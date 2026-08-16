import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { buildListingSearchText } from "../src/listings/listing-search";

const prisma = new PrismaClient();

async function seedAdmin() {
  const displayName = process.env.SEED_ADMIN_NAME?.trim();
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const configuredValues = [displayName, email, password].filter(Boolean);

  if (configuredValues.length === 0) {
    console.info("Skipped admin seed: SEED_ADMIN_* is not configured");
    return;
  }
  if (!displayName || !email || !password)
    throw new Error(
      "SEED_ADMIN_NAME, SEED_ADMIN_EMAIL và SEED_ADMIN_PASSWORD phải được cấu hình đầy đủ.",
    );
  if (!/^\S+@\S+\.\S+$/.test(email))
    throw new Error("SEED_ADMIN_EMAIL không hợp lệ.");
  if (password.length < 8)
    throw new Error("SEED_ADMIN_PASSWORD cần có ít nhất 8 ký tự.");

  const existing = await prisma.adminCredential.findUnique({
    where: { email },
  });
  if (existing) {
    console.info(`Admin account already exists: ${email}`);
    return;
  }

  const passwordHash = await hash(password, 12);
  await prisma.user.create({
    data: {
      displayName,
      email,
      role: "ADMIN",
      adminCredential: { create: { email, passwordHash } },
    },
  });
  console.info(`Seeded admin account: ${email}`);
}

async function seedDemoUser(slot: number) {
  const prefix = `SEED_DEMO_USER_${slot}`;
  const displayName = process.env[`${prefix}_NAME`]?.trim();
  const email = process.env[`${prefix}_EMAIL`]?.trim().toLowerCase();
  const password = process.env[`${prefix}_PASSWORD`];
  const configuredValues = [displayName, email, password].filter(Boolean);

  if (configuredValues.length === 0) return;
  if (!displayName || !email || !password)
    throw new Error(
      `${prefix}_NAME, ${prefix}_EMAIL và ${prefix}_PASSWORD phải được cấu hình đầy đủ.`,
    );
  if (!/^\S+@\S+\.\S+$/.test(email))
    throw new Error(`${prefix}_EMAIL không hợp lệ.`);
  if (password.length < 8)
    throw new Error(`${prefix}_PASSWORD cần có ít nhất 8 ký tự.`);

  const existingCredential = await prisma.adminCredential.findUnique({
    where: { email },
    include: { user: true },
  });
  if (existingCredential) {
    if (existingCredential.user.role !== "USER")
      throw new Error(`Không thể dùng tài khoản admin ${email} làm user demo.`);
    console.info(`Demo user already exists: ${email}`);
    return;
  }

  const passwordHash = await hash(password, 12);
  const existingUser = await prisma.user.findFirst({ where: { email } });
  if (existingUser?.role === "ADMIN")
    throw new Error(`Không thể dùng tài khoản admin ${email} làm user demo.`);

  if (existingUser) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        displayName,
        role: "USER",
        adminCredential: { create: { email, passwordHash } },
      },
    });
  } else {
    await prisma.user.create({
      data: {
        displayName,
        email,
        role: "USER",
        // Clearly synthetic contact data keeps demo accounts usable without
        // presenting it as a verified real-world identity.
        phoneNumber: "0000000000",
        facebookProfileUrl: "https://www.facebook.com/profile.php?id=0",
        profileCompletedAt: new Date(),
        adminCredential: { create: { email, passwordHash } },
      },
    });
  }
  console.info(`Seeded demo user: ${email}`);
}

async function seedDemoUsers() {
  await seedDemoUser(1);
  await seedDemoUser(2);
}

const shortCode = (length: number) =>
  randomUUID().replace(/-/g, "").slice(0, length).toUpperCase();

async function backfillPublicListingCodes() {
  const listings = await prisma.listing.findMany({
    orderBy: { createdAt: "asc" },
  });
  const orderCodeByGroup = new Map<string, string>();
  const usedOrderCodes = new Set<string>();
  for (const listing of listings) {
    if (!listing.orderCode || !/^D-\d{6}$/.test(listing.orderCode)) continue;
    const groupKey = listing.sharedPhotoGroupId ?? listing.id;
    if (!orderCodeByGroup.has(groupKey))
      orderCodeByGroup.set(groupKey, listing.orderCode);
    usedOrderCodes.add(listing.orderCode);
  }
  const nextOrderCode = () => {
    for (;;) {
      const number = (
        parseInt(randomUUID().replace(/-/g, "").slice(0, 10), 16) % 1_000_000
      )
        .toString()
        .padStart(6, "0");
      const code = `D-${number}`;
      if (usedOrderCodes.has(code)) continue;
      usedOrderCodes.add(code);
      return code;
    }
  };
  for (const listing of listings) {
    const groupKey = listing.sharedPhotoGroupId ?? listing.id;
    const orderCode = orderCodeByGroup.get(groupKey) ?? nextOrderCode();
    orderCodeByGroup.set(groupKey, orderCode);
    await prisma.listing.update({
      where: { id: listing.id },
      data: {
        productCode: listing.productCode ?? `SP-${shortCode(8)}`,
        orderCode,
      },
    });
  }
  if (listings.length)
    console.info(`Backfilled public codes for ${listings.length} listings`);
}

