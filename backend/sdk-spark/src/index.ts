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
  createAbandonmentState,
  updateScenario,
  DEFAULT_ABANDONMENT_ENGINE_CONFIG,
  type AbandonmentState,
} from "./score/abandonmentEngine";
import {
  hasPurchasedRecently,
  markPopupShown,
  shouldSkip,
  DEFAULT_GATES_CONFIG,
  type GatesConfig,
} from "./score/gates";
import {
  attachAllSignals,
  attachAllAbandonmentSignals,
  fetchCartSnapshot,
  DEFAULT_WEIGHTS,
  DEFAULT_ABANDONMENT_WEIGHTS,
  type SignalWeights,
  type AbandonmentSignalWeights,
} from "./score/signals";

const ABANDONMENT_SHOWN_KEY = "nx_abandonment_shown_session";

function isAbandonmentAlreadyShown(): boolean {
  try {
    return sessionStorage.getItem(ABANDONMENT_SHOWN_KEY) === "1";
  } catch {
    return false;
  }
}

function markAbandonmentShown(): void {
  try {
    sessionStorage.setItem(ABANDONMENT_SHOWN_KEY, "1");
  } catch {
    /* ignore */
  }
}

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

function deriveAbandonmentConfig(
  remote: Record<string, any> | null,
): {
  engine: EngineConfig;
  weights: AbandonmentSignalWeights;
} {
  const r = remote ?? {};
  const w = (r.weights ?? {}) as Partial<AbandonmentSignalWeights>;
  return {
    engine: {
      ...DEFAULT_ABANDONMENT_ENGINE_CONFIG,
      threshold:
        typeof r.threshold === "number"
          ? r.threshold
          : DEFAULT_ABANDONMENT_ENGINE_CONFIG.threshold,
      decayRate:
        typeof r.decayRate === "number"
          ? r.decayRate
          : DEFAULT_ABANDONMENT_ENGINE_CONFIG.decayRate,
      scoreMax:
        typeof r.scoreMax === "number"
          ? r.scoreMax
          : DEFAULT_ABANDONMENT_ENGINE_CONFIG.scoreMax,
    },
    weights: { ...DEFAULT_ABANDONMENT_WEIGHTS, ...w },
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

  // 3. Fetch config + cart snapshot + BOTH scoring configs in parallel
  const [cfg, cartItemCount, remoteScoring, remoteAbandonment] =
    await Promise.all([
      api.getConfig(),
      fetchCartSnapshot(),
      api.getScoringConfig(),
      api.getAbandonmentScoringConfig(),
    ]);

  if (!cfg || !cfg.popups?.length) return;

  // 4. Pick BOTH popups: the page-matching normal popup, and the
  //    abandonment-exit-intent popup (if active + has banner).
  const normalPopup = cfg.popups.find(
    (p) =>
      p.id !== "abandonment-exit-intent" &&
      p.status === "active" &&
      matchesUrl(p.targetUrlPatterns, location.pathname),
  );
  const abandonmentPopup = cfg.popups.find(
    (p) => p.id === "abandonment-exit-intent" && p.status === "active",
  );
  if (!normalPopup && !abandonmentPopup) return;

  // 5. Resolve scoring config (Firestore overrides → defaults)
  const scoring = deriveScoringConfig(remoteScoring);
  const abandonmentCfg = deriveAbandonmentConfig(remoteAbandonment);

  const hasConverted = hasPurchasedRecently(scoring.gates.purchaseLockDays);

  // 6. Initialize state for BOTH engines
  const state = createState({
    cartItemCount,
    hasConverted,
    engineConfig: scoring.engine,
  });
  const abState = createAbandonmentState({
    initialCartItemCount: cartItemCount,
    hasConverted,
    engineConfig: abandonmentCfg.engine,
  });

  // 7. Attach all listeners — normal + abandonment
  attachAllSignals(state, scoring.weights, scoring.cartUiGraceMs);
  attachAllAbandonmentSignals(abState, abandonmentCfg.weights);

  // 8. Conflict resolution: once abandonment fires, normal stops.
  let abandonmentFired = false;

  if (abandonmentPopup) {
    startEvaluator({
      state: abState,
      shouldSkip: () => {
        if (abandonmentFired) return "already_fired";
        if (state.fired) return "normal_already_fired";
        if (isAbandonmentAlreadyShown()) return "abandonment_already_shown";
        if (hasConverted) return "already_converted";
        return null;
      },
      onFire: (firedState) => {
        abandonmentFired = true;
        updateScenario(abState);
        onAbandonmentFired(
          abandonmentPopup,
          api,
          firedState as AbandonmentState,
        );
      },
    });
  }

  if (normalPopup) {
    startEvaluator({
      state,
      shouldSkip: () => {
        if (abandonmentFired) return "abandonment_took_priority";
        return shouldSkip(state, scoring.gates);
      },
      onFire: (firedState) => {
        onScoreThresholdReached(normalPopup, api, firedState);
      },
    });
  }

  // 9. Expose debug handle for QA — available on:
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
    (window as any).__nx_ab_state = abState;
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

function onAbandonmentFired(
  popup: Popup,
  api: Api,
  state: AbandonmentState,
): void {
  // Reminder popup: image + X + backdrop dismiss, NO 60s timer.
  // Banner click redirects to popup.redirectPath. No discount code applied.
  const shown = showPopup(popup, { withTimer: false });
  if (!shown) return;

  // Session-once flag distinct from normal popup's flag
  markAbandonmentShown();
  markShown(popup.id);

  const scenario = state.lastScenario;
  const scoreSnapshot = {
    score: state.score,
    threshold: state.engineConfig.threshold,
    timeOnPageMs: Date.now() - state.bornAt,
    signals: state.signalLog
      .map((s) => `${s.name}:${s.weight}`)
      .slice(-20),
  };

  api.sendEvent(
    {
      popupId: popup.id,
      type: "impression",
      scenario,
      ...scoreSnapshot,
    },
    popup.position,
  );

  shown.onCta(() => {
    api.sendEvent(
      { popupId: popup.id, type: "click", scenario },
      popup.position,
    );
    // Reminder popup has no discount code — just redirect.
    const target = popup.redirectPath || "/cart";
    window.location.assign(target);
  });

  shown.onClose((reason) => {
    api.sendEvent(
      {
        popupId: popup.id,
        type: "dismiss",
        dismissReason: reason,
        scenario,
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
