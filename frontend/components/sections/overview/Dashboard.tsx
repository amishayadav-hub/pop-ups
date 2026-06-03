"use client";

import { useEffect, useState } from "react";
import { ArrowRight, MousePointerClick, Target, TrendingUp, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type {
  DashboardMetrics,
  IntentDistribution,
  IntentTier,
  PopupSummary,
} from "@/lib/types";

type Props = {
  onJumpToPosition?: () => void;
};

const TIER_BAR: Record<IntentTier, string> = {
  high: "bg-emerald-500",
  medium: "bg-sky-500",
  low: "bg-amber-500",
};

const TIER_LABEL: Record<IntentTier, string> = {
  high: "High intent",
  medium: "Medium intent",
  low: "Low intent",
};

export default function Dashboard({ onJumpToPosition }: Props) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [popups, setPopups] = useState<PopupSummary[]>([]);
  const [intent, setIntent] = useState<IntentDistribution[]>([]);
  const [lowMed, setLowMed] = useState<number>(0);

  useEffect(() => {
    api.getMetrics().then(setMetrics);
    api.getPopups().then(setPopups);
    api.getIntentDistribution().then(({ distribution, lowMedConverted }) => {
      setIntent(distribution);
      setLowMed(lowMedConverted);
    });
  }, []);

  const activeCount = popups.filter((p) => p.status === "active").length;
  const fmt = (n: number) => n.toLocaleString();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          icon={<Eye className="h-4 w-4" />}
          label="Impressions"
          value={metrics ? fmt(metrics.impressions) : "—"}
          delta="+12.4%"
        />
        <MetricCard
          icon={<MousePointerClick className="h-4 w-4" />}
          label="Clicks"
          value={metrics ? fmt(metrics.clicks) : "—"}
          delta="+8.1%"
        />
        <MetricCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="CTR"
          value={metrics ? `${metrics.ctr.toFixed(2)}%` : "—"}
          delta="+0.6 pp"
        />
        <MetricCard
          icon={<Target className="h-4 w-4" />}
          label="Conversions"
          value={metrics ? fmt(metrics.conversions) : "—"}
          delta="+3.2%"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold">Active popups</CardTitle>
            <span className="text-xs text-muted-foreground">
              {activeCount} of {popups.length} live
            </span>
          </CardHeader>
          <CardContent className="space-y-2">
            {popups.map((p) => {
              const isActive = p.status === "active";
              return (
                <div
                  key={p.id}
                  className={cn(
                    "flex items-center justify-between rounded-md border px-3 py-2 transition-colors",
                    isActive
                      ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30"
                      : "border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/30",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        isActive ? "bg-emerald-500" : "bg-rose-500",
                      )}
                    />
                    <span className="text-sm font-medium">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground">
                      CTR {p.ctr.toFixed(1)}%
                    </span>
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[11px] font-medium capitalize",
                        isActive
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                          : "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
                      )}
                    >
                      {p.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Intent distribution
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Share of visitors signalling each intent level this week.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {intent.map((i) => (
                <div key={i.tier}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{TIER_LABEL[i.tier]}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {i.percent}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full transition-all", TIER_BAR[i.tier])}
                      style={{ width: `${i.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Low+Medium converted: <b className="text-foreground">{lowMed} users</b> this week
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
              !
            </div>
            <div>
              <div className="text-sm font-semibold">
                Bottom-left position is underperforming
              </div>
              <p className="text-xs text-muted-foreground">
                Bottom-left CTR ~9% vs Center ~22%. Move active popups to a
                better slot.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={onJumpToPosition} className="gap-1">
            Fix position <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  delta,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs">{label}</span>
          {icon}
        </div>
        <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
        <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
          {delta} vs last week
        </div>
      </CardContent>
    </Card>
  );
}
