import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apiUrl = "http://localhost:4000/api/v1";
const testTitle = `Forum E2E ${Date.now()}`;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function login(email: string, password: string) {
  const response = await fetch(`${apiUrl}/auth/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, remember: false }),
  });
  assert(response.status === 201, `Login failed for ${email}`);
  const session = (response.headers.get("set-cookie") ?? "").match(
    /tws_session=([^;]+)/,
  )?.[1];
  assert(session, "Login did not return a session cookie");
  return `tws_session=${session}`;
}

async function api(path: string, cookie: string, init: RequestInit = {}) {
  return fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      Origin: "http://localhost:3000",
      Cookie: cookie,
      ...init.headers,
    },
  });
}

async function json<T>(response: Response, status = 200) {
  const body = (await response.json().catch(() => null)) as T;
  assert(
    response.status === status,
    `Expected ${status}, received ${response.status}: ${JSON.stringify(body)}`,
  );
  return body;
}

async function main() {
  const adminCookie = await login(
    requiredEnv("SEED_ADMIN_EMAIL").toLowerCase(),
    requiredEnv("SEED_ADMIN_PASSWORD"),
  );
  const memberCookie = await login(
    requiredEnv("SEED_DEMO_USER_1_EMAIL").toLowerCase(),
    requiredEnv("SEED_DEMO_USER_1_PASSWORD"),
  );
  let postId = "";

  try {
    const activeMembers = await prisma.user.count({
      where: { role: "USER", status: "ACTIVE" },
    });
    const post = await json<{ id: string; notifiedUsers: number }>(
      await api("/forum/posts", adminCookie, {
        method: "POST",
        body: JSON.stringify({
          title: testTitle,
          content:
            "Nội dung tạm thời để kiểm thử forum và thông báo toàn hệ thống.",
        }),
      }),
      201,
    );
    postId = post.id;
    assert(
      post.notifiedUsers === activeMembers,
      "Forum post should notify every active member",
    );

    const posts = await json<{
      items: Array<{ id: string }>;
      page: number;
      pageSize: number;
      totalPages: number;
    }>(
      await api(
        `/forum/posts?q=${encodeURIComponent(testTitle)}&sort=NEWEST&page=1&pageSize=5`,
        memberCookie,
      ),
    );
    assert(
      posts.items.some(({ id }) => id === postId),
      "Member should find the forum post through paginated search",
    );
    assert(posts.page === 1, "Forum should return the requested page");
    assert(posts.pageSize === 5, "Forum should return the requested page size");
    assert(posts.totalPages >= 1, "Forum should return pagination metadata");

    const notifications = await json<
      Array<{ type: string; targetUrl: string | null; readAt: string | null }>
    >(await api("/notifications", memberCookie));
    assert(
      notifications.some(
        (item) =>
          item.type === "FORUM_POSTED" &&
          item.targetUrl === `/community-guidelines#forum-${postId}` &&
          item.readAt === null,
      ),
      "Member should receive an unread forum notification",
    );

    for (const path of [
      "/admin/users?scope=RECENT&page=1&pageSize=5",
      "/admin/users?scope=RESTRICTED&page=1&pageSize=5",
      "/admin/user-reports?status=ALL&page=1&pageSize=5",
      "/admin/listing-reports?status=ALL&page=1&pageSize=5",
    ]) {
      const result = await json<{ items: unknown[]; totalPages: number }>(
        await api(path, adminCookie),
      );
      assert(Array.isArray(result.items), `${path} should return items`);
      assert(result.totalPages >= 1, `${path} should return pagination`);
    }

    console.info(
      "Forum/admin E2E passed: global notification and paginated admin queues work.",
    );
  } finally {
    if (postId) {
      await prisma.$transaction([
        prisma.notification.deleteMany({
          where: { targetUrl: `/community-guidelines#forum-${postId}` },
        }),
        prisma.auditLog.deleteMany({
          where: { entityType: "ForumPost", entityId: postId },
        }),
        prisma.forumPost.deleteMany({ where: { id: postId } }),
      ]);
    }
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
