# Agent Guide

- This is a single-package Chrome Manifest V3 extension; there is no workspace, test suite, lint config, or formatter config.
- Install dependencies with `npm install`. Run `npm run typecheck` and `npm run build` for verification; the build output is `dist/`.
- `src/background.ts` is the sole Vite entrypoint and must remain the service worker emitted as `dist/background.js`; `public/manifest.json` supplies the MV3 manifest copied into `dist/`.
- Test extension changes by rebuilding, then load or reload the repository's `dist/` directory at `chrome://extensions` with Developer mode enabled. Chrome 120 or newer is required.
- The service worker intercepts HTTP(S) downloads, cancels and erases the browser download, then opens `grabbit://addUri?payload=...`; preserve URL-encoded JSON payloads and forwarded request metadata when changing this flow.
- Request headers are captured for only about 10 seconds and intentionally exclude browser-managed/security, proxy, and transport headers; do not assume every download has a captured request.
