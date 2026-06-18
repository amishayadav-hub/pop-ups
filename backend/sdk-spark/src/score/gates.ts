// Hard gates — short-circuit conditions that suppress popup firing
// regardless of score. Each gate returns its name when active, null otherwise.

import type { ScoringState } from "./engine";
import { timeOnPageMs } from "./engine";

// Defaults — overridable via GatesConfig passed to shouldSkip()
export const DEFAULT_BOUNCER_THRESHOLD_MS = 9_000;
export const DEFAULT_POWER_CONVERTER_MS = 5 * 60 * 1000;
export const DEFAULT_PURCHASE_LOCK_DAYS = 30;

export type GatesConfig = {
  bouncerThresholdMs: number;
  powerConverterMs: number;
  purchaseLockDays: number;
};

export const DEFAULT_GATES_CONFIG: GatesConfig = {
  bouncerThresholdMs: DEFAULT_BOUNCER_THRESHOLD_MS,
  powerConverterMs: DEFAULT_POWER_CONVERTER_MS,
  purchaseLockDays: DEFAULT_PURCHASE_LOCK_DAYS,
};

// Anveshan uses an Ajax floating cart — URL doesn't change when cart opens.
// We detect cart-flow via (a) recent cart-icon tap, (b) drawer DOM check.
const CART_DRAWER_SELECTORS = [
  "body.cart-drawer-open",
  "body.cart-open",
  "body.is-cart-open",
  "html.cart-open",
  "[data-cart-drawer-open]",
  "[data-cart-open='true']",
  ".cart-drawer.is-open",
  ".cart-drawer.is-active",
  ".cart-drawer--active",
  ".js-cart-drawer.is-active",
  "#cart-drawer.is-active",
  "#CartDrawer.is-open",
];

export function isCartDrawerOpen(): boolean {
  for (const sel of CART_DRAWER_SELECTORS) {
    try {
      if (document.querySelector(sel)) return true;
    } catch {
      /* invalid selector — ignore */
    }
  }
  return false;
}

export function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = (el as HTMLElement).tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export function isCheckoutUrl(): boolean {
  return /\/checkouts\//i.test(location.pathname);
}

export function isThankYouUrl(): boolean {
  const p = location.pathname;
  return (
    /\/thank[-_]?you/i.test(p) ||
    /\/orders\/[^/]+/i.test(p) ||
    /\/checkouts\/[^/]+\/thank[-_]?you/i.test(p)
  );
}

const PURCHASED_KEY = "nx_purchased";

export function markPurchased(): void {
  try {
    localStorage.setItem(PURCHASED_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function hasPurchasedRecently(
  lockDays: number = DEFAULT_PURCHASE_LOCK_DAYS,
): boolean {
  try {
    const raw = localStorage.getItem(PURCHASED_KEY);
    if (!raw) return false;
    const last = Number(raw);
    if (!isFinite(last)) return false;
    const days = (Date.now() - last) / 86_400_000;
    return days < lockDays;
  } catch {
    return false;
  }
}

const POPUP_SHOWN_KEY = "nx_popup_shown_session";

export function isPopupAlreadyShown(): boolean {
  try {
    return sessionStorage.getItem(POPUP_SHOWN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markPopupShown(): void {
  try {
    sessionStorage.setItem(POPUP_SHOWN_KEY, "1");
  } catch {
    /* ignore */
  }
}

// Main gate runner — first matching gate wins
export function shouldSkip(
  state: ScoringState,
  config: GatesConfig = DEFAULT_GATES_CONFIG,
): string | null {
  // Order matters — cheapest checks first
  if (state.fired) return "already_fired";
  if (isPopupAlreadyShown()) return "popup_already_shown";
  if (state.hasConverted || hasPurchasedRecently(config.purchaseLockDays))
    return "already_converted";
  if (timeOnPageMs(state) < config.bouncerThresholdMs) return "bouncer";
  if (Date.now() < state.cartUiOpenUntil) return "cart_ui_recent_tap";
  if (isInputFocused()) return "typing_form";
  if (isCheckoutUrl()) return "checkout_url";
  if (isThankYouUrl()) {
    markPurchased();
    return "thank_you_url";
  }
  if (
    timeOnPageMs(state) > config.powerConverterMs &&
    state.cartItemCount > 0
  ) {
    return "power_converter";
  }
  if (isCartDrawerOpen()) return "cart_drawer_open";
  return null;
}
