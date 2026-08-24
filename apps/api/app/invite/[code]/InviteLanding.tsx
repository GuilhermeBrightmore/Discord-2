"use client";

import { useEffect, useState } from "react";

const githubUrl = "https://github.com/GuilhermeBrightmore/Discord-2";
const downloadUrl = process.env.NEXT_PUBLIC_DOWNLOAD_URL ?? `${githubUrl}/releases/latest`;

interface InvitePreview {
  code: string;
  server: { id: string; name: string; iconUrl: string | null; memberCount: number };
  expiresAt: string | null;
}

export default function InviteLanding({ code }: { code: string }) {
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [error, setError] = useState("");
  const deepLink = `fungocord://invite/${encodeURIComponent(code)}`;

  useEffect(() => {
    let alive = true;
    fetch(`/api/invites/${encodeURIComponent(code)}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Convite indisponivel");
        if (alive) setInvite(body);
      })
      .catch((reason) => alive && setError(reason instanceof Error ? reason.message : "Convite indisponivel"));
    return () => { alive = false; };
  }, [code]);

  useEffect(() => {
    if (!invite) return;
    const timer = window.setTimeout(() => { window.location.href = deepLink; }, 550);
    return () => window.clearTimeout(timer);
  }, [deepLink, invite]);

  return <main className="invite-page">
    <a className="invite-brand" href="/"><img src="/fungocord.png" alt="" /> FungoCord</a>
    <section className="invite-card">
      {error ? <>
        <div className="invite-icon invalid">!</div>
        <span>CONVITE INDISPONÍVEL</span>
        <h1>{error}</h1>
        <p>Peça um novo link ao proprietário do servidor.</p>
        <a className="ghost-button" href="/">Voltar para o início</a>
      </> : invite ? <>
        {invite.server.iconUrl ? <img className="invite-server-icon" src={invite.server.iconUrl} alt="" /> : <div className="invite-server-icon fallback">{invite.server.name.slice(0, 2).toUpperCase()}</div>}
        <span>VOCÊ FOI CONVIDADO PARA</span>
        <h1>{invite.server.name}</h1>
        <p><i className="online-dot" /> {invite.server.memberCount} {invite.server.memberCount === 1 ? "membro" : "membros"}</p>
        <a className="download-button invite-open" href={deepLink}>Abrir no FungoCord</a>
        <small>O aplicativo perguntará se você deseja aceitar este convite.</small>
      </> : <>
        <div className="invite-loader" />
        <h1>Verificando convite…</h1>
      </>}
    </section>
    <p className="invite-fallback">Ainda não tem o aplicativo? <a href={downloadUrl}>Baixe o FungoCord para Windows</a></p>
  </main>;
}
