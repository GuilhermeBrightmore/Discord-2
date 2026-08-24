import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("discord2", {
  config: () => ipcRenderer.invoke("config:get"),
  session: {
    load: () => ipcRenderer.invoke("session:load"),
    save: (value: string) => ipcRenderer.invoke("session:save", value),
    clear: () => ipcRenderer.invoke("session:clear"),
  },
  screens: {
    list: () => ipcRenderer.invoke("screens:list"),
    select: (sourceId: string, shareAudio: boolean) => ipcRenderer.invoke("screens:select", { sourceId, shareAudio }),
  },
  clipboard: { writeText: (value: string) => ipcRenderer.invoke("clipboard:writeText", value) },
  updates: {
    getState: () => ipcRenderer.invoke("update:getState"),
    check: () => ipcRenderer.invoke("update:check"),
    install: () => ipcRenderer.invoke("update:install"),
    onState: (listener: (state: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, state: unknown) => listener(state);
      ipcRenderer.on("update:state", handler);
      return () => ipcRenderer.removeListener("update:state", handler);
    },
  },
  deepLinks: {
    onInvite: (listener: (code: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, code: string) => listener(code);
      ipcRenderer.on("deep-link:invite", handler);
      return () => ipcRenderer.removeListener("deep-link:invite", handler);
    },
  },
  platform: process.platform,
});
