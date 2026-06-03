import type { Popup } from "./types";
import { isFirstVisit, isMobile } from "./visitor";

type Trigger = () => void;
type Detach = () => void;

export function attachTrigger(popup: Popup, fire: Trigger): Detach {
  switch (popup.id) {
    case "entry":
      return attachEntry(fire);
    case "exit-intent":
      return attachExitIntent(fire);
    case "promotional":
      return attachAfterDelay(fire, 25_000);
    case "countdown":
      return attachAfterDelay(fire, 10_000);
    case "weather":
      return () => undefined;
    default:
      return () => undefined;
  }
}

function attachEntry(fire: Trigger): Detach {
  if (!isFirstVisit()) return () => undefined;
  const id = window.setTimeout(fire, 4_000);
  return () => window.clearTimeout(id);
}

function attachAfterDelay(fire: Trigger, ms: number): Detach {
  const id = window.setTimeout(fire, ms);
  return () => window.clearTimeout(id);
}

function attachExitIntent(fire: Trigger): Detach {
  if (isMobile()) return attachMobileExit(fire);
  return attachDesktopExit(fire);
}

function attachDesktopExit(fire: Trigger): Detach {
  let armed = true;
  const onLeave = (e: MouseEvent) => {
    if (!armed) return;
    if (e.clientY <= 0) {
      armed = false;
      fire();
    }
  };
  document.addEventListener("mouseleave", onLeave);
  return () => document.removeEventListener("mouseleave", onLeave);
}

function attachMobileExit(fire: Trigger): Detach {
  let armed = true;
  let lastY = 0;
  let lastT = 0;
  let backArmed = false;
  let pushed = false;

  const onScroll = () => {
    const y = window.scrollY;
    const t = Date.now();
    const dy = lastY - y;
    const dt = t - lastT;
    if (dt > 0 && dt < 250 && dy > 40 && y < 200) {
      lastY = y;
      lastT = t;
      if (armed) {
        armed = false;
        fire();
      }
      return;
    }
    lastY = y;
    lastT = t;
  };

  const onHide = () => {
    if (!armed) return;
    if (document.visibilityState === "hidden") {
      armed = false;
      fire();
    }
  };

  const onPopState = () => {
    if (!backArmed) return;
    backArmed = false;
    if (armed) {
      armed = false;
      fire();
    }
  };

  try {
    history.pushState({ nx: 1 }, "", location.href);
    pushed = true;
    backArmed = true;
  } catch {
    /* ignore */
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("popstate", onPopState);

  return () => {
    window.removeEventListener("scroll", onScroll);
    document.removeEventListener("visibilitychange", onHide);
    window.removeEventListener("popstate", onPopState);
    if (pushed) {
      try {
        history.back();
      } catch {
        /* ignore */
      }
    }
  };
}
