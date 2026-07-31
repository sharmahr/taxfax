import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { collection } from 'firebase/firestore';
import { Copy, Mail, Trash2, UserPlus } from 'lucide-react';
import {
  paths,
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  ROLE_RANK,
  type FirmMember,
  type FirmRole,
} from '@taxfax/shared';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { useCollection } from '@/lib/firestore';
import { firebaseErrorMessage } from '@/lib/errors';
import { timeAgo } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tooltip } from '@/components/ui/Tooltip';
import { toast } from '@/components/ui/Toast';
import { SettingsHeader } from '@/components/settings/layout';
import { inviteMember, removeMember, updateMemberRole } from '@/components/settings/api';
import { normEmail } from '@/components/onboarding/csv';

export const Route = createFileRoute('/_app/settings/members')({
  component: MembersPage,
});

const ALL_ROLES: FirmRole[] = ['owner', 'admin', 'preparer', 'viewer'];

function MembersPage() {
  const { activeFirm, user } = useAuth();
  const firmId = activeFirm?.firmId;
  const myRole = activeFirm?.role ?? 'viewer';
  const myUid = user?.uid ?? '';
  const canManage = ROLE_RANK[myRole] >= ROLE_RANK.admin;

  const { data: members, loading, error } = useCollection<FirmMember>(
    firmId ? collection(db, paths.members(firmId)) : null,
  );

  const sorted = useMemo(
    () =>
      [...members].sort(
        (a, b) => ROLE_RANK[b.role] - ROLE_RANK[a.role] || a.name.localeCompare(b.name),
      ),
    [members],
  );
  const ownerCount = useMemo(() => members.filter((m) => m.role === 'owner').length, [members]);

  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <div>
      <SettingsHeader
        title="Members & roles"
        description="Everyone who can sign in to your workspace, and exactly what each of them can do."
        action={
          canManage ? (
            <Button variant="primary" size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus className="size-4" />
              Invite
            </Button>
          ) : undefined
        }
      />

      <RoleLegend />

      <div className="mt-8">
        {loading ? (
          <MembersSkeleton />
        ) : error ? (
          <p className="rounded-lg border border-line bg-surface-sunken px-3.5 py-3 text-sm text-ink-muted">
            {firebaseErrorMessage(error)}
          </p>
        ) : sorted.length <= 1 ? (
          <EmptyState
            icon={UserPlus}
            title="It's just you so far"
            description="You're set up as the owner. Invite the preparers and admins who'll work the season with you — they'll show up here once they accept."
            action={
              canManage ? (
                <Button variant="primary" size="sm" onClick={() => setInviteOpen(true)}>
                  <UserPlus className="size-4" />
                  Invite a colleague
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {sorted.map((member) => (
              <MemberRow
                key={member.uid}
                member={member}
                firmId={firmId!}
                myRole={myRole}
                myUid={myUid}
                ownerCount={ownerCount}
              />
            ))}
          </ul>
        )}
      </div>

      {firmId ? (
        <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} firmId={firmId} myRole={myRole} />
      ) : null}
    </div>
  );
}

/** Plain-language guide to what a role can do — read once, believed forever. */
function RoleLegend() {
  return (
    <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-4 rounded-xl border border-line bg-surface px-5 py-5 sm:grid-cols-2">
      {ALL_ROLES.map((role) => (
        <div key={role} className="flex gap-3">
          <dt className="w-16 shrink-0 text-sm font-semibold text-ink">{ROLE_LABEL[role]}</dt>
          <dd className="min-w-0 flex-1 text-2xs leading-relaxed text-ink-muted">{ROLE_DESCRIPTION[role]}</dd>
        </div>
      ))}
    </dl>
  );
}

