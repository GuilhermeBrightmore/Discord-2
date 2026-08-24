export type CallVolumeSource = "microphone" | "screen";

const STORAGE_KEY = "fungocord:call-volumes:v1";

type SavedVolumes = Record<string, Partial<Record<CallVolumeSource, number>>>;

function load(): SavedVolumes {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as SavedVolumes;
  } catch {
    return {};
  }
}

export function getCallVolume(userId: string, source: CallVolumeSource) {
  const value = load()[userId]?.[source];
  return typeof value === "number" ? Math.max(0, Math.min(1, value)) : 1;
}

export function setCallVolume(userId: string, source: CallVolumeSource, volume: number) {
  const saved = load();
  saved[userId] = { ...saved[userId], [source]: Math.max(0, Math.min(1, volume)) };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}
