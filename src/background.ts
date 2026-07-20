type GrabbitPayload = {
  url: string
  filename?: string
  userAgent?: string
  authorization?: string
  referer?: string
  cookie?: string
}

type CapturedRequest = {
  url: string
  time: number
  headers: Record<string, string>
}

const requestTtlMs = 2 * 60 * 1000
const recentRequests = new Map<string, CapturedRequest>()

function normalizeHeaderName(name: string) {
  return name.toLowerCase()
}

function captureRequestHeaders(
  details: chrome.webRequest.OnBeforeSendHeadersDetails
): chrome.webRequest.BlockingResponse | undefined {
  if (!details.requestHeaders) {
    return undefined
  }

  const headers: Record<string, string> = {}
  for (const header of details.requestHeaders) {
    if (!header.name || header.value === undefined) {
      continue
    }
    headers[normalizeHeaderName(header.name)] = header.value
  }

  recentRequests.set(details.url, {
    url: details.url,
    time: Date.now(),
    headers,
  })

  return undefined
}

function pruneCapturedRequests() {
  const expiredBefore = Date.now() - requestTtlMs
  for (const [key, request] of recentRequests) {
    if (request.time < expiredBefore) {
      recentRequests.delete(key)
    }
  }
}

function base64UrlEncode(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "")
}

function buildCookieHeader(cookies: chrome.cookies.Cookie[]) {
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ")
}

async function getCookieHeader(url: string) {
  try {
    const cookies = await chrome.cookies.getAll({ url })
    return buildCookieHeader(cookies)
  } catch {
    return ""
  }
}

function buildGrabbitUrl(payload: GrabbitPayload) {
  return `grabbit://add?payload=${base64UrlEncode(JSON.stringify(payload))}`
}

function isSupportedDownloadUrl(url: string) {
  return /^(https?|ftp):\/\//i.test(url)
}

function basename(value: string) {
  return value.split(/[\\/]/).filter(Boolean).pop() || ""
}

async function openExternalProtocol(url: string) {
  await chrome.tabs.create({ active: false, url })
}

async function sendDownloadToGrabbit(item: chrome.downloads.DownloadItem) {
  if (!isSupportedDownloadUrl(item.url)) {
    return
  }

  pruneCapturedRequests()

  const capturedRequest = recentRequests.get(item.url)
  const headers = capturedRequest?.headers ?? {}
  const cookie = headers.cookie || (await getCookieHeader(item.url))
  const referer = headers.referer || item.referrer || ""
  const userAgent = headers["user-agent"] || navigator.userAgent || ""
  const authorization = headers.authorization || ""

  const payload: GrabbitPayload = {
    url: item.url,
    filename: basename(item.filename) || basename(item.url) || undefined,
    userAgent,
    authorization,
    referer,
    cookie,
  }

  try {
    await chrome.downloads.cancel(item.id)
  } catch {
    return
  }

  await openExternalProtocol(buildGrabbitUrl(payload)).catch(() => undefined)
}

chrome.webRequest.onBeforeSendHeaders.addListener(
  captureRequestHeaders,
  { urls: ["<all_urls>"] },
  ["requestHeaders", "extraHeaders"]
)

chrome.downloads.onCreated.addListener((item) => {
  void sendDownloadToGrabbit(item)
})
