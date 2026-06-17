"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, HelpCircle, Minus, Plus, RotateCcw, Save, Sliders } from "lucide-react";
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
  detail: string;
  min: number;
  max: number;
  step: number;
  beta?: boolean;
}> = [
  {
    key: "threshold",
    label: "Fire threshold",
    hint: "Popup fires when a visitor's score crosses this value.",
    detail:
      "The Fire Threshold sets the minimum score required to trigger the popup. Every visitor builds up a score from their behavior — scrolling, hesitating, tab-switching, and so on. Once their score reaches or crosses this value, the popup appears. Lower it to show the popup more often; raise it to only catch high-intent visitors. Default: 75.",
    min: 30,
    max: 120,
    step: 1,
  },
  {
    key: "decayRate",
    label: "Score decay rate",
    hint: "Points removed every 10 seconds the visitor stays engaged.",
    detail:
      "Score decay prevents the score from creeping up forever on long sessions. Every 10 seconds an engaged visitor stays on the page (touching, scrolling, clicking), this many points are subtracted from their total. Active engagement keeps the score low; idle behavior lets it grow. Default: 5.",
    min: 0,
    max: 20,
    step: 1,
  },
  {
    key: "bouncerThresholdSec",
    label: "Bounce skip window (seconds)",
    hint: "Visitors who leave faster than this never see the popup.",
    detail:
      "If a visitor leaves the page in fewer seconds than this, we treat them as a bouncer — someone who landed by accident — and the popup is skipped entirely, even if their score crosses the threshold. Avoids spamming people who didn't intend to be here. Default: 9 seconds.",
    min: 0,
    max: 30,
    step: 1,
  },
  {
    key: "powerConverterMin",
    label: "Power-converter window (minutes)",
    hint: "Don't interrupt visitors actively shopping with items in cart.",
    detail:
      "If a visitor has spent more than this many minutes on the site AND already has items in their cart, they're considered a 'power converter' — clearly already buying. The popup is suppressed to avoid disrupting their checkout flow. Default: 5 minutes.",
    min: 1,
    max: 30,
    step: 1,
  },
  {
    key: "cartUiGraceSec",
    label: "Cart-tap grace period (seconds)",
    hint: "After tapping the cart icon, wait this long before any popup.",
    detail:
      "When a visitor opens the floating cart drawer or taps the cart icon, they're actively checking out. The popup is suppressed for this many seconds after any such cart-icon tap so we never interrupt a purchase in progress. Default: 60 seconds.",
    min: 0,
    max: 300,
    step: 5,
  },
  {
    key: "purchaseLockDays",
    label: "Post-purchase lock (days)",
    hint: "Recent buyers won't see the popup for this many days.",
    detail:
      "After a visitor completes a purchase, they're locked out of the popup for this many days. Prevents loyal customers from getting flooded with discount offers right after they paid full price. Stored client-side per device. Default: 30 days.",
    min: 0,
    max: 90,
    step: 1,
    beta: true,
  },
  {
    key: "scoreMax",
    label: "Maximum score cap",
    hint: "Score is capped at this value no matter how many signals fire.",
    detail:
      "Prevents runaway scores. Even if a visitor triggers every possible behavior signal, their score will never exceed this cap. Keeps repeat-fire signals like tab-switching from artificially blowing past the fire threshold. Default: 120.",
    min: 50,
    max: 300,
    step: 10,
  },
  {
    key: "autoDismissSec",
    label: "Auto-dismiss timer (seconds)",
    hint: "Popup auto-closes after this many seconds if the visitor doesn't act.",
    detail:
      "Controls the countdown timer shown on the popup. When it reaches zero, the popup closes itself (logged as a 'timeout' dismissal). Lower it for a quicker, less intrusive popup; raise it to give visitors more time to read. Applies to the standard exit-intent popup. Default: 60 seconds.",
    min: 5,
    max: 120,
    step: 5,
  },
];

