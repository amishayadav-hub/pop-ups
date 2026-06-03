"use client";

import { useEffect, useState } from "react";
import { Cloud, DoorOpen, LogIn, Megaphone, Timer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import type { PopupSummary, PopupTypeId } from "@/lib/types";

const ICON: Record<PopupTypeId, React.ReactNode> = {
  "exit-intent": <DoorOpen className="h-4 w-4" />,
  entry: <LogIn className="h-4 w-4" />,
  promotional: <Megaphone className="h-4 w-4" />,
  countdown: <Timer className="h-4 w-4" />,
  weather: <Cloud className="h-4 w-4" />,
};

const DESCRIPTION: Record<PopupTypeId, string> = {
  "exit-intent":
    "Fires when visitor tries to leave (mouseleave top on desktop, back button on mobile).",
  entry:
    "First-visit welcome popup. Fires 4 seconds after page load for new visitors.",
  promotional:
    "Promote slow-moving products. Fires 25 seconds after page load.",
  countdown: "Limited-time offer with live timer. Fires 10 seconds after load.",
  weather: "Show based on visitor's local weather (rainy / cold / sunny etc).",
};

export default function PopupTypes() {
  const [popups, setPopups] = useState<PopupSummary[]>([]);
  const [pending, setPending] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.getPopups().then(setPopups);
  }, []);

  const toggle = async (id: string) => {
    const current = popups.find((p) => p.id === id);
    if (!current) return;
    const nextStatus: "active" | "paused" =
      current.status === "active" ? "paused" : "active";

    // optimistic update
    setPopups((ps) =>
      ps.map((p) => (p.id === id ? { ...p, status: nextStatus } : p)),
    );
    setPending((s) => new Set(s).add(id));

    try {
      await api.setPopupStatus(id, nextStatus);
    } catch {
      // revert on failure
      setPopups((ps) =>
        ps.map((p) =>
          p.id === id ? { ...p, status: current.status } : p,
        ),
      );
    } finally {
      setPending((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {popups.map((p) => {
        const isActive = p.status === "active";
        const isPending = pending.has(p.id);
        return (
          <Card key={p.id} className="overflow-hidden">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-md bg-muted text-foreground">
                  {ICON[p.id]}
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">
                    {p.name}
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {DESCRIPTION[p.id]}
                  </p>
                </div>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={() => toggle(p.id)}
                disabled={isPending}
                aria-label={`Toggle ${p.name}`}
              />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-xs">
                <span className="text-muted-foreground">
                  Status on storefront
                </span>
                <Badge
                  variant={isActive ? "secondary" : "outline"}
                  className={
                    isActive
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                      : "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                  }
                >
                  {isPending
                    ? "Updating…"
                    : isActive
                      ? "● Live on anveshan.farm"
                      : "○ Paused"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
