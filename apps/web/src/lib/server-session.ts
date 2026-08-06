const defaultApiUrl = "http://localhost:4000/api/v1";

export function serverApiUrl() {
  const configured = (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    defaultApiUrl
  ).replace(/\/$/, "");
  return configured.endsWith("/api/v1") ? configured : `${configured}/api/v1`;
}

export async function hasValidSession(
  cookieHeader: string | null,
  request: typeof fetch = fetch,
) {
  if (!cookieHeader) return false;
  try {
    const response = await request(`${serverApiUrl()}/auth/me`, {
      cache: "no-store",
      headers: { cookie: cookieHeader },
    });
    return response.ok;
  } catch {
    return false;
  }
}
