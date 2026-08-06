import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apiUrl = "http://localhost:4000/api/v1";
const testPrefix = `Demo E2E ${Date.now()}`;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function api(path: string, cookie: string, init: RequestInit = {}) {
  return fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      Cookie: cookie,
      ...init.headers,
    },
  });
}

async function login(email: string, password: string) {
  const response = await fetch(`${apiUrl}/auth/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, remember: false }),
  });
  assert(response.status === 201, `Login failed for ${email}`);
  const setCookie = response.headers.get("set-cookie") ?? "";
  const session = setCookie.match(/tws_session=([^;]+)/)?.[1];
  assert(session, `Login did not return a session for ${email}`);
  const user = (await response.json()) as {
    id: string;
    role: "USER" | "ADMIN";
    displayName: string;
  };
  return { cookie: `tws_session=${session}`, user };
}

async function expectJson<T>(response: Response, expectedStatus: number) {
  const body = (await response.json().catch(() => null)) as T;
  assert(
    response.status === expectedStatus,
    `Expected ${expectedStatus}, received ${response.status}: ${JSON.stringify(body)}`,
  );
  return body;
}

async function main() {
  const startedAt = new Date();
  const sellerEmail = requiredEnv("SEED_DEMO_USER_1_EMAIL").toLowerCase();
  const sellerPassword = requiredEnv("SEED_DEMO_USER_1_PASSWORD");
  const buyerEmail = requiredEnv("SEED_DEMO_USER_2_EMAIL").toLowerCase();
  const buyerPassword = requiredEnv("SEED_DEMO_USER_2_PASSWORD");
  const adminEmail = requiredEnv("SEED_ADMIN_EMAIL").toLowerCase();
  const adminPassword = requiredEnv("SEED_ADMIN_PASSWORD");

  let sellerId = "";
  let buyerId = "";
  let reportId = "";
  const listingIds: string[] = [];

  try {
    const seededSeller = await prisma.user.findFirstOrThrow({
      where: { email: sellerEmail, role: "USER" },
    });
    await prisma.user.update({
      where: { id: seededSeller.id },
      data: {
        canPostListings: true,
        postingRestrictionReason: null,
        postingRestrictedAt: null,
      },
    });

    const [seller, buyer, admin] = await Promise.all([
      login(sellerEmail, sellerPassword),
      login(buyerEmail, buyerPassword),
      login(adminEmail, adminPassword),
    ]);
    assert(seller.user.role === "USER", "Demo seller must keep the USER role");
    assert(buyer.user.role === "USER", "Demo buyer must keep the USER role");
    assert(admin.user.role === "ADMIN", "Admin seed must have the ADMIN role");
    sellerId = seller.user.id;
    buyerId = buyer.user.id;

    const category = await prisma.category.findFirstOrThrow({
      where: { slug: "tech", isActive: true },
    });
    const listingPayload = {
      title: `${testPrefix} Seller Listing`,
      description:
        "Bài đăng tạm thời dùng để kiểm thử đầy đủ luồng hai tài khoản demo.",
      categoryId: category.id,
      subcategory: "charging-cables",
      condition: "USED",
      price: 125000,
      quantity: 1,
      location: "Thành phố Hồ Chí Minh",
      deliveryMethod: "MEETUP",
      allowAdminMediation: true,
      sellerPolicyAccepted: true,
      images: [
        {
          publicId: `demo-e2e/${Date.now()}`,
          secureUrl: "https://images.example.com/demo-e2e.png",
        },
      ],
    };

    const listing = await expectJson<{ id: string; sellerId: string }>(
      await api("/listings", seller.cookie, {
        method: "POST",
        body: JSON.stringify(listingPayload),
      }),
      201,
    );
    listingIds.push(listing.id);
    assert(listing.sellerId === sellerId, "Demo seller should own the listing");

    const contact = await expectJson<{
      trade: { id: string; status: string };
    }>(
      await api(`/listings/${listing.id}/contact`, buyer.cookie, {
        method: "POST",
        body: JSON.stringify({ quantity: 1 }),
      }),
      201,
    );
    assert(contact.trade.status === "ACTIVE", "Buyer trade should be active");

    await expectJson(
      await api(`/trades/${contact.trade.id}/complete`, seller.cookie, {
        method: "POST",
        body: JSON.stringify({}),
      }),
      201,
    );
    await expectJson(
      await api(`/trades/${contact.trade.id}/reviews`, buyer.cookie, {
        method: "POST",
        body: JSON.stringify({
          rating: 5,
          comment: `${testPrefix} buyer review`,
        }),
      }),
      201,
    );
    await expectJson(
      await api(`/trades/${contact.trade.id}/reviews`, seller.cookie, {
        method: "POST",
        body: JSON.stringify({
          rating: 5,
          comment: `${testPrefix} seller review`,
        }),
      }),
      201,
    );

    const report = await expectJson<{ id: string }>(
      await api(`/users/${sellerId}/reports`, buyer.cookie, {
        method: "POST",
        body: JSON.stringify({
          reason: "OTHER",
          description: `${testPrefix}: vi phạm điều khoản dùng cho kiểm thử.`,
        }),
      }),
      201,
    );
    reportId = report.id;

    await expectJson(
      await api(`/admin/user-reports/${report.id}/resolve`, admin.cookie, {
        method: "PATCH",
        body: JSON.stringify({
          decision: "RESTRICT_POSTING",
          resolution: `${testPrefix}: admin xác nhận vi phạm điều khoản.`,
        }),
      }),
      200,
    );

    const sellerAfterRestriction = await login(sellerEmail, sellerPassword);
    const me = await expectJson<{
      canPostListings: boolean;
      postingRestrictionReason: string | null;
    }>(await api("/auth/me", sellerAfterRestriction.cookie), 200);
    assert(!me.canPostListings, "Restricted user should still login");
    assert(
      me.postingRestrictionReason?.includes(testPrefix),
      "Restriction reason should be visible after login",
    );

    const notifications = await expectJson<
      Array<{ title: string; readAt: string | null }>
    >(await api("/notifications", sellerAfterRestriction.cookie), 200);
    assert(
      notifications.some(
        (notification) =>
          notification.title.includes("tạm khóa quyền đăng bài") &&
          notification.readAt === null,
      ),
      "Restricted user should receive an unread notification after login",
    );

    const blocked = await api("/listings", sellerAfterRestriction.cookie, {
      method: "POST",
      body: JSON.stringify({
        ...listingPayload,
        title: `${testPrefix} Blocked`,
      }),
    });
    assert(blocked.status === 403, "Restricted user must not create a listing");

    await expectJson(
      await api(`/admin/users/${sellerId}/posting-permission`, admin.cookie, {
        method: "PATCH",
        body: JSON.stringify({ allowed: true }),
      }),
      200,
    );

    const restoredListing = await expectJson<{ id: string }>(
      await api("/listings", sellerAfterRestriction.cookie, {
        method: "POST",
        body: JSON.stringify({
          ...listingPayload,
          title: `${testPrefix} Restored Permission`,
        }),
      }),
      201,
    );
    listingIds.push(restoredListing.id);

    const notificationsAfterRestore = await expectJson<
      Array<{ title: string }>
    >(await api("/notifications", sellerAfterRestriction.cookie), 200);
    assert(
      notificationsAfterRestore.some((notification) =>
        notification.title.includes("khôi phục quyền đăng bài"),
      ),
      "Restored user should receive a permission notification",
    );

    console.info(
      "Demo accounts E2E passed: login, listing, trade, mutual reviews, report, admin restriction, login notification, posting block, and permission restore.",
    );
  } finally {
    if (sellerId) {
      await prisma.user.update({
        where: { id: sellerId },
        data: {
          canPostListings: true,
          postingRestrictionReason: null,
          postingRestrictedAt: null,
        },
      });
    }
    if (listingIds.length) {
      await prisma.listing.deleteMany({ where: { id: { in: listingIds } } });
    }
    if (reportId) {
      await prisma.userReport.deleteMany({ where: { id: reportId } });
    }
    if (sellerId && buyerId) {
      await prisma.notification.deleteMany({
        where: {
          userId: { in: [sellerId, buyerId] },
          createdAt: { gte: startedAt },
          OR: [
            { title: { contains: "quyền đăng bài" } },
            { title: { contains: testPrefix } },
            { message: { contains: testPrefix } },
          ],
        },
      });
    }
    await prisma.auditLog.deleteMany({
      where: {
        createdAt: { gte: startedAt },
        OR: [
          ...(reportId ? [{ entityId: reportId }] : []),
          ...(sellerId ? [{ entityId: sellerId }] : []),
        ],
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
