"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  BarDatum,
  FunnelStage,
  IntentBreakdown,
  IntentTier,
} from "@/lib/types";

const TIER_STYLE: Record<IntentTier, { label: string; ring: string; bg: string }> = {
  low: {
    label: "Low intent",
    ring: "ring-amber-200 dark:ring-amber-900/50",
    bg: "bg-amber-50 dark:bg-amber-950/30",
  },
  medium: {
    label: "Medium intent",
    ring: "ring-sky-200 dark:ring-sky-900/50",
    bg: "bg-sky-50 dark:bg-sky-950/30",
  },
  high: {
    label: "High intent",
    ring: "ring-emerald-200 dark:ring-emerald-900/50",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
  },
};

export default function Conversions() {
  const [intent, setIntent] = useState<IntentBreakdown[]>([]);
  const [byType, setByType] = useState<BarDatum[]>([]);
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);

  useEffect(() => {
    api.getIntentBreakdown().then(setIntent);
    api.getConversionsByType().then(setByType);
    api.getFunnel().then(setFunnel);
  }, []);

  const intentTotal = intent.reduce((s, i) => s + i.count, 0) || 1;
  const barMax = Math.max(...byType.map((b) => b.value), 1);
  const funnelMax = funnel[0]?.count ?? 1;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">
            Conversions by intent tier
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Visitors grouped by how strong their buying signal was.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {intent.map((i) => {
            const style = TIER_STYLE[i.tier];
            const pct = ((i.count / intentTotal) * 100).toFixed(1);
            return (
              <div
                key={i.tier}
                className={cn(
                  "rounded-lg p-4 ring-1 ring-inset",
                  style.bg,
                  style.ring,
                )}
              >
                <div className="text-xs font-medium text-muted-foreground">
                  {style.label}
                </div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">
                  {i.count.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">{pct}% of total</div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Conversions by popup type
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {byType.map((b) => {
              const pct = (b.value / barMax) * 100;
              return (
                <div key={b.label}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{b.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {b.value.toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Funnel</CardTitle>
            <p className="text-xs text-muted-foreground">
              Impressions → clicks → converted
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {funnel.map((stage, i) => {
              const pct = (stage.count / funnelMax) * 100;
              const prev = i > 0 ? funnel[i - 1].count : null;
              const stepRate = prev
                ? ((stage.count / prev) * 100).toFixed(1)
                : null;
              return (
                <div key={stage.label}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{stage.label}</span>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      {stepRate && <span>{stepRate}% of prev</span>}
                      <span className="tabular-nums">
                        {stage.count.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1 h-7 overflow-hidden rounded-md bg-muted">
                    <div
                      className="flex h-full items-center justify-end rounded-md bg-gradient-to-r from-primary/80 to-primary px-2 text-[10px] font-medium text-primary-foreground transition-all"
                      style={{ width: `${pct}%` }}
                    >
                      {pct.toFixed(0)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
