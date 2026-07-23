/**
 * Offline write queue — persists failed PATCH batches to localStorage and
 * replays them the next time the browser comes online.
 *
 * A "batch" is a group of requests that must all succeed together (e.g. all
 * the PATCH calls for one AddNoteAndPhotos submission). If any request in the
 * batch fails the whole batch stays in the queue for the next attempt.
 */

const QUEUE_KEY = "ms_offline_queue";

export type QueuedRequest = {
  method: string;
  url: string;
  body?: unknown;
};

export type QueuedBatch = {
  batchId: string;
  requests: QueuedRequest[];
  /** Child IDs affected — used by callers to invalidate the right caches. */
  childIds: string[];
};

function load(): QueuedBatch[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function persist(batches: QueuedBatch[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(batches));
  } catch {
    // localStorage full or unavailable — silently skip
  }
}

/** Add a batch of requests to the offline queue. */
export function enqueueBatch(batch: QueuedBatch): void {
  const q = load();
  q.push(batch);
  persist(q);
}

/** True when there are pending requests waiting to be replayed. */
export function hasPendingQueue(): boolean {
  return load().length > 0;
}

/**
 * Attempt to replay every queued batch.
 *
 * Returns `true` if at least one batch was successfully drained so the caller
 * can show a "saved" confirmation.  Batches that still fail are left in the
 * queue for the next attempt.
 */
export async function drainQueue(): Promise<boolean> {
  const batches = load();
  if (batches.length === 0) return false;

  const remaining: QueuedBatch[] = [];
  let anySucceeded = false;

  for (const batch of batches) {
    let batchOk = true;
    for (const req of batch.requests) {
      try {
        const res = await fetch(req.url, {
          method: req.method,
          headers: req.body ? { "Content-Type": "application/json" } : {},
          body: req.body ? JSON.stringify(req.body) : undefined,
          credentials: "include",
        });
        if (!res.ok) {
          batchOk = false;
          break;
        }
      } catch {
        batchOk = false;
        break;
      }
    }

    if (batchOk) {
      anySucceeded = true;
    } else {
      remaining.push(batch);
    }
  }

  persist(remaining);
  return anySucceeded;
}
