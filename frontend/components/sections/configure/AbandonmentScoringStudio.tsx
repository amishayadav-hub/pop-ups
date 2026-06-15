"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  HelpCircle,
  Minus,
  Plus,
  RotateCcw,
  Save,
  Sliders,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import {
  DEFAULT_ABANDONMENT_CONFIG,
  type AbandonmentScoringConfig,
} from "@/lib/types";

type Status = "idle" | "saving" | "saved";

type Props = {
  onBack: () => void;
};

const CORE_FIELDS: Array<{
  key: keyof Omit<AbandonmentScoringConfig, "weights">;
  label: string;
  hint: string;
  detail: string;
  min: number;
  max: number;
  step: number;
}> = [
  {
    key: "threshold",
    label: "Fire threshold",
    hint: "Reminder popup fires when abandonment score crosses this value.",
    detail:
      "Sets the minimum abandonment score required to trigger the reminder popup. Cart-having visitors already proved buying intent, so this is typically LOWER than the normal exit-intent threshold. Lower it for more reminder popups; raise it for only the strongest abandonment signals. Default: 50.",
    min: 20,
    max: 120,
    step: 1,
  },
  {
    key: "decayRate",
    label: "Score decay rate",
    hint: "Points removed every 10s of active engagement.",
    detail:
      "Slower decay than normal engine because cart items don't fade — once added, they sit there urgently. Every 10 seconds an engaged visitor stays on the page, this many points are subtracted from their abandonment score. Default: 2 (slower than the normal engine's 5).",
    min: 0,
    max: 20,
    step: 1,
  },
  {
    key: "scoreMax",
    label: "Maximum score cap",
    hint: "Score is capped at this value no matter how many signals fire.",
    detail:
      "Even if a visitor triggers every abandonment signal multiple times, their score will never exceed this cap. Prevents repeat-fire signals from artificially blowing past the fire threshold. Default: 120.",
    min: 50,
    max: 300,
    step: 10,
  },
];

const EXIT_SIGNAL_FIELDS: Array<{
  key: keyof AbandonmentScoringConfig["weights"];
  label: string;
  hint: string;
  detail: string;
}> = [
  {
    key: "popstate",
    label: "Back button or swipe-back",
    hint: "Visitor presses back / swipes back on mobile.",
    detail:
      "Strongest exit signal — visitor is one tap away from leaving the site. Detects browser back button, mobile swipe-back gesture, and back arrow.",
  },
  {
    key: "mouseleave_top",
    label: "Cursor leaves toward tabs (desktop)",
    hint: "Mouse moves up toward browser address bar or tabs.",
    detail:
      "Desktop only. Classic exit-intent trigger. Visitor's cursor crossing the top edge usually means they're heading for tabs, bookmarks, or back button.",
  },
  {
    key: "visibility_hidden",
    label: "Tab / app hidden",
    hint: "Visitor switches tab, locks screen, or backgrounds the browser.",
    detail:
      "Fires when the page becomes hidden — tab switch, app switch, screen lock, window minimize. Works on mobile and desktop. The biggest exit signal on mobile.",
  },
  {
    key: "tab_blur",
    label: "Window loses focus (desktop)",
    hint: "Visitor clicks another app or window.",
    detail:
      "Desktop only. Window loses keyboard focus — visitor switched apps. Broader than 'tab hidden' because the page may still be visible.",
  },
  {
    key: "rapid_scroll_up",
    label: "Rapid scroll to top",
    hint: "Visitor scrolls upward fast — looking for URL bar.",
    detail:
      "Fast upward scroll near the top of the page (>40px in <300ms). Predicts visitor reaching for browser controls. Fires once per session.",
  },
  {
    key: "touch_idle_25s",
    label: "No touch for 25 seconds (mobile)",
    hint: "Mobile visitor hasn't tapped or scrolled in 25 seconds.",
    detail:
      "Mobile only. 25 seconds of inactivity. Resets on any tap/scroll. Suggests distraction or decision wall.",
  },
];

