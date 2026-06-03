import { initializeApp } from "firebase-admin/app";

initializeApp();

export { aggregateEvent } from "./aggregate";
export { computePositionBenchmarks } from "./benchmarks";
export { getConfig, recordEvent } from "./http";
