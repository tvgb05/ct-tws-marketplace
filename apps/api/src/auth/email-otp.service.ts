import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { compare, hash } from "bcryptjs";
import { randomInt } from "node:crypto";
import nodemailer from "nodemailer";
import { Resend } from "resend";
import { PrismaService } from "../prisma/prisma.service";
import type { EmailOtpIntent } from "./auth-intent";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

@Injectable()
export class EmailOtpService {
  private readonly logger = new Logger(EmailOtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  isAvailable() {
    if (this.developmentEchoEnabled()) return true;
    if (this.config.get<string>("RESEND_API_KEY")) return true;
    const host = this.config.get<string>("SMTP_HOST");
    const user = this.config.get<string>("SMTP_USER");
    const password = this.config.get<string>("SMTP_PASSWORD");
    const from = this.config.get<string>("MAIL_FROM");
    return Boolean(host && from && Boolean(user) === Boolean(password));
  }

  async requestCode(email: string, intent: EmailOtpIntent) {
    if (!this.isAvailable())
      throw new ServiceUnavailableException(
        "Dịch vụ gửi email chưa được cấu hình.",
      );
    const normalizedEmail = email.trim().toLowerCase();
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const codeHash = await hash(code, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await this.prisma.emailLoginCode.updateMany({
      where: { email: normalizedEmail, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    const record = await this.prisma.emailLoginCode.create({
      data: {
        email: normalizedEmail,
        codeHash,
        expiresAt,
        intent,
      },
    });

    const developmentEcho = this.developmentEchoEnabled();
    if (!developmentEcho) {
      try {
        await this.sendCode(normalizedEmail, code, record.id, intent);
      } catch (error) {
        this.logger.error(
          "Không thể gửi OTP qua nhà cung cấp email",
          error instanceof Error ? error.stack : undefined,
        );
        await this.prisma.emailLoginCode.delete({ where: { id: record.id } });
        throw new ServiceUnavailableException(
          "Dịch vụ gửi email chưa sẵn sàng. Vui lòng thử lại sau.",
        );
      }
    }

    return {
      success: true,
      expiresInSeconds: OTP_TTL_MS / 1000,
      ...(developmentEcho ? { devCode: code } : {}),
    };
  }

  async verifyCode(email: string, code: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const record = await this.prisma.emailLoginCode.findFirst({
      where: {
        email: normalizedEmail,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    if (
      !record ||
      !new Set(["register", "reset-password"]).has(record.intent) ||
      record.attempts >= MAX_ATTEMPTS
    )
      throw new UnauthorizedException("Mã OTP không hợp lệ hoặc đã hết hạn");

    const valid = await compare(code, record.codeHash);
    if (!valid) {
      await this.prisma.emailLoginCode.update({
        where: { id: record.id },
        data: {
          attempts: { increment: 1 },
          ...(record.attempts + 1 >= MAX_ATTEMPTS
            ? { consumedAt: new Date() }
            : {}),
        },
      });
      throw new UnauthorizedException("Mã OTP không hợp lệ hoặc đã hết hạn");
    }

    const consumed = await this.prisma.emailLoginCode.updateMany({
      where: {
        email: normalizedEmail,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { consumedAt: new Date() },
    });
    if (consumed.count < 1)
      throw new UnauthorizedException("Mã OTP không hợp lệ hoặc đã hết hạn");
    return {
      email: normalizedEmail,
      intent:
        record.intent === "reset-password"
          ? ("reset-password" as const)
          : ("register" as const),
    };
  }

  private async sendCode(
    email: string,
    code: string,
    requestId: string,
    intent: EmailOtpIntent,
  ) {
    const resendApiKey = this.config.get<string>("RESEND_API_KEY");
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      const from = this.config.get(
        "RESEND_FROM",
        "taskflow-planner <login@taskflow-planner.site>",
      );
      const { error } = await resend.emails.send(
        {
          from,
          to: [email],
          subject: this.emailSubject(code, intent),
          text: this.emailText(code, intent),
          html: this.emailHtml(code, intent),
        },
        { idempotencyKey: `otp-${requestId}` },
      );
      if (error) throw new Error(error.message);
      return;
    }

    const host = this.config.get<string>("SMTP_HOST");
    const port = Number(this.config.get("SMTP_PORT", "587"));
    const user = this.config.get<string>("SMTP_USER");
    const password = this.config.get<string>("SMTP_PASSWORD");
    const from = this.config.get<string>("MAIL_FROM");
    if (
      !host ||
      !Number.isInteger(port) ||
      !from ||
      Boolean(user) !== Boolean(password)
    )
      throw new Error("SMTP configuration is incomplete");

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure:
        this.config.get("SMTP_SECURE", port === 465 ? "true" : "false") ===
        "true",
      ...(user && password ? { auth: { user, pass: password } } : {}),
    });
    await transporter.sendMail({
      from,
      to: email,
      subject: this.emailSubject(code, intent),
      text: this.emailText(code, intent),
      html: this.emailHtml(code, intent),
    });
  }

  private emailSubject(code: string, intent: EmailOtpIntent) {
    return intent === "register"
      ? `${code} là mã xác minh đăng ký taskflow-planner`
      : `${code} là mã đặt lại mật khẩu taskflow-planner`;
  }

  private emailText(code: string, intent: EmailOtpIntent) {
    const action =
      intent === "register" ? "xác minh đăng ký" : "đặt lại mật khẩu";
    return [
      `Bạn đang ${action} TWS Community Market qua hệ thống taskflow-planner.`,
      `Mã OTP của bạn là: ${code}`,
      "Mã có hiệu lực trong 10 phút và chỉ dùng một lần.",
      "Nếu chưa thấy email, hãy kiểm tra cả thư mục Spam hoặc Thư rác và tìm người gửi taskflow-planner.",
      "Nếu bạn không yêu cầu mã này, hãy bỏ qua email.",
    ].join("\n\n");
  }

  private emailHtml(code: string, intent: EmailOtpIntent) {
    const heading =
      intent === "register" ? "Xác minh đăng ký" : "Đặt lại mật khẩu";
    return `<div style="max-width:520px;margin:0 auto;padding:28px;font-family:Arial,sans-serif;color:#17231f"><p style="margin:0 0 8px;color:#6d7c76;font-size:13px">taskflow-planner</p><h1 style="margin:0 0 20px;font-size:22px">${heading} TWS Community Market</h1><p>Mã OTP của bạn là:</p><p style="margin:18px 0;padding:16px;background:#f2f5ef;border-radius:8px;text-align:center;font-size:30px;font-weight:700;letter-spacing:7px">${code}</p><p>Mã có hiệu lực trong <strong>10 phút</strong> và chỉ dùng một lần.</p><p style="padding:12px;background:#fff7e6;border-radius:6px;font-size:13px">Nếu chưa thấy email, hãy kiểm tra cả <strong>Spam/Thư rác</strong> và tìm người gửi <strong>taskflow-planner</strong>.</p><p style="color:#6d7c76;font-size:12px">Nếu bạn không yêu cầu mã này, hãy bỏ qua email. Email được gửi bởi taskflow-planner.site cho TWS Community Market.</p></div>`;
  }

  private developmentEchoEnabled() {
    const webUrl = this.config.get("WEB_URL", "");
    return (
      this.config.get("NODE_ENV") !== "production" &&
      this.config.get("EMAIL_OTP_DEV_ECHO", "false") === "true" &&
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(webUrl)
    );
  }
}
