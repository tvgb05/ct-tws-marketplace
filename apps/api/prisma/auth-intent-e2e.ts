import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AuthService } from "../src/auth/auth.service";
import { PrismaService } from "../src/prisma/prisma.service";

const prisma = new PrismaService();
const auth = new AuthService(
  prisma,
  new JwtService({ secret: "auth-intent-regression-secret-32-chars" }),
);

async function main() {
  await prisma.$connect();
  const suffix = randomUUID();
  const email = `auth-intent-${suffix}@example.com`;
  const googleProviderId = `auth-intent-google-${suffix}`;
  let createdUserId: string | undefined;

  try {
    await assert.rejects(
      auth.loginWithGoogle(
        {
          providerUserId: googleProviderId,
          displayName: "Thành viên thử nghiệm",
          email,
        },
        false,
        "login",
      ),
      NotFoundException,
      "Đăng nhập không được tự tạo tài khoản mới",
    );

    const afterFailedLogin = await prisma.user.findFirst({ where: { email } });
    assert.equal(afterFailedLogin, null);

    const registered = await auth.loginWithGoogle(
      {
        providerUserId: googleProviderId,
        displayName: "Thành viên thử nghiệm",
        email,
      },
      false,
      "register",
    );
    createdUserId = registered.user.id;
    assert.equal(registered.user.role, "USER");

    await assert.rejects(
      auth.loginWithGoogle(
        {
          providerUserId: googleProviderId,
          displayName: "Thành viên thử nghiệm",
          email,
        },
        false,
        "register",
      ),
      ConflictException,
      "Đăng ký không được ghi đè tài khoản đã tồn tại",
    );

    const loggedIn = await auth.loginWithGoogle(
      {
        providerUserId: googleProviderId,
        displayName: "Thành viên thử nghiệm",
        email,
      },
      false,
      "login",
    );
    assert.equal(loggedIn.user.id, registered.user.id);

    console.info(
      "Auth intent E2E passed: login and registration no longer create or overwrite accounts implicitly.",
    );
  } finally {
    if (createdUserId) {
      await prisma.user.deleteMany({ where: { id: createdUserId } });
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
