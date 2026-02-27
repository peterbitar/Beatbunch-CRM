"use client";

import { useEffect, useState, useCallback } from "react";
import { getLeads, deleteLead } from "@/lib/leads";
import {
  STAGE_LABELS,
  STAGE_COLORS,
  SOURCE_LABELS,
  type LeadWithContacts,
} from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface LeadsListProps {
  refreshKey: number;
}

function ContactPill({
  role,
  name,
  sub,
}: {
  role: string;
  name: string;
  sub?: string;
}) {
  const colors: Record<string, string> = {
    parent: "bg-blue-50 border-blue-200 text-blue-800",
    adult: "bg-violet-50 border-violet-200 text-violet-800",
    child: "bg-amber-50 border-amber-200 text-amber-800",
  };
  return (
    <span
      className={`inline-flex flex-col rounded-md border px-2.5 py-1 text-xs ${colors[role] ?? "bg-muted"}`}
    >
      <span className="font-semibold capitalize">{role}</span>
      <span>{name}</span>
      {sub && <span className="text-[10px] opacity-70">{sub}</span>}
    </span>
  );
}

export function LeadsList({ refreshKey }: LeadsListProps) {
  const [leads, setLeads] = useState<LeadWithContacts[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLeads();
      setLeads(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads, refreshKey]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this lead?")) return;
    setDeletingId(id);
    try {
      await deleteLead(id);
      setLeads((prev) => prev.filter((l) => l.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Loading leads…
        </CardContent>
      </Card>
    );
  }

  if (leads.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No leads yet — add your first one above.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Leads{" "}
          <span className="text-muted-foreground font-normal text-sm">
            ({leads.length})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {leads.map((lead) => {
            const primary =
              lead.contacts.find(
                (c) => c.role === "parent" || c.role === "adult"
              ) ?? lead.contacts[0];

            return (
              <div
                key={lead.id}
                className="flex items-start justify-between gap-4 px-6 py-4"
              >
                <div className="flex-1 min-w-0 space-y-2">
                  {/* Name + stage */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">
                      {primary
                        ? `${primary.first_name} ${primary.last_name}`
                        : "Unknown"}
                    </span>
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_COLORS[lead.stage]}`}
                    >
                      {STAGE_LABELS[lead.stage]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      via {SOURCE_LABELS[lead.source]}
                    </span>
                  </div>

                  {/* Contacts */}
                  <div className="flex flex-wrap gap-2">
                    {lead.contacts.map((c) => (
                      <ContactPill
                        key={c.id}
                        role={c.role}
                        name={`${c.first_name} ${c.last_name}`}
                        sub={c.instrument_interest ?? undefined}
                      />
                    ))}
                  </div>

                  {/* Notes + date */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {lead.notes && <span>{lead.notes}</span>}
                    <span>
                      {new Date(lead.created_at).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  disabled={deletingId === lead.id}
                  onClick={() => handleDelete(lead.id)}
                >
                  {deletingId === lead.id ? "…" : "Delete"}
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
