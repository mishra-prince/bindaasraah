#!/usr/bin/env bash
set -euo pipefail

REPO="mishra-prince/bindaasraah"
cd "$(dirname "$0")"

echo "Publishing BindaasRaah to GitHub as $REPO"

if ! command -v git >/dev/null 2>&1; then
  echo "Git not installed. On macOS install Apple Command Line Tools: xcode-select --install"
  exit 1
fi
if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required. If you use Homebrew, run: brew install gh"
  echo "Then run this script again: bash publish-mac.sh"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub authentication is required."
  gh auth login
fi

WHO="$(gh api user --jq .login)"
if [[ "$WHO" != "mishra-prince" ]]; then
  echo "Authenticated as $WHO, not mishra-prince. To avoid publishing to the wrong account, stopping."
  exit 1
fi

if [[ -f .env ]] || [[ -f secrets.json ]] || [[ -f .env.local ]]; then
  echo "Detected a local secrets file. To avoid uploading secrets, stop and inspect before publishing."
  exit 1
fi

if [[ "$(git rev-parse --show-toplevel 2>/dev/null || true)" != "$PWD" ]]; then
  git init
fi

git branch -M main
if [[ -z "$(git config user.name || true)" ]] || [[ -z "$(git config user.email || true)" ]]; then
  echo "Git name/email not configured. Configure them using git config --global and run again."
  exit 1
fi

git add .
if ! git diff --cached --quiet; then
  git commit -m "Publish BindaasRaah navigation and journey beta"
fi

if gh repo view "$REPO" >/dev/null 2>&1; then
  echo "Repository already exists: https://github.com/$REPO"
  if git remote get-url origin >/dev/null 2>&1; then
    REMOTE="$(git remote get-url origin)"
    if [[ "$REMOTE" != *"mishra-prince/bindaasraah"* ]]; then
      echo "Origin points somewhere else ($REMOTE). Stopping to prevent an accidental push."
      exit 1
    fi
  else
    git remote add origin "https://github.com/$REPO.git"
  fi
  git push -u origin main
else
  gh repo create "$REPO" --public --description "BindaasRaah — privacy-first journey planning research beta" --source=. --remote=origin --push
fi

printf '\nGitHub source: https://github.com/%s\n' "$REPO"
echo "NEXT: Go to https://dashboard.render.com/ and create New > Blueprint."
echo "Select this repository and approve render.yaml after reviewing the hosting account and plan."
echo "Wait for the provider to return a public URL; no deployment URL is assigned by this script."
echo "Do not publish any API keys in source code; use the hosting provider environment variables."
