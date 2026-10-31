# Publish BindaasRaah on GitHub + Render

BindaasRaah v0.2 is an **unauthenticated research beta**. It is not a production-ready women's safety platform. Never publish demo accounts as real women, or imply live gender counts, verified lighting, or emergency dispatch.

## 1. Create the empty GitHub repository

1. In your signed-in GitHub account, open https://github.com/new.
2. Name the repository `bindaasraah`. Choose Public only if you're comfortable making the code open-source (the app contains no user identities or API keys).
3. Do **not** check “Add a README”, “.gitignore” or “license” since these files are included.
4. Create the repository.

## 2. Push from Mac

Open Terminal **inside the extracted `bindaasraah-deploy-ready` directory**:

```bash
cd ~/Downloads/bindaasraah-deploy-ready
git init
git branch -M main
git add .
git commit -m "Release BindaasRaah navigation beta"
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/bindaasraah.git
git push -u origin main
```

Replace `YOUR_GITHUB_USERNAME` with your actual username. GitHub will require authentication via your existing credential helper or supported login flow. Do not paste tokens into the chat or source code.

## 3. Deploy to Render

1. Sign in at https://dashboard.render.com and connect GitHub.
2. Choose **New > Blueprint** and select the `bindaasraah` repository, or **New > Web Service** with Python runtime and start command `python3 server.py`.
3. Use the included `render.yaml`; check the service, billing and region before approving creation.
4. For more reliable routes set `ORS_API_KEY` **only** in Render's secret environment variables.
5. Visit the Render-assigned URL when deployment says Live, test `/api/health`, then validate real routes, mapped places, and fallback errors.

`render.yaml` selects the free plan; Render services can sleep, have usage limits, and may require plan confirmation. No live domain is promised until hosting reports success.

## 4. Updating

Edit files, run:

```bash
python3 -m unittest discover -s tests -p 'test_*.py' -v
npm test
npm run check
git add .
git commit -m "Describe the improvement"
git push
```

GitHub Actions executes checks, and Render is configured to redeploy after successful CI. If you don't connect Render to GitHub, it cannot auto-deploy.

## Critical limits

- Public Nominatim has a *global* rate limit of 1 request/s and requires identifiable requests. This small research beta enforces application-wide cooldowns; **do not direct significant public traffic here**. For a public user launch, use contracted geocoding, routing, tile and places providers.
- Do not assume Valhalla public demo, OSMF tile servers or Overpass offer production guarantees.
- This app has no secure identity verification, E2EE chat, roadside dispatch or real-time gender activity feed.
- Route coordinates and query strings are processed transiently by app server and third-party provider servers. Do not promise zero server-side processing or confidentiality from a hosting operator.
- The app must be security-reviewed and independently tested before real participant trials.
