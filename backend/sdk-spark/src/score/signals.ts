// Behavior signal listeners — each attaches passively, mutates score state.
// All listeners use { passive: true } to never block scroll/touch threads.
//
// All signal weights are config-driven (via SignalWeights passed to
// attachAllSignals) so the dashboard's Scoring Studio can tune them
// without an SDK redeploy. Hardcoded fallbacks live in DEFAULT_WEIGHTS.

import { addSignal, markEngagement } from "./engine";
import type { ScoringState } from "./engine";
import { isMobile } from "../visitor";

export type SignalWeights = {
  popstate: number;
  mouseleave_top: number;
  visibility_hidden: number;
  tab_blur: number;
  rapid_scroll_up: number;
  touch_idle_25s: number;
  pdp_hesitation_20s: number;
  reviews_section_seen: number;
  multiple_pdps_2plus: number;
  many_pdps_4plus: number;
  time_30s: number;
  time_60s: number;
  scroll_depth_50: number;
  cart_has_items: number;
  variant_tap_1: number;
  variant_tap_2: number;
  add_to_cart_clicked: number;
  search_active: number;
};

export const DEFAULT_WEIGHTS: SignalWeights = {
  popstate: 40,
  mouseleave_top: 30,
  visibility_hidden: 30,
  tab_blur: 20,
  rapid_scroll_up: 25,
  touch_idle_25s: 20,
  pdp_hesitation_20s: 30,
  reviews_section_seen: 15,
  multiple_pdps_2plus: 15,
  many_pdps_4plus: 20,
  time_30s: 5,
  time_60s: 5,
  scroll_depth_50: 10,
  cart_has_items: 20,
  variant_tap_1: 15,
  variant_tap_2: 10,
  add_to_cart_clicked: -50,
  search_active: -20,
};

/* -------------------------------------------------------------------------- */
/* Engagement tracker (used for decay logic)                                  */
/* -------------------------------------------------------------------------- */

export function attachEngagementTracker(state: ScoringState): void {
  const mark = () => markEngagement(state);
  document.addEventListener("touchstart", mark, { passive: true });
  document.addEventListener("scroll", mark, { passive: true });
  document.addEventListener("click", mark, { passive: true, capture: true });
}

/* -------------------------------------------------------------------------- */
/* Cart UI tap detection (Ajax floating cart on Anveshan)                     */
/* -------------------------------------------------------------------------- */

const CART_TRIGGER_SELECTORS = [
  'a[href*="/cart"]',
  'a[href$="/cart"]',
  "[data-cart-toggle]",
  "[data-cart-icon]",
  "[data-cart-drawer-toggle]",
  ".cart-icon",
  ".cart-toggle",
  ".cart-drawer-toggle",
  ".js-cart-toggle",
  "#cart-icon",
  '[aria-label*="cart" i]',
  '[aria-controls*="cart" i]',
].join(",");

export function attachCartUiDetection(
  state: ScoringState,
  graceMs: number = 60_000,
): void {
  document.addEventListener(
    "click",
    (e) => {
      const target = e.target as Element | null;
      if (!target || !target.closest) return;
      if (target.closest(CART_TRIGGER_SELECTORS)) {
        state.cartUiOpenUntil = Date.now() + graceMs;
      }
    },
    { passive: true, capture: true },
  );
}

/* -------------------------------------------------------------------------- */
/* Exit-style signals                                                         */
/* -------------------------------------------------------------------------- */

export function attachVisibilitySignal(
  state: ScoringState,
  weight: number,
): void {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      addSignal(state, "visibility_hidden", weight);
    }
  });
}

export function attachPopstateSignal(
  state: ScoringState,
  weight: number,
): void {
  try {
    history.pushState({ nx: 1 }, "", location.href);
  } catch {
    /* SPA history conflict — ignore */
  }
  window.addEventListener("popstate", () => {
    addSignal(state, "popstate", weight);
  });
}

export function attachMouseleaveSignal(
  state: ScoringState,
  weight: number,
): void {
  if (isMobile()) return;
  document.addEventListener("mouseleave", (e: MouseEvent) => {
    if (e.clientY <= 0) addSignal(state, "mouseleave_top", weight);
  });
}

export function attachBlurSignal(
  state: ScoringState,
  weight: number,
): void {
  if (isMobile()) return;
  window.addEventListener("blur", () => {
    addSignal(state, "tab_blur", weight);
  });
}

