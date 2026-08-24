# Arquitetura de implantacao

## Producao

O Electron conversa diretamente com o Supabase usando somente a chave publica e o JWT do usuario. As politicas RLS sao a fronteira de autorizacao para perfis, membros, canais, mensagens, conversas e Storage. O Supabase Realtime transmite mudancas do PostgreSQL e presenca efemera.

A aplicacao Next.js em `apps/api` e deliberadamente pequena e stateless para escalar em funcoes Vercel. Ela valida o JWT no Supabase, confirma que o usuario pertence ao servidor/canal e assina um token LiveKit com duracao de dez minutos. A chave `service_role` e o segredo LiveKit existem apenas nessa API.

O LiveKit atua como SFU: cada cliente envia uma unica trilha e o servidor encaminha as camadas apropriadas aos demais participantes. Camera e tela podem coexistir, e a grade do Electron se adapta a varias publicacoes simultaneas.

## Rede local

`iniciar-local.bat` sobe a pilha oficial do Supabase por meio do CLI e um LiveKit isolado em Docker. O script escolhe o IPv4 da rota padrao, gera configuracoes ignoradas pelo Git e inicia a API Hono em `0.0.0.0:8787`. O mesmo `server-core` e usado na Vercel e localmente.

O modo LAN e indicado para redes privadas confiaveis. Ele usa HTTP/WS sem TLS. Para acesso pela internet, use dominios HTTPS/WSS, certificados, TURN e regras de firewall restritas; nao encaminhe diretamente as portas locais do Supabase.

## Vercel

- Root Directory: `apps/api`
- Framework: Next.js
- Build Command: `npm run build`
- Output Directory: `.next`
- Node.js: 24 ou superior
- Function: `app/api/[...route]/route.ts`
- Endpoint de saude: `/api/health`
- Endpoint de token: `POST /api/rtc/token`

Variaveis obrigatorias: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `PUBLIC_LIVEKIT_URL` e `ALLOWED_ORIGINS`.
