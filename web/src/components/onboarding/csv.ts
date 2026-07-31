import Papa from 'papaparse';
import {
  ENTITY_TYPE_LABEL,
  FILING_STATUS_LABEL,
  type EntityType,
  type FilingStatus,
} from '@taxfax/shared';

/**
 * Browser-side CSV ingest for the client import. Everything the taxpayer roster
 * needs happens here, in the tab, before a single row is sent: encoding
 * detection, delimiter sniffing, header→field inference, and the same field
 * validation the `importClients` callable runs — so the preview tells the truth
 * about what the server will do rather than guessing.
 *
 * ponytail: the four validators below (email/phone/name/tags) mirror
 * functions/src/lib/validate.ts exactly. They live in Cloud Functions, not the
 * shared package, so they can't be imported; the preview would lie without them.
 */

// ── The fields importClients accepts ─────────────────────────────────────────
export type ImportField =
  | 'displayName'
  | 'email'
  | 'phone'
  | 'entityType'
  | 'filingStatus'
  | 'tags'
  | 'assignedTo';

export interface FieldSpec {
  key: ImportField;
  label: string;
  required: boolean;
  hint: string;
  /** Header tokens that identify this column, strongest first. */
  aliases: string[];
}

export const IMPORT_FIELDS: FieldSpec[] = [
  {
    key: 'displayName',
    label: 'Client name',
    required: true,
    hint: 'The only field we truly need to start.',
    aliases: [
      'clientname', 'displayname', 'taxpayername', 'taxpayer', 'fullname', 'name',
      'client', 'contactname', 'primarycontact', 'accountname',
    ],
  },
  {
    key: 'email',
    label: 'Email',
    required: false,
    hint: 'Where reminders and the portal link are sent. We dedupe on this.',
    aliases: ['emailaddress', 'email', 'e-mail', 'emailid', 'primaryemail', 'workemail'],
  },
  {
    key: 'phone',
    label: 'Phone',
    required: false,
    hint: 'US numbers are assumed unless a country code is present. Enables SMS.',
    aliases: ['phonenumber', 'mobile', 'cell', 'cellphone', 'phone', 'telephone', 'primaryphone', 'contactnumber'],
  },
  {
    key: 'entityType',
    label: 'Entity / return type',
    required: false,
    hint: '1040, 1065, 1120-S… we read it from whatever your software wrote.',
    aliases: ['entitytype', 'entity', 'returntype', 'formtype', 'form', 'clienttype', 'type'],
  },
  {
    key: 'filingStatus',
    label: 'Filing status',
    required: false,
    hint: 'Single, MFJ, HOH… mapped from free text.',
    aliases: ['filingstatus', 'filing', 'maritalstatus', 'status'],
  },
  {
    key: 'tags',
    label: 'Tags',
    required: false,
    hint: 'Semicolon- or comma-separated. Becomes filterable labels.',
    aliases: ['tags', 'tag', 'labels', 'label', 'groups', 'group', 'segment', 'category'],
  },
  {
    key: 'assignedTo',
    label: 'Assign to',
    required: false,
    hint: "A teammate's email. Unrecognized names are left unassigned.",
    aliases: ['assignedto', 'assigned', 'assignee', 'preparer', 'staff', 'manager', 'owner', 'partner'],
  },
];

export type FieldMapping = Partial<Record<ImportField, number>>;

// ── Server-mirrored validators ───────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_RE = /^\+[1-9]\d{7,14}$/;

export function normEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (email.length === 0 || email.length > 254) return null;
  return EMAIL_RE.test(email) ? email : null;
}

export function normPhone(value: string): string | null {
  const raw = value.trim();
  if (raw.length === 0) return null;
  const hadPlus = raw.startsWith('+');
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length === 0) return null;
  let e164: string;
  if (hadPlus) e164 = `+${digits}`;
  else if (digits.length === 10) e164 = `+1${digits}`;
  else if (digits.length === 11 && digits.startsWith('1')) e164 = `+${digits}`;
  else e164 = `+${digits}`;
  return E164_RE.test(e164) ? e164 : null;
}

export function cleanName(value: string, min = 1, max = 200): string | null {
  const name = value.replace(/\s+/g, ' ').trim();
  if (name.length < min || name.length > max) return null;
  return name;
}

export function normTags(value: string, maxTags = 25, maxLen = 40): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of value.split(/[;,]/)) {
    const tag = part.replace(/\s+/g, ' ').trim().slice(0, maxLen);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= maxTags) break;
  }
  return out;
}

// ── Entity / filing coercion (mirrors functions/src/firm/clients.ts) ─────────
export function coerceEntity(raw: string): EntityType {
  const s = raw.toLowerCase();
  if (/1120-?s|s-?corp|s corp|subchapter s/.test(s)) return 's-corp';
  if (/1120|c-?corp|c corp/.test(s)) return 'c-corp';
  if (/1065|partnership|llc|partners|\blp\b|llp/.test(s)) return 'partnership';
  if (/1041|trust|estate|fiduciary/.test(s)) return 'trust';
  if (/990|non-?profit|not-for-profit|exempt|charity/.test(s)) return 'nonprofit';
  return 'individual';
}

