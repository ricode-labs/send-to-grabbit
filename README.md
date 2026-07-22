# Send-to-Grabbit

Chrome extension for sending browser downloads to Grabbit.

## Commands

- `npm install` installs dependencies.
- `npm run typecheck` runs TypeScript checks.
- `npm run build` builds the extension into `dist/`.

## Loading in Chrome

1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Click Load unpacked and select this repo's `dist/` directory.

## Protocol

Downloads are sent to Grabbit with a single protocol shape:

```text
grabbit://addUri?payload=<base64url-json>
```

The decoded JSON payload includes `url` and aria2-style `header` lines:

```json
{
  "url": "https://example.com/file.zip",
  "header": ["Accept-Language: ja", "Accept-Charset: utf-8"]
}
```