const WEIGHT_GROUPS: Array<{
  title: string;
  description: string;
  keys: Array<{
    key: keyof ScoringConfig["weights"];
    label: string;
    hint: string;
    detail: string;
    beta?: boolean;
  }>;
}> = [
  {
    title: "Exit signals",
    description: "Behaviors that suggest the visitor is about to leave.",
    keys: [
      {
        key: "popstate",
        label: "Back button or swipe-back",
        hint: "Visitor presses the back button or swipes back on mobile.",
        detail:
          "Detects when a visitor presses the browser back button, swipes back on mobile (iOS/Android gesture), or uses the back arrow in the address bar. This is the strongest exit signal we have — usually means the visitor is one tap away from leaving the site entirely. Higher weight = popup fires sooner on back-button taps.",
      },
      {
        key: "mouseleave_top",
        label: "Cursor leaves toward tabs (desktop)",
        hint: "Mouse moves up toward the browser address bar or tabs.",
        detail:
          "Desktop only. Fires when the visitor's mouse crosses the top edge of the page — usually a signal they're heading for the back button, tabs, or bookmarks. Classic 'exit intent' trigger. Doesn't apply on mobile (no cursor). Higher weight = more sensitive desktop exit detection.",
      },
      {
        key: "visibility_hidden",
        label: "Tab/app hidden",
        hint: "Visitor switches tab, locks screen, or backgrounds the browser.",
        detail:
          "Fires whenever the page becomes hidden — visitor switched browser tabs, locked their phone, opened another app, or minimized the window. Strong signal of distraction or context-switching, often a precursor to leaving. Works on both mobile and desktop. Anveshan's biggest exit signal since 90% of traffic is mobile.",
      },
      {
        key: "tab_blur",
        label: "Window loses focus (desktop)",
        hint: "Visitor clicks away to another app or window (desktop only).",
        detail:
          "Desktop only. Fires when the browser window loses keyboard focus — visitor clicked another app, switched to a different window, or opened DevTools in a separate window. Broader than 'tab hidden' because the page may still be visible. Weaker signal than full tab-hidden.",
        beta: true,
      },
      {
        key: "rapid_scroll_up",
        label: "Rapid scroll to top",
        hint: "Visitor scrolls upward fast — looking for the URL bar or back button.",
        detail:
          "Detects fast upward scrolling near the top of the page (>40 pixels in under 300ms, scroll position under 200px). Strong predictor that a visitor is reaching for the address bar, back button, or browser controls — i.e., about to leave. Fires once per session.",
      },
      {
        key: "touch_idle_25s",
        label: "No touch for 25 seconds (mobile)",
        hint: "Mobile visitor hasn't tapped or scrolled in 25 seconds.",
        detail:
          "Mobile only. Fires when a mobile visitor has been inactive (no tap, no scroll) for 25 seconds straight. Suggests they got distracted, hit a decision wall, or are passively skimming. Resets every time they interact. Doesn't apply on desktop.",
      },
    ],
  },
  {
    title: "Engagement signals",
    description: "Strong interest signals — visitor is invested but hasn't bought yet.",
    keys: [
      {
        key: "pdp_hesitation_20s",
        label: "Product page hesitation (20s, no cart)",
        hint: "20 seconds on a product page without adding to cart.",
        detail:
          "Our signature warm-lead signal. Fires after 20 seconds on any product (PDP) page when the cart is still empty and the visitor hasn't clicked 'Add to Cart'. Classic pattern: visitor is weighing the decision — perfect moment for a nudge. Higher weight = more aggressive hesitation-based popups.",
      },
      {
        key: "reviews_section_seen",
        label: "Scrolled to reviews or FAQ",
        hint: "Visitor scrolled far enough to see social proof.",
        detail:
          "Fires when the visitor scrolls a reviews section, FAQ, or similar social-proof block into view (30% visible). Indicates they're doing due diligence and are seriously considering buying. A small bump helps tip the scale at the perfect moment.",
      },
      {
        key: "multiple_pdps_2plus",
        label: "Viewed 2+ product pages",
        hint: "Visitor has browsed at least 2 different products this session.",
        detail:
          "Fires when the visitor has viewed 2 or more distinct product pages in this session. Suggests comparison shopping — they're interested but undecided. Stored in sessionStorage per tab.",
      },
      {
        key: "many_pdps_4plus",
        label: "Viewed 4+ product pages",
        hint: "Visitor has browsed at least 4 products — possibly indecisive.",
        detail:
          "Fires when the visitor has viewed 4 or more distinct product pages in this session. Comparison fatigue — they're cycling through options and might benefit from a recommendation or discount nudge. Stacks on top of the 2+ signal.",
        beta: true,
      },
      {
        key: "time_30s",
        label: "30 seconds on page",
        hint: "Visitor has been on the current page for 30 seconds.",
        detail:
          "Mild engagement signal. Fires 30 seconds after the page loads. Past the initial bounce window — visitor is at least paying attention. Small contribution to total score.",
      },
      {
        key: "time_60s",
        label: "60 seconds on page",
        hint: "Visitor has spent a full minute on the current page.",
        detail:
          "Deep engagement signal. Fires 60 seconds after page load. Visitor is reading, considering, or scrolling slowly — clearly interested but not yet acting. Stacks on top of the 30s signal.",
      },
      {
        key: "scroll_depth_50",
        label: "Scrolled past halfway",
        hint: "Visitor scrolled at least 50% down the page.",
        detail:
          "Fires when the visitor's scroll position passes 50% of the total page height. Means they've consumed at least half the content — strong sign of engagement, especially on long product pages.",
      },
      {
        key: "cart_has_items",
        label: "Cart already has items",
        hint: "Visitor arrived with items already in their cart.",
        detail:
          "Fires once at page load if the Shopify cart already contains items (checked via /cart.js). Visitor was already shopping in a previous session — they're warm and one step from buying. Bumps their score so the popup can fire sooner if they show exit intent.",
      },
      {
        key: "variant_tap_1",
        label: "First variant selection",
        hint: "Visitor tapped a product variant (size, color, etc.).",
        detail:
          "Fires the first time the visitor selects a product variant — size, color, weight, flavor, etc. Strong consideration signal: they're past 'just browsing' and into 'figuring out which one to buy'.",
      },
      {
        key: "variant_tap_2",
        label: "Second variant selection",
        hint: "Visitor switched variants again — comparing options.",
        detail:
          "Fires on the second variant tap. Visitor is comparing between options — common pattern of indecision. A small bump after this can help push them toward checkout.",
      },
    ],
  },
  {
    title: "Negative signals (push score DOWN)",
    description: "Behaviors that mean the visitor is converting — don't interrupt.",
    keys: [
      {
        key: "add_to_cart_clicked",
        label: "Added item to cart",
        hint: "Subtract heavily — visitor is actively buying.",
        detail:
          "Strongest negative signal. Fires when the visitor clicks any 'Add to Cart' button. They're actively converting — the LAST thing we want is to interrupt with a discount popup. Set to a large negative number to wipe out most of their accumulated score and suppress the popup entirely.",
      },
      {
        key: "search_active",
        label: "Search bar focused",
        hint: "Visitor focused or started typing in the site's search bar.",
        detail:
          "Fires once per session when the visitor focuses any search input — site header search, predictive-search modal, mobile search drawer, or a search results page filter. A focused search means the visitor knows what they're looking for and doesn't need a discount popup distraction. Suppresses popups for focused, intent-driven sessions.",
      },
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
  if (a.autoDismissSec !== b.autoDismissSec) return false;
  for (const k of Object.keys(a.weights) as Array<keyof ScoringConfig["weights"]>) {
    if (a.weights[k] !== b.weights[k]) return false;
  }
  return true;
}

type Props = {
  onBack?: () => void;
};

export default function ScoringStudio({ onBack }: Props = {}) {
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
      {onBack && (
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
      )}
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
              detail={f.detail}
              beta={f.beta}
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
                detail={entry.detail}
                beta={entry.beta}
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
  detail,
  beta,
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
  beta?: boolean;
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
        isChanged && "border-amber-300 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20",
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
            {beta && (
              <span className="rounded bg-amber-100 px-1 py-0.5 text-[9px] font-semibold uppercase leading-none tracking-wide text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                beta
              </span>
            )}
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