async function backfillListingSearchText() {
  const listings = await prisma.listing.findMany({
    include: { category: { select: { name: true } } },
  });
  for (const listing of listings) {
    await prisma.listing.update({
      where: { id: listing.id },
      data: {
        searchText: buildListingSearchText([
          listing.title,
          listing.description,
          listing.category.name,
          listing.subcategory,
          listing.location,
          listing.productCode,
          listing.orderCode,
        ]),
      },
    });
  }
  if (listings.length)
    console.info(`Backfilled search text for ${listings.length} listings`);
}

async function reconcileListingInventory() {
  await prisma.listingTrade.updateMany({
    where: { status: "QUEUED" },
    data: { allocatedQuantity: 0 },
  });
  const listings = await prisma.listing.findMany({
    include: {
      trades: {
        where: { status: { in: ["ACTIVE", "COMPLETED"] } },
        select: { status: true, allocatedQuantity: true },
      },
    },
  });
  for (const listing of listings) {
    const reservedQuantity = listing.trades
      .filter((trade) => trade.status === "ACTIVE")
      .reduce((total, trade) => total + trade.allocatedQuantity, 0);
    const soldQuantity = listing.trades
      .filter((trade) => trade.status === "COMPLETED")
      .reduce((total, trade) => total + trade.allocatedQuantity, 0);
    const totalQuantity = Math.max(
      listing.totalQuantity,
      soldQuantity + reservedQuantity,
      1,
    );
    const availableQuantity = totalQuantity - soldQuantity - reservedQuantity;
    const status =
      listing.status === "HIDDEN"
        ? "HIDDEN"
        : soldQuantity >= totalQuantity
          ? "SOLD"
          : availableQuantity > 0
            ? "AVAILABLE"
            : "RESERVED";
    await prisma.listing.update({
      where: { id: listing.id },
      data: { totalQuantity, reservedQuantity, soldQuantity, status },
    });
  }
  if (listings.length)
    console.info(`Reconciled inventory for ${listings.length} listings`);
}

async function main() {
  const categories = [
    ["Điện tử & công nghệ", "tech", "⌘"],
    ["Gia dụng", "appliances", "⌂"],
    ["Nội thất & nhà cửa", "home", "▰"],
    ["Đồ thủ công", "handmade", "✣"],
    ["Thời trang", "fashion", "◒"],
    ["Sách & học tập", "books", "▤"],
    ["Làm đẹp", "beauty", "✿"],
    ["Thể thao", "sports", "◆"],
    ["Xe cộ", "vehicles", "◈"],
    ["Dịch vụ", "services", "⚙"],
    ["Khác", "other", "…"],
  ];
  await prisma.category.updateMany({
    where: { slug: { notIn: categories.map((item) => item[1]) } },
    data: { isActive: false },
  });
  for (const [name, slug, icon] of categories) {
    await prisma.category.upsert({
      where: { slug },
      update: { name, icon, isActive: true },
      create: {
        name,
        slug,
        icon,
        sortOrder: categories.findIndex((x) => x[1] === slug),
      },
    });
  }
  const [
    techCategory,
    legacyFlashlightCategory,
    servicesCategory,
    legacyFoodCategory,
  ] = await Promise.all([
    prisma.category.findUnique({ where: { slug: "tech" } }),
    prisma.category.findUnique({ where: { slug: "flashlights" } }),
    prisma.category.findUnique({ where: { slug: "services" } }),
    prisma.category.findUnique({ where: { slug: "food" } }),
  ]);
  if (techCategory && legacyFlashlightCategory) {
    const migrated = await prisma.listing.updateMany({
      where: { categoryId: legacyFlashlightCategory.id },
      data: {
        categoryId: techCategory.id,
        subcategory: "flashlights",
      },
    });
    if (migrated.count) {
      console.info(
        `Moved ${migrated.count} flashlight listings under the tech category`,
      );
    }
  }
  if (servicesCategory && legacyFoodCategory) {
    const migrated = await prisma.listing.updateMany({
      where: { categoryId: legacyFoodCategory.id },
      data: {
        categoryId: servicesCategory.id,
        subcategory: "other-services",
      },
    });
    if (migrated.count) {
      console.info(
        `Moved ${migrated.count} food listings under the services category`,
      );
    }
  }
  console.info("Seeded marketplace categories");
  await seedAdmin();
  await seedDemoUsers();
  await backfillPublicListingCodes();
  await backfillListingSearchText();
  await reconcileListingInventory();
}
main().finally(() => prisma.$disconnect());
