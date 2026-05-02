// Scheduler tick. Runs once a minute, fires every schedule whose
// nextRunAt is due, then advances nextRunAt by its cadence.
//
// Uses plain setInterval — cadence is daily/weekly/monthly so a 60s
// resolution is plenty and we avoid pulling in node-cron.

import { storage } from "./storage";
import { runSchedule, nextRunFor } from "./runner";

const TICK_INTERVAL_MS = 60_000;

let started = false;
let runningIds = new Set<number>();

export function startScheduler() {
  if (started) return;
  started = true;
  // Backfill nextRunAt for schedules created before this field was tracked.
  for (const s of storage.listAllSchedules()) {
    if (s.enabled && !s.nextRunAt) {
      storage.updateSchedule(s.id, { nextRunAt: nextRunFor(s.cadence) });
    }
  }
  setInterval(tick, TICK_INTERVAL_MS);
  // Run an immediate tick on boot so newly-scheduled-now jobs fire promptly.
  setTimeout(tick, 5_000);
  console.log(`[scheduler] started (tick=${TICK_INTERVAL_MS}ms)`);
}

async function tick() {
  const now = Date.now();
  let due;
  try {
    due = storage.listAllSchedules().filter((s) => s.enabled && (s.nextRunAt ?? 0) <= now);
  } catch (e) {
    console.error("[scheduler] list failed:", e);
    return;
  }
  for (const s of due) {
    if (runningIds.has(s.id)) continue;
    runningIds.add(s.id);
    runSchedule(s)
      .then((r) => {
        const next = nextRunFor(s.cadence, now);
        storage.updateSchedule(s.id, { lastRunAt: now, nextRunAt: next });
        console.log(
          `[scheduler] schedule ${s.id} ran:`,
          r.delivered
            ? `delivered via ${r.deliveryProvider}`
            : r.error || r.deliveryError || "no delivery"
        );
      })
      .catch((e) => {
        console.error(`[scheduler] schedule ${s.id} crashed:`, e);
        const next = nextRunFor(s.cadence, now);
        storage.updateSchedule(s.id, { lastRunAt: now, nextRunAt: next });
      })
      .finally(() => {
        runningIds.delete(s.id);
      });
  }
}
