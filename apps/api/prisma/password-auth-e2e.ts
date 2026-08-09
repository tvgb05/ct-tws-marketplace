import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AuthProvider } from "@prisma/client";
import { AuthService } from "../src/auth/auth.service";
import { PrismaService } from "../src/prisma/prisma.service";

const prisma = new PrismaService();
const jwt = new JwtService({
  secret: "password-auth-regression-secret-32-chars",
});
const auth = new AuthService(prisma, jwt);

async function main() {
  await prisma.$connect();
  const suffix = randomUUID();
  const email = `password-auth-${suffix}@example.com`;
  const firstPassword = "InitialPassword123";
  const nextPassword = "UpdatedPassword456";
  let userId: string | undefined;

  try {
    const registered = await auth.registerWithEmail(
      email,
      "Thành viên mật khẩu",
      firstPassword,
      false,
    );
    userId = registered.user.id;
    const credential = await prisma.authIdentity.findUniqueOrThrow({
      where: {
        provider_providerUserId: {
          provider: AuthProvider.EMAIL,
          providerUserId: email,
        },
      },
    });
    assert(credential.passwordHash);
    assert.notEqual(credential.passwordHash, firstPassword);

    const loggedIn = await auth.loginWithEmailPassword(
      email,
      firstPassword,
      false,
    );
    assert.equal(loggedIn.user.id, registered.user.id);

    await assert.rejects(
      auth.loginWithEmailPassword(email, "WrongPassword999", false),
      UnauthorizedException,
    );
    await assert.rejects(
      auth.registerWithEmail(email, "Tên bị trùng", firstPassword, false),
      ConflictException,
    );

    const sessionBeforeReset = jwt.decode(loggedIn.token) as {
      sessionVersion?: number;
    };
    await auth.resetEmailPassword(email, nextPassword);
    const updatedUser = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    assert.equal(
      updatedUser.sessionVersion,
      (sessionBeforeReset.sessionVersion ?? 0) + 1,
    );
    await assert.rejects(
      auth.loginWithEmailPassword(email, firstPassword, false),
      UnauthorizedException,
    );
    const loggedInAfterReset = await auth.loginWithEmailPassword(
      email,
      nextPassword,
      false,
    );
    assert.equal(loggedInAfterReset.user.id, userId);

    console.info(
      "Password auth E2E passed: registration hashes passwords, login validates them, and reset invalidates old credentials and sessions.",
    );
  } finally {
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
