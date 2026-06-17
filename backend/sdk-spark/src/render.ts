// Image-only popup renderer.
// The entire banner image is clickable; no text/headline/subhead/CTA button.
// User clicks anywhere on the banner → CTA callback fires → redirect.

import type { DismissReason, Popup } from "./types";

const ROOT_ID = "nx-popup-root";
const DEFAULT_AUTO_DISMISS_SEC = 60;

function formatCountdown(secondsLeft: number): string {
  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function ensureRoot(): HTMLElement {
  let root = document.getElementById(ROOT_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = ROOT_ID;
    document.body.appendChild(root);
  }
  return root;
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] as string,
  );
}

export type ShownPopup = {
  el: HTMLElement;
  destroy: () => void;
  onCta: (cb: () => void) => void;
  onClose: (cb: (reason: DismissReason) => void) => void;
};

export type ShowPopupOptions = {
  withTimer?: boolean; // default true. Reminder popups pass false.
  autoDismissSec?: number; // countdown duration; default 60s.
};

export function showPopup(
  popup: Popup,
  options: ShowPopupOptions = {},
): ShownPopup | null {
  // Image-only design: if no banner URL, nothing to show.
  if (!popup.bannerUrl) return null;

  const withTimer = options.withTimer !== false;
  const autoDismissSec =
    typeof options.autoDismissSec === "number" && options.autoDismissSec > 0
      ? options.autoDismissSec
      : DEFAULT_AUTO_DISMISS_SEC;

  const root = ensureRoot();

  const overlay = document.createElement("div");
  overlay.className = "nx-overlay";
  overlay.dataset.popupId = popup.id;
  overlay.dataset.position = popup.position;

  const timerHtml = withTimer
    ? `<div class="nx-timer" aria-live="polite" aria-label="Auto-closes in">
         <span class="nx-timer-icon" aria-hidden="true">&#9201;</span>
         <span class="nx-timer-value">${formatCountdown(autoDismissSec)}</span>
       </div>`
    : "";

  overlay.innerHTML = `
    <div class="nx-card" role="dialog" aria-modal="true" aria-label="${escapeHtml(popup.name || "Promotional offer")}">
      ${timerHtml}
      <button type="button" class="nx-close" aria-label="Close">&times;</button>
      <img class="nx-banner" src="${escapeHtml(popup.bannerUrl)}" alt="" loading="eager" />
    </div>
  `;

  root.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("nx-open"));

  const ctaCbs: Array<() => void> = [];
  const closeCbs: Array<(reason: DismissReason) => void> = [];

  let countdownIntervalId: number | null = null;

  const destroy = () => {
    if (countdownIntervalId !== null) {
      window.clearInterval(countdownIntervalId);
      countdownIntervalId = null;
    }
    overlay.classList.remove("nx-open");
    setTimeout(() => overlay.remove(), 250);
  };

  // Close button — capture phase so it fires BEFORE any bubble-phase listener
  const closeBtn = overlay.querySelector(".nx-close") as HTMLElement | null;
  closeBtn?.addEventListener(
    "click",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      closeCbs.forEach((cb) => cb("x_button"));
      destroy();
    },
    { capture: true },
  );
  // Also catch touchend / pointerdown to be defensive on mobile
  closeBtn?.addEventListener(
    "pointerdown",
    (e) => {
      e.stopPropagation();
    },
    { capture: true },
  );

  // CTA action — ONLY on the banner image itself (not on close button or card padding)
  const banner = overlay.querySelector(".nx-banner") as HTMLElement | null;
  banner?.addEventListener("click", (e) => {
    e.preventDefault();
    ctaCbs.forEach((cb) => cb());
  });

  // Backdrop click (outside card entirely) → dismiss
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeCbs.forEach((cb) => cb("backdrop"));
      destroy();
    }
  });

  // Auto-dismiss countdown — starts immediately, ticks every second.
  // At 0 the popup closes itself and fires close handlers with reason "timeout".
  // Skipped entirely for reminder popups (withTimer === false).
  if (withTimer) {
    const timerValueEl = overlay.querySelector(
      ".nx-timer-value",
    ) as HTMLElement | null;
    let secondsLeft = autoDismissSec;
    countdownIntervalId = window.setInterval(() => {
      secondsLeft -= 1;
      if (timerValueEl) timerValueEl.textContent = formatCountdown(secondsLeft);
      if (secondsLeft <= 0) {
        closeCbs.forEach((cb) => cb("timeout"));
        destroy();
      }
    }, 1000);
  }

  return {
    el: overlay,
    destroy,
    onCta: (cb) => ctaCbs.push(cb),
    onClose: (cb) => closeCbs.push(cb),
  };
}

export function applyDiscountAndRedirect(
  code: string | undefined,
  path: string | undefined,
): void {
  const target = path ?? "/";
  if (code) {
    window.location.assign(
      `/discount/${encodeURIComponent(code)}?redirect=${encodeURIComponent(target)}`,
    );
  } else {
    window.location.assign(target);
  }
}
