// Score engine — unified intent score for popup trigger decisions.
//
// Design:
// - All state lives in one in-memory object (no localStorage during scoring)
// - Score updates are O(1) and synchronous (<0.05 ms)
// - Evaluator runs once per second via requestIdleCallback (skips during scroll)
// - Hard gates short-circuit before score check
// - Decay reduces score when user is actively engaged
//
// Tunable constants are exposed as defaults but can be overridden at runtime
// via the ScoringConfig passed to createState() / startEvaluator(). This lets
// the dashboard's "Scoring Studio" change weights without an SDK redeploy.

export const DEFAULT_THRESHOLD = 75;
export const DEFAULT_DECAY_RATE = 5;
export const DEFAULT_DECAY_INTERVAL_MS = 10_000;
export const DEFAULT_EVAL_INTERVAL_MS = 1_000;
export const DEFAULT_SCORE_MIN = 0;
export const DEFAULT_SCORE_MAX = 120;

// Legacy named exports — kept for any external code that still imports them.
export const THRESHOLD = DEFAULT_THRESHOLD;
export const DECAY_RATE = DEFAULT_DECAY_RATE;
export const DECAY_INTERVAL_MS = DEFAULT_DECAY_INTERVAL_MS;
export const EVAL_INTERVAL_MS = DEFAULT_EVAL_INTERVAL_MS;
export const SCORE_MIN = DEFAULT_SCORE_MIN;
export const SCORE_MAX = DEFAULT_SCORE_MAX;

export type SignalLogEntry = {
  name: string;
  weight: number;
  ts: number;
};

export type EngineConfig = {
  threshold: number;
  decayRate: number;
  decayIntervalMs: number;
  evalIntervalMs: number;
  scoreMin: number;
  scoreMax: number;
};

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  threshold: DEFAULT_THRESHOLD,
  decayRate: DEFAULT_DECAY_RATE,
  decayIntervalMs: DEFAULT_DECAY_INTERVAL_MS,
  evalIntervalMs: DEFAULT_EVAL_INTERVAL_MS,
  scoreMin: DEFAULT_SCORE_MIN,
  scoreMax: DEFAULT_SCORE_MAX,
};

export type ScoringState = {
  score: number;
  bornAt: number;
  lastEngagementAt: number;
  lastDecayAt: number;
  fired: boolean;
  cartUiOpenUntil: number;
  cartItemCount: number;
  hasConverted: boolean;
  signalLog: SignalLogEntry[];
  // Reference to the active engine config so addSignal can clamp correctly.
  engineConfig: EngineConfig;
};

export function createState(opts: {
  cartItemCount: number;
  hasConverted: boolean;
  engineConfig?: Partial<EngineConfig>;
}): ScoringState {
  const now = Date.now();
  return {
    score: 0,
    bornAt: now,
    lastEngagementAt: now,
    lastDecayAt: now,
    fired: false,
    cartUiOpenUntil: 0,
    cartItemCount: opts.cartItemCount,
    hasConverted: opts.hasConverted,
    signalLog: [],
    engineConfig: { ...DEFAULT_ENGINE_CONFIG, ...(opts.engineConfig ?? {}) },
  };
}

export function addSignal(
  state: ScoringState,
  name: string,
  weight: number,
): void {
  if (state.fired) return;
  state.score += weight;
  const { scoreMin, scoreMax } = state.engineConfig;
  if (state.score < scoreMin) state.score = scoreMin;
  if (state.score > scoreMax) state.score = scoreMax;
  state.signalLog.push({ name, weight, ts: Date.now() });
}

export function markEngagement(state: ScoringState): void {
  state.lastEngagementAt = Date.now();
}

export function applyDecay(state: ScoringState): void {
  const now = Date.now();
  const { decayIntervalMs, decayRate, scoreMin } = state.engineConfig;
  // Only decay if user has been actively engaged in the last 2 sec
  if (now - state.lastEngagementAt > 2_000) return;
  if (now - state.lastDecayAt < decayIntervalMs) return;
  state.score = Math.max(scoreMin, state.score - decayRate);
  state.lastDecayAt = now;
  state.signalLog.push({ name: "decay", weight: -decayRate, ts: now });
}

export function timeOnPageMs(state: ScoringState): number {
  return Date.now() - state.bornAt;
}

// requestIdleCallback polyfill — Safari < 14 doesn't have it
const ric: (cb: () => void) => number =
  typeof window !== "undefined" && "requestIdleCallback" in window
    ? (cb) => (window as any).requestIdleCallback(cb, { timeout: 500 })
    : (cb) => window.setTimeout(cb, 1) as unknown as number;

export type EvaluatorOptions = {
  state: ScoringState;
  shouldSkip: () => string | null;
  onFire: (state: ScoringState) => void;
};

export function startEvaluator(opts: EvaluatorOptions): () => void {
  let stopped = false;
  const { threshold, evalIntervalMs } = opts.state.engineConfig;

  const tick = () => {
    if (stopped || opts.state.fired) return;

    // 1. Hard gates — short-circuit before any score work
    const skipReason = opts.shouldSkip();
    if (skipReason) {
      schedule();
      return;
    }

    // 2. Apply decay if engaged
    applyDecay(opts.state);

    // 3. Threshold check
    if (opts.state.score >= threshold) {
      opts.state.fired = true;
      opts.onFire(opts.state);
      return; // stop polling after fire
    }

    schedule();
  };

  const schedule = () => {
    setTimeout(() => ric(tick), evalIntervalMs);
  };

  schedule();

  return () => {
    stopped = true;
  };
}
