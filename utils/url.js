const PAIR_SEPARATOR = "||";

export function normalizeUrlForKey(raw) {
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const protocol = url.protocol.toLowerCase();
    const hostname = url.hostname.toLowerCase();
    let pathname = url.pathname || "/";
    if (pathname !== "/") {
      pathname = pathname.replace(/\/+$/, "");
      if (!pathname.startsWith("/")) pathname = `/${pathname}`;
    }
    const search = url.search || "";
    return `${protocol}//${hostname}${pathname}${search}`.toLowerCase();
  } catch {
    return String(raw).trim().toLowerCase();
  }
}

export function makePairKey(urlA, urlB) {
  const a = normalizeUrlForKey(urlA);
  const b = normalizeUrlForKey(urlB);
  if (!a || !b) return "";
  return [a, b].sort().join(PAIR_SEPARATOR);
}

export function isLocalNetworkUrl(raw) {
  if (!raw) return true;
  try {
    const url = new URL(raw);
    const protocol = url.protocol.toLowerCase();
    if (protocol !== "http:" && protocol !== "https:") return true;

    const host = url.hostname.toLowerCase();
    if (!host) return true;

    if (host === "localhost" || host.endsWith(".localhost")) return true;

    if (/^(?:127\.|0\.0\.0\.0)/.test(host)) return true;
    if (/^10\./.test(host)) return true;
    if (/^169\.254\./.test(host)) return true;
    if (/^192\.168\./.test(host)) return true;
    if (/^172\.(?:1[6-9]|2\d|3[0-1])\./.test(host)) return true;

    if (host.includes(":")) {
      const unbracketed = host.replace(/^\[|\]$/g, "");
      if (unbracketed === "::1") return true;
      if (/^(?:fc|fd)/i.test(unbracketed)) return true;
      if (/^fe80:/i.test(unbracketed)) return true;
    }

    if (!host.includes(".")) return true;

    return false;
  } catch {
    return true;
  }
}

export function isBrowserInternalUrl(raw) {
  if (!raw) return true;
  const value = String(raw).trim();
  if (!value) return true;
  if (/^(?:chrome|edge|about|chrome-extension|moz-extension):/i.test(value)) {
    return true;
  }
  try {
    const url = new URL(value);
    const protocol = url.protocol.toLowerCase();
    return (
      protocol === "chrome:" ||
      protocol === "edge:" ||
      protocol === "about:" ||
      protocol === "chrome-extension:" ||
      protocol === "moz-extension:"
    );
  } catch {
    return true;
  }
}
