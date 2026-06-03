import { Api, matchesUrl, nextIntentBucket } from "./api";
import { attachTrigger } from "./intent";
import { applyDiscountAndRedirect, showPopup } from "./render";
import { canShow, markShown } from "./storage";
import type { Popup } from "./types";
import { getSessionId, getVisitorId, isMobile } from "./visitor";

function readBootstrap(): { apiKey?: string; endpoint?: string; css?: string } {
  if (typeof document === "undefined") return {};
  const script =
    (document.currentScript as HTMLScriptElement | null) ??
    (document.querySelector("script[data-api-key]") as HTMLScriptElement | null);
  if (!script) return {};
  return {
    apiKey: script.dataset.apiKey,
    endpoint: script.dataset.endpoint,
    css: script.dataset.css,
  };
}

async function boot() {
  const { apiKey, endpoint, css } = readBootstrap();
  if (!apiKey || !endpoint) {
    console.warn("[NexCent] missing data-key or data-endpoint on script tag");
    return;
  }

  if (css !== "off") {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = css || endpoint.replace(/\/$/, "").replace(/\/[^/]+$/, "") + "/popup.css";
    document.head.appendChild(link);
  }

  const visitorId = getVisitorId();
  const sessionId = getSessionId();
  const device: "mobile" | "desktop" = isMobile() ? "mobile" : "desktop";
  const api = new Api({ apiKey, endpoint, visitorId, sessionId, device });

  const cfg = await api.getConfig();
  if (!cfg || !cfg.popups?.length) return;

  for (const popup of cfg.popups) {
    schedulePopup(popup, api);
  }
}

let currentlyShown: string | null = null;

function schedulePopup(popup: Popup, api: Api) {
  if (!matchesUrl(popup.targetUrlPatterns, location.pathname)) return;
  if (!canShow(popup.id, popup.frequency)) return;

  const detach = attachTrigger(popup, () => {
    if (currentlyShown) return;
    currentlyShown = popup.id;
    markShown(popup.id);
    detach();

    const shown = showPopup(popup);
    const intent = nextIntentBucket(popup.id);
    api.sendEvent({ popupId: popup.id, type: "impression" }, popup.position);

    shown.onCta(() => {
      api.sendEvent({ popupId: popup.id, type: "click" }, popup.position);
      api.sendEvent(
        { popupId: popup.id, type: "convert", conversionKind: "click" },
        popup.position,
      );
      void intent;
      applyDiscountAndRedirect(popup.discountCode, popup.redirectPath);
    });
    shown.onClose(() => {
      currentlyShown = null;
    });
  });
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
}