function MemberRow({
  member,
  firmId,
  myRole,
  myUid,
  ownerCount,
}: {
  member: FirmMember;
  firmId: string;
  myRole: FirmRole;
  myUid: string;
  ownerCount: number;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const myRank = ROLE_RANK[myRole];
  const isSelf = member.uid === myUid;
  const outranksMe = ROLE_RANK[member.role] > myRank;
  const manageable = myRank >= ROLE_RANK.admin && !outranksMe;
  const isLastOwner = member.role === 'owner' && ownerCount <= 1;

  const grantableRoles = ALL_ROLES.filter((r) => ROLE_RANK[r] <= myRank);
  const roleLocked = !manageable || isLastOwner;
  const roleReason = !manageable
    ? outranksMe
      ? `${member.name.split(' ')[0]} outranks you, so you can't change their role.`
      : undefined
    : isLastOwner
      ? 'A firm always needs an owner. Make someone else an owner first, then you can change this.'
      : undefined;

  const removeReason = isSelf
    ? "You can't remove yourself. Ask another admin to do it if you're leaving."
    : !manageable
      ? outranksMe
        ? `${member.name.split(' ')[0]} outranks you.`
        : 'You need admin access to remove people.'
      : isLastOwner
        ? "You can't remove the last owner. Make someone else an owner first."
        : undefined;

  async function changeRole(role: FirmRole) {
    if (role === member.role) return;
    setBusy(true);
    try {
      await updateMemberRole({ firmId, uid: member.uid, role });
      toast.success(`${member.name} is now ${ROLE_LABEL[role].toLowerCase()}.`);
    } catch (err) {
      toast.error(firebaseErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await removeMember({ firmId, uid: member.uid });
      toast.success(`${member.name} was removed from the firm.`);
      setConfirmOpen(false);
    } catch (err) {
      toast.error(firebaseErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const roleControl = roleLocked ? (
    <RoleTag role={member.role} reason={roleReason} />
  ) : (
    <Select value={member.role} onValueChange={(v) => changeRole(v as FirmRole)} disabled={busy}>
      <SelectTrigger className="h-8 w-36" aria-label={`Role for ${member.name}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {grantableRoles.map((r) => (
          <SelectItem key={r} value={r}>
            {ROLE_LABEL[r]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 sm:px-5">
      <Avatar name={member.name} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-ink">{member.name}</p>
          {isSelf ? <Badge variant="stamp">You</Badge> : null}
          {member.status === 'invited' ? <Badge variant="outline">Invited</Badge> : null}
        </div>
        <p className="truncate text-2xs text-ink-faint">{member.email}</p>
      </div>

      <p className="hidden w-28 shrink-0 text-2xs text-ink-faint md:block">
        {member.lastSeenAt ? `Seen ${timeAgo(member.lastSeenAt)}` : 'Not signed in yet'}
      </p>

      <div className="flex items-center gap-1.5">
        {roleControl}
        {removeReason ? (
          <Tooltip content={removeReason}>
            <span tabIndex={0} className="inline-flex rounded-md">
              <Button variant="ghost" size="sm" iconOnly disabled aria-label={`Remove ${member.name}`}>
                <Trash2 className="size-4" />
              </Button>
            </span>
          </Tooltip>
        ) : (
          <Tooltip content={`Remove ${member.name}`}>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              onClick={() => setConfirmOpen(true)}
              aria-label={`Remove ${member.name}`}
              className="text-ink-faint hover:text-status-danger"
            >
              <Trash2 className="size-4" />
            </Button>
          </Tooltip>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {member.name}?</DialogTitle>
            <DialogDescription>
              They'll lose access to this workspace immediately. Clients assigned to them stay in the
              firm and can be reassigned. This can't be undone, but you can invite them back later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={busy}>
              Keep them
            </Button>
            <Button variant="danger" onClick={remove} loading={busy}>
              Remove from firm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

/** A static role with an optional "why can't I change this?" explanation. */
function RoleTag({ role, reason }: { role: FirmRole; reason?: string }) {
  const label = (
    <span className="inline-flex h-8 items-center rounded-md px-2.5 text-sm font-medium text-ink-muted">
      {ROLE_LABEL[role]}
    </span>
  );
  return reason ? (
    <Tooltip content={reason}>
      <span tabIndex={0} className="cursor-help underline decoration-line decoration-dotted underline-offset-4">
        {label}
      </span>
    </Tooltip>
  ) : (
    label
  );
}

function InviteDialog({
  open,
  onOpenChange,
  firmId,
  myRole,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  firmId: string;
  myRole: FirmRole;
}) {
  const grantable = ALL_ROLES.filter((r) => ROLE_RANK[r] <= ROLE_RANK[myRole] && r !== 'owner');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<FirmRole>('preparer');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ email: string; url: string } | null>(null);

  const emailError = email.trim() && !normEmail(email) ? "That doesn't look like a valid email." : undefined;

  async function submit() {
    const clean = normEmail(email);
    if (!clean) return;
    setBusy(true);
    try {
      const res = await inviteMember({ firmId, email: clean, role });
      const url = `${window.location.origin}/invite/${res.token}`;
      setSent({ email: res.email, url });
      setEmail('');
      toast.success(res.resent ? `Invitation resent to ${res.email}.` : `Invitation sent to ${res.email}.`);
    } catch (err) {
      toast.error(firebaseErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!sent) return;
    try {
      await navigator.clipboard.writeText(sent.url);
      toast.success('Invite link copied.');
    } catch {
      toast.error('Could not copy — select the link and copy it manually.');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setSent(null);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a colleague</DialogTitle>
          <DialogDescription>
            We'll email them a link to join. They pick their own password; you decide what they can do.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Email address" error={emailError}>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !emailError) void submit();
              }}
              placeholder="colleague@yourfirm.com"
              autoFocus
            />
          </Field>
          <Field label="Role" hint={ROLE_DESCRIPTION[role]}>
            <Select value={role} onValueChange={(v) => setRole(v as FirmRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {grantable.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {sent ? (
            <div className="rounded-lg border border-line bg-surface-sunken px-3.5 py-3">
              <p className="flex items-center gap-2 text-2xs font-medium text-ink">
                <Mail className="size-3.5 text-ink-faint" />
                Invitation sent to {sent.email}
              </p>
              <p className="mt-1 text-2xs text-ink-faint">
                They'll appear in the list once they accept. Email not arriving? Share the link directly.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="ticket min-w-0 flex-1 truncate rounded border border-line bg-surface px-2 py-1 text-ink-muted">
                  {sent.url}
                </code>
                <Button variant="secondary" size="sm" onClick={copyLink}>
                  <Copy className="size-3.5" />
                  Copy
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {sent ? 'Done' : 'Cancel'}
          </Button>
          <Button variant="primary" onClick={submit} loading={busy} disabled={!email.trim() || Boolean(emailError)}>
            {sent ? 'Send another' : 'Send invitation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MembersSkeleton() {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
      {Array.from({ length: 3 }).map((_, i) => (
        <li key={i} className="flex items-center gap-4 px-4 py-3.5 sm:px-5">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-52" />
          </div>
          <Skeleton className="h-8 w-36 rounded-md" />
        </li>
      ))}
    </ul>
  );
}
