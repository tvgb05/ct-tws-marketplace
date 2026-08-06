import assert from "node:assert/strict";
import { requireJwtSecret } from "../src/auth/jwt-secret";
import { publicListingSelect } from "../src/listings/listings.service";

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

console.info(
  "Security regression passed: JWT fails closed and public listings omit contact details.",
);
