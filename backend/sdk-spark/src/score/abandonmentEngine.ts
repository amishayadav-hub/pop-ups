// Abandonment scoring engine — parallel to the main engine.
//
// Differences from main engine:
// - Has an "armed" flag. Until armed, ALL signals are ignored (score stays 0).
// - Armed when: cartItemCount > 0 at boot OR user clicks add-to-cart.
// - Once armed, stays armed for the session (no disarm on cart-clear).
// - Has its own threshold, decay rate, score cap.
// - Tracks the "scenario" context at fire time (post_add_to_cart /
//   checkout_started / cart_page) for analytics breakdown.

import {
  addSignal as addBaseSignal,
  applyDecay,
  createState,
  type EngineConfig,
  type ScoringState,
  DEFAULT_ENGINE_CONFIG,
} from "./engine";
import type { AbandonmentScenario } from "../types";

export type AbandonmentState = ScoringState & {
  armed: boolean;
  // Most-recently observed scenario context at fire time
  lastScenario: AbandonmentScenario;
};

export const DEFAULT_ABANDONMENT_ENGINE_CONFIG: EngineConfig = {
  ...DEFAULT_ENGINE_CONFIG,
  threshold: 50, // lower than normal (75) — cart already proves intent
  decayRate: 2, // slower decay — cart items don't fade
};

export function createAbandonmentState(opts: {
  initialCartItemCount: number;
  hasConverted: boolean;
  engineConfig?: Partial<EngineConfig>;
}): AbandonmentState {
  const base = createState({
    cartItemCount: opts.initialCartItemCount,
    hasConverted: opts.hasConverted,
    engineConfig: {
      ...DEFAULT_ABANDONMENT_ENGINE_CONFIG,
      ...(opts.engineConfig ?? {}),
    },
  });
  return {
    ...base,
    armed: opts.initialCartItemCount > 0,
    lastScenario: "post_add_to_cart",
  };
}

export function armAbandonment(state: AbandonmentState): void {
  state.armed = true;
}

// Gated addSignal — no-op until armed.
export function addAbandonmentSignal(
  state: AbandonmentState,
  name: string,
  weight: number,
): void {
  if (!state.armed) return;
  addBaseSignal(state, name, weight);
}

// Inspect the current URL to figure out which scenario context the user
// is in. Updated each tick so analytics tagging stays accurate.
export function detectScenario(): AbandonmentScenario {
  const p =
    typeof location !== "undefined" ? location.pathname.toLowerCase() : "";
  if (/\/checkouts?\//.test(p)) return "checkout_started";
  if (p === "/cart" || p.endsWith("/cart")) return "cart_page";
  return "post_add_to_cart";
}

export function updateScenario(state: AbandonmentState): void {
  state.lastScenario = detectScenario();
}

// Apply decay just like the main engine. Re-export so callers don't have
// to import from both files.
export { applyDecay };
