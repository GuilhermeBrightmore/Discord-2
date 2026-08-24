import { DownloadCloud, RefreshCw, Rocket, X } from "lucide-react";
import { useEffect, useState } from "react";

export function UpdateBanner() {
  const [state, setState] = useState<UpdateState>({ status: "idle" });
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    void window.discord2.updates.getState().then(setState);
    return window.discord2.updates.onState((next) => { setState(next); setHidden(false); });
  }, []);
  if (hidden || ["idle", "current"].includes(state.status)) return null;
  const text = state.status === "checking" ? "Procurando atualizacoes..." : state.status === "available" ? `FungoCord ${state.version} disponivel` : state.status === "downloading" ? `Baixando atualizacao · ${state.percent ?? 0}%` : state.status === "downloaded" ? `FungoCord ${state.version} pronto para instalar` : "Nao foi possivel verificar atualizacoes";
  return <aside className={`update-banner ${state.status}`}><span>{state.status === "downloaded" ? <Rocket /> : state.status === "error" ? <RefreshCw /> : <DownloadCloud />}</span><div><strong>{text}</strong>{state.status === "downloading" && <i><b style={{ width: `${state.percent ?? 0}%` }} /></i>}{state.status === "error" && <small>{state.message}</small>}</div>{state.status === "downloaded" && <button onClick={() => void window.discord2.updates.install()}>Reiniciar e instalar</button>}{state.status === "error" && <button onClick={() => void window.discord2.updates.check()}>Tentar novamente</button>}<button className="update-close" title="Fechar" onClick={() => setHidden(true)}><X /></button></aside>;
}
