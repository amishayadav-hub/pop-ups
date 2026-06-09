"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { FunnelStage } from "@/lib/types";

export default function Conversions() {
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);

  useEffect(() => {
    api.getFunnel().then((stages) =>
      setFunnel(stages.filter((s) => s.label !== "Converted")),
    );
  }, []);

  const funnelMax = funnel[0]?.count ?? 1;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Funnel</CardTitle>
          <p className="text-xs text-muted-foreground">
            Impressions → clicks
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
  );
}
