import { useMemo } from 'react';
import { collection, collectionGroup, orderBy, query, where } from 'firebase/firestore';
import { paths, type ChaseMessage, type Client, type ClientChaseState, type Contact } from '@taxfax/shared';
import { db } from '@/lib/firebase';
import { useCollection } from '@/lib/firestore';
import { toDate } from '@/lib/format';

export type ClientDoc = Client & { id: string };
export type ChaseMessageDoc = ChaseMessage & { id: string };

export type ChaseTab = 'scheduled' | 'attention' | 'paused' | 'sent';
export type AttentionReason = 'bounced' | 'no_channel' | 'opted_out' | 'escalated' | 'delivery_failed';

export interface ChaseRow {
  client: ClientDoc;
  status: ClientChaseState['status'];
  stepIndex: number;
  nextDueAt: Date | null;
  lastSentAt: Date | null;
  lastOpenedAt: Date | null;
  reachable: boolean;
  emailSuppressed: boolean;
  smsSuppressed: boolean;
  bounced: boolean;
  hasFailure: boolean;
  outstanding: number;
  attention: AttentionReason | null;
}

export interface ChaseData {
  loading: boolean;
  error: boolean;
  rows: ChaseRow[];
  byId: Map<string, ChaseRow>;
  byTab: Record<ChaseTab, ChaseRow[]>;
  counts: Record<ChaseTab, number>;
  activeCount: number;
  messagesByClient: Map<string, ChaseMessageDoc[]>;
}

const ATTENTION_ORDER: Record<AttentionReason, number> = {
  bounced: 0,
  delivery_failed: 1,
  no_channel: 2,
  opted_out: 3,
  escalated: 4,
};

function suppression(c: Contact | undefined) {
  const emailSuppressed = !c?.email || c.emailOptOut === true;
  const smsSuppressed = !c?.phone || c.smsOptOut === true;
  const optedOut = c?.emailOptOut === true || c?.smsOptOut === true;
  return { emailSuppressed, smsSuppressed, reachable: !(emailSuppressed && smsSuppressed), optedOut };
}

function ts(v: ClientChaseState['nextDueAt']): Date | null {
  return v ? toDate(v) : null;
}

export function useChaseData(firmId: string | null): ChaseData {
  const clients = useCollection<ClientDoc>(
    firmId ? query(collection(db, paths.clients(firmId)), orderBy('sortName')) : null,
  );

  // Firm-wide delivery history. Best-effort: if the collection-group read isn't
  // permitted, the console still runs entirely off client chase state.
  const messages = useCollection<ChaseMessageDoc>(
    firmId ? query(collectionGroup(db, 'chaseMessages'), where('firmId', '==', firmId)) : null,
  );

  const messagesByClient = useMemo(() => {
    const map = new Map<string, ChaseMessageDoc[]>();
    for (const m of messages.data) {
      const list = map.get(m.clientId) ?? [];
      list.push(m);
      map.set(m.clientId, list);
    }
    for (const list of map.values()) list.sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime());
    return map;
  }, [messages.data]);

  const failedClientIds = useMemo(() => {
    const set = new Set<string>();
    for (const m of messages.data) if (m.status === 'failed') set.add(m.clientId);
    return set;
  }, [messages.data]);

  const rows = useMemo<ChaseRow[]>(() => {
    return clients.data.map((client) => {
      const chase = client.chase;
      const { emailSuppressed, smsSuppressed, reachable, optedOut } = suppression(client.primaryContact);
      const bounced = /bounc/i.test(chase.pausedReason ?? '');
      const hasFailure = failedClientIds.has(client.id);
      const inPlay = chase.status === 'active' || chase.status === 'escalated' || chase.status === 'paused';

      let attention: AttentionReason | null = null;
      if (inPlay) {
        if (bounced) attention = 'bounced';
        else if (hasFailure) attention = 'delivery_failed';
        else if (!reachable) attention = optedOut ? 'opted_out' : 'no_channel';
        else if (chase.status === 'escalated') attention = 'escalated';
      }

      return {
        client,
        status: chase.status,
        stepIndex: chase.stepIndex,
        nextDueAt: ts(chase.nextDueAt),
        lastSentAt: ts(chase.lastSentAt),
        lastOpenedAt: ts(chase.lastOpenedAt),
        reachable,
        emailSuppressed,
        smsSuppressed,
        bounced,
        hasFailure,
        outstanding: Math.max(0, client.progress.total - client.progress.accepted),
        attention,
      };
    });
  }, [clients.data, failedClientIds]);

  const byId = useMemo(() => new Map(rows.map((r) => [r.client.id, r] as const)), [rows]);

  const byTab = useMemo<Record<ChaseTab, ChaseRow[]>>(() => {
    const scheduled = rows
      .filter((r) => r.status === 'active' && r.attention === null)
      .sort((a, b) => (a.nextDueAt?.getTime() ?? Infinity) - (b.nextDueAt?.getTime() ?? Infinity));
    const attention = rows
      .filter((r) => r.attention !== null)
      .sort((a, b) => ATTENTION_ORDER[a.attention!] - ATTENTION_ORDER[b.attention!]);
    const paused = rows
      .filter((r) => r.status === 'paused')
      .sort((a, b) => a.client.sortName.localeCompare(b.client.sortName));
    const cutoff = Date.now() - 12 * 24 * 60 * 60 * 1000;
    const sent = rows
      .filter((r) => r.lastSentAt && r.lastSentAt.getTime() >= cutoff)
      .sort((a, b) => (b.lastSentAt?.getTime() ?? 0) - (a.lastSentAt?.getTime() ?? 0));
    return { scheduled, attention, paused, sent };
  }, [rows]);

  const counts = useMemo<Record<ChaseTab, number>>(
    () => ({
      scheduled: byTab.scheduled.length,
      attention: byTab.attention.length,
      paused: byTab.paused.length,
      sent: byTab.sent.length,
    }),
    [byTab],
  );

  const activeCount = useMemo(
    () => rows.filter((r) => r.status === 'active' || r.status === 'escalated').length,
    [rows],
  );

  return {
    loading: clients.loading && clients.data.length === 0,
    error: Boolean(clients.error),
    rows,
    byId,
    byTab,
    counts,
    activeCount,
    messagesByClient,
  };
}
