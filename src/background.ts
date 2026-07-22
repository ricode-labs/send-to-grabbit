type GrabbitPayload = {
  url: string;
  header: string[];
};

type CapturedHeader = {
  name: string;
  value: string;
};

type CapturedRequest = {
  time: number;
  headers: CapturedHeader[];
};

const requestTtlMs = 2 * 60 * 1000;
const pruneIntervalMs = 30 * 1000;
const recentRequests = new Map<string, CapturedRequest>();
const debugPrefix = "[Send to Grabbit]";
const excludedHeaders = new Set([
  "host",
  "connection",
  "content-length",
  "content-type",
  "range",
  "accept-encoding",
  "upgrade-insecure-requests",
]);

function debugLog(message: string, data?: unknown) {
  if (data === undefined) {
    console.debug(debugPrefix, message);
    return;
  }

  console.debug(debugPrefix, message, data);
}

function pruneCapturedRequests() {
  const expiredBefore = Date.now() - requestTtlMs;
  for (const [key, request] of recentRequests) {
    if (request.time < expiredBefore) {
      recentRequests.delete(key);
    }
  }
}

setInterval(pruneCapturedRequests, pruneIntervalMs);

async function getCookieHeader(url: string) {
  const cookies = await chrome.cookies.getAll({ url });
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

function buildGrabbitUrl(payload: GrabbitPayload) {
  const params = new URLSearchParams({ payload: JSON.stringify(payload) });
  const grabbitUrl = `grabbit://addUri?${params.toString()}`;
  debugLog("Built Grabbit URL", { grabbitUrl });
  return grabbitUrl;
}

function isSupportedDownloadUrl(url: string) {
  return /^(https?):\/\//i.test(url);
}

async function openExternalProtocol(url: string) {
  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (activeTab?.id !== undefined) {
    await chrome.tabs.update(activeTab.id, { url });
  } else {
    await chrome.tabs.create({ active: true, url });
  }
}

function shouldForwardHeader(name: string) {
  const normalizedName = name.toLowerCase();
  return (
    !excludedHeaders.has(normalizedName) &&
    !normalizedName.startsWith("sec-") &&
    !normalizedName.startsWith("proxy-")
  );
}

function hasHeader(headers: CapturedHeader[], name: string) {
  return headers.some((header) => header.name.toLowerCase() === name);
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

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (!details.requestHeaders) {
      return;
    }

    const headers: CapturedHeader[] = [];
    for (const header of details.requestHeaders) {
      if (header.value !== undefined) {
        headers.push({ name: header.name, value: header.value });
      }
    }

    recentRequests.set(details.url, {
      time: Date.now(),
      headers,
    });
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders", "extraHeaders"],
);

chrome.downloads.onCreated.addListener(async (item) => {
  if (!isSupportedDownloadUrl(item.url)) {
    return;
  }

  const capturedRequest = recentRequests.get(item.url);
  const headers = capturedRequest?.headers ?? [];
  const header = await buildForwardedHeaders(item, headers);
  const payload: GrabbitPayload = {
    url: item.url,
    header,
  };
  await chrome.downloads.cancel(item.id);
  await openExternalProtocol(buildGrabbitUrl(payload));
    debugLog("Opened Grabbit protocol URL", { payload });
});
