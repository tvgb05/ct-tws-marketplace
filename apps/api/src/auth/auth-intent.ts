export const AUTH_INTENTS = ["login", "register"] as const;
export const EMAIL_OTP_INTENTS = ["register", "reset-password"] as const;

export type AuthIntent = (typeof AUTH_INTENTS)[number];
export type EmailOtpIntent = (typeof EMAIL_OTP_INTENTS)[number];

export function authIntentFrom(value: unknown): AuthIntent {
  return value === "register" ? "register" : "login";
}
