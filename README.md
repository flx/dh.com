# digitalhandstand.com

Static website for Digital Handstand.

## Purpose
- Central landing page for all apps.
- App-specific pages under:
  - `/pawnpilot/`
  - `/stuffbucket/`
  - `/nummern/`
- App Store-ready legal/support URLs:
  - `/pawnpilot/privacy/`
  - `/pawnpilot/support/`
  - `/stuffbucket/privacy/`
  - `/stuffbucket/support/`
  - `/nummern/privacy/`
  - `/nummern/instructions/`

## Structure
- `index.html` - app hub
- `pawnpilot/` - PawnPilot pages
- `stuffbucket/` - StuffBucket pages
- `nummern/` - Nummern pages
- `assets/styles.css` - shared styling
- `assets/images/` - app icons
- `404.html` - fallback page

## Local preview
From this folder:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Cloudflare Pages deploy
1. Create a Pages project from your Git repo (recommended) or use Direct Upload.
2. Build command: none
3. Build output directory: `/` (root)
4. Add custom domain `digitalhandstand.com`.

No framework or build step is required.

## App Store URLs to use
- PawnPilot support: `https://digitalhandstand.com/pawnpilot/support/`
- PawnPilot privacy: `https://digitalhandstand.com/pawnpilot/privacy/`
- StuffBucket support: `https://digitalhandstand.com/stuffbucket/support/`
- StuffBucket privacy: `https://digitalhandstand.com/stuffbucket/privacy/`
- Nummern instructions: `https://digitalhandstand.com/nummern/instructions/`
- Nummern privacy: `https://digitalhandstand.com/nummern/privacy/`
