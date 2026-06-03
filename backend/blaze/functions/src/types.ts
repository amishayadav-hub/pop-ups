export type PopupTypeId =
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

export type IntentTier = "low" | "medium" | "high";

export type EventDoc = {
  popupId: PopupTypeId;
  type: "impression" | "click" | "convert";
  conversionKind?: "click" | "add_to_cart";
  intent?: IntentTier;
  city?: string;
  position?: Position;
  visitorId?: string;
  sessionId?: string;
  page?: string;
  device?: "mobile" | "desktop";
  ts: FirebaseFirestore.Timestamp;
};

export type PopupDoc = {
  id: PopupTypeId;
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
  frequency: "once-per-visitor" | "once-per-day" | "once-per-session" | "always";
  ctr: number;
  conversions: number;
};

export type ApiKeyDoc = {
  prefix: string;
  allowedOrigins: string[];
  enabled: boolean;
  createdAt: FirebaseFirestore.Timestamp;
  lastUsedAt?: FirebaseFirestore.Timestamp;
};
