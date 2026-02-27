"use client";

import { useState, useTransition } from "react";
import { createLeadWithContacts } from "@/lib/leads";
import { SOURCE_LABELS, type LeadSource, type ContactRole } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

const LEAD_TYPES = [
  { value: "adult", label: "Adult" },
  { value: "parent_child", label: "Parent + Child(ren)" },
] as const;

type LeadType = (typeof LEAD_TYPES)[number]["value"];

interface ChildFields {
  id: number;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  instrument_interest: string;
}

interface AddLeadFormProps {
  onLeadAdded: () => void;
}

function ChildForm({
  child,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  child: ChildFields;
  index: number;
  canRemove: boolean;
  onChange: (id: number, field: keyof ChildFields, value: string) => void;
  onRemove: (id: number) => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
          Child {index + 1}
        </p>
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(child.id)}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            Remove
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>First name *</Label>
          <Input
            value={child.first_name}
            onChange={(e) => onChange(child.id, "first_name", e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label>Last name *</Label>
          <Input
            value={child.last_name}
            onChange={(e) => onChange(child.id, "last_name", e.target.value)}
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Date of birth</Label>
          <Input
            type="date"
            value={child.date_of_birth}
            onChange={(e) =>
              onChange(child.id, "date_of_birth", e.target.value)
            }
          />
        </div>
        <div className="space-y-1">
          <Label>Instrument interest</Label>
          <Input
            placeholder="e.g. Drums"
            value={child.instrument_interest}
            onChange={(e) =>
              onChange(child.id, "instrument_interest", e.target.value)
            }
          />
        </div>
      </div>
    </div>
  );
}

let childIdCounter = 1;

function makeChild(): ChildFields {
  return {
    id: childIdCounter++,
    first_name: "",
    last_name: "",
    date_of_birth: "",
    instrument_interest: "",
  };
}

export function AddLeadForm({ onLeadAdded }: AddLeadFormProps) {
  const [leadType, setLeadType] = useState<LeadType>("adult");
  const [children, setChildren] = useState<ChildFields[]>([makeChild()]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateChild(
    id: number,
    field: keyof ChildFields,
    value: string
  ) {
    setChildren((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  }

  function addChild() {
    setChildren((prev) => [...prev, makeChild()]);
  }

  function removeChild(id: number) {
    setChildren((prev) => prev.filter((c) => c.id !== id));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        const contacts: Parameters<
          typeof createLeadWithContacts
        >[0]["contacts"] = [];

        if (leadType === "adult") {
          contacts.push({
            role: "adult" as ContactRole,
            first_name: fd.get("adult_first") as string,
            last_name: fd.get("adult_last") as string,
            email: (fd.get("adult_email") as string) || undefined,
            phone: (fd.get("adult_phone") as string) || undefined,
            instrument_interest:
              (fd.get("adult_instrument") as string) || undefined,
          });
        } else {
          contacts.push({
            role: "parent" as ContactRole,
            first_name: fd.get("parent_first") as string,
            last_name: fd.get("parent_last") as string,
            email: (fd.get("parent_email") as string) || undefined,
            phone: (fd.get("parent_phone") as string) || undefined,
          });
          for (const child of children) {
            if (!child.first_name || !child.last_name) continue;
            contacts.push({
              role: "child" as ContactRole,
              first_name: child.first_name,
              last_name: child.last_name,
              date_of_birth: child.date_of_birth || undefined,
              instrument_interest: child.instrument_interest || undefined,
            });
          }
        }

        await createLeadWithContacts({
          source: fd.get("source") as LeadSource,
          notes: (fd.get("notes") as string) || undefined,
          contacts,
        });

        (e.target as HTMLFormElement).reset();
        setLeadType("adult");
        setChildren([makeChild()]);
        onLeadAdded();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a lead</CardTitle>
        <CardDescription>
          Log a new enquiry — adult, or parent with one or more children.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          {/* Lead type toggle */}
          <div className="space-y-2">
            <Label>Who is enquiring?</Label>
            <div className="flex gap-2">
              {LEAD_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setLeadType(t.value)}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    leadType === t.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {leadType === "adult" ? (
            <div className="space-y-3 rounded-lg border border-violet-200 bg-violet-50/50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                Adult
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="adult_first">First name *</Label>
                  <Input id="adult_first" name="adult_first" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="adult_last">Last name *</Label>
                  <Input id="adult_last" name="adult_last" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="adult_email">Email</Label>
                  <Input id="adult_email" name="adult_email" type="email" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="adult_phone">Phone</Label>
                  <Input id="adult_phone" name="adult_phone" type="tel" />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="adult_instrument">Instrument interest</Label>
                <Input
                  id="adult_instrument"
                  name="adult_instrument"
                  placeholder="e.g. Guitar, Piano"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Parent */}
              <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                  Parent
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="parent_first">First name *</Label>
                    <Input id="parent_first" name="parent_first" required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="parent_last">Last name *</Label>
                    <Input id="parent_last" name="parent_last" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="parent_email">Email</Label>
                    <Input
                      id="parent_email"
                      name="parent_email"
                      type="email"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="parent_phone">Phone</Label>
                    <Input
                      id="parent_phone"
                      name="parent_phone"
                      type="tel"
                    />
                  </div>
                </div>
              </div>

              {/* Children — dynamic list */}
              <div className="space-y-3">
                {children.map((child, index) => (
                  <ChildForm
                    key={child.id}
                    child={child}
                    index={index}
                    canRemove={children.length > 1}
                    onChange={updateChild}
                    onRemove={removeChild}
                  />
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full border-dashed"
                  onClick={addChild}
                >
                  + Add another child
                </Button>
              </div>
            </div>
          )}

          {/* Source + notes */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="source">How did they find us?</Label>
              <select
                id="source"
                name="source"
                defaultValue="other"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                name="notes"
                placeholder="Any quick notes…"
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Saving…" : "Add lead"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
