import { Api, matchesUrl, nextIntentBucket } from "./api";
import { applyDiscountAndRedirect, showPopup } from "./render";
import { markShown } from "./storage";
import type { Popup } from "./types";
import { getSessionId, getVisitorId, isMobile } from "./visitor";
import {
  createState,
  startEvaluator,
  DEFAULT_ENGINE_CONFIG,
  type EngineConfig,
  type ScoringState,
} from "./score/engine";
import {
  hasPurchasedRecently,
  markPopupShown,
  shouldSkip,
  DEFAULT_GATES_CONFIG,
  type GatesConfig,
} from "./score/gates";
import {
  attachAllSignals,
  fetchCartSnapshot,
  DEFAULT_WEIGHTS,
  type SignalWeights,
} from "./score/signals";

/**
 * Reads scoring config from Firestore (if present) and merges with defaults.
 * Returns engineConfig (threshold/decay/etc), gatesConfig (bouncer/converter
 * skip thresholds), weights (per-signal point values), and cart UI grace ms.
 */
function deriveScoringConfig(
  remote: Record<string, any> | null,
): {
  engine: EngineConfig;
  gates: GatesConfig;
  weights: SignalWeights;
  cartUiGraceMs: number;
} {
  const r = remote ?? {};
  const w = (r.weights ?? {}) as Partial<SignalWeights>;
  return {
    engine: {
      ...DEFAULT_ENGINE_CONFIG,
      threshold:
        typeof r.threshold === "number" ? r.threshold : DEFAULT_ENGINE_CONFIG.threshold,
      decayRate:
        typeof r.decayRate === "number" ? r.decayRate : DEFAULT_ENGINE_CONFIG.decayRate,
      decayIntervalMs:
        typeof r.decayIntervalMs === "number"
          ? r.decayIntervalMs
          : DEFAULT_ENGINE_CONFIG.decayIntervalMs,
      evalIntervalMs:
        typeof r.evalIntervalMs === "number"
          ? r.evalIntervalMs
          : DEFAULT_ENGINE_CONFIG.evalIntervalMs,
      scoreMin:
        typeof r.scoreMin === "number" ? r.scoreMin : DEFAULT_ENGINE_CONFIG.scoreMin,
      scoreMax:
        typeof r.scoreMax === "number" ? r.scoreMax : DEFAULT_ENGINE_CONFIG.scoreMax,
    },
    gates: {
      bouncerThresholdMs:
        typeof r.bouncerThresholdSec === "number"
          ? r.bouncerThresholdSec * 1000
          : DEFAULT_GATES_CONFIG.bouncerThresholdMs,
      powerConverterMs:
        typeof r.powerConverterMin === "number"
          ? r.powerConverterMin * 60_000
          : DEFAULT_GATES_CONFIG.powerConverterMs,
      purchaseLockDays:
        typeof r.purchaseLockDays === "number"
          ? r.purchaseLockDays
          : DEFAULT_GATES_CONFIG.purchaseLockDays,
    },
    weights: { ...DEFAULT_WEIGHTS, ...w },
    cartUiGraceMs:
      typeof r.cartUiGraceSec === "number" ? r.cartUiGraceSec * 1000 : 60_000,
  };
}

function readBootstrap(): {
  projectId?: string;
  webApiKey?: string;
  databaseId?: string;
  css?: string;
} {
  if (typeof document === "undefined") return {};
  const script =
    (document.currentScript as HTMLScriptElement | null) ??
    (document.querySelector("script[data-project]") as HTMLScriptElement | null);
  if (!script) return {};
  return {
    projectId: script.dataset.project,
    webApiKey: script.dataset.webKey,
    databaseId: script.dataset.db ?? "default",
    css: script.dataset.css,
  };
}

