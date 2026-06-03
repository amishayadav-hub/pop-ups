"use client";

import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Save, Sliders } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { DEFAULT_SCORING_CONFIG, type ScoringConfig } from "@/lib/types";

type Status = "idle" | "saving" | "saved";

const CORE_FIELDS: Array<{
  key: keyof Omit<ScoringConfig, "weights">;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
}> = [
  {
    key: "threshold",
    label: "Fire threshold",
    hint: "Popup fires when score crosses this",
    min: 30,
    max: 120,
    step: 1,
  },
  {
    key: "decayRate",
    label: "Decay rate",
    hint: "Points removed every 10s of engagement",
    min: 0,
    max: 20,
    step: 1,
  },
  {
    key: "bouncerThresholdSec",
    label: "Bouncer skip threshold (sec)",
    hint: "Skip popup if visitor stays less than this",
    min: 0,
    max: 30,
    step: 1,
  },
  {
    key: "powerConverterMin",
    label: "Power-converter skip (min)",
    hint: "Skip popup if time exceeds this and cart has items",
    min: 1,
    max: 30,
    step: 1,
  },
  {
    key: "cartUiGraceSec",
    label: "Cart UI grace period (sec)",
    hint: "Suppress popup for this long after cart icon tap",
    min: 0,
    max: 300,
    step: 5,
  },
  {
    key: "purchaseLockDays",
    label: "Post-purchase lock (days)",
    hint: "Don't show popup to recent buyers for this many days",
    min: 0,
    max: 90,
    step: 1,
  },
  {
    key: "scoreMax",
    label: "Score cap (max)",
    hint: "Upper bound for accumulated score",
    min: 50,
    max: 300,
    step: 10,
  },
];

const WEIGHT_GROUPS: Array<{
  title: string;
  description: string;
  keys: Array<{
    key: keyof ScoringConfig["weights"];
    label: string;
    hint: string;
  }>;
}> = [
  {
    title: "Exit signals",
    description: "Visitor showing intent to leave",
    keys: [
      { key: "popstate", label: "Back gesture / popstate", hint: "Mobile back button, swipe-back, browser back arrow" },
      { key: "mouseleave_top", label: "Mouseleave top (desktop)", hint: "Cursor moves toward browser tabs" },
      { key: "visibility_hidden", label: "Visibility hidden", hint: "Tab hidden / app switched / lock screen" },
      { key: "tab_blur", label: "Tab blur (desktop)", hint: "Window lost focus" },
      { key: "rapid_scroll_up", label: "Rapid scroll-up", hint: "Fast scroll toward top of page" },
      { key: "touch_idle_25s", label: "Touch idle 25s (mobile)", hint: "No interaction for 25 seconds on mobile" },
    ],
  },
  {
    title: "Engagement signals",
    description: "Visitor showing strong interest but no conversion yet",
    keys: [
      { key: "pdp_hesitation_20s", label: "PDP hesitation (20s no cart)", hint: "Anveshan signature: warm lead" },
      { key: "reviews_section_seen", label: "Reviews/FAQ seen", hint: "Visitor scrolled to social proof" },
      { key: "multiple_pdps_2plus", label: "Multiple PDPs (2+)", hint: "Comparison shopping" },
      { key: "many_pdps_4plus", label: "Many PDPs (4+)", hint: "Comparison fatigue" },
      { key: "time_30s", label: "Time on page 30s", hint: "Past initial bounce window" },
      { key: "time_60s", label: "Time on page 60s", hint: "Deep engagement" },
      { key: "scroll_depth_50", label: "Scroll depth 50%", hint: "Consumed half the content" },
      { key: "cart_has_items", label: "Cart has items", hint: "Already adding products" },
      { key: "variant_tap_1", label: "Variant tap (1st)", hint: "Considering options" },
      { key: "variant_tap_2", label: "Variant tap (2nd)", hint: "Comparing variants" },
    ],
  },
  {
    title: "Negative signals (push score DOWN)",
    description: "Signs visitor is actively buying — don't disrupt",
    keys: [
      { key: "add_to_cart_clicked", label: "Add to cart clicked", hint: "Strong buying intent" },
      { key: "pinch_zoom", label: "Pinch-zoom product image", hint: "Close inspection — interest rising" },
    ],
  },
];

function deepEqual(a: ScoringConfig, b: ScoringConfig): boolean {
  if (a.threshold !== b.threshold) return false;
  if (a.decayRate !== b.decayRate) return false;
  if (a.bouncerThresholdSec !== b.bouncerThresholdSec) return false;
  if (a.powerConverterMin !== b.powerConverterMin) return false;
  if (a.cartUiGraceSec !== b.cartUiGraceSec) return false;
  if (a.purchaseLockDays !== b.purchaseLockDays) return false;
  if (a.scoreMax !== b.scoreMax) return false;
  for (const k of Object.keys(a.weights) as Array<keyof ScoringConfig["weights"]>) {
    if (a.weights[k] !== b.weights[k]) return false;
  }
  return true;
}

