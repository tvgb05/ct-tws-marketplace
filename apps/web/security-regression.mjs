import assert from "node:assert/strict";
import { hasValidSession, serverApiUrl } from "./src/lib/server-session.ts";

const originalApiUrl = process.env.API_URL;
const originalPublicApiUrl = process.env.NEXT_PUBLIC_API_URL;

process.env.API_URL = "http://api.internal:4000";
assert.equal(
  serverApiUrl(),
  "http://api.internal:4000/api/v1",
  "Server API URL must add the API prefix",
);

let requestCount = 0;
assert.equal(
  await hasValidSession(null, async () => {
    requestCount += 1;
    return new Response(null, { status: 200 });
  }),
  false,
  "A missing cookie must be rejected without contacting the API",
);
assert.equal(requestCount, 0);

let forwardedCookie = "";
assert.equal(
  await hasValidSession("tws_session=valid", async (_url, init) => {
    forwardedCookie = new Headers(init?.headers).get("cookie") ?? "";
    return new Response(null, { status: 200 });
  }),
  true,
  "A session accepted by the API must pass the web gate",
);
assert.equal(forwardedCookie, "tws_session=valid");

assert.equal(
  await hasValidSession(
    "tws_session=fake",
    async () => new Response(null, { status: 401 }),
  ),
  false,
  "A forged cookie rejected by the API must not pass the web gate",
);
assert.equal(
  await hasValidSession("tws_session=unknown", async () => {
    throw new Error("API unavailable");
  }),
  false,
  "The web gate must fail closed when the API is unavailable",
);

if (originalApiUrl === undefined) delete process.env.API_URL;
else process.env.API_URL = originalApiUrl;
if (originalPublicApiUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
else process.env.NEXT_PUBLIC_API_URL = originalPublicApiUrl;

console.info(
  "Security regression passed: the web gate validates sessions and fails closed.",
);
