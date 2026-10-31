# BindaasRaah — one-script GitHub publishing

1. Unzip this archive to Downloads.
2. Install GitHub CLI if needed: `brew install gh` (requires Homebrew; otherwise install via https://cli.github.com/).
3. In Terminal:
   ```bash
   cd ~/Downloads/bindaasraah-github-publish
   bash publish-mac.sh
   ```
4. Log in to **your own** GitHub account if asked (browser/OAuth; never share GitHub tokens here).
5. The script creates `mishra-prince/bindaasraah` if it does not exist, makes one initial commit, and pushes it. It refuses to switch accounts or force-push unrelated history.
6. Visit https://dashboard.render.com/ and click **New > Blueprint**, then connect the repo. The included `render.yaml` uses a Python web service and a health check at `/api/health`. Check pricing/limits before approval.
7. Once Render reports Live, check its actual assigned URL and `/api/health`. Test routing, map tiles and public-provider rate limits. If using an OpenRouteService API key, configure `ORS_API_KEY` as a server environment variable; never commit it.

This script cannot authorize Render or publish without a GitHub login. It does not deploy the website by itself. This is a research beta, not a verified route-safety service or a women-only social network.
