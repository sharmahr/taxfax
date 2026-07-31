import { useCallback, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  RotateCcw,
  UploadCloud,
} from 'lucide-react';
import { collection, query, where } from 'firebase/firestore';
import {
  ENTITY_TYPE_LABEL,
  paths,
  type Client,
  type EntityType,
  type FilingStatus,
} from '@taxfax/shared';
import { db } from '@/lib/firebase';
import { useCollection } from '@/lib/firestore';
import { firebaseErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/Button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { StatusPill } from '@/components/ui/StatusPill';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { Tooltip } from '@/components/ui/Tooltip';
import { toast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import { importClients, type ImportResult } from '@/components/settings/api';
import {
  buildPreview,
  delimiterName,
  IMPORT_FIELDS,
  inferMapping,
  normEmail,
  parseCsv,
  readFileText,
  toPayload,
  type FieldMapping,
  type ParsedCsv,
  type PreviewRow,
  type RowOutcome,
} from '@/components/onboarding/csv';

const PREVIEW_ROWS = 8;
const NONE = 'none';

/**
 * The preview table is dense, so Type and Filing render as the short forms a
 * preparer already reads — the federal form number and the filing-status
 * abbreviation — instead of the long labels, which wrapped and pushed the
 * all-important status column off the edge. TS enforces every case.
 */
const ENTITY_FORM: Record<EntityType, string> = {
  individual: '1040',
  partnership: '1065',
  's-corp': '1120-S',
  'c-corp': '1120',
  trust: '1041',
  nonprofit: '990',
};
const FILING_SHORT: Record<FilingStatus, string> = {
  single: 'Single',
  mfj: 'MFJ',
  mfs: 'MFS',
  hoh: 'HOH',
  qw: 'QW',
  entity: '—',
};

/**
 * `buildPreview` only sees the file, so it can flag a row that repeats *inside*
 * the CSV but not one that is already a client. The second thing every firm
 * does is fix one row and upload the same list again, and at that moment the
 * only question worth answering is "what will this actually do to my roster?".
 * The server matches on email within the season, so the preview matches the
 * same way — otherwise it promises eleven imports and performs none.
 */
type PreviewOutcome = RowOutcome | 'existing';
type MarkedRow = Omit<PreviewRow, 'outcome'> & { outcome: PreviewOutcome };

function markExisting(rows: PreviewRow[], existingEmails: Set<string>): MarkedRow[] {
  return rows.map((r) =>
    r.email && existingEmails.has(r.email) ? { ...r, outcome: 'existing' as const } : r,
  );
}

interface ImportStats {
  /** Rows that will become new clients — the number the button may claim. */
  create: number;
  existing: number;
  duplicate: number;
  error: number;
}

function tally(rows: MarkedRow[]): ImportStats {
  const stats: ImportStats = { create: 0, existing: 0, duplicate: 0, error: 0 };
  for (const r of rows) {
    if (r.outcome === 'ready') stats.create++;
    else if (r.outcome === 'existing') stats.existing++;
    else if (r.outcome === 'duplicate') stats.duplicate++;
    else stats.error++;
  }
  return stats;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function ImportClients({
  firmId,
  taxYear,
  canImport,
  onImported,
}: {
  firmId: string;
  taxYear: number;
  canImport: boolean;
  onImported?: (result: ImportResult) => void;
}) {
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const preview = useMemo(
    () => (parsed ? buildPreview(parsed.rows, mapping) : []),
    [parsed, mapping],
  );

  // The roster this file is about to land in. Read live, because the truthful
  // answer to "how many will this import?" depends on who is already here.
  const roster = useCollection<Client>(
    firmId ? query(collection(db, paths.clients(firmId)), where('taxYear', '==', taxYear)) : null,
  );
  const existingEmails = useMemo(() => {
    const emails = new Set<string>();
    for (const c of roster.data) {
      const email = normEmail(c.primaryContact?.email ?? '');
      if (email) emails.add(email);
    }
    return emails;
  }, [roster.data]);

  const rows = useMemo(() => markExisting(preview, existingEmails), [preview, existingEmails]);
  const stats = useMemo(() => tally(rows), [rows]);
  const nameMapped = mapping.displayName !== undefined;
  const checkingRoster = roster.loading;

  const handleFile = useCallback(async (file: File) => {
    setParseError(null);
    setResult(null);
    setFileName(file.name);
    try {
      const text = await readFileText(file);
      const csv = parseCsv(text);
      if (csv.headers.length === 0 || csv.rows.length === 0) {
        setParsed(null);
        setParseError(
          "We couldn't find any rows in that file. Export it as CSV from your tax software and try again.",
        );
        return;
      }
      setParsed(csv);
      setMapping(inferMapping(csv.headers));
    } catch {
      setParsed(null);
      setParseError('That file could not be read. A plain CSV export works best.');
    }
  }, []);

  function reset() {
    setParsed(null);
    setMapping({});
    setFileName('');
    setParseError(null);
    setResult(null);
  }

  async function commit() {
    // Only the rows we promised to create. The server dedupes again against the
    // roster, so a client added by a teammate mid-upload is still safe.
    const payload = toPayload(rows.filter((r) => r.outcome === 'ready') as PreviewRow[]);
    if (payload.length === 0) return;
    setImporting(true);
    try {
      const res = await importClients({ firmId, taxYear, rows: payload });
      setResult(res);
      onImported?.(res);
      if (res.created > 0) {
        toast.success(`Imported ${plural(res.created, 'client', 'clients')}.`);
      } else {
        toast.success('Everyone in that file was already in your workspace.');
      }
    } catch (err) {
      toast.error(firebaseErrorMessage(err));
    } finally {
      setImporting(false);
    }
  }

  if (result) {
    return <ImportSummary result={result} fileName={fileName} onReset={reset} />;
  }

  if (!parsed) {
    return (
      <DropZone
        dragging={dragging}
        setDragging={setDragging}
        onFile={handleFile}
        error={parseError}
        disabled={!canImport}
      />
    );
  }

  const columnOptions = parsed.headers.map((h, i) => ({
    value: String(i),
    label: h || `Column ${i + 1}`,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <FileSpreadsheet className="size-5 shrink-0 text-ink-faint" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{fileName}</p>
            <p className="text-2xs text-ink-faint">
              <span className="tabular-nums">{parsed.rows.length}</span>{' '}
              {parsed.rows.length === 1 ? 'row' : 'rows'} · {delimiterName(parsed.delimiter)}-separated
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={reset}>
          <RotateCcw className="size-4" />
          Choose another file
        </Button>
      </div>

      <section aria-label="Column mapping" className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">Match your columns</h3>
          <p className="mt-0.5 text-2xs text-ink-faint">
            We've guessed these from your headers. Fix any that look wrong — the preview updates as
            you go.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {IMPORT_FIELDS.map((spec) => {
            const current = mapping[spec.key];
            const unmappedRequired = spec.required && current === undefined;
            return (
              <div key={spec.key} className="min-w-0">
                <div className="mb-1 flex items-baseline gap-1.5">
                  <span className="text-2xs font-medium text-ink">{spec.label}</span>
                  {spec.required ? (
                    <span className="text-2xs text-stamp-ink">required</span>
                  ) : null}
                </div>
                <Select
                  value={current === undefined ? NONE : String(current)}
                  onValueChange={(v) =>
                    setMapping((prev) => {
                      const next = { ...prev };
                      if (v === NONE) delete next[spec.key];
                      else next[spec.key] = Number(v);
                      return next;
                    })
                  }
                >
                  <SelectTrigger
                    aria-label={`Column for ${spec.label}`}
                    aria-invalid={unmappedRequired || undefined}
                    className={cn(unmappedRequired && 'border-status-danger')}
                  >
                    <SelectValue placeholder="Don't import" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Don't import</SelectItem>
                    {columnOptions.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-2xs leading-relaxed text-ink-faint">
                  {unmappedRequired ? (
                    <span className="text-status-danger">
                      Pick the column with your client names to continue.
                    </span>
                  ) : (
                    spec.hint
                  )}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-label="Preview" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">Preview</h3>
          <StatsRibbon stats={stats} />
        </div>

        {/* Mobile: a stacked list. A six-column table can't breathe on a phone,
            and the status must never scroll out of view, so we show cards here
            and the full table from `sm` up. */}
        <ul className="space-y-2 sm:hidden">
          {rows.slice(0, PREVIEW_ROWS).map((row) => (
            <PreviewCardView key={row.index} row={row} />
          ))}
        </ul>

        <div className="hidden overflow-x-auto rounded-lg border border-line sm:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="hidden sm:table-cell">Phone</TableHead>
                <TableHead className="hidden md:table-cell">Type</TableHead>
                <TableHead className="hidden md:table-cell">Filing</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, PREVIEW_ROWS).map((row) => (
                <PreviewRowView key={row.index} row={row} />
              ))}
            </TableBody>
          </Table>
        </div>
        {rows.length > PREVIEW_ROWS ? (
          <p className="text-2xs text-ink-faint">
            Showing the first {PREVIEW_ROWS} of{' '}
            <span className="tabular-nums">{rows.length}</span> rows.
          </p>
        ) : null}

        <FlaggedRows rows={rows} />
      </section>

      <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-2xs leading-relaxed text-ink-faint">
          <CheckCircle2 className="mr-1 inline size-3.5 align-[-2px] text-status-success" />
          {outcomeSentence(stats, checkingRoster)}
        </p>
        <Button
          variant="primary"
          onClick={commit}
          loading={importing}
          disabled={!canImport || !nameMapped || checkingRoster || stats.create === 0}
          className="shrink-0"
        >
          {stats.create > 0 ? `Import ${plural(stats.create, 'client', 'clients')}` : 'Nothing to import'}
        </Button>
      </div>
      {!canImport ? (
        <p className="text-2xs text-status-warn">
          Your role can't import clients. Ask an owner, admin, or preparer to run this.
        </p>
      ) : null}
    </div>
  );
}

function DropZone({
  dragging,
  setDragging,
  onFile,
  error,
  disabled,
}: {
  dragging: boolean;
  setDragging: (v: boolean) => void;
  onFile: (file: File) => void;
  error: string | null;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file && !disabled) onFile(file);
        }}
        className={cn(
          'flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center',
          'transition-colors duration-100 ease-out-quint',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20',
          disabled && 'cursor-not-allowed opacity-60',
          dragging
            ? 'border-ink bg-surface-sunken'
            : 'border-line-strong bg-surface hover:bg-surface-sunken/50',
        )}
      >
        <span className="inline-flex size-11 items-center justify-center rounded-lg bg-surface-sunken text-ink-faint">
          <UploadCloud className="size-5" />
        </span>
        <span>
          <span className="block text-sm font-medium text-ink">
            Drop a CSV here, or click to choose
          </span>
          <span className="mt-1 block text-2xs text-ink-faint">
            Straight from Lacerte, Drake, UltraTax, ProSeries — or any spreadsheet.
          </span>
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv,.txt,text/plain,application/vnd.ms-excel"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
      {error ? (
        <p className="mt-3 flex items-start gap-1.5 text-2xs text-status-danger">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      ) : (
        <p className="mt-3 text-2xs text-ink-faint">
          We read the file in your browser — nothing uploads until you approve the preview. We match
          on email, so importing the same list twice is safe.
        </p>
      )}
    </div>
  );
}

function PreviewRowView({ row }: { row: MarkedRow }) {
  const warnings = row.issues.filter((i) => i.level === 'warn');
  return (
    <TableRow className={cn(row.outcome === 'error' && 'opacity-55')}>
      <TableCell className="font-medium text-ink">{row.displayName || '—'}</TableCell>
      <TableCell className={cn('text-ink-muted', !row.email && row.emailRaw && 'text-status-warn')}>
        {row.email ?? (row.emailRaw ? row.emailRaw : '—')}
      </TableCell>
      <TableCell className={cn('hidden text-ink-muted sm:table-cell', !row.phone && row.phoneRaw && 'text-status-warn')}>
        {row.phone ?? (row.phoneRaw ? row.phoneRaw : '—')}
      </TableCell>
      <TableCell className="hidden whitespace-nowrap text-ink-muted md:table-cell">
        <Tooltip content={ENTITY_TYPE_LABEL[row.entityType]}>
          <span tabIndex={0} className="tabular-nums">{ENTITY_FORM[row.entityType]}</span>
        </Tooltip>
      </TableCell>
      <TableCell className="hidden whitespace-nowrap text-ink-muted md:table-cell">
        {row.filingStatus ? FILING_SHORT[row.filingStatus] : '—'}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1.5">
          {warnings.length > 0 ? (
            <Tooltip content={warnings.map((w) => w.message).join(' ')}>
              <span tabIndex={0} className="rounded text-status-warn">
                <AlertTriangle className="size-3.5" aria-label="Warning" />
              </span>
            </Tooltip>
          ) : null}
          <RowStatus outcome={row.outcome} />
        </div>
      </TableCell>
    </TableRow>
  );
}

function PreviewCardView({ row }: { row: MarkedRow }) {
  const warnings = row.issues.filter((i) => i.level === 'warn');
  const detail = [
    ENTITY_TYPE_LABEL[row.entityType],
    row.filingStatus ? FILING_SHORT[row.filingStatus] : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <li
      className={cn(
        'rounded-lg border border-line bg-surface px-3.5 py-3',
        row.outcome === 'error' && 'opacity-55',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-sm font-medium text-ink">{row.displayName || '—'}</p>
        <div className="flex shrink-0 items-center gap-1.5">
          {warnings.length > 0 ? (
            <span className="text-status-warn">
              <AlertTriangle className="size-3.5" aria-label="Warning" />
            </span>
          ) : null}
          <RowStatus outcome={row.outcome} />
        </div>
      </div>
      <p
        className={cn(
          'mt-0.5 truncate text-2xs',
          !row.email && row.emailRaw ? 'text-status-warn' : 'text-ink-faint',
        )}
      >
        {row.email ?? (row.emailRaw ? row.emailRaw : 'No email')}
      </p>
      {detail ? <p className="mt-1 text-2xs text-ink-faint">{detail}</p> : null}
    </li>
  );
}

function RowStatus({ outcome }: { outcome: PreviewOutcome }) {
  if (outcome === 'existing') {
    return <StatusPill tone="neutral">Already here</StatusPill>;
  }
  if (outcome === 'duplicate') {
    return (
      <StatusPill tone="warn" dot>
        Repeated row
      </StatusPill>
    );
  }
  if (outcome === 'error') {
    return (
      <StatusPill tone="danger" dot>
        Skip
      </StatusPill>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-2xs text-ink-faint">
      <CheckCircle2 className="size-3.5 text-status-success" />
      New
    </span>
  );
}

/** The one sentence under the preview: what pressing the button will do. */
function outcomeSentence(stats: ImportStats, checkingRoster: boolean): string {
  if (checkingRoster) return 'Checking these against the clients you already have…';

  const untouched = stats.existing + stats.duplicate;
  if (stats.create === 0) {
    if (stats.existing > 0) {
      return stats.existing === 1
        ? 'That client is already in your workspace. Nothing to import — your roster is up to date.'
        : `All ${stats.existing} of these clients are already in your workspace. Nothing to import — your roster is up to date.`;
    }
    return 'No row in this file can become a client — check the column mapping above.';
  }
  if (untouched > 0) {
    return `${plural(stats.create, 'client is', 'clients are')} new. The other ${plural(untouched, 'row', 'rows')} ${untouched === 1 ? 'is' : 'are'} already in your workspace and will be left alone.`;
  }
  return 'Safe to run twice — we match on email, so re-uploading this file changes nothing.';
}

function StatsRibbon({ stats }: { stats: ImportStats }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-ink-faint">
      <span className="tabular-nums text-ink-muted">
        <span className="font-medium text-ink">{stats.create}</span> new
      </span>
      {stats.existing > 0 ? (
        <span className="tabular-nums">
          <span className="font-medium text-ink-muted">{stats.existing}</span> already here
        </span>
      ) : null}
      {stats.duplicate > 0 ? (
        <span className="tabular-nums">
          <span className="font-medium text-status-warn">{stats.duplicate}</span> repeated
        </span>
      ) : null}
      {stats.error > 0 ? (
        <span className="tabular-nums">
          <span className="font-medium text-status-danger">{stats.error}</span> skipped
        </span>
      ) : null}
    </div>
  );
}

function FlaggedRows({ rows }: { rows: MarkedRow[] }) {
  const flagged = rows.filter((r) => r.issues.length > 0);
  if (flagged.length === 0) return null;

  return (
    <details className="group rounded-lg border border-line bg-surface-sunken/40 px-3.5 py-2.5">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-2xs font-medium text-ink-muted">
        <AlertTriangle className="size-3.5 text-status-warn" />
        {flagged.length} {flagged.length === 1 ? 'row needs' : 'rows need'} a look
        <span className="ml-auto text-ink-faint transition-transform group-open:rotate-90">›</span>
      </summary>
      <ul className="mt-2 space-y-1.5 border-t border-line pt-2">
        {flagged.slice(0, 12).map((r) => (
          <li key={r.index} className="text-2xs leading-relaxed text-ink-faint">
            <span className="font-medium text-ink-muted">Row {r.index + 2}</span>
            {r.displayName ? ` · ${r.displayName}` : ''} — {r.issues.map((i) => i.message).join(' ')}
          </li>
        ))}
        {flagged.length > 12 ? (
          <li className="text-2xs text-ink-faint">…and {flagged.length - 12} more.</li>
        ) : null}
      </ul>
    </details>
  );
}

function ImportSummary({
  result,
  fileName,
  onReset,
}: {
  result: ImportResult;
  fileName: string;
  onReset: () => void;
}) {
  const nothingNew = result.created === 0;
  return (
    <div className="rounded-xl border border-line bg-surface p-6">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-status-success-wash text-status-success">
          <CheckCircle2 className="size-5" />
        </span>
        <div className="min-w-0">
          <h3 className="display text-xl text-ink">
            {nothingNew ? 'Already up to date' : `Imported ${result.created} clients`}
          </h3>
          <p className="mt-1 text-pretty text-2xs leading-relaxed text-ink-muted">
            {nothingNew ? (
              <>
                Everyone in <span className="font-medium text-ink-muted">{fileName}</span> was
                already in your workspace — nothing was duplicated.
              </>
            ) : (
              <>
                From <span className="font-medium text-ink-muted">{fileName}</span>.
                {result.skipped > 0 ? (
                  <> {result.skipped} {result.skipped === 1 ? 'was' : 'were'} skipped as duplicates or already present.</>
                ) : null}
              </>
            )}
          </p>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-5">
        <Stat label="Imported" value={result.created} tone="ink" />
        <Stat label="Skipped" value={result.skipped} tone="muted" />
        <Stat label="Errors" value={result.errors.length} tone={result.errors.length ? 'danger' : 'muted'} />
      </dl>

      {result.errors.length > 0 ? (
        <ul className="mt-4 space-y-1 rounded-lg border border-line bg-surface-sunken/50 px-3.5 py-2.5">
          {result.errors.slice(0, 8).map((e) => (
            <li key={e.row} className="text-2xs leading-relaxed text-ink-faint">
              <span className="font-medium text-ink-muted">Row {e.row + 1}</span> — {e.reason}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-5 flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onReset}>
          <UploadCloud className="size-4" />
          Import another file
        </Button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'ink' | 'muted' | 'danger';
}) {
  return (
    <div>
      <dd
        className={cn(
          'display text-2xl tabular-nums',
          tone === 'ink' && 'text-ink',
          tone === 'muted' && 'text-ink-muted',
          tone === 'danger' && 'text-status-danger',
        )}
      >
        {value}
      </dd>
      <dt className="mt-0.5 text-2xs text-ink-faint">{label}</dt>
    </div>
  );
}