export function attachRapidScrollUpSignal(
  state: ScoringState,
  weight: number,
): void {
  let lastY = window.scrollY;
  let lastT = Date.now();
  let throttleAt = 0;
  let fired = false;
  document.addEventListener(
    "scroll",
    () => {
      if (fired) return;
      const now = Date.now();
      if (now - throttleAt < 100) return; // throttle 10/sec
      throttleAt = now;
      const y = window.scrollY;
      const dy = lastY - y;
      const dt = now - lastT;
      if (dt > 0 && dt < 300 && dy > 40 && y < 200) {
        addSignal(state, "rapid_scroll_up", weight);
        fired = true;
      }
      lastY = y;
      lastT = now;
    },
    { passive: true },
  );
}

export function attachTouchIdleSignal(
  state: ScoringState,
  weight: number,
): void {
  if (!isMobile()) return;
  let lastInteraction = Date.now();
  let fired = false;
  const reset = () => {
    lastInteraction = Date.now();
    fired = false;
  };
  document.addEventListener("touchstart", reset, { passive: true });
  document.addEventListener("scroll", reset, { passive: true });
  setInterval(() => {
    if (!fired && Date.now() - lastInteraction > 25_000) {
      addSignal(state, "touch_idle_25s", weight);
      fired = true;
    }
  }, 5_000);
}

/* -------------------------------------------------------------------------- */
/* Engagement / PDP-specific signals                                          */
/* -------------------------------------------------------------------------- */

