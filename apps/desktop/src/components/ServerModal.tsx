import { useState } from "react";
import { ArrowLeft, Link2, Plus, Users, X } from "lucide-react";
import { createServer, joinServer } from "../lib/data";

export function ServerModal({ onClose, onDone }: { onClose(): void; onDone(): Promise<void> }) {
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { if (mode === "create") await createServer(value); else await joinServer(value); await onDone(); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Operacao indisponivel"); }
    finally { setBusy(false); }
  }
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal-card" onMouseDown={(event) => event.stopPropagation()}>
    <button className="modal-close" onClick={onClose}><X /></button>
    {mode === "choose" ? <><div className="modal-badge"><Users /></div><h2>Adicione um servidor</h2><p>Crie seu proprio espaco ou use um convite.</p><button className="choice-card" onClick={() => setMode("create")}><span><Plus /></span><div><strong>Criar uma comunidade</strong><small>Comece do zero</small></div></button><button className="choice-card" onClick={() => setMode("join")}><span><Link2 /></span><div><strong>Entrar com convite</strong><small>Use o codigo recebido</small></div></button></> : <form onSubmit={submit}><button type="button" className="back-button" onClick={() => setMode("choose")}><ArrowLeft /> Voltar</button><div className="modal-badge">{mode === "create" ? <Plus /> : <Link2 />}</div><h2>{mode === "create" ? "Crie seu servidor" : "Entre em um servidor"}</h2><p>{mode === "create" ? "Dê um nome especial para sua comunidade." : "Cole apenas o codigo do convite."}</p><label>{mode === "create" ? "Nome do servidor" : "Codigo do convite"}<input autoFocus value={value} onChange={(event) => setValue(event.target.value)} minLength={2} required placeholder={mode === "create" ? "Minha comunidade" : "a1b2c3d4"} /></label>{error && <div className="form-error">{error}</div>}<button className="primary-button" disabled={busy}>{busy ? "Aguarde..." : mode === "create" ? "Criar servidor" : "Entrar"}</button></form>}
  </div></div>;
}
