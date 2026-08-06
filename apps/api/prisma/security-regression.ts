import assert from "node:assert/strict";
import { requireJwtSecret } from "../src/auth/jwt-secret";
import { publicListingSelect } from "../src/listings/listings.service";
import { isAllowedSessionRequestOrigin } from "../src/security/request-origin";

const config = (value?: string) => ({
  get: <T>() => value as T | undefined,
});

assert.throws(
  () => requireJwtSecret(config()),
  /JWT_SECRET is required/,
  "API must reject a missing JWT secret",
);
assert.throws(
  () => requireJwtSecret(config("too-short")),
  /at least 32 characters/,
  "API must reject a short JWT secret",
);
assert.equal(
  requireJwtSecret(config("a-secure-test-secret-with-32-characters")),
  "a-secure-test-secret-with-32-characters",
  "API must accept a sufficiently long JWT secret",
);
assert.equal(
  "contactType" in publicListingSelect,
  false,
  "Public listing selection must not expose contactType",
);
assert.equal(
  "contactValue" in publicListingSelect,
  false,
  "Public listing selection must not expose contactValue",
);
assert.equal(
  isAllowedSessionRequestOrigin({
    method: "POST",
    hasSessionCookie: true,
    origin: "https://tws-web-production.up.railway.app",
    webUrl: "https://tws-web-production.up.railway.app",
  }),
  true,
  "Authenticated mutations from the configured web origin must be accepted",
);
assert.equal(
  isAllowedSessionRequestOrigin({
    method: "POST",
    hasSessionCookie: true,
    origin: "https://attacker.example",
    webUrl: "https://tws-web-production.up.railway.app",
  }),
  false,
  "Authenticated cross-origin mutations must be rejected",
);
assert.equal(
  isAllowedSessionRequestOrigin({
    method: "GET",
    hasSessionCookie: true,
    webUrl: "https://tws-web-production.up.railway.app",
  }),
  true,
  "Safe authenticated reads must remain available",
);

console.info(
  "Security regression passed: JWT fails closed, public listings omit contact details, and session mutations validate their origin.",
);
