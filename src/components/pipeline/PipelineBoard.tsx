"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { createClient } from "@/lib/supabase/client";
import { getLeads, updateLeadStage } from "@/lib/leads";
import { triggerStageEmail } from "@/app/email/actions";
import {
  STAGE_LABELS,
  SOURCE_LABELS,
  getPrimaryContact,
  getChildren,
  type LeadStage,
  type LeadWithContacts,
} from "@/lib/types";

const STAGES: LeadStage[] = [
  "new",
  "contacted",
  "trial_booked",
  "trial_done",
  "enrolled",
  "lost",
];

const COLUMN_STYLE: Record<
  LeadStage,
  { bg: string; border: string; label: string; dot: string }
> = {
  new:          { bg: "bg-slate-50",  border: "border-slate-200",  label: "text-slate-600",  dot: "bg-slate-400"  },
  contacted:    { bg: "bg-blue-50",   border: "border-blue-200",   label: "text-blue-700",   dot: "bg-blue-500"   },
  trial_booked: { bg: "bg-amber-50",  border: "border-amber-200",  label: "text-amber-700",  dot: "bg-amber-500"  },
  trial_done:   { bg: "bg-purple-50", border: "border-purple-200", label: "text-purple-700", dot: "bg-purple-500" },
  enrolled:     { bg: "bg-green-50",  border: "border-green-200",  label: "text-green-700",  dot: "bg-green-500"  },
  lost:         { bg: "bg-rose-50",   border: "border-rose-200",   label: "text-rose-600",   dot: "bg-rose-400"   },
};

// ── Lead Card ──────────────────────────────────────────────────────

function LeadCard({
  lead,
  overlay = false,
}: {
  lead: LeadWithContacts;
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: lead.id, disabled: overlay });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const primary = getPrimaryContact(lead);
  const children = getChildren(lead);
  const instruments = [
    primary?.instrument_interest,
    ...children.map((c) => c.instrument_interest),
  ].filter(Boolean);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={[
        "bg-white rounded-xl border border-border p-3 space-y-2 select-none",
        "cursor-grab active:cursor-grabbing transition-all",
        isDragging
          ? "opacity-30 shadow-none"
          : "shadow-sm hover:shadow-md hover:-translate-y-0.5",
        overlay ? "shadow-2xl rotate-1 opacity-100 cursor-grabbing" : "",
      ].join(" ")}
    >
      {/* Name + role */}
      <div>
        <p className="font-semibold text-sm leading-snug">
          {primary
            ? `${primary.first_name} ${primary.last_name}`
            : "Unknown"}
        </p>
        <p className="text-[11px] text-muted-foreground capitalize">
          {primary?.role}
          {children.length > 0 &&
            ` · ${children.length} child${children.length > 1 ? "ren" : ""}`}
        </p>
      </div>

      {/* Children pills */}
      {children.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {children.map((c) => (
            <span
              key={c.id}
              className="rounded-full bg-amber-100 text-amber-800 text-[10px] font-medium px-2 py-0.5"
            >
              {c.first_name}
            </span>
          ))}
        </div>
      )}

      {/* Instruments */}
      {instruments.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          🎵 {instruments.join(", ")}
        </p>
      )}

      {/* Contact + source */}
      <div className="space-y-0.5">
        {primary?.phone && (
          <p className="text-[10px] text-muted-foreground">{primary.phone}</p>
        )}
        <p className="text-[10px] text-muted-foreground/70">
          via {SOURCE_LABELS[lead.source]}
        </p>
      </div>
    </div>
  );
}

// ── Column ─────────────────────────────────────────────────────────

function Column({
  stage,
  leads,
}: {
  stage: LeadStage;
  leads: LeadWithContacts[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const s = COLUMN_STYLE[stage];

  return (
    <div className="flex flex-col w-60 shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 px-0.5">
        <span className={`h-2 w-2 rounded-full ${s.dot}`} />
        <span className={`text-sm font-semibold ${s.label}`}>
          {STAGE_LABELS[stage]}
        </span>
        <span className="ml-auto text-xs font-medium bg-muted text-muted-foreground rounded-full px-2 py-0.5 tabular-nums">
          {leads.length}
        </span>
      </div>

      {/* Drop area */}
      <div
        ref={setNodeRef}
        className={[
          "flex-1 min-h-[120px] rounded-xl border-2 p-2 space-y-2 transition-all",
          s.bg,
          isOver ? `${s.border} ring-2 ring-primary/20` : "border-transparent",
        ].join(" ")}
      >
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} />
        ))}
        {leads.length === 0 && (
          <div className="flex items-center justify-center h-16 text-xs text-muted-foreground/50 rounded-lg border-2 border-dashed border-muted">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pipeline Board ─────────────────────────────────────────────────

export function PipelineBoard({ refreshKey = 0 }: { refreshKey?: number }) {
  const [leads, setLeads] = useState<LeadWithContacts[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const fetchLeads = useCallback(async () => {
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

  // Real-time subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("pipeline-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "leads" },
        (payload) => {
          const updated = payload.new as { id: string; stage: LeadStage };
          setLeads((prev) =>
            prev.map((l) =>
              l.id === updated.id ? { ...l, stage: updated.stage } : l
            )
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "leads" },
        () => fetchLeads()
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "leads" },
        (payload) => {
          const deleted = payload.old as { id: string };
          setLeads((prev) => prev.filter((l) => l.id !== deleted.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLeads]);

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;

    const leadId = active.id as string;
    const newStage = over.id as LeadStage;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stage === newStage) return;

    // Optimistic update
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, stage: newStage } : l))
    );

    try {
      await updateLeadStage(leadId, newStage);
      // Fire email asynchronously — don't await so UI isn't blocked
      triggerStageEmail(leadId, newStage).then((result) => {
        if (result.sent) console.log(`[email] Triggered for stage: ${newStage}`);
        else if (result.error) console.warn(`[email] Skipped: ${result.error}`);
      });
    } catch {
      // Revert on failure
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, stage: lead.stage } : l))
      );
    }
  }

  const leadsByStage = STAGES.reduce(
    (acc, stage) => {
      acc[stage] = leads.filter((l) => l.stage === stage);
      return acc;
    },
    {} as Record<LeadStage, LeadWithContacts[]>
  );

  const activeLead = leads.find((l) => l.id === activeId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Loading pipeline…
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-6 pt-1 px-1 min-h-[520px]">
        {STAGES.map((stage) => (
          <Column key={stage} stage={stage} leads={leadsByStage[stage]} />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeLead && <LeadCard lead={activeLead} overlay />}
      </DragOverlay>
    </DndContext>
  );
}
