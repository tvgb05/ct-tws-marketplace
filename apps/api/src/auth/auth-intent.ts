export const AUTH_INTENTS = ["login", "register"] as const;

export type AuthIntent = (typeof AUTH_INTENTS)[number];

export function authIntentFrom(value: unknown): AuthIntent {
  return value === "register" ? "register" : "login";
}
