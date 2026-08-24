interface DesktopSource { id: string; name: string; thumbnail: string; icon: string | null }
interface RuntimeConfig { supabaseUrl?: string; supabaseKey?: string; apiUrl?: string; livekitUrl?: string }
interface UpdateState { status: "idle" | "checking" | "available" | "downloading" | "downloaded" | "current" | "error"; version?: string; percent?: number; message?: string }
interface Window {
  discord2: {
    config(): Promise<RuntimeConfig>;
    session: { load(): Promise<string | null>; save(value: string): Promise<boolean>; clear(): Promise<void> };
    screens: { list(): Promise<DesktopSource[]>; select(sourceId: string, shareAudio: boolean): Promise<void> };
    clipboard: { writeText(value: string): Promise<boolean> };
    updates: { getState(): Promise<UpdateState>; check(): Promise<UpdateState>; install(): Promise<void>; onState(listener: (state: UpdateState) => void): () => void };
    platform: string;
  };
}
