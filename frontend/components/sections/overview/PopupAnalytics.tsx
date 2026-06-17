"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Eye,
  MousePointerClick,
  TrendingUp,
  XCircle,
  AlarmClock,
  Sliders,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { WeeklyBar } from "@/components/ui/WeeklyBar";
import type { PopupAnalyticsMetrics, WeeklyDataPoint } from "@/lib/types";

type Props = {
  popupId: string;
  popupName: string;
  description: string;
  onBack: () => void;
  onOpenScoringStudio?: () => void;
  onOpenAbandonmentScoringStudio?: () => void;
};

const ABANDONMENT_ID = "abandonment-exit-intent";

export default function PopupAnalytics({
  popupId,
  popupName,
  description,
  onBack,
  onOpenScoringStudio,
  onOpenAbandonmentScoringStudio,
}: Props) {
  const [metrics, setMetrics] = useState<PopupAnalyticsMetrics | null>(null);
  const [weekly, setWeekly] = useState<WeeklyDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const isAbandonment = popupId === ABANDONMENT_ID;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.getPopupAnalytics(popupId),
      api.getWeeklyImpressionsForPopup(popupId),
    ])
      .then(([m, w]) => {
        if (cancelled) return;
        setMetrics(m);
        setWeekly(w);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [popupId]);

  const fmt = (n: number) => n.toLocaleString();

  return (
    <div className="space-y-6">
      {/* Back nav + olive Scoring Studio button (both popups) */}
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1.5 -ml-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to All Popups
        </Button>
        {(() => {
          const handler = isAbandonment
            ? onOpenAbandonmentScoringStudio
            : onOpenScoringStudio;
          if (!handler) return null;
          return (
            <button
              type="button"
              onClick={handler}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#1F5F57] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#267065] focus:outline-none focus:ring-2 focus:ring-[#1F5F57] focus:ring-offset-2 dark:bg-[#1F5F57] dark:text-white dark:hover:bg-[#267065] dark:focus:ring-[#1F5F57]"
            >
              <Sliders className="h-3.5 w-3.5" />
              Scoring Studio
            </button>
          );
        })()}
      </div>

      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold leading-tight">{popupName}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      {/* Metric cards */}
      <div
        className={cn(
          "grid grid-cols-2 gap-4",
          isAbandonment ? "lg:grid-cols-5" : "lg:grid-cols-4",
        )}
      >
        <MetricCard
          icon={<Eye className="h-4 w-4" />}
          label="Impressions"
          value={metrics ? fmt(metrics.impressions) : loading ? "…" : "—"}
        />
        <MetricCard
          icon={<MousePointerClick className="h-4 w-4" />}
          label="Clicks"
          value={metrics ? fmt(metrics.clicks) : loading ? "…" : "—"}
        />
        <MetricCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="CTR"
          value={metrics ? `${metrics.ctr.toFixed(2)}%` : loading ? "…" : "—"}
        />
        {isAbandonment && (
          <MetricCard
            icon={<AlarmClock className="h-4 w-4" />}
            label="Ignored"
            value={
              metrics?.ignored !== undefined
                ? fmt(metrics.ignored)
                : loading
                  ? "…"
                  : "—"
            }
          />
        )}
        <MetricCard
          icon={<XCircle className="h-4 w-4" />}
          label="Closed / Crossed"
          value={metrics ? fmt(metrics.closed) : loading ? "…" : "—"}
          hint="X button or backdrop tap"
        />
      </div>

      {/* Weekly graph */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            Weekly performance
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Day-by-day impressions for the last 7 days.
          </p>
        </CardHeader>
        <CardContent className="pt-2">
          {weekly.length > 0 ? (
            <WeeklyBar data={weekly} label="Impressions" />
          ) : (
            <div className="grid h-48 place-items-center text-xs text-muted-foreground">
              {loading ? "Loading…" : "No data yet"}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs">{label}</span>
          {icon}
        </div>
        <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
          {value}
        </div>
        {hint && (
          <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>
        )}
      </CardContent>
    </Card>
  );
}
