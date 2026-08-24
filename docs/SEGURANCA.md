# Lista de seguranca

- Nunca envie `.env.local`, chaves `service_role` ou o segredo do LiveKit ao GitHub.
- No Electron, apenas a chave publica Supabase pode usar o prefixo `VITE_`.
- Configure confirmacao de e-mail, SMTP proprio, CAPTCHA e limites de Auth no Supabase antes do lancamento.
- Revise as politicas de `supabase/migrations` sempre que adicionar uma tabela.
- Restrinja `ALLOWED_ORIGINS` aos esquemas/domínios utilizados em producao.
- Use somente `https://` e `wss://` fora da rede local.
- Configure TURN/TLS no LiveKit para redes corporativas e moveis restritivas.
- Rode `npm audit`, atualize Electron/Next.js/Supabase/LiveKit e recompile os executaveis regularmente.
- Proteja a branch principal depois da primeira publicacao. O `publicar-github.bat` usa force push por solicitacao explicita e pede confirmacao se encontrar conteudo.

O renderer Electron executa com `contextIsolation`, sandbox e `nodeIntegration: false`. A ponte preload expoe somente operacoes limitadas de configuracao publica, sessao criptografada, tela, clipboard, atualizacoes e convites profundos. Navegacao remota e novas janelas internas sao bloqueadas.

Permissoes, hierarquia, expulsao, banimento, cargos e comandos de moderacao de voz sao validados por funcoes `security definer` no PostgreSQL; esconder um botao no cliente nunca e tratado como autorizacao. O endpoint publico de convite retorna somente nome, icone e quantidade de membros do servidor, sem listar usuarios ou expor dados privados.
