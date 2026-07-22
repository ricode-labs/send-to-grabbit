type GrabbitPayload = {
  url: string;
  header: string[];
};

type CapturedHeader = {
  name: string;
  value: string;
};

type CapturedRequest = {
  url: string;
  time: number;
  headers: CapturedHeader[];
};

const requestTtlMs = 2 * 60 * 1000;
const recentRequests = new Map<string, CapturedRequest>();
const debugPrefix = "[Send to Grabbit]";

function debugLog(message: string, data?: unknown) {
  if (data === undefined) {
    console.debug(debugPrefix, message);
    return;
  }

  console.debug(debugPrefix, message, data);
}

function pruneCapturedRequests() {
  const expiredBefore = Date.now() - requestTtlMs;
  let prunedCount = 0;
  for (const [key, request] of recentRequests) {
    if (request.time < expiredBefore) {
      recentRequests.delete(key);
      prunedCount += 1;
    }
  }

  if (prunedCount > 0) {
    debugLog("Pruned expired captured requests", { prunedCount });
  }
}

function base64UrlEncode(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function buildCookieHeader(cookies: chrome.cookies.Cookie[]) {
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

async function getCookieHeader(url: string) {
  try {
    const cookies = await chrome.cookies.getAll({ url });
    debugLog("Read cookies for download URL", {
      url,
      cookieCount: cookies.length,
    });
    return buildCookieHeader(cookies);
  } catch (error) {
    debugLog("Failed to read cookies for download URL", { url, error });
    return "";
  }
}

function buildGrabbitUrl(payload: GrabbitPayload) {
  return `grabbit://addUri?payload=${base64UrlEncode(JSON.stringify(payload))}`;
}

function isSupportedDownloadUrl(url: string) {
  return /^(https?|ftp):\/\//i.test(url);
}

async function openExternalProtocol(url: string) {
  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (activeTab?.id !== undefined) {
    debugLog("Opening protocol URL in active tab", { tabId: activeTab.id });
    await chrome.tabs.update(activeTab.id, { url });
    return;
  }

  debugLog("No active tab found; opening protocol URL in new tab");
  await chrome.tabs.create({ active: true, url });
}

function summarizePayload(payload: GrabbitPayload) {
  return {
    url: payload.url,
    headerCount: payload.header?.length ?? 0,
    headerNames: payload.header?.map((header) => header.split(":", 1)[0]) ?? [],
  };
}

function shouldForwardHeader(name: string) {
  const normalizedName = normalizeHeaderName(name);
  const excludedHeaders = new Set([
    "host",
    "connection",
    "content-length",
    "content-type",
    "range",
    "accept-encoding",
    "upgrade-insecure-requests",
  ]);

  return (
    !excludedHeaders.has(normalizedName) &&
    !normalizedName.startsWith("sec-") &&
    !normalizedName.startsWith("proxy-")
  );
}

function hasHeader(headers: CapturedHeader[], name: string) {
  const normalizedName = normalizeHeaderName(name);
  return headers.some(
    (header) => normalizeHeaderName(header.name) === normalizedName,
  );
}

async function buildForwardedHeaders(
  item: chrome.downloads.DownloadItem,
  capturedHeaders: CapturedHeader[],
) {
  const headers = capturedHeaders.filter((header) =>
    shouldForwardHeader(header.name),
  );

  if (!hasHeader(headers, "cookie")) {
    const cookie = await getCookieHeader(item.url);
    if (cookie) {
      headers.push({ name: "Cookie", value: cookie });
    }
  }

  if (!hasHeader(headers, "referer") && item.referrer) {
    headers.push({ name: "Referer", value: item.referrer });
  }

  if (!hasHeader(headers, "user-agent") && navigator.userAgent) {
    headers.push({ name: "User-Agent", value: navigator.userAgent });
  }

  return headers.map((header) => `${header.name}: ${header.value}`);
}

async function sendDownloadToGrabbit(item: chrome.downloads.DownloadItem) {
  debugLog("Download created", {
    id: item.id,
    url: item.url,
    filename: item.filename,
    referrer: item.referrer,
  });

  if (!isSupportedDownloadUrl(item.url)) {
    debugLog("Ignored unsupported download URL", {
      id: item.id,
      url: item.url,
    });
    return;
  }

  pruneCapturedRequests();

  const capturedRequest = recentRequests.get(item.url);
  const headers = capturedRequest?.headers ?? [];
  debugLog("Matched captured request", {
    id: item.id,
    url: item.url,
    matched: Boolean(capturedRequest),
    capturedAgeMs: capturedRequest
      ? Date.now() - capturedRequest.time
      : undefined,
    headerNames: headers.map((header) => header.name),
  });

  const header = await buildForwardedHeaders(item, headers);

  const payload: GrabbitPayload = {
    url: item.url,
    header,
  };

  debugLog("Prepared Grabbit payload", summarizePayload(payload));

  try {
    await chrome.downloads.cancel(item.id);
    debugLog("Cancelled browser download", { id: item.id });
  } catch (error) {
    debugLog("Failed to cancel browser download", { id: item.id, error });
    return;
  }

  try {
    await openExternalProtocol(buildGrabbitUrl(payload));
    debugLog("Opened Grabbit protocol URL", { id: item.id });
  } catch (error) {
    debugLog("Failed to open Grabbit protocol URL", { id: item.id, error });
  }
}

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (!details.requestHeaders) {
      debugLog("Request had no headers to capture", { url: details.url });
      return undefined;
    }

    const headers: CapturedHeader[] = [];
    for (const header of details.requestHeaders) {
      if (header.value !== undefined) {
        headers.push({ name: header.name, value: header.value });
      }
    }

    recentRequests.set(details.url, {
      url: details.url,
      time: Date.now(),
      headers,
    });

    debugLog("Captured request headers", {
      url: details.url,
      headerNames: headers.map((header) => header.name),
    });

    return undefined;
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders", "extraHeaders"],
);

chrome.downloads.onCreated.addListener((item) => {
  void sendDownloadToGrabbit(item);
});
