import type { ConfigResponse, EventInput, PopupId } from "./types";

type Options = {
  apiKey: string;
  endpoint: string;
  visitorId: string;
  sessionId: string;
  device: "mobile" | "desktop";
};

export class Api {
  constructor(private opts: Options) {}

  async getConfig(): Promise<ConfigResponse | null> {
    try {
      const r = await fetch(`${this.opts.endpoint}/getConfig?key=${encodeURIComponent(this.opts.apiKey)}`, {
        method: "GET",
        credentials: "omit",
      });
      if (!r.ok) return null;
      return (await r.json()) as ConfigResponse;
    } catch {
      return null;
    }
  }

  sendEvent(ev: EventInput, position?: string): void {
    const body = JSON.stringify({
      ...ev,
      position,
      visitorId: this.opts.visitorId,
      sessionId: this.opts.sessionId,
      page: location.pathname,
      device: this.opts.device,
    });
    const url = `${this.opts.endpoint}/recordEvent?key=${encodeURIComponent(this.opts.apiKey)}`;
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        if (navigator.sendBeacon(url, blob)) return;
      }
    } catch {
      /* fall through */
    }
    fetch(url, {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  }
}

export function matchesUrl(patterns: string[] | undefined, path: string): boolean {
  if (!patterns || patterns.length === 0) return true;
  return patterns.some((p) => {
    if (p === "*") return true;
    if (p.endsWith("*")) return path.startsWith(p.slice(0, -1));
    return p === path;
  });
}

export function nextIntentBucket(id: PopupId): "low" | "medium" | "high" {
  if (id === "exit-intent" || id === "countdown") return "high";
  if (id === "promotional" || id === "weather") return "medium";
  return "low";
}
