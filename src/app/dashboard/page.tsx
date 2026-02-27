"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logout, seedDummyData } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { AddLeadForm } from "@/components/leads/AddLeadForm";

export default function DashboardPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [seeding, startSeedTransition] = useTransition();
  const [seedDone, setSeedDone] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push("/login");
      else setEmail(data.user.email ?? null);
    });
  }, [router]);

  function handleLeadAdded() {
    setDialogOpen(false);
    setRefreshKey((k) => k + 1);
  }

  function handleSeed() {
    startSeedTransition(async () => {
      await seedDummyData();
      setSeedDone(true);
      setRefreshKey((k) => k + 1);
    });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
              B
            </div>
            <span className="font-semibold text-sm">BeatBunch CRM</span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {email && (
              <span className="text-sm text-muted-foreground hidden sm:block">
                {email}
              </span>
            )}
            <form action={logout}>
              <Button variant="ghost" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* Page header */}
      <div className="border-b border-border/40 bg-card/40">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center gap-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Pipeline</h1>
            <p className="text-xs text-muted-foreground">
              Drag cards between columns to update stage
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {!seedDone && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSeed}
                disabled={seeding}
                className="text-muted-foreground"
              >
                {seeding ? "Loading…" : "Load sample data"}
              </Button>
            )}

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">+ Add Lead</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add a lead</DialogTitle>
                </DialogHeader>
                <AddLeadForm onLeadAdded={handleLeadAdded} />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Pipeline board */}
      <div className="flex-1 overflow-x-auto">
        <div className="max-w-[1400px] mx-auto px-6 py-6">
          <PipelineBoard refreshKey={refreshKey} />
        </div>
      </div>
    </div>
  );
}