export function coerceFiling(raw: string): FilingStatus | undefined {
  const s = raw.toLowerCase().replace(/[^a-z ]/g, '');
  if (/mfj|married filing joint|joint/.test(s)) return 'mfj';
  if (/mfs|married filing separate|separate/.test(s)) return 'mfs';
  if (/hoh|head of house/.test(s)) return 'hoh';
  if (/qw|widow|surviving spouse/.test(s)) return 'qw';
  if (/single/.test(s)) return 'single';
  if (/entity|business|corp|partnership/.test(s)) return 'entity';
  return undefined;
}

export const ENTITY_OPTIONS = Object.entries(ENTITY_TYPE_LABEL) as [EntityType, string][];
export const FILING_OPTIONS = Object.entries(FILING_STATUS_LABEL) as [FilingStatus, string][];

// ── File reading (encoding-aware) ────────────────────────────────────────────
/**
 * Reads a File to text, honouring the byte-order mark Excel loves to emit —
 * including its habit of exporting "CSV" as UTF-16. Without this a UTF-16 export
 * parses as one column of mojibake.
 */
export async function readFileText(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let encoding = 'utf-8';
  let offset = 0;
  if (buf[0] === 0xff && buf[1] === 0xfe) {
    encoding = 'utf-16le';
    offset = 2;
  } else if (buf[0] === 0xfe && buf[1] === 0xff) {
    encoding = 'utf-16be';
    offset = 2;
  } else if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    offset = 3; // UTF-8 BOM
  }
  const text = new TextDecoder(encoding).decode(buf.subarray(offset));
  // A stray leading BOM can survive some decoders; strip it defensively.
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  delimiter: string;
}

const DELIMITER_LABEL: Record<string, string> = {
  ',': 'comma',
  '\t': 'tab',
  ';': 'semicolon',
  '|': 'pipe',
};

export function delimiterName(delimiter: string): string {
  return DELIMITER_LABEL[delimiter] ?? 'auto-detected';
}

/**
 * Parses raw CSV text. papaparse sniffs the delimiter, honours quoted commas
 * and CRLF, and gives us a header row plus body. If a first/last split is the
 * only name signal, a combined "Full name" column is synthesised so the mapping
 * has a single name column to point at (Drake and UltraTax both export split).
 */
export function parseCsv(text: string): ParsedCsv {
  const result = Papa.parse<string[]>(text, {
    skipEmptyLines: 'greedy',
    delimiter: '',
  });
  const table = (result.data as string[][]).filter((r) => r.length > 0);
  if (table.length === 0) return { headers: [], rows: [], delimiter: result.meta.delimiter ?? ',' };

  const headers = (table[0] ?? []).map((h) => (h ?? '').trim());
  const rows = table.slice(1).map((r) => headers.map((_, i) => (r[i] ?? '').trim()));
  const withName = synthesizeName(headers, rows);
  return { ...withName, delimiter: result.meta.delimiter ?? ',' };
}

