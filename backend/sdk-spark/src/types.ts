export type PopupId =
  | "exit-intent"
  | "abandonment-exit-intent"
  | "promotional"
  | "weather";

export type PopupVariant = "default" | "reminder";

export type AbandonmentScenario =
  | "post_add_to_cart"
  | "checkout_started"
  | "cart_page";

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
  variant?: PopupVariant;
};

export type ConfigResponse = {
  version: number;
  serverTime: number;
  popups: Popup[];
  config: {
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
  scenario?: AbandonmentScenario;
  // Score-snapshot fields included on impression events
  score?: number;
  threshold?: number;
  timeOnPageMs?: number;
  signals?: string[];
};
