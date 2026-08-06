import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { compare, hash } from "bcryptjs";
import { randomInt } from "node:crypto";
import nodemailer from "nodemailer";
import { PrismaService } from "../prisma/prisma.service";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

@Injectable()
export class EmailOtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  isAvailable() {
    if (this.developmentEchoEnabled()) return true;
    const host = this.config.get<string>("SMTP_HOST");
    const user = this.config.get<string>("SMTP_USER");
    const password = this.config.get<string>("SMTP_PASSWORD");
    const from = this.config.get<string>("MAIL_FROM");
    return Boolean(host && from && Boolean(user) === Boolean(password));
  }

  async requestCode(email: string) {
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
      data: { email: normalizedEmail, codeHash, expiresAt },
    });

    const developmentEcho = this.developmentEchoEnabled();
    if (!developmentEcho) {
      try {
        await this.sendCode(normalizedEmail, code);
      } catch {
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
    if (!record || record.attempts >= MAX_ATTEMPTS)
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
    return normalizedEmail;
  }

  private async sendCode(email: string, code: string) {
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
      subject: `${code} là mã đăng nhập TWS Community Market`,
      text: `Mã đăng nhập của bạn là ${code}. Mã có hiệu lực trong 10 phút. Nếu bạn không yêu cầu mã này, hãy bỏ qua email.`,
      html: `<p>Mã đăng nhập TWS Community Market của bạn là:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>Mã có hiệu lực trong 10 phút. Nếu bạn không yêu cầu mã này, hãy bỏ qua email.</p>`,
    });
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
