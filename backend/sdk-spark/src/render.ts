// Image-only popup renderer.
// The entire banner image is clickable; no text/headline/subhead/CTA button.
// User clicks anywhere on the banner → CTA callback fires → redirect.

import type { Popup } from "./types";

const ROOT_ID = "nx-popup-root";

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
  onClose: (cb: () => void) => void;
};

export function showPopup(popup: Popup): ShownPopup | null {
  // Image-only design: if no banner URL, nothing to show.
  if (!popup.bannerUrl) return null;

  const root = ensureRoot();

  const overlay = document.createElement("div");
  overlay.className = "nx-overlay";
  overlay.dataset.popupId = popup.id;
  overlay.dataset.position = popup.position;

  overlay.innerHTML = `
    <div class="nx-card" role="dialog" aria-modal="true" aria-label="${escapeHtml(popup.name || "Promotional offer")}">
      <button type="button" class="nx-close" aria-label="Close">&times;</button>
      <img class="nx-banner" src="${escapeHtml(popup.bannerUrl)}" alt="" loading="eager" />
    </div>
  `;

  root.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("nx-open"));

  const ctaCbs: Array<() => void> = [];
  const closeCbs: Array<() => void> = [];

  const destroy = () => {
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
      closeCbs.forEach((cb) => cb());
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
      closeCbs.forEach((cb) => cb());
      destroy();
    }
  });

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
