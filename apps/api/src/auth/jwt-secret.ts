import type { ConfigService } from "@nestjs/config";

export const MIN_JWT_SECRET_LENGTH = 32;

export function requireJwtSecret(config: Pick<ConfigService, "get">) {
  const secret = config.get<string>("JWT_SECRET")?.trim();
  if (!secret || secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET is required and must contain at least ${MIN_JWT_SECRET_LENGTH} characters`,
    );
  }
  return secret;
}
