import { useState } from "react";
import { ArrowRight, LockKeyhole, Sparkles } from "lucide-react";
import { getSupabase } from "../lib/supabase";

export function AuthScreen() {
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const supabase = await getSupabase();
      const result = signup
        ? await supabase.auth.signUp({ email, password, options: { data: { username: name, display_name: name } } })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (signup && !result.data.session) setError("Conta criada. Confirme o e-mail para entrar.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Nao foi possivel autenticar"); }
    finally { setBusy(false); }
  }

  return <div className="auth-page">
    <section className="auth-hero">
      <div className="brand-mark"><img src="/fungocord.png" alt="" /><span>FungoCord</span></div>
      <div className="hero-copy"><div className="eyebrow"><Sparkles size={15} /> SUA COMUNIDADE, CENTRALIZADA</div><h1>Converse.<br />Compartilhe.<br /><em>Fique perto.</em></h1><p>Mensagens em tempo real, chamadas de alta qualidade e compartilhamento de tela em um aplicativo seguro e independente.</p></div>
      <div className="orb orb-one" /><div className="orb orb-two" />
    </section>
    <section className="auth-panel"><form className="auth-card" onSubmit={submit}>
      <div className="auth-icon"><LockKeyhole /></div><h2>{signup ? "Crie sua conta" : "Bem-vindo de volta"}</h2><p>{signup ? "Comece uma nova comunidade." : "Entre para continuar suas conversas."}</p>
      {signup && <label>Nome de usuario<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={24} required placeholder="guilherme" /></label>}
      <label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="voce@exemplo.com" /></label>
      <label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required placeholder="Minimo de 8 caracteres" /></label>
      {error && <div className="form-error">{error}</div>}
      <button className="primary-button" disabled={busy}>{busy ? "Aguarde..." : signup ? "Criar conta" : "Entrar"}<ArrowRight size={18} /></button>
      <button type="button" className="link-button" onClick={() => { setSignup(!signup); setError(""); }}>{signup ? "Ja tenho uma conta" : "Ainda nao tenho uma conta"}</button>
    </form></section>
  </div>;
}
