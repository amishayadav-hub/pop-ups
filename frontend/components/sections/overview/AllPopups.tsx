"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { ABANDONMENT_PLACEHOLDER } from "@/lib/mock-data";
import type { PopupSummary } from "@/lib/types";

const POSITION_LABEL: Record<string, string> = {
  "top-left": "Top left",
  "top-center": "Top center",
  "top-right": "Top right",
  "middle-left": "Middle left",
  center: "Center",
  "middle-right": "Middle right",
  "bottom-left": "Bottom left",
  "bottom-center": "Bottom center",
  "bottom-right": "Bottom right",
};

// Popups that drill into a dedicated analytics view when clicked.
const DRILLABLE_IDS = new Set<string>([
  "exit-intent",
  "abandonment-exit-intent",
]);

type Props = {
  onSelectPopup?: (
    popupId: string,
    popupName: string,
    description: string,
  ) => void;
};

const DESCRIPTIONS: Record<string, string> = {
  "exit-intent":
    "Desktop cursor-leave detection + multi-signal exit intent scoring.",
  "abandonment-exit-intent":
    "Triggered when a visitor with items in cart shows abandonment behaviour.",
};

export default function AllPopups({ onSelectPopup }: Props) {
  const [popups, setPopups] = useState<PopupSummary[]>([]);

  useEffect(() => {
    api.getPopups().then((real) => {
      // Use the real abandonment doc if Firestore has one; otherwise fall
      // back to the placeholder. Merge so display fields are never blank.
      const realAbandonment = real.find(
        (p) => p.id === "abandonment-exit-intent",
      );
      const abandonment = {
        ...ABANDONMENT_PLACEHOLDER,
        ...(realAbandonment ?? {}),
      };

      // Rebuild the list: rename exit-intent → "Normal Exit Intent" and
      // place the single abandonment entry right after it. Skip any real
      // abandonment doc in the loop so it can't be added twice.
      const out: PopupSummary[] = [];
      let inserted = false;
      for (const p of real) {
        if (p.id === "abandonment-exit-intent") continue;
        if (p.id === "exit-intent") {
          out.push({ ...p, name: "Normal Exit Intent" });
          out.push(abandonment);
          inserted = true;
        } else {
          out.push(p);
        }
      }
      if (!inserted) out.push(abandonment);
      setPopups(out);
    });
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">All popups</CardTitle>
        <p className="text-xs text-muted-foreground">
          Every popup type with live performance and current position.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-12 gap-2 border-b px-5 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <div className="col-span-5">Popup</div>
          <div className="col-span-3">Status</div>
          <div className="col-span-2 text-right">CTR</div>
          <div className="col-span-2 text-right">Position</div>
        </div>
        {popups.map((p) => {
          const drillable = DRILLABLE_IDS.has(p.id);
          const handleClick = () => {
            if (!drillable || !onSelectPopup) return;
            onSelectPopup(
              p.id,
              p.name,
              DESCRIPTIONS[p.id] ?? "",
            );
          };
          return (
            <div
              key={p.id}
              role={drillable ? "button" : undefined}
              tabIndex={drillable ? 0 : undefined}
              onClick={drillable ? handleClick : undefined}
              onKeyDown={
                drillable
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleClick();
                      }
                    }
                  : undefined
              }
              className={cn(
                "grid grid-cols-12 items-center gap-2 border-b px-5 py-3 text-sm last:border-b-0",
                drillable
                  ? "cursor-pointer transition-colors hover:bg-accent/40 focus:bg-accent/50 focus:outline-none"
                  : "hover:bg-accent/30",
              )}
            >
              <div className="col-span-5 flex items-center gap-2 font-medium">
                {p.name}
              </div>
              <div className="col-span-3">
                <Badge
                  variant={p.status === "active" ? "secondary" : "outline"}
                  className="capitalize"
                >
                  <span
                    className={
                      p.status === "active"
                        ? "mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500"
                        : "mr-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/40"
                    }
                  />
                  {p.status}
                </Badge>
              </div>
              <div className="col-span-2 text-right tabular-nums">
                {p.ctr.toFixed(1)}%
              </div>
              <div className="col-span-2 flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
                <span>{POSITION_LABEL[p.position]}</span>
                {drillable && (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
