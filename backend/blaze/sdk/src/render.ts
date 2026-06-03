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
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c] as string));
}

function countdownText(target: string): string {
  const ms = Math.max(0, new Date(target).getTime() - Date.now());
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export type ShownPopup = {
  el: HTMLElement;
  destroy: () => void;
  onCta: (cb: () => void) => void;
  onClose: (cb: () => void) => void;
};

export function showPopup(popup: Popup): ShownPopup {
  const root = ensureRoot();

  const overlay = document.createElement("div");
  overlay.className = "nx-overlay";
  overlay.dataset.popupId = popup.id;
  overlay.dataset.position = popup.position;

  const banner = popup.bannerUrl
    ? `<img class="nx-banner" src="${escapeHtml(popup.bannerUrl)}" alt="" loading="eager" />`
    : "";

  const sub = popup.subheadline
    ? `<p class="nx-sub">${escapeHtml(popup.subheadline)}</p>`
    : "";

  const code = popup.discountCode
    ? `<div class="nx-code"><span class="nx-code-label">Code</span><span class="nx-code-value">${escapeHtml(popup.discountCode)}</span></div>`
    : "";

  const countdown =
    popup.id === "countdown" && popup.countdownExpiresAt
      ? `<div class="nx-countdown" aria-live="polite">${countdownText(popup.countdownExpiresAt)}</div>`
      : "";

  overlay.innerHTML = `
    <div class="nx-card" role="dialog" aria-modal="true" aria-labelledby="nx-headline">
      <button type="button" class="nx-close" aria-label="Close">×</button>
      ${banner}
      <div class="nx-body">
        ${countdown}
        <h2 id="nx-headline" class="nx-headline">${escapeHtml(popup.headline)}</h2>
        ${sub}
        ${code}
        <button type="button" class="nx-cta">${escapeHtml(popup.ctaText)}</button>
      </div>
    </div>
  `;

  root.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("nx-open"));

  let countdownTimer: number | undefined;
  if (popup.id === "countdown" && popup.countdownExpiresAt) {
    const el = overlay.querySelector(".nx-countdown");
    if (el) {
      countdownTimer = window.setInterval(() => {
        el.textContent = countdownText(popup.countdownExpiresAt!);
      }, 1000);
    }
  }

  const ctaCbs: Array<() => void> = [];
  const closeCbs: Array<() => void> = [];

  const destroy = () => {
    if (countdownTimer) clearInterval(countdownTimer);
    overlay.classList.remove("nx-open");
    setTimeout(() => overlay.remove(), 250);
  };

  overlay.querySelector(".nx-cta")?.addEventListener("click", () => {
    ctaCbs.forEach((cb) => cb());
  });
  overlay.querySelector(".nx-close")?.addEventListener("click", () => {
    closeCbs.forEach((cb) => cb());
    destroy();
  });
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

export function applyDiscountAndRedirect(code: string | undefined, path: string | undefined): void {
  const target = path ?? "/";
  if (code) {
    window.location.assign(`/discount/${encodeURIComponent(code)}?redirect=${encodeURIComponent(target)}`);
  } else {
    window.location.assign(target);
  }
}
