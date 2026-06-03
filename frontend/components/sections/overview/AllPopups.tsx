"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
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

export default function AllPopups() {
  const [popups, setPopups] = useState<PopupSummary[]>([]);

  useEffect(() => {
    api.getPopups().then(setPopups);
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
          <div className="col-span-4">Popup</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2 text-right">CTR</div>
          <div className="col-span-2 text-right">Conversions</div>
          <div className="col-span-2 text-right">Position</div>
        </div>
        {popups.map((p) => (
          <div
            key={p.id}
            className="grid grid-cols-12 items-center gap-2 border-b px-5 py-3 text-sm last:border-b-0 hover:bg-accent/30"
          >
            <div className="col-span-4 font-medium">{p.name}</div>
            <div className="col-span-2">
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
            <div className="col-span-2 text-right tabular-nums">
              {p.conversions.toLocaleString()}
            </div>
            <div className="col-span-2 text-right text-xs text-muted-foreground">
              {POSITION_LABEL[p.position]}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
