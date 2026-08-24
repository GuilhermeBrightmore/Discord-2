export type CameraResolution = "480p" | "720p" | "1080p";
export type ScreenResolution = "480p" | "720p" | "1080p" | "1440p" | "source";
export type ScreenFps = 5 | 15 | 30 | 60;

export interface AppSettings {
  microphoneId: string;
  speakerId: string;
  cameraId: string;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
  cameraResolution: CameraResolution;
  screenResolution: ScreenResolution;
  screenFps: ScreenFps;
  screenAudio: boolean;
  sendWithEnter: boolean;
}

export const APP_SETTINGS_EVENT = "discord2:settings-changed";

export const defaultAppSettings: AppSettings = {
  microphoneId: "default",
  speakerId: "default",
  cameraId: "default",
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
  cameraResolution: "720p",
  screenResolution: "1080p",
  screenFps: 30,
  screenAudio: true,
  sendWithEnter: true,
};

const storageKey = "discord2:app-settings:v1";

export function loadAppSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return { ...defaultAppSettings };
    return { ...defaultAppSettings, ...JSON.parse(stored) } as AppSettings;
  } catch {
    return { ...defaultAppSettings };
  }
}

export function saveAppSettings(settings: AppSettings) {
  localStorage.setItem(storageKey, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent<AppSettings>(APP_SETTINGS_EVENT, { detail: settings }));
}

export function cameraDimensions(resolution: CameraResolution) {
  return {
    "480p": { width: 854, height: 480, frameRate: 30 },
    "720p": { width: 1280, height: 720, frameRate: 30 },
    "1080p": { width: 1920, height: 1080, frameRate: 30 },
  }[resolution];
}

export function screenDimensions(resolution: ScreenResolution) {
  return {
    "480p": { width: 854, height: 480 },
    "720p": { width: 1280, height: 720 },
    "1080p": { width: 1920, height: 1080 },
    "1440p": { width: 2560, height: 1440 },
    source: { width: 3840, height: 2160 },
  }[resolution];
}
