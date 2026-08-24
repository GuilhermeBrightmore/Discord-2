import { app, BrowserWindow, clipboard, desktopCapturer, ipcMain, safeStorage, session, shell } from "electron";
import { autoUpdater } from "electron-updater";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

let windowRef: BrowserWindow | null = null;
let selectedSourceId: string | null = null;
let selectedAudio = false;
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
type UpdateState = { status: "idle" | "checking" | "available" | "downloading" | "downloaded" | "current" | "error"; version?: string; percent?: number; message?: string };
let updateState: UpdateState = { status: "idle", version: app.getVersion() };

function sessionFile() { return path.join(app.getPath("userData"), "session.bin"); }

function publishUpdateState(next: UpdateState) {
  updateState = next;
  windowRef?.webContents.send("update:state", next);
}

function configureAutoUpdates() {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("checking-for-update", () => publishUpdateState({ status: "checking", version: app.getVersion() }));
  autoUpdater.on("update-available", (info) => publishUpdateState({ status: "available", version: info.version }));
  autoUpdater.on("update-not-available", () => publishUpdateState({ status: "current", version: app.getVersion() }));
  autoUpdater.on("download-progress", (progress) => publishUpdateState({ status: "downloading", version: updateState.version, percent: Math.round(progress.percent) }));
  autoUpdater.on("update-downloaded", (info) => publishUpdateState({ status: "downloaded", version: info.version }));
  autoUpdater.on("error", (error) => publishUpdateState({ status: "error", version: app.getVersion(), message: error.message }));
  windowRef?.webContents.once("did-finish-load", () => setTimeout(() => void autoUpdater.checkForUpdates().catch((error: Error) => publishUpdateState({ status: "error", message: error.message })), 5000));
  setInterval(() => void autoUpdater.checkForUpdates().catch(() => undefined), 30 * 60 * 1000);
}

function createWindow() {
  windowRef = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1040,
    minHeight: 680,
    backgroundColor: "#0b0d14",
    titleBarStyle: "hiddenInset",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  windowRef.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  windowRef.webContents.on("will-navigate", (event, url) => {
    const allowed = isDev ? url.startsWith(process.env.VITE_DEV_SERVER_URL!) : url.startsWith("file://");
    if (!allowed) event.preventDefault();
  });
  if (isDev) void windowRef.loadURL(process.env.VITE_DEV_SERVER_URL!);
  else void windowRef.loadFile(path.join(__dirname, "../dist/index.html"));
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => callback(["media", "display-capture"].includes(permission)));
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    const sources = await desktopCapturer.getSources({ types: ["screen", "window"], thumbnailSize: { width: 640, height: 360 }, fetchWindowIcons: true });
    const source = sources.find((item) => item.id === selectedSourceId);
    if (!source) return callback({});
    callback({ video: source, audio: selectedAudio ? "loopback" : undefined });
  });

  ipcMain.handle("config:get", () => ({
    supabaseUrl: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    apiUrl: process.env.PUBLIC_API_URL ?? process.env.VITE_API_URL,
    livekitUrl: process.env.PUBLIC_LIVEKIT_URL ?? process.env.VITE_LIVEKIT_URL,
  }));
  ipcMain.handle("screens:list", async () => (await desktopCapturer.getSources({ types: ["screen", "window"], thumbnailSize: { width: 480, height: 270 }, fetchWindowIcons: true })).map((source) => ({ id: source.id, name: source.name, thumbnail: source.thumbnail.toDataURL(), icon: source.appIcon?.toDataURL() ?? null })));
  ipcMain.handle("screens:select", (_event, value: { sourceId: string; shareAudio: boolean }) => { selectedSourceId = value.sourceId; selectedAudio = value.shareAudio; });
  ipcMain.handle("clipboard:writeText", (_event, value: string) => { clipboard.writeText(String(value)); return true; });
  ipcMain.handle("update:getState", () => updateState);
  ipcMain.handle("update:check", async () => {
    if (!app.isPackaged) return { status: "current", version: app.getVersion() } satisfies UpdateState;
    publishUpdateState({ status: "checking", version: app.getVersion() });
    await autoUpdater.checkForUpdates();
    return updateState;
  });
  ipcMain.handle("update:install", () => { if (updateState.status === "downloaded") autoUpdater.quitAndInstall(false, true); });
  ipcMain.handle("session:load", () => {
    if (!safeStorage.isEncryptionAvailable() || !existsSync(sessionFile())) return null;
    try { return safeStorage.decryptString(readFileSync(sessionFile())); } catch { return null; }
  });
  ipcMain.handle("session:save", (_event, value: string) => {
    if (!safeStorage.isEncryptionAvailable()) return false;
    writeFileSync(sessionFile(), safeStorage.encryptString(value));
    return true;
  });
  ipcMain.handle("session:clear", () => { if (existsSync(sessionFile())) unlinkSync(sessionFile()); });
  createWindow();
  configureAutoUpdates();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
