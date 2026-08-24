import { LogIn, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { joinServer, loadInvitePreview, type InvitePreview } from "../lib/data";

export function InviteModal({ code, onClose, onAccepted }: { code: string; onClose(): void; onAccepted(serverId: string): Promise<void> }) {
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    setInvite(null); setError("");
    void loadInvitePreview(code).then((preview) => { if (alive) setInvite(preview); }).catch((cause) => { if (alive) setError(cause instanceof Error ? cause.message : "Convite invalido"); });
    return () => { alive = false; };
  }, [code]);

  async function accept() {
    setBusy(true); setError("");
    try { const serverId = await joinServer(code); await onAccepted(serverId); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Nao foi possivel aceitar o convite"); }
    finally { setBusy(false); }
  }

  return <div className="modal-backdrop invite-modal-backdrop" onMouseDown={onClose}><div className="modal-card invite-app-modal" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose}><X /></button>
    {invite ? <>{invite.server.iconUrl ? <img className="invite-app-icon" src={invite.server.iconUrl} alt="" /> : <div className="invite-app-icon fallback">{invite.server.name.slice(0, 2).toUpperCase()}</div>}<span>CONVITE PARA SERVIDOR</span><h2>{invite.server.name}</h2><p><Users /> {invite.server.memberCount} {invite.server.memberCount === 1 ? "membro" : "membros"}</p><button className="primary-button" disabled={busy} onClick={() => void accept()}><LogIn /> {busy ? "Entrando..." : "Aceitar convite"}</button><button className="secondary-button invite-decline" disabled={busy} onClick={onClose}>Agora nao</button></> : error ? <><div className="invite-app-icon invalid">!</div><h2>Convite indisponivel</h2><p>{error}</p><button className="secondary-button invite-decline" onClick={onClose}>Fechar</button></> : <><div className="invite-app-loader" /><h2>Verificando convite...</h2></>}
  </div></div>;
}
