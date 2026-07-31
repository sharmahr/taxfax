import { useState, type FormEvent } from 'react';
import {
  DOC_CATEGORY_LABEL,
  DOC_CATEGORY_ORDER,
  DOC_TYPES,
  type RequestPriority,
} from '@taxfax/shared';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { createRequest, run } from '../actions';

interface AddRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  firmId: string;
  clientId: string;
  taxYear: number;
  nextOrder: number;
}

const PRIORITIES: { id: RequestPriority; label: string }[] = [
  { id: 'critical', label: 'Critical' },
  { id: 'standard', label: 'Standard' },
  { id: 'optional', label: 'Optional' },
];

export function AddRequestDialog({
  open,
  onOpenChange,
  firmId,
  clientId,
  taxYear,
  nextOrder,
}: AddRequestDialogProps) {
  const [docTypeId, setDocTypeId] = useState('');
  const [reason, setReason] = useState('');
  const [priority, setPriority] = useState<RequestPriority>('standard');
  const [count, setCount] = useState(1);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setDocTypeId('');
    setReason('');
    setPriority('standard');
    setCount(1);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!docTypeId) return;
    setSaving(true);
    const ok = await run(
      createRequest(firmId, clientId, {
        docTypeId,
        reason: reason.trim() || 'Added by your preparer.',
        priority,
        expectedCount: Math.max(1, count),
        taxYear,
        order: nextOrder,
      }),
      { success: 'Added to the checklist' },
    );
    setSaving(false);
    if (ok) {
      reset();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : (reset(), onOpenChange(o)))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a document request</DialogTitle>
          <DialogDescription>
            Ask this client for one more document. It joins the checklist and the chase immediately.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-4">
          <Field label="Document">
            <Select value={docTypeId} onValueChange={setDocTypeId}>
              <SelectTrigger aria-label="Document type">
                <SelectValue placeholder="Choose a document type…" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {DOC_CATEGORY_ORDER.map((cat) => {
                  const types = DOC_TYPES.filter((t) => t.category === cat);
                  if (types.length === 0) return null;
                  return (
                    <SelectGroup key={cat}>
                      <SelectLabel>{DOC_CATEGORY_LABEL[cat]}</SelectLabel>
                      {types.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.code} — {t.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  );
                })}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="Why you need it"
            hint="Shown to the client so they know exactly what to send."
          >
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Your Schedule E last year listed a rental in Austin — we need this year’s 1098."
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority">
              <Select value={priority} onValueChange={(v) => setPriority(v as RequestPriority)}>
                <SelectTrigger aria-label="Priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="How many">
              <Input
                type="number"
                min={1}
                max={20}
                value={count}
                onChange={(e) => setCount(Number(e.target.value) || 1)}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={!docTypeId} loading={saving}>
              Add to checklist
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
