import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Request } from "express";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../prisma/prisma.service";
import { requireJwtSecret } from "./jwt-secret";

const cookieExtractor = (request: Request) =>
  request?.cookies?.tws_session ?? null;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
      ignoreExpiration: false,
      secretOrKey: requireJwtSecret(config),
    });
  }

  async validate(payload: {
    sub: string;
    sessionVersion?: number;
    adminCredentialVersion?: number;
  }) {
    const record = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { adminCredential: true },
    });
    if (!record || record.status !== "ACTIVE")
      throw new UnauthorizedException();
    if ((payload.sessionVersion ?? 0) !== record.sessionVersion)
      throw new UnauthorizedException();
    if (
      record.role === "ADMIN" &&
      (!record.adminCredential ||
        payload.adminCredentialVersion !==
          record.adminCredential.updatedAt.getTime())
    )
      throw new UnauthorizedException();

    const { adminCredential: _adminCredential, ...user } = record;
    void _adminCredential;
    return user;
  }
}