async function boot() {
  const { projectId, webApiKey, databaseId, css } = readBootstrap();
  if (!projectId || !webApiKey) {
    console.warn(
      "[NexCent] missing data-project or data-web-key on script tag",
    );
    return;
  }

  // 1. Inject popup CSS (async, doesn't block)
  if (css !== "off") {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    const scriptSrc =
      (document.currentScript as HTMLScriptElement | null)?.src ?? "";
    const base = scriptSrc.replace(/\/[^/]+$/, "");
    link.href = css || (base ? `${base}/popup.css` : "/v1/popup.css");
    document.head.appendChild(link);
  }

  // 2. Init visitor + device + API client
  const visitorId = getVisitorId();
  const sessionId = getSessionId();
  const device: "mobile" | "desktop" = isMobile() ? "mobile" : "desktop";
  const api = new Api({
    projectId,
    webApiKey,
    databaseId: databaseId ?? "default",
    visitorId,
    sessionId,
    device,
  });

  // 3. Fetch popup config + cart snapshot + scoring config in parallel
  const [cfg, cartItemCount, remoteScoring] = await Promise.all([
    api.getConfig(),
    fetchCartSnapshot(),
    api.getScoringConfig(),
  ]);

  if (!cfg || !cfg.popups?.length) return;

  // 4. Pick the single active popup eligible for this page
  const popup = cfg.popups.find(
    (p) =>
      p.status === "active" &&
      matchesUrl(p.targetUrlPatterns, location.pathname),
  );
  if (!popup) return;

  // 5. Resolve scoring config (Firestore overrides → defaults)
  const scoring = deriveScoringConfig(remoteScoring);

  // 6. Initialize unified scoring state
  const state = createState({
    cartItemCount,
    hasConverted: hasPurchasedRecently(scoring.gates.purchaseLockDays),
    engineConfig: scoring.engine,
  });

  // 7. Attach all passive behavior listeners with tunable weights
  attachAllSignals(state, scoring.weights, scoring.cartUiGraceMs);

  // 8. Start the score evaluator (1-sec idle loop)
  startEvaluator({
    state,
    shouldSkip: () => shouldSkip(state, scoring.gates),
    onFire: (firedState) => {
      onScoreThresholdReached(popup, api, firedState);
    },
  });

  // 8. Expose debug handle for QA — available on:
  //   • localhost (dev)
  //   • hostnames containing "test" (our test.html on Hosting)
  //   • *.myshopify.com (Shopify dev/staging stores)
  //   • any page with ?nx_debug=1 in the URL (manual override)
  if (
    location.hostname === "localhost" ||
    location.hostname.includes("test") ||
    location.hostname.endsWith(".myshopify.com") ||
    /[?&]nx_debug=1\b/.test(location.search)
  ) {
    (window as any).__nx_state = state;
  }
}

function onScoreThresholdReached(
  popup: Popup,
  api: Api,
  state: ScoringState,
): void {
  // Render the popup — bails out (returns null) if no banner image set.
  const shown = showPopup(popup);
  if (!shown) {
    // No banner uploaded → don't show empty popup, don't waste impression.
    return;
  }

  // Mark session-shown so we don't fire again
  markPopupShown();
  markShown(popup.id);

  // Build score-breakdown payload for analytics
  const scoreSnapshot = {
    score: state.score,
    threshold: state.engineConfig.threshold,
    timeOnPageMs: Date.now() - state.bornAt,
    signals: state.signalLog
      .map((s) => `${s.name}:${s.weight}`)
      .slice(-20), // last 20 contributions to keep payload small
  };

  const intent = nextIntentBucket(popup.id);

  api.sendEvent(
    {
      popupId: popup.id,
      type: "impression",
      ...scoreSnapshot,
    },
    popup.position,
  );

  shown.onCta(() => {
    api.sendEvent(
      { popupId: popup.id, type: "click" },
      popup.position,
    );
    api.sendEvent(
      {
        popupId: popup.id,
        type: "convert",
        conversionKind: "click",
        intent,
      },
      popup.position,
    );
    applyDiscountAndRedirect(popup.discountCode, popup.redirectPath);
  });

  shown.onClose((reason) => {
    // Popup dismissed without conversion — log it so the dashboard can
    // distinguish active rejection (X / backdrop) from passive ignore.
    api.sendEvent(
      {
        popupId: popup.id,
        type: "dismiss",
        dismissReason: reason,
      },
      popup.position,
    );
  });
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
}