const NEGATIVE_SIGNAL_FIELDS: Array<{
  key: keyof AbandonmentScoringConfig["weights"];
  label: string;
  hint: string;
  detail: string;
}> = [
  {
    key: "reviews_section_seen",
    label: "Scrolled to reviews or FAQ",
    hint: "Visitor is reading social proof — still engaged.",
    detail:
      "Visitor scrolled to a reviews / FAQ block. They're researching, not abandoning. Subtract a small amount to delay the reminder popup.",
  },
  {
    key: "time_30s",
    label: "30 seconds on page",
    hint: "Still on the page after 30 seconds — not yet abandoning.",
    detail:
      "Mild engagement signal. After 30 seconds, the visitor isn't actively bouncing. Small negative weight delays popup until stronger signals appear.",
  },
  {
    key: "time_60s",
    label: "60 seconds on page",
    hint: "A full minute on the page — deeply engaged.",
    detail:
      "Deep engagement signal. After 60 seconds, the visitor is clearly considering. Negative weight prevents the popup from firing on someone who's still actively shopping.",
  },
  {
    key: "variant_tap_1",
    label: "First variant selection",
    hint: "Visitor tapped a product variant — still considering options.",
    detail:
      "Variant taps mean active consideration, not abandonment. Subtract small amount to delay popup.",
  },
];

function deepEqual(
  a: AbandonmentScoringConfig,
  b: AbandonmentScoringConfig,
): boolean {
  if (a.threshold !== b.threshold) return false;
  if (a.decayRate !== b.decayRate) return false;
  if (a.scoreMax !== b.scoreMax) return false;
  for (const k of Object.keys(a.weights) as Array<
    keyof AbandonmentScoringConfig["weights"]
  >) {
    if (a.weights[k] !== b.weights[k]) return false;
  }
  return true;
}

