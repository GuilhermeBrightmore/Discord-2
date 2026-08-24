import { Camera, Headphones, Mic2, MonitorUp, RefreshCw, Settings, X } from "lucide-react";
import { useEffect, useState } from "react";
import { loadAppSettings, saveAppSettings, type AppSettings } from "../lib/settings";

type DeviceGroups = Record<MediaDeviceKind, MediaDeviceInfo[]>;
const emptyDevices = (): DeviceGroups => ({ audioinput: [], audiooutput: [], videoinput: [] });

export function AppSettingsModal({ onClose }: { onClose(): void }) {
  const [settings, setSettings] = useState<AppSettings>(() => loadAppSettings());
  const [devices, setDevices] = useState<DeviceGroups>(emptyDevices);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function refreshDevices(requestPermission = false) {
    setLoading(true); setError("");
    try {
      if (requestPermission) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
        stream?.getTracks().forEach((track) => track.stop());
      }
      const next = emptyDevices();
      for (const device of await navigator.mediaDevices.enumerateDevices()) {
        if (device.kind in next) next[device.kind].push(device);
      }
      setDevices(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nao foi possivel listar os dispositivos.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void refreshDevices(true); }, []);

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSaved(false); setSettings((current) => ({ ...current, [key]: value }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault(); saveAppSettings(settings); setSaved(true);
  }

  return <div className="modal-backdrop settings-backdrop" onMouseDown={onClose}><div className="modal-card settings-modal" onMouseDown={(event) => event.stopPropagation()}>
    <button className="modal-close" onClick={onClose}><X /></button>
    <div className="modal-badge"><Settings /></div><h2>Configuracoes do aplicativo</h2><p>Escolha os dispositivos e o comportamento usado nas chamadas e mensagens.</p>
    <form onSubmit={submit}>
      <section className="settings-section"><h3><Mic2 /> Entrada de audio</h3>
        <DeviceSelect label="Microfone" devices={devices.audioinput} value={settings.microphoneId} fallback="Microfone padrao" onChange={(value) => update("microphoneId", value)} />
        <div className="settings-toggle-grid"><Toggle label="Supressao de ruido" checked={settings.noiseSuppression} onChange={(value) => update("noiseSuppression", value)} /><Toggle label="Cancelamento de eco" checked={settings.echoCancellation} onChange={(value) => update("echoCancellation", value)} /><Toggle label="Ganho automatico" checked={settings.autoGainControl} onChange={(value) => update("autoGainControl", value)} /></div>
      </section>
      <section className="settings-section"><h3><Headphones /> Saida de audio</h3><DeviceSelect label="Fone ou alto-falante" devices={devices.audiooutput} value={settings.speakerId} fallback="Saida padrao" onChange={(value) => update("speakerId", value)} /></section>
      <section className="settings-section"><h3><Camera /> Camera</h3><div className="settings-grid"><DeviceSelect label="Dispositivo de video" devices={devices.videoinput} value={settings.cameraId} fallback="Camera padrao" onChange={(value) => update("cameraId", value)} /><label>Resolucao<select value={settings.cameraResolution} onChange={(event) => update("cameraResolution", event.target.value as AppSettings["cameraResolution"])}><option value="480p">480p</option><option value="720p">720p</option><option value="1080p">1080p</option></select></label></div></section>
      <section className="settings-section"><h3><MonitorUp /> Compartilhamento de tela</h3><div className="settings-grid"><label>Resolucao<select value={settings.screenResolution} onChange={(event) => update("screenResolution", event.target.value as AppSettings["screenResolution"])}><option value="480p">480p</option><option value="720p">720p</option><option value="1080p">1080p</option><option value="1440p">1440p</option><option value="source">Original</option></select></label><label>FPS<select value={settings.screenFps} onChange={(event) => update("screenFps", Number(event.target.value) as AppSettings["screenFps"])}><option value="5">5</option><option value="15">15</option><option value="30">30</option><option value="60">60</option></select></label></div><Toggle label="Compartilhar audio do sistema por padrao" checked={settings.screenAudio} onChange={(value) => update("screenAudio", value)} /></section>
      <section className="settings-section"><h3>Mensagens</h3><Toggle label="Enter envia; Shift + Enter quebra a linha" checked={settings.sendWithEnter} onChange={(value) => update("sendWithEnter", value)} /></section>
      {error && <div className="form-error">{error}</div>}{saved && <div className="form-success">Configuracoes salvas e aplicadas.</div>}
      <div className="settings-actions"><button type="button" className="secondary-button" disabled={loading} onClick={() => void refreshDevices(true)}><RefreshCw /> {loading ? "Atualizando..." : "Atualizar dispositivos"}</button><button className="primary-button">Salvar configuracoes</button></div>
    </form>
  </div></div>;
}

function DeviceSelect({ label, devices, value, fallback, onChange }: { label: string; devices: MediaDeviceInfo[]; value: string; fallback: string; onChange(value: string): void }) {
  const hasValue = value === "default" || devices.some((device) => device.deviceId === value);
  return <label>{label}<select value={hasValue ? value : "default"} onChange={(event) => onChange(event.target.value)}><option value="default">{fallback}</option>{devices.filter((device) => device.deviceId !== "default").map((device, index) => <option value={device.deviceId} key={`${device.kind}:${device.deviceId}`}>{device.label || `${fallback} ${index + 1}`}</option>)}</select></label>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange(value: boolean): void }) {
  return <label className="settings-toggle"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label>;
}
