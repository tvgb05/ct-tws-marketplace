import { randomUUID } from "node:crypto";
import { JwtService } from "@nestjs/jwt";
import { AuthProvider } from "@prisma/client";
import { AuthService } from "../src/auth/auth.service";
import { PrismaService } from "../src/prisma/prisma.service";

const prisma = new PrismaService();
const auth = new AuthService(
  prisma,
  new JwtService({ secret: "google-role-regression-secret-32-chars" }),
);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function main() {
  await prisma.$connect();

  const adminEmail = requiredEnv("SEED_ADMIN_EMAIL").toLowerCase();
  const adminCredential = await prisma.adminCredential.findFirst({
    where: {
      email: { equals: adminEmail, mode: "insensitive" },
      user: { role: "ADMIN" },
    },
    include: { user: true },
  });
  assert(adminCredential, `No seeded ADMIN credential found for ${adminEmail}`);

  const suffix = randomUUID();
  const adminProviderId = `google-admin-e2e-${suffix}`;
  const memberProviderId = `google-member-e2e-${suffix}`;
  let collisionUserId: string | undefined;
  let memberUserId: string | undefined;
  const originalAdmin = {
    displayName: adminCredential.user.displayName,
    avatarUrl: adminCredential.user.avatarUrl,
    email: adminCredential.user.email,
    lastLoginAt: adminCredential.user.lastLoginAt,
  };

  try {
    const collisionUser = await prisma.user.create({
      data: {
        displayName: "Temporary duplicate",
        email: adminEmail,
        authIdentities: {
          create: {
            provider: AuthProvider.GOOGLE,
            providerUserId: adminProviderId,
          },
        },
      },
    });
    collisionUserId = collisionUser.id;

    const adminLogin = await auth.loginWithGoogle({
      providerUserId: adminProviderId,
      displayName: "Google Admin",
      avatarUrl: "https://example.com/admin-avatar.png",
      email: adminEmail.toUpperCase(),
    });
    assert(adminLogin.user.id === adminCredential.userId, "Wrong admin user");
    assert(adminLogin.user.role === "ADMIN", "Admin email was not elevated");

    const adminPayload = new JwtService().decode(adminLogin.token) as {
      sub?: string;
      role?: string;
      adminCredentialVersion?: number;
    };
    assert(adminPayload.sub === adminCredential.userId, "Wrong JWT subject");
    assert(adminPayload.role === "ADMIN", "JWT is missing ADMIN role");
    assert(
      adminPayload.adminCredentialVersion ===
        adminCredential.updatedAt.getTime(),
      "JWT is missing current admin credential version",
    );

    const movedIdentity = await prisma.authIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: AuthProvider.GOOGLE,
          providerUserId: adminProviderId,
        },
      },
    });
    assert(
      movedIdentity?.userId === adminCredential.userId,
      "Existing Google identity was not reassigned to seeded admin",
    );

    const memberEmail = `google-member-${suffix}@example.com`;
    const member = await prisma.user.create({
      data: {
        displayName: "Temporary member",
        email: memberEmail,
        role: "USER",
        adminCredential: {
          create: {
            email: memberEmail,
            passwordHash: "test-only-not-used-for-login",
          },
        },
      },
    });
    memberUserId = member.id;

    const memberLogin = await auth.loginWithGoogle({
      providerUserId: memberProviderId,
      displayName: "Google Member",
      email: memberEmail,
    });
    assert(memberLogin.user.id === member.id, "Wrong member user");
    assert(
      memberLogin.user.role === "USER",
      "A USER credential was incorrectly elevated to ADMIN",
    );

    console.info(
      "Google role E2E passed: seeded admin email maps to ADMIN; other Google emails remain USER.",
    );
  } finally {
    await prisma.authIdentity.deleteMany({
      where: {
        provider: AuthProvider.GOOGLE,
        providerUserId: { in: [adminProviderId, memberProviderId] },
      },
    });
    if (collisionUserId) {
      await prisma.user.deleteMany({ where: { id: collisionUserId } });
    }
    if (memberUserId) {
      await prisma.user.deleteMany({ where: { id: memberUserId } });
    }
    await prisma.user.update({
      where: { id: adminCredential.userId },
      data: originalAdmin,
    });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
