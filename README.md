# Send-to-Grabbit

Chrome extension for sending browser downloads to Grabbit.

## Why use it

Send-to-Grabbit removes the manual copy-and-paste step when sending browser downloads to Grabbit.

It also forwards useful request metadata, including cookies, referrer, user agent, and captured request headers when available. This is especially helpful for downloads that require a logged-in browser session or signed request context, where pasting only the raw URL into Grabbit may fail.

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
grabbit://addUri?payload=<url-encoded-json>
```

The `payload` query parameter is URL-encoded JSON with `url` and aria2-style `header` lines:

```json
{
  "url": "https://example.com/file.zip",
  "header": ["Accept-Language: ja", "Accept-Charset: utf-8"]
}
```
