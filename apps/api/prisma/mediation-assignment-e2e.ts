import { JwtService } from "@nestjs/jwt";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();
const apiUrl = "http://localhost:4000/api/v1";
const webUrl = process.env.WEB_URL ?? "http://localhost:3000";
const prefix = `mediation-e2e-${Date.now()}`;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function api(path: string, token: string, init: RequestInit = {}) {
  return fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      Cookie: `tws_session=${token}`,
      Origin: webUrl,
      ...init.headers,
    },
  });
}

async function json<T>(response: Response, expectedStatus: number) {
  const body = (await response.json().catch(() => null)) as T;
  assert(
    response.status === expectedStatus,
    `Expected ${expectedStatus}, received ${response.status}: ${JSON.stringify(body)}`,
  );
  return body;
}

async function main() {
  const startedAt = new Date();
  const jwt = new JwtService({
    secret:
      process.env.JWT_SECRET ?? "local-development-secret-change-me-please",
  });
  let listingId = "";
  let mediationId = "";
  let temporaryAdminId = "";
  let buyerId = "";
  let sellerId = "";

  try {
    const seededAdmin = await prisma.adminCredential.findFirst({
      where: { user: { role: "ADMIN", status: "ACTIVE" } },
      include: { user: true },
    });
    assert(seededAdmin, "Seed one active admin before mediation E2E");

    const category = await prisma.category.findFirst({
      where: { isActive: true },
    });
    assert(category, "Seed categories before mediation E2E");

    const [seller, buyer] = await Promise.all([
      prisma.user.create({
        data: {
          displayName: `${prefix} Seller`,
          email: `${prefix}-seller@example.com`,
          phoneNumber: "0912345678",
          facebookProfileUrl: "https://facebook.com/mediation-e2e-seller",
          profileCompletedAt: new Date(),
        },
      }),
      prisma.user.create({
        data: {
          displayName: `${prefix} Buyer`,
          email: `${prefix}-buyer@example.com`,
          phoneNumber: "0987654321",
          facebookProfileUrl: "https://facebook.com/mediation-e2e-buyer",
          profileCompletedAt: new Date(),
        },
      }),
    ]);
    sellerId = seller.id;
    buyerId = buyer.id;

    const temporaryAdmin = await prisma.user.create({
      data: {
        displayName: `${prefix} Admin 2`,
        email: `${prefix}-admin@example.com`,
        role: "ADMIN",
        adminCredential: {
          create: {
            email: `${prefix}-admin@example.com`,
            passwordHash: await hash("Temporary123", 4),
          },
        },
      },
      include: { adminCredential: true },
    });
    temporaryAdminId = temporaryAdmin.id;
    assert(temporaryAdmin.adminCredential, "Temporary admin needs credential");

    const listing = await prisma.listing.create({
      data: {
        sellerId: seller.id,
        categoryId: category.id,
        title: `${prefix} Listing`,
        slug: `${prefix}-listing`,
        description: "Temporary listing for mediation assignment regression.",
        condition: "USED",
        price: 100000,
        location: "Thành phố Hồ Chí Minh",
        deliveryMethod: "MEETUP",
        contactType: "PHONE",
        contactValue: seller.phoneNumber!,
        allowAdminMediation: true,
        totalQuantity: 1,
        publishedAt: new Date(),
      },
    });
    listingId = listing.id;

    const [buyerToken, seededAdminToken, temporaryAdminToken] =
      await Promise.all([
        jwt.signAsync({ sub: buyer.id, role: "USER" }),
        jwt.signAsync({
          sub: seededAdmin.userId,
          role: "ADMIN",
          adminCredentialVersion: seededAdmin.updatedAt.getTime(),
        }),
        jwt.signAsync({
          sub: temporaryAdmin.id,
          role: "ADMIN",
          adminCredentialVersion:
            temporaryAdmin.adminCredential.updatedAt.getTime(),
        }),
      ]);

    const created = await json<{
      request: { id: string };
      trade: { id: string; status: string };
    }>(
      await api(`/listings/${listing.id}/mediation-requests`, buyerToken, {
        method: "POST",
        body: JSON.stringify({ quantity: 1, buyerNote: prefix }),
      }),
      201,
    );
    mediationId = created.request.id;
    assert(
      created.trade.status === "ACTIVE",
      "Mediation trade should be active",
    );

    const adminAlerts = await prisma.notification.findMany({
      where: {
        userId: { in: [seededAdmin.userId, temporaryAdmin.id] },
        type: "MEDIATION_REQUESTED",
        message: { contains: listing.title },
        createdAt: { gte: startedAt },
      },
    });
    assert(
      new Set(adminAlerts.map(({ userId }) => userId)).size === 2,
      "Every active admin should receive the pending mediation notification",
    );

    for (const token of [seededAdminToken, temporaryAdminToken]) {
      const queue = await json<{
        items: Array<{ id: string }>;
      }>(
        await api(
          `/mediation-requests/admin?scope=PENDING&q=${encodeURIComponent(prefix)}&page=1&pageSize=10`,
          token,
        ),
        200,
      );
      assert(
        queue.items.some(({ id }) => id === mediationId),
        "Every admin should see the unassigned request",
      );
    }

    const claims = await Promise.all([
      api(`/mediation-requests/${mediationId}/assign`, seededAdminToken, {
        method: "POST",
      }),
      api(`/mediation-requests/${mediationId}/assign`, temporaryAdminToken, {
        method: "POST",
      }),
    ]);
    assert(
      claims.filter(({ status }) => status === 201).length === 1,
      "Exactly one admin should claim the request",
    );
    assert(
      claims.filter(({ status }) => status === 409).length === 1,
      "The competing admin should receive a conflict",
    );

    const assigned = await prisma.mediationRequest.findUniqueOrThrow({
      where: { id: mediationId },
    });
    assert(assigned.assignedAdminId, "Claim should assign an admin");
    const winnerIsSeeded = assigned.assignedAdminId === seededAdmin.userId;
    const winnerToken = winnerIsSeeded ? seededAdminToken : temporaryAdminToken;
    const loserToken = winnerIsSeeded ? temporaryAdminToken : seededAdminToken;

    const notifications = await prisma.notification.findMany({
      where: {
        userId: { in: [buyer.id, seller.id] },
        type: "MEDIATION_ASSIGNED",
        createdAt: { gte: startedAt },
      },
    });
    assert(notifications.length === 2, "Buyer and seller should be notified");
    assert(
      notifications.every(
        ({ targetUrl }) => targetUrl === `/users/${assigned.assignedAdminId}`,
      ),
      "Assignment notifications should link to the responsible admin",
    );

    const forbiddenCompletion = await api(
      `/trades/${created.trade.id}/admin-complete`,
      loserToken,
      { method: "POST" },
    );
    assert(
      forbiddenCompletion.status === 403,
      "A different admin must not complete the assigned trade",
    );
    await json(
      await api(`/trades/${created.trade.id}/admin-complete`, winnerToken, {
        method: "POST",
      }),
      201,
    );

    const completed = await prisma.mediationRequest.findUniqueOrThrow({
      where: { id: mediationId },
    });
    assert(completed.status === "COMPLETED", "Mediation should be completed");
    assert(
      completed.assignedAdminId === assigned.assignedAdminId,
      "Completion must preserve the responsible admin",
    );

    console.info(
      "Mediation E2E passed: all admins see pending work, one claims it atomically, notifications link to that admin, and only the owner can complete.",
    );
  } finally {
    if (mediationId) {
      await prisma.auditLog.deleteMany({
        where: { entityType: "MediationRequest", entityId: mediationId },
      });
      await prisma.mediationRequest.deleteMany({ where: { id: mediationId } });
    }
    await prisma.notification.deleteMany({
      where: {
        createdAt: { gte: startedAt },
        OR: [
          { title: { contains: prefix } },
          { message: { contains: prefix } },
        ],
      },
    });
    if (listingId)
      await prisma.listing.deleteMany({ where: { id: listingId } });
    const userIds = [temporaryAdminId, buyerId, sellerId].filter(Boolean);
    if (userIds.length)
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
