import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { HevySyncState } from "./types";

const STATE_FILE = resolve(__dirname, ".hevy-sync-state.json");

const EMPTY: HevySyncState = {
  lastFullSyncAt: null,
  lastIncrementalSyncAt: null,
  exercisesCreated: 0,
  exercisesUpdated: 0,
  exercisesSkipped: 0,
  errors: [],
  apiRequests: 0,
};

export async function loadSyncState(): Promise<HevySyncState> {
  try {
    const raw = await readFile(STATE_FILE, "utf8");
    return { ...EMPTY, ...JSON.parse(raw) } as HevySyncState;
  } catch {
    return { ...EMPTY };
  }
}

export async function saveSyncState(state: HevySyncState): Promise<void> {
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}
