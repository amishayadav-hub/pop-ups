export type PopupId =
  | "exit-intent"
  | "entry"
  | "promotional"
  | "countdown"
  | "weather";

export type Position =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export type Frequency =
  | "once-per-visitor"
  | "once-per-day"
  | "once-per-session"
  | "always";

export type Popup = {
  id: PopupId;
  name: string;
  status: "active" | "paused";
  position: Position;
  order: number;
  bannerUrl?: string;
  headline: string;
  subheadline?: string;
  ctaText: string;
  discountCode?: string;
  redirectPath?: string;
  targetUrlPatterns?: string[];
  frequency: Frequency;
  countdownExpiresAt?: string;
};

export type ConfigResponse = {
  version: number;
  serverTime: number;
  popups: Popup[];
  config: {
    countdownExpiresAt?: string;
    weatherRule?: { id: string; name: string; conditions: string[] };
  };
};

export type DismissReason = "x_button" | "backdrop" | "timeout";

export type IntentTier = "low" | "medium" | "high";

export type EventInput = {
  popupId: PopupId;
  type: "impression" | "click" | "convert" | "dismiss";
  conversionKind?: "click" | "add_to_cart";
  dismissReason?: DismissReason;
  intent?: IntentTier;
  // Score-snapshot fields included on impression events
  score?: number;
  threshold?: number;
  timeOnPageMs?: number;
  signals?: string[];
};
