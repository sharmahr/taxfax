import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  collection,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { FileText, Minus, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import {
  DOC_CATEGORY_LABEL,
  DOC_CATEGORY_ORDER,
  DOC_TYPES,
  docType,
  paths,
  ROLE_RANK,
  type DocCategory,
  type RequestPriority,
  type Timestampish,
} from '@taxfax/shared';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { useCollection } from '@/lib/firestore';
import { firebaseErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
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
import { toast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import { SettingsHeader } from '@/components/settings/layout';

export const Route = createFileRoute('/_app/settings/templates')({
  component: TemplatesPage,
});

interface TemplateItem {
  docTypeId: string;
  priority: RequestPriority;
  reason: string;
  expectedCount: number;
}
interface FirmTemplate {
  id: string;
  firmId: string;
  name: string;
  items: TemplateItem[];
  createdBy: string;
  createdAt: Timestampish;
  updatedAt: Timestampish;
}

const PRIORITIES: RequestPriority[] = ['critical', 'standard', 'optional'];
const PRIORITY_LABEL: Record<RequestPriority, string> = {
  critical: 'Must have',
  standard: 'Standard',
  optional: 'If it applies',
};

type ItemConfig = { priority: RequestPriority; expectedCount: number };
type Selection = Record<string, ItemConfig>;

function TemplatesPage() {
  const { activeFirm, user } = useAuth();
  const firm = activeFirm?.firm;
  const canEdit = activeFirm ? ROLE_RANK[activeFirm.role] >= ROLE_RANK.admin : false;

  const templatesQuery = useMemo(
    () => (firm ? query(collection(db, paths.templates(firm.id)), orderBy('name')) : null),
    [firm?.id],
  );
  const { data: templates, loading } = useCollection<FirmTemplate>(templatesQuery);

  const [editing, setEditing] = useState<FirmTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<FirmTemplate | null>(null);

  if (!firm) return <TemplatesSkeleton />;

  const editorOpen = creating || editing !== null;

  return (
    <div>
      <SettingsHeader
        title="Checklist templates"
        description="A reusable set of documents to request. TaxFax normally builds a checklist from last year's return — a template is for the clients that don't fit the mould, like a new rental or a first-year business."
        action={
          canEdit && templates.length > 0 ? (
            <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              New template
            </Button>
          ) : undefined
        }
      />

      <div className="mt-8">
        {loading ? (
          <TemplatesListSkeleton />
        ) : templates.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No templates yet"
            description={
              canEdit
                ? 'Build one for a recurring situation — a rental owner, a sole proprietor, an estate — and apply it to any client in one click.'
                : "Your firm hasn't saved any checklist templates yet. An owner or admin can create them."
            }
            action={
              canEdit ? (
                <Button variant="primary" onClick={() => setCreating(true)}>
                  <Plus className="size-4" />
                  New template
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {templates.map((t) => (
              <TemplateRow
                key={t.id}
                template={t}
                canEdit={canEdit}
                onEdit={() => setEditing(t)}
                onDelete={() => setToDelete(t)}
              />
            ))}
          </ul>
        )}
      </div>

      {editorOpen ? (
        <TemplateEditor
          firmId={firm.id}
          uid={user?.uid ?? ''}
          editing={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      ) : null}

      <DeleteTemplateDialog
        firmId={firm.id}
        template={toDelete}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}

function TemplateRow({
  template,
  canEdit,
  onEdit,
  onDelete,
}: {
  template: FirmTemplate;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const categories = useMemo(() => {
    const seen = new Set<DocCategory>();
    for (const item of template.items) seen.add(docType(item.docTypeId).category);
    return DOC_CATEGORY_ORDER.filter((c) => seen.has(c)).map((c) => DOC_CATEGORY_LABEL[c]);
  }, [template.items]);

  return (
    <li className="flex items-center justify-between gap-4 py-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">{template.name}</p>
        <p className="mt-0.5 truncate text-2xs text-ink-faint">
          <span className="tabular-nums">{template.items.length}</span>{' '}
          {template.items.length === 1 ? 'document' : 'documents'}
          {categories.length ? <span className="text-line-strong"> · </span> : null}
          {categories.join(', ')}
        </p>
      </div>
      {canEdit ? (
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="size-3.5" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={onDelete}
            aria-label={`Delete ${template.name}`}
            className="text-ink-faint hover:text-status-danger"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function TemplateEditor({
  firmId,
  uid,
  editing,
  onClose,
}: {
  firmId: string;
  uid: string;
  editing: FirmTemplate | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? '');
  const [touched, setTouched] = useState(false);
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState<Selection>(() => {
    const seed: Selection = {};
    for (const item of editing?.items ?? []) {
      seed[item.docTypeId] = { priority: item.priority, expectedCount: item.expectedCount };
    }
    return seed;
  });
  const [saving, setSaving] = useState(false);

  const selectedCount = Object.keys(selection).length;
  const nameError = touched && name.trim().length < 2 ? 'Give the template a name.' : undefined;

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return DOC_CATEGORY_ORDER.map((category) => ({
      category,
      types: DOC_TYPES.filter(
        (d) =>
          d.category === category &&
          (q === '' ||
            d.code.toLowerCase().includes(q) ||
            d.label.toLowerCase().includes(q) ||
            d.hint.toLowerCase().includes(q)),
      ),
    })).filter((g) => g.types.length > 0);
  }, [search]);

  function toggle(id: string, on: boolean) {
    setSelection((prev) => {
      const next = { ...prev };
      if (on) next[id] = { priority: 'standard', expectedCount: 1 };
      else delete next[id];
      return next;
    });
  }
  function configure(id: string, patch: Partial<ItemConfig>) {
    setSelection((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function save() {
    setTouched(true);
    const trimmed = name.trim();
    if (trimmed.length < 2 || selectedCount === 0) return;

    const items: TemplateItem[] = DOC_TYPES.filter((d) => selection[d.id]).map((d) => ({
      docTypeId: d.id,
      priority: selection[d.id].priority,
      reason: d.hint,
      expectedCount: selection[d.id].expectedCount,
    }));

    setSaving(true);
    try {
      if (editing) {
        await updateDoc(doc(db, paths.templates(firmId), editing.id), {
          name: trimmed,
          items,
          updatedAt: serverTimestamp(),
        });
        toast.success('Template updated.');
      } else {
        const ref = doc(collection(db, paths.templates(firmId)));
        await setDoc(ref, {
          id: ref.id,
          firmId,
          name: trimmed,
          items,
          createdBy: uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        toast.success('Template created.');
      }
      onClose();
    } catch (err) {
      toast.error(firebaseErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit template' : 'New checklist template'}</DialogTitle>
          <DialogDescription>
            Name it, then choose the documents to request and how hard to press for each.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Template name" error={nameError} required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="Rental property owner"
              autoFocus
              maxLength={100}
            />
          </Field>

          <div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search documents…"
                className="pl-9"
                aria-label="Search documents"
              />
            </div>

            <div className="mt-2 max-h-[42vh] overflow-y-auto rounded-lg border border-line">
              {groups.length === 0 ? (
                <p className="px-3 py-6 text-center text-2xs text-ink-faint">
                  No document matches “{search}”.
                </p>
              ) : (
                groups.map((group) => (
                  <div key={group.category} className="border-b border-line last:border-b-0">
                    <p className="sticky top-0 z-[1] bg-surface-sunken px-3 py-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-faint">
                      {DOC_CATEGORY_LABEL[group.category]}
                    </p>
                    <div className="p-1.5">
                      {group.types.map((def) => {
                        const config = selection[def.id];
                        return (
                          <div
                            key={def.id}
                            className={cn(
                              'rounded-lg px-2 py-2 transition-colors',
                              config ? 'bg-surface-sunken/60' : 'hover:bg-surface-sunken/40',
                            )}
                          >
                            <label className="flex cursor-pointer items-start gap-2.5">
                              <Checkbox
                                checked={Boolean(config)}
                                onCheckedChange={(c) => toggle(def.id, c === true)}
                                className="mt-0.5"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-baseline gap-x-2">
                                  <span className="text-sm font-medium text-ink">{def.code}</span>
                                  <span className="truncate text-2xs text-ink-faint">
                                    {def.label}
                                  </span>
                                </span>
                                <span className="mt-0.5 block text-pretty text-2xs leading-relaxed text-ink-faint">
                                  {def.hint}
                                </span>
                              </span>
                            </label>

                            {config ? (
                              <div className="mt-2 flex flex-wrap items-center gap-2 pl-[1.625rem]">
                                <Select
                                  value={config.priority}
                                  onValueChange={(v) =>
                                    configure(def.id, { priority: v as RequestPriority })
                                  }
                                >
                                  <SelectTrigger className="h-8 w-40 text-2xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {PRIORITIES.map((p) => (
                                      <SelectItem key={p} value={p}>
                                        {PRIORITY_LABEL[p]}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {def.multiple ? (
                                  <Stepper
                                    value={config.expectedCount}
                                    onChange={(n) => configure(def.id, { expectedCount: n })}
                                  />
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <p className="text-2xs text-ink-faint" aria-live="polite">
            <span className="tabular-nums">{selectedCount}</span>{' '}
            {selectedCount === 1 ? 'document' : 'documents'} selected
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={save}
              loading={saving}
              disabled={selectedCount === 0 || name.trim().length < 2}
            >
              {editing ? 'Save changes' : 'Create template'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        iconOnly
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        aria-label="Fewer expected"
      >
        <Minus className="size-3.5" />
      </Button>
      <span className="w-10 text-center text-2xs tabular-nums text-ink-muted" aria-live="polite">
        ×{value}
      </span>
      <Button
        variant="ghost"
        size="sm"
        iconOnly
        onClick={() => onChange(Math.min(9, value + 1))}
        disabled={value >= 9}
        aria-label="More expected"
      >
        <Plus className="size-3.5" />
      </Button>
    </div>
  );
}

function DeleteTemplateDialog({
  firmId,
  template,
  onClose,
}: {
  firmId: string;
  template: FirmTemplate | null;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!template) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, paths.templates(firmId), template.id));
      toast.success('Template deleted.');
      onClose();
    } catch (err) {
      toast.error(firebaseErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={template !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{template?.name}”?</DialogTitle>
          <DialogDescription>
            This removes the template for the whole firm. Checklists you've already applied to
            clients are unaffected — this only stops it being reused.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Keep it
          </Button>
          <Button variant="danger" onClick={remove} loading={busy}>
            Delete template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplatesSkeleton() {
  return (
    <div>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-3 h-4 w-full max-w-xl" />
      <div className="mt-8">
        <TemplatesListSkeleton />
      </div>
    </div>
  );
}
function TemplatesListSkeleton() {
  return (
    <div className="divide-y divide-line border-y border-line">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between py-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}
