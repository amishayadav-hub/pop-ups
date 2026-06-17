"use client";

import { cn } from "@/lib/utils";
import type { WeeklyDataPoint } from "@/lib/types";

type Props = {
  data: WeeklyDataPoint[];
  label?: string;
  className?: string;
};

export function WeeklyBar({ data, label = "Impressions", className }: Props) {
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className={cn("w-full", className)}>
      <div className="flex h-48 items-stretch gap-2 px-1">
        {data.map((d) => {
          const pct = (d.count / max) * 100;
          return (
            <div
              key={d.day}
              className="group flex h-full flex-1 flex-col items-center"
              title={`${d.day}: ${d.count.toLocaleString()} ${label.toLowerCase()}`}
            >
              <div className="mb-1 text-[10px] font-medium tabular-nums text-muted-foreground transition-colors group-hover:text-foreground">
                {d.count.toLocaleString()}
              </div>
              {/* flex-1 bar area gives the % height a real box to resolve against */}
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-primary/60 to-primary transition-all group-hover:from-primary group-hover:to-primary/90"
                  style={{ height: `${Math.max(pct, 2)}%` }}
                  aria-label={`${d.day}: ${d.count} ${label.toLowerCase()}`}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-2 px-1">
        {data.map((d) => (
          <div
            key={d.day}
            className="flex-1 text-center text-[11px] font-medium text-muted-foreground"
          >
            {d.day}
          </div>
        ))}
      </div>
    </div>
  );
}