export default function AbandonmentScoringStudio({ onBack }: Props) {
  const [original, setOriginal] = useState<AbandonmentScoringConfig | null>(
    null,
  );
  const [draft, setDraft] = useState<AbandonmentScoringConfig | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getAbandonmentScoringConfig()
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

  const updateCore = <K extends keyof Omit<AbandonmentScoringConfig, "weights">>(
    key: K,
    value: AbandonmentScoringConfig[K],
  ) => {
    if (!draft) return;
    setDraft({ ...draft, [key]: value });
    setStatus("idle");
  };

  const updateWeight = (
    key: keyof AbandonmentScoringConfig["weights"],
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
      await api.setAbandonmentScoringConfig(draft);
      setOriginal(draft);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (e) {
      setStatus("idle");
      setLoadError((e as Error).message);
    }
  };

  const onReset = () => {
    setDraft(DEFAULT_ABANDONMENT_CONFIG);
    setStatus("idle");
  };

  if (loadError) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-destructive">
          Failed to load abandonment scoring config: {loadError}
        </CardContent>
      </Card>
    );
  }

  if (!draft || !original) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Loading abandonment scoring config…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Back nav */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1.5 -ml-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Analytics
        </Button>
      </div>

      {/* Sticky save bar */}
      <Card
        className={cn(
          "sticky top-16 z-10 transition-colors",
          isDirty && "border-amber-300 bg-amber-50 dark:bg-amber-950/30",
        )}
      >
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-[#7a8d3a]/15 text-[#5b6d25] dark:bg-[#a8bb5e]/15 dark:text-[#a8bb5e]">
              <Sliders className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">
                Abandonment Scoring Studio
              </div>
              <p className="text-xs text-muted-foreground">
                {isDirty
                  ? "Unsaved changes — visitors get new weights within 5 min of save."
                  : "Live config matches saved state. Edit any value below to start tuning the abandonment engine."}
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
            Score threshold determines when the reminder popup fires.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {CORE_FIELDS.map((f) => (
            <NumberField
              key={f.key}
              label={f.label}
              hint={f.hint}
              detail={f.detail}
              value={draft[f.key] as number}
              defaultValue={DEFAULT_ABANDONMENT_CONFIG[f.key] as number}
              min={f.min}
              max={f.max}
              step={f.step}
              onChange={(v) => updateCore(f.key, v as never)}
            />
          ))}
        </CardContent>
      </Card>

      {/* Exit signals */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Exit signals</CardTitle>
          <p className="text-xs text-muted-foreground">
            Behaviors that suggest the cart-having visitor is about to leave.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {EXIT_SIGNAL_FIELDS.map((entry) => (
            <NumberField
              key={entry.key}
              label={entry.label}
              hint={entry.hint}
              detail={entry.detail}
              value={draft.weights[entry.key]}
              defaultValue={DEFAULT_ABANDONMENT_CONFIG.weights[entry.key]}
              min={-100}
              max={100}
              step={1}
              onChange={(v) => updateWeight(entry.key, v)}
              signed
            />
          ))}
        </CardContent>
      </Card>

      {/* Negative engagement signals */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">
            Engagement signals (negative — push score down)
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            When the visitor is still engaged after add-to-cart, subtract small
            amounts to delay the reminder popup. Range: -1 to -10.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {NEGATIVE_SIGNAL_FIELDS.map((entry) => (
            <NumberField
              key={entry.key}
              label={entry.label}
              hint={entry.hint}
              detail={entry.detail}
              value={draft.weights[entry.key]}
              defaultValue={DEFAULT_ABANDONMENT_CONFIG.weights[entry.key]}
              min={-10}
              max={0}
              step={1}
              onChange={(v) => updateWeight(entry.key, v)}
              signed
            />
          ))}
        </CardContent>
      </Card>

      <Separator />
      <p className="text-xs text-muted-foreground">
        Changes apply within ~5 minutes for visitors who load the SDK after
        save (Firebase Hosting cache TTL). Existing visitors keep their session
        weights until their next page load.
      </p>
    </div>
  );
}

function NumberField({
  label,
  hint,
  detail,
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
  detail: string;
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

  const [showHelp, setShowHelp] = useState(false);
  const helpRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showHelp) return;
    const onDocClick = (e: MouseEvent) => {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
        setShowHelp(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowHelp(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [showHelp]);

  return (
    <div
      className={cn(
        "relative rounded-md border bg-background p-3 transition-colors",
        isChanged &&
          "border-amber-300 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div ref={helpRef} className="relative flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            aria-expanded={showHelp}
            aria-label={`More info about ${label}`}
            className="-ml-0.5 inline-flex items-center gap-1 rounded text-xs font-medium hover:text-[#525252] focus:outline-none focus:ring-2 focus:ring-ring dark:hover:text-[#d4d4d4]"
          >
            <span>{label}</span>
            <HelpCircle className="h-3 w-3 text-[#7c7c7c] dark:text-[#a8a8a8]" />
          </button>
          {showHelp && (
            <div
              role="tooltip"
              className="absolute left-0 top-full z-50 mt-1.5 w-72 rounded-md border border-[#d4d4d4] bg-[#f5f5f5] p-3 text-[11px] leading-relaxed text-[#404040] shadow-lg dark:border-[#4a4a4a] dark:bg-[#262626] dark:text-[#d4d4d4]"
            >
              <div className="mb-1 text-[11px] font-semibold text-[#525252] dark:text-[#d4d4d4]">
                {label}
              </div>
              {detail}
            </div>
          )}
        </div>
        <span
          className={cn(
            "tabular-nums text-xs font-semibold",
            isChanged ? "text-amber-700 dark:text-amber-400" : "text-foreground",
          )}
        >
          {displayValue}
        </span>
      </div>
      <p className="mt-0.5 text-[11px] text-[#7c7c7c] dark:text-[#a8a8a8]">
        {hint}
      </p>
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
        <div className="flex items-center rounded-md border bg-background">
          <button
            type="button"
            aria-label={`Decrease ${label}`}
            onClick={() => onChange(Math.max(min, value - step))}
            disabled={value <= min}
            className="grid h-7 w-7 place-items-center rounded-l-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Minus className="h-3 w-3" />
          </button>
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-12 border-x bg-transparent px-1 py-1 text-center text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            aria-label={`Increase ${label}`}
            onClick={() => onChange(Math.min(max, value + step))}
            disabled={value >= max}
            className="grid h-7 w-7 place-items-center rounded-r-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
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