/** If the sheet splits first/last and has no single-name column, build one. */
function synthesizeName(
  headers: string[],
  rows: string[][],
): { headers: string[]; rows: string[][] } {
  const norm = headers.map(normalizeHeader);
  const hasFull = norm.some((h) => ['name', 'clientname', 'fullname', 'taxpayername', 'displayname'].includes(h));
  if (hasFull) return { headers, rows };

  const firstIdx = norm.findIndex((h) => ['firstname', 'first', 'givenname', 'fname'].includes(h));
  const lastIdx = norm.findIndex((h) => ['lastname', 'last', 'surname', 'familyname', 'lname'].includes(h));
  if (firstIdx === -1 || lastIdx === -1) return { headers, rows };

  const newHeaders = [...headers, 'Full name'];
  const newRows = rows.map((r) => {
    const full = `${r[firstIdx] ?? ''} ${r[lastIdx] ?? ''}`.trim();
    return [...r, full];
  });
  return { headers: newHeaders, rows: newRows };
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Infers a header→field mapping. Exact alias match wins over a contains match,
 * and each column is claimed by at most one field so two near-synonyms don't
 * both grab the same column.
 */
export function inferMapping(headers: string[]): FieldMapping {
  const norm = headers.map(normalizeHeader);
  const taken = new Set<number>();
  const mapping: FieldMapping = {};

  const claim = (field: ImportField, predicate: (h: string) => boolean) => {
    if (mapping[field] !== undefined) return;
    const idx = norm.findIndex((h, i) => !taken.has(i) && h.length > 0 && predicate(h));
    if (idx !== -1) {
      mapping[field] = idx;
      taken.add(idx);
    }
  };

  // Pass 1: exact alias equality.
  for (const spec of IMPORT_FIELDS) {
    claim(spec.key, (h) => spec.aliases.includes(h));
  }
  // Pass 2: contains, longest aliases first so "emailaddress" beats a bare "id".
  for (const spec of IMPORT_FIELDS) {
    const sorted = [...spec.aliases].sort((a, b) => b.length - a.length);
    claim(spec.key, (h) => sorted.some((a) => a.length >= 4 && h.includes(a)));
  }
  return mapping;
}

// ── Row model + validation ───────────────────────────────────────────────────
export type RowOutcome = 'ready' | 'duplicate' | 'error';

export interface RowIssue {
  field: ImportField;
  level: 'error' | 'warn';
  message: string;
}

export interface PreviewRow {
  index: number;
  displayName: string;
  email: string | null;
  emailRaw: string;
  phone: string | null;
  phoneRaw: string;
  entityType: EntityType;
  filingStatus?: FilingStatus;
  tags: string[];
  assignedTo?: string;
  outcome: RowOutcome;
  issues: RowIssue[];
}

function cell(row: string[], mapping: FieldMapping, field: ImportField): string {
  const idx = mapping[field];
  return idx === undefined ? '' : (row[idx] ?? '');
}

/** Turns parsed rows + a mapping into validated preview rows. */
export function buildPreview(rows: string[][], mapping: FieldMapping): PreviewRow[] {
  const seenEmail = new Set<string>();
  return rows.map((row, index) => {
    const issues: RowIssue[] = [];

    const nameRaw = cell(row, mapping, 'displayName');
    const displayName = cleanName(nameRaw) ?? '';
    if (!displayName) {
      issues.push({ field: 'displayName', level: 'error', message: 'No name — this row will be skipped.' });
    }

    const emailRaw = cell(row, mapping, 'email');
    const email = emailRaw ? normEmail(emailRaw) : null;
    if (emailRaw && !email) {
      issues.push({ field: 'email', level: 'warn', message: "Email looks off — imported without it, so they can't be chased yet." });
    }

    const phoneRaw = cell(row, mapping, 'phone');
    const phone = phoneRaw ? normPhone(phoneRaw) : null;
    if (phoneRaw && !phone) {
      issues.push({ field: 'phone', level: 'warn', message: 'Phone isn’t dialable — imported without it, so no SMS.' });
    }

    const entityText = cell(row, mapping, 'entityType');
    const entityType = coerceEntity(entityText);
    const filingText = cell(row, mapping, 'filingStatus');
    const filingStatus = coerceFiling(filingText) ?? (entityType === 'individual' ? undefined : 'entity');
    const tags = normTags(cell(row, mapping, 'tags'));
    const assignedRaw = cell(row, mapping, 'assignedTo').trim();
    const assignedTo = assignedRaw || undefined;

    let outcome: RowOutcome = 'ready';
    if (!displayName) {
      outcome = 'error';
    } else if (email) {
      if (seenEmail.has(email)) {
        outcome = 'duplicate';
        issues.push({ field: 'email', level: 'warn', message: 'Duplicate of an earlier row — only the first is imported.' });
      } else {
        seenEmail.add(email);
      }
    }

    return {
      index, displayName, email, emailRaw, phone, phoneRaw,
      entityType, filingStatus, tags, assignedTo, outcome, issues,
    };
  });
}

export interface ImportRowPayload {
  displayName: string;
  email?: string;
  phone?: string;
  entityType: EntityType;
  filingStatus?: FilingStatus;
  tags?: string[];
  assignedTo?: string;
}

/**
 * The payload sent to importClients. Rows with no name are dropped (the server
 * would reject them anyway); duplicates are kept because the server dedupes both
 * within the batch and against clients already in the firm, so re-running is a
 * no-op. Sending raw-ish values lets the server stay the single source of truth.
 */
export function toPayload(rows: PreviewRow[]): ImportRowPayload[] {
  return rows
    .filter((r) => r.outcome !== 'error')
    .map((r) => ({
      displayName: r.displayName,
      ...(r.emailRaw ? { email: r.emailRaw } : {}),
      ...(r.phoneRaw ? { phone: r.phoneRaw } : {}),
      entityType: r.entityType,
      ...(r.filingStatus ? { filingStatus: r.filingStatus } : {}),
      ...(r.tags.length ? { tags: r.tags } : {}),
      ...(r.assignedTo ? { assignedTo: r.assignedTo } : {}),
    }));
}

export interface PreviewStats {
  ready: number;
  duplicate: number;
  error: number;
  warnings: number;
  total: number;
}

export function summarize(rows: PreviewRow[]): PreviewStats {
  let ready = 0;
  let duplicate = 0;
  let error = 0;
  let warnings = 0;
  for (const r of rows) {
    if (r.outcome === 'ready') ready++;
    else if (r.outcome === 'duplicate') duplicate++;
    else error++;
    if (r.issues.some((i) => i.level === 'warn')) warnings++;
  }
  return { ready, duplicate, error, warnings, total: rows.length };
}
