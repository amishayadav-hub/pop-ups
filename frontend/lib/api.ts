import { USE_FIREBASE } from "./firebase";
import { mockApi } from "./mock-api";
// Spark variant: computes analytics live from the events collection
// (no Cloud Functions aggregator needed on the Firebase free plan).
import { firebaseSparkApi } from "./firebase-api-spark";

export const api = USE_FIREBASE ? firebaseSparkApi : mockApi;
