const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

interface SessionRequestOriginInput {
  method: string;
  hasSessionCookie: boolean;
  origin?: string;
  webUrl: string;
}

export function isAllowedSessionRequestOrigin({
  method,
  hasSessionCookie,
  origin,
  webUrl,
}: SessionRequestOriginInput) {
  if (safeMethods.has(method.toUpperCase()) || !hasSessionCookie) return true;

  try {
    return origin === new URL(webUrl).origin;
  } catch {
    return false;
  }
}