export function attachPdpHesitationSignal(
  state: ScoringState,
  weight: number,
  addedToCart: { value: boolean },
): void {
  if (!/\/products\//.test(location.pathname)) return;
  setTimeout(() => {
    if (!addedToCart.value && state.cartItemCount === 0) {
      addSignal(state, "pdp_hesitation_20s", weight);
    }
  }, 20_000);
}

export function attachReviewsSignal(
  state: ScoringState,
  weight: number,
): void {
  if (!("IntersectionObserver" in window)) return;
  const selectors = [
    "[id*='review' i]",
    "[class*='review' i]",
    "[id*='faq' i]",
    "[class*='faq' i]",
    "[data-section-type*='review' i]",
  ];
  let fired = false;
  const observer = new IntersectionObserver(
    (entries) => {
      if (fired) return;
      for (const entry of entries) {
        if (entry.isIntersecting) {
          addSignal(state, "reviews_section_seen", weight);
          fired = true;
          observer.disconnect();
          return;
        }
      }
    },
    { threshold: 0.3 },
  );
  setTimeout(() => {
    if (fired) return;
    for (const sel of selectors) {
      try {
        document.querySelectorAll(sel).forEach((el) => {
          try {
            observer.observe(el);
          } catch {
            /* ignore */
          }
        });
      } catch {
        /* invalid selector */
      }
    }
  }, 1_500);
}

export function attachMultiPdpSignal(
  state: ScoringState,
  weightTwoPlus: number,
  weightFourPlus: number,
): void {
  const KEY = "nx_pdps_viewed";
  try {
    if (!/\/products\//.test(location.pathname)) return;
    let seen: string[] = [];
    const raw = sessionStorage.getItem(KEY);
    if (raw) {
      try {
        seen = JSON.parse(raw);
      } catch {
        /* ignore parse */
      }
    }
    if (!seen.includes(location.pathname)) {
      seen.push(location.pathname);
      sessionStorage.setItem(KEY, JSON.stringify(seen));
    }
    if (seen.length >= 4) {
      addSignal(state, "many_pdps_4plus", weightFourPlus);
    } else if (seen.length >= 2) {
      addSignal(state, "multiple_pdps_2plus", weightTwoPlus);
    }
  } catch {
    /* sessionStorage blocked */
  }
}

export function attachTimeOnPageSignal(
  state: ScoringState,
  weight30s: number,
  weight60s: number,
): void {
  setTimeout(() => addSignal(state, "time_30s", weight30s), 30_000);
  setTimeout(() => addSignal(state, "time_60s", weight60s), 60_000);
}

export function attachScrollDepthSignal(
  state: ScoringState,
  weight: number,
): void {
  let fired = false;
  let throttleAt = 0;
  document.addEventListener(
    "scroll",
    () => {
      if (fired) return;
      const now = Date.now();
      if (now - throttleAt < 200) return;
      throttleAt = now;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max < 200) return;
      const pct = window.scrollY / max;
      if (pct >= 0.5) {
        addSignal(state, "scroll_depth_50", weight);
        fired = true;
      }
    },
    { passive: true },
  );
}

export function attachCartSnapshotSignal(
  state: ScoringState,
  weight: number,
): void {
  if (state.cartItemCount > 0) {
    addSignal(state, "cart_has_items", weight);
  }
}

/* -------------------------------------------------------------------------- */
/* Negative signals (push score DOWN)                                         */
/* -------------------------------------------------------------------------- */

const ADD_TO_CART_SELECTORS = [
  'button[name="add"]',
  "[data-add-to-cart]",
  ".add-to-cart",
  ".product-form__submit",
  '[aria-label*="add to cart" i]',
  '[data-action="add-to-cart"]',
].join(",");

export function attachAddToCartNegative(
  state: ScoringState,
  weight: number,
  addedToCart: { value: boolean },
): void {
  document.addEventListener(
    "click",
    (e) => {
      const target = e.target as Element | null;
      if (!target || !target.closest) return;
      if (target.closest(ADD_TO_CART_SELECTORS)) {
        addSignal(state, "add_to_cart_clicked", weight);
        addedToCart.value = true;
      }
    },
    { passive: true, capture: true },
  );
}

const VARIANT_SELECTORS = [
  "[data-variant-id]",
  '[name="id"][type="radio"]',
  ".variant-selector",
  ".variant-option",
  ".product-variant-option",
  'select[name*="variant" i]',
].join(",");

export function attachVariantTapSignal(
  state: ScoringState,
  weight1: number,
  weight2: number,
): void {
  let count = 0;
  document.addEventListener(
    "click",
    (e) => {
      const target = e.target as Element | null;
      if (!target || !target.closest) return;
      if (target.closest(VARIANT_SELECTORS)) {
        count++;
        if (count === 1) addSignal(state, "variant_tap_1", weight1);
        else if (count === 2) addSignal(state, "variant_tap_2", weight2);
      }
    },
    { passive: true, capture: true },
  );
}

// Detects when visitor focuses any element that looks like a search bar —
// either by element type, ARIA role, name="q" (Shopify standard), or themed
// class/id patterns. Covers predictive-search modals and slide-in drawers
// because they delegate via focusin (bubbles up after element is added).
const SEARCH_SELECTORS = [
  'input[type="search"]',
  'input[name="q"]',
  'input[placeholder*="search" i]',
  'input[aria-label*="search" i]',
  '[role="searchbox"]',
  'form[action*="/search"] input',
  'form[role="search"] input',
  ".search-input",
  ".search__input",
  ".search-bar__input",
  ".header-search input",
  ".predictive-search input",
  "#Search",
  "#search-input",
].join(",");

export function attachSearchActiveSignal(
  state: ScoringState,
  weight: number,
): void {
  let fired = false;
  document.addEventListener(
    "focusin",
    (e) => {
      if (fired) return;
      const target = e.target as Element | null;
      if (!target || !target.closest) return;
      if (target.closest(SEARCH_SELECTORS)) {
        addSignal(state, "search_active", weight);
        fired = true;
      }
    },
    { passive: true, capture: true },
  );
}

/* -------------------------------------------------------------------------- */
/* Cart fetch helper (one-time at boot)                                       */
/* -------------------------------------------------------------------------- */

export async function fetchCartSnapshot(): Promise<number> {
  try {
    const r = await fetch("/cart.js", {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!r.ok) return 0;
    const data = await r.json();
    return typeof data.item_count === "number" ? data.item_count : 0;
  } catch {
    return 0;
  }
}

/* -------------------------------------------------------------------------- */
/* Wire all signals at once (single entry point)                              */
/* -------------------------------------------------------------------------- */

export function attachAllSignals(
  state: ScoringState,
  weights: SignalWeights = DEFAULT_WEIGHTS,
  cartUiGraceMs: number = 60_000,
): { addedToCart: { value: boolean } } {
  attachCartUiDetection(state, cartUiGraceMs);
  attachEngagementTracker(state);

  const addedToCart = { value: false };

  // Exit signals
  attachVisibilitySignal(state, weights.visibility_hidden);
  attachPopstateSignal(state, weights.popstate);
  attachMouseleaveSignal(state, weights.mouseleave_top);
  attachBlurSignal(state, weights.tab_blur);
  attachRapidScrollUpSignal(state, weights.rapid_scroll_up);
  attachTouchIdleSignal(state, weights.touch_idle_25s);

  // Engagement / PDP signals
  attachPdpHesitationSignal(state, weights.pdp_hesitation_20s, addedToCart);
  attachReviewsSignal(state, weights.reviews_section_seen);
  attachMultiPdpSignal(
    state,
    weights.multiple_pdps_2plus,
    weights.many_pdps_4plus,
  );
  attachTimeOnPageSignal(state, weights.time_30s, weights.time_60s);
  attachScrollDepthSignal(state, weights.scroll_depth_50);
  attachCartSnapshotSignal(state, weights.cart_has_items);

  // Negative signals
  attachAddToCartNegative(state, weights.add_to_cart_clicked, addedToCart);
  attachVariantTapSignal(state, weights.variant_tap_1, weights.variant_tap_2);
  attachSearchActiveSignal(state, weights.search_active);

  return { addedToCart };
}
