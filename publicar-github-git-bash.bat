: <<'BATCH'
@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title FungoCord - Publicar pelo Git Bash

set "GIT_BASH=%GIT_BASH_EXE%"
if defined GIT_BASH goto git_bash_found

set "GIT_BASH=%ProgramFiles%\Git\bin\bash.exe"
if exist "%GIT_BASH%" goto git_bash_found

set "GIT_BASH=%LocalAppData%\Programs\Git\bin\bash.exe"
if exist "%GIT_BASH%" goto git_bash_found

set "GIT_BASH=%ProgramFiles(x86)%\Git\bin\bash.exe"
if exist "%GIT_BASH%" goto git_bash_found

echo [ERRO] Git Bash nao encontrado.
echo Instale o Git for Windows em https://git-scm.com/download/win
echo Se ele estiver em outro local, defina GIT_BASH_EXE com o caminho do bash.exe.
pause
exit /b 1

:git_bash_found
"%GIT_BASH%" "%~f0" %*
set "SCRIPT_EXIT=%ERRORLEVEL%"
if not "%SCRIPT_EXIT%"=="0" pause
exit /b %SCRIPT_EXIT%
BATCH

set -Eeuo pipefail

script_path="${BASH_SOURCE[0]}"
if command -v cygpath >/dev/null 2>&1; then
  script_path="$(cygpath -u "$script_path")"
fi
project_root="$(cd "$(dirname "$script_path")" && pwd)"
cd "$project_root"

printf '\n============================================================\n'
printf '  FUNGOCORD - PUBLICACAO NO GITHUB PELO GIT BASH\n'
printf '============================================================\n\n'

if ! command -v git >/dev/null 2>&1; then
  echo "[ERRO] O comando git nao esta disponivel no Git Bash."
  exit 1
fi

# Um repositorio interno impede que arquivos de uma pasta Git superior sejam incluidos.
if [[ ! -e .git ]]; then
  git init --initial-branch=main .
fi

repo_url="${1:-}"
if [[ -z "$repo_url" ]] && git remote get-url origin >/dev/null 2>&1; then
  repo_url="$(git remote get-url origin)"
fi
if [[ -z "$repo_url" ]]; then
  read -r -p "Cole a URL do repositorio GitHub: " repo_url
fi

if [[ ! "$repo_url" =~ ^https://github\.com/[^/[:space:]]+/[^/[:space:]]+(/)?$ ]] &&
   [[ ! "$repo_url" =~ ^git@github\.com:[^/[:space:]]+/[^/[:space:]]+(/)?$ ]]; then
  echo "[ERRO] Informe uma URL HTTPS ou SSH valida do GitHub."
  echo "Exemplo: https://github.com/usuario/repositorio.git"
  exit 1
fi

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$repo_url"
else
  git remote add origin "$repo_url"
fi

echo "[1/4] Verificando acesso e conteudo remoto..."
if ! remote_heads="$(git ls-remote --heads origin 2>&1)"; then
  echo "$remote_heads"
  echo "[ERRO] Nao foi possivel acessar o repositorio."
  echo "Confirme a URL e autentique pelo Git Credential Manager."
  exit 1
fi

remote_branch="$(git ls-remote --symref origin HEAD 2>/dev/null | awk '$1 == "ref:" { sub("refs/heads/", "", $2); print $2; exit }')"
if [[ -z "$remote_branch" && -n "$remote_heads" ]]; then
  remote_branch="$(printf '%s\n' "$remote_heads" | awk 'NF >= 2 { sub("refs/heads/", "", $2); print $2; exit }')"
fi
remote_branch="${remote_branch:-main}"

if [[ -n "$remote_heads" ]]; then
  printf '\n[ATENCAO] O repositorio remoto ja possui conteudo.\n'
  printf 'Todos os arquivos e o historico da branch "%s" serao substituidos.\n' "$remote_branch"
  printf 'Outras branches e tags nao serao apagadas.\n\n'
  read -r -p 'Digite SUBSTITUIR para confirmar: ' confirmation
  if [[ "$confirmation" != "SUBSTITUIR" ]]; then
    echo "Operacao cancelada sem alterar o GitHub."
    exit 0
  fi
else
  echo "[OK] O repositorio remoto esta vazio."
fi

echo "[2/4] Preparando todos os arquivos deste projeto..."
git config user.name >/dev/null 2>&1 || git config user.name "FungoCord Publisher"
git config user.email >/dev/null 2>&1 || git config user.email "fungocord@users.noreply.github.com"
git add --all
git commit --allow-empty -m "Publicar FungoCord centralizado"
git branch -M "$remote_branch"

echo "[3/4] Substituindo a branch remota $remote_branch..."
git push --force origin "HEAD:$remote_branch"

echo "[4/4] Publicacao concluida."
printf '\n[SUCESSO] Repositorio atualizado: %s\n' "$repo_url"
printf 'Branch substituida: %s\n\n' "$remote_branch"
read -r -p "Pressione Enter para fechar..." _