export default function ScoringStudio() {
  const [original, setOriginal] = useState<ScoringConfig | null>(null);
  const [draft, setDraft] = useState<ScoringConfig | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getScoringConfig()
      .then((cfg) => {
        setOriginal(cfg);
        setDraft(cfg);
      })
      .catch((e) => setLoadError((e as Error).message));
  }, []);

  const isDirty = useMemo(() => {
    if (!original || !draft) return false;
    return !deepEqual(original, draft);
  }, [original, draft]);

  const updateCore = <K extends keyof Omit<ScoringConfig, "weights">>(
    key: K,
    value: ScoringConfig[K],
  ) => {
    if (!draft) return;
    setDraft({ ...draft, [key]: value });
    setStatus("idle");
  };

  const updateWeight = (
    key: keyof ScoringConfig["weights"],
    value: number,
  ) => {
    if (!draft) return;
    setDraft({ ...draft, weights: { ...draft.weights, [key]: value } });
    setStatus("idle");
  };

  const onSave = async () => {
    if (!draft || !isDirty) return;
    setStatus("saving");
    try {
      await api.setScoringConfig(draft);
      setOriginal(draft);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (e) {
      setStatus("idle");
      setLoadError((e as Error).message);
    }
  };

  const onReset = () => {
    setDraft(DEFAULT_SCORING_CONFIG);
    setStatus("idle");
  };

  if (loadError) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-destructive">
          Failed to load scoring config: {loadError}
        </CardContent>
      </Card>
    );
  }

  if (!draft || !original) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Loading scoring config…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Sticky save bar */}
      <Card
        className={cn(
          "sticky top-16 z-10 transition-colors",
          isDirty && "border-amber-300 bg-amber-50 dark:bg-amber-950/30",
        )}
      >
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary">
              <Sliders className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">Scoring Studio</div>
              <p className="text-xs text-muted-foreground">
                {isDirty
                  ? "Unsaved changes — visitors get new weights within 5 min of save."
                  : "Live config matches saved state. Edit any value below to start tuning."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {status === "saved" && (
              <Badge
                variant="secondary"
                className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
              >
                Saved
              </Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={onReset}
              disabled={status === "saving"}
              className="gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset to defaults
            </Button>
            <Button
              size="sm"
              onClick={onSave}
              disabled={!isDirty || status === "saving"}
              className="gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              {status === "saving" ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Core thresholds */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">
            Core thresholds + gates
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            The score threshold determines when a popup fires. Skip thresholds
            short-circuit the popup entirely.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {CORE_FIELDS.map((f) => (
            <NumberField
              key={f.key}
              label={f.label}
              hint={f.hint}
              value={draft[f.key] as number}
              defaultValue={DEFAULT_SCORING_CONFIG[f.key] as number}
              min={f.min}
              max={f.max}
              step={f.step}
              onChange={(v) => updateCore(f.key, v as never)}
            />
          ))}
        </CardContent>
      </Card>

      {/* Weight groups */}
      {WEIGHT_GROUPS.map((group) => (
        <Card key={group.title}>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              {group.title}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{group.description}</p>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {group.keys.map((entry) => (
              <NumberField
                key={entry.key}
                label={entry.label}
                hint={entry.hint}
                value={draft.weights[entry.key]}
                defaultValue={DEFAULT_SCORING_CONFIG.weights[entry.key]}
                min={-100}
                max={100}
                step={1}
                onChange={(v) => updateWeight(entry.key, v)}
                signed
              />
            ))}
          </CardContent>
        </Card>
      ))}

      <Separator />
      <p className="text-xs text-muted-foreground">
        Changes apply within ~5 minutes for visitors who load the SDK after save
        (Firebase Hosting cache TTL). Existing visitors keep their session weights
        until their next page load.
      </p>
    </div>
  );
}

function NumberField({
  label,
  hint,
  value,
  defaultValue,
  min,
  max,
  step,
  onChange,
  signed,
}: {
  label: string;
  hint: string;
  value: number;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  signed?: boolean;
}) {
  const isChanged = value !== defaultValue;
  const displayValue =
    signed && value > 0 ? `+${value}` : signed && value === 0 ? "0" : `${value}`;

  return (
    <div
      className={cn(
        "rounded-md border bg-background p-3 transition-colors",
        isChanged && "border-amber-300 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-xs font-medium">{label}</label>
        <span
          className={cn(
            "tabular-nums text-xs font-semibold",
            isChanged ? "text-amber-700 dark:text-amber-400" : "text-foreground",
          )}
        >
          {displayValue}
        </span>
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 h-1.5 cursor-pointer appearance-none rounded-full bg-muted accent-foreground"
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-16 rounded-md border bg-background px-2 py-1 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      {isChanged && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Default: {signed && defaultValue > 0 ? "+" : ""}
          {defaultValue}
        </p>
      )}
    </div>
  );
}
