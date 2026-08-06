import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ContactType, ModerationStatus, Prisma, User } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { CreateListingBatchDto } from "./dto/create-listing-batch.dto";
import { CreateListingDto } from "./dto/create-listing.dto";
import { ListListingsDto } from "./dto/list-listings.dto";
import {
  buildListingSearchText,
  buildSearchGroups,
  searchRelevance,
} from "./listing-search";

const listingInclude = {
  seller: {
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
      joinedAt: true,
      role: true,
    },
  },
  category: { select: { id: true, name: true, slug: true } },
  images: { orderBy: { sortOrder: "asc" as const } },
  _count: { select: { favorites: true, reports: true } },
};

export const publicListingSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  searchText: true,
  condition: true,
  price: true,
  location: true,
  deliveryMethod: true,
  allowAdminMediation: true,
  status: true,
  moderationStatus: true,
  totalQuantity: true,
  reservedQuantity: true,
  soldQuantity: true,
  subcategory: true,
  sharedPhotoGroupId: true,
  sharedPhotoItemCount: true,
  productCode: true,
  orderCode: true,
  publishedAt: true,
  createdAt: true,
  seller: listingInclude.seller,
  category: listingInclude.category,
  images: listingInclude.images,
  _count: listingInclude._count,
} satisfies Prisma.ListingSelect;

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async findAll(query: ListListingsDto) {
    const categorySlugs = (query.categories ?? query.category ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const subcategories = (query.subcategories ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const searchGroups = query.search ? buildSearchGroups(query.search) : [];
    const where: Prisma.ListingWhereInput = {
      deletedAt: null,
      status: { in: ["AVAILABLE", "RESERVED", "SOLD"] },
      moderationStatus: "APPROVED",
      ...(searchGroups.length && {
        AND: searchGroups.map((variants) => ({
          OR: variants.map((variant) => ({
            searchText: { contains: variant },
          })),
        })),
      }),
      ...(categorySlugs.length && {
        category: { slug: { in: categorySlugs } },
      }),
      ...(subcategories.length && { subcategory: { in: subcategories } }),
      ...(query.condition && { condition: query.condition }),
      ...(query.location && {
        location: { contains: query.location, mode: "insensitive" },
      }),
      ...((query.minPrice !== undefined || query.maxPrice !== undefined) && {
        price: {
          ...(query.minPrice !== undefined && { gte: query.minPrice }),
          ...(query.maxPrice !== undefined && { lte: query.maxPrice }),
        },
      }),
      ...(query.shipping === "yes" && {
        deliveryMethod: { in: ["SHIPPING", "BOTH"] },
      }),
      ...(query.shipping === "no" && { deliveryMethod: "MEETUP" }),
    };
    const orderBy: Prisma.ListingOrderByWithRelationInput =
      query.sort === "price_asc"
        ? { price: "asc" }
        : query.sort === "price_desc"
          ? { price: "desc" }
          : query.sort === "oldest"
            ? { createdAt: "asc" }
            : { createdAt: "desc" };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.listing.findMany({
        where,
        select: publicListingSelect,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.listing.count({ where }),
    ]);
    if (query.search && (!query.sort || query.sort === "newest"))
      data.sort((left, right) => {
        const relevance =
          searchRelevance(query.search!, right) -
          searchRelevance(query.search!, left);
        return (
          relevance || right.createdAt.getTime() - left.createdAt.getTime()
        );
      });
    return {
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(slug: string) {
    const listing = await this.prisma.listing.findFirst({
      where: { slug, deletedAt: null, moderationStatus: "APPROVED" },
      select: publicListingSelect,
    });
    if (!listing) throw new NotFoundException("Không tìm thấy bài đăng");
    await this.prisma.listing.update({
      where: { id: listing.id },
      data: { viewCount: { increment: 1 } },
    });
    const sharedPhotoItems = listing.sharedPhotoGroupId
      ? await this.prisma.listing.findMany({
          where: {
            sharedPhotoGroupId: listing.sharedPhotoGroupId,
            deletedAt: null,
            moderationStatus: "APPROVED",
          },
          select: {
            id: true,
            slug: true,
            title: true,
            price: true,
            status: true,
            productCode: true,
            orderCode: true,
          },
          orderBy: { createdAt: "asc" },
        })
      : [];
    return { ...listing, sharedPhotoItems };
  }

  findMine(user: User) {
    return this.prisma.listing.findMany({
      where: { sellerId: user.id, deletedAt: null },
      include: listingInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  async create(user: User, dto: CreateListingDto) {
    this.validateSeller(user, dto.sellerPolicyAccepted);
    const moderationStatus = this.moderationStatus();
    const productCode = this.createProductCode();
    return this.prisma.$transaction(async (tx) => {
      const orderCode = await this.createOrderCode(tx);
      const category = await tx.category.findFirst({
        where: { id: dto.categoryId, isActive: true },
      });
      if (!category) throw new BadRequestException("Danh mục không hợp lệ");
      await this.rememberSellerPolicy(tx, user);
      return tx.listing.create({
        data: {
          sellerId: user.id,
          categoryId: dto.categoryId,
          subcategory: dto.subcategory,
          title: dto.title.trim(),
          productCode,
          orderCode,
          slug: this.createSlug(dto.title),
          description: dto.description.trim(),
          searchText: buildListingSearchText([
            dto.title,
            dto.description,
            category.name,
            dto.subcategory,
            dto.location,
            productCode,
            orderCode,
          ]),
          condition: dto.condition,
          price: dto.price,
          totalQuantity: dto.quantity,
          location: dto.location.trim(),
          deliveryMethod: dto.deliveryMethod,
          contactType: ContactType.FACEBOOK,
          contactValue: user.facebookProfileUrl!,
          allowAdminMediation: dto.allowAdminMediation,
          moderationStatus,
          publishedAt: moderationStatus === "APPROVED" ? new Date() : null,
          images: {
            create: dto.images.map((image, sortOrder) => ({
              ...image,
              sortOrder,
            })),
          },
        },
        include: listingInclude,
      });
    });
  }

  async createBatch(user: User, dto: CreateListingBatchDto) {
    this.validateSeller(user, dto.sellerPolicyAccepted);
    const moderationStatus = this.moderationStatus();
    const sharedPhotoGroupId = randomUUID();
    const categoryIds = [...new Set(dto.items.map((item) => item.categoryId))];
    return this.prisma.$transaction(async (tx) => {
      const orderCode = await this.createOrderCode(tx);
      const categories = await tx.category.findMany({
        where: { id: { in: categoryIds }, isActive: true },
      });
      if (categories.length !== categoryIds.length)
        throw new BadRequestException("Có món sử dụng danh mục không hợp lệ");
      const categoryById = new Map(
        categories.map((category) => [category.id, category]),
      );
      await this.rememberSellerPolicy(tx, user);
      return Promise.all(
        dto.items.map((item) => {
          const category = categoryById.get(item.categoryId)!;
          const productCode = this.createProductCode();
          return tx.listing.create({
            data: {
              sellerId: user.id,
              categoryId: item.categoryId,
              subcategory: item.subcategory,
              title: item.title.trim(),
              productCode,
              orderCode,
              slug: this.createSlug(item.title),
              description: dto.description.trim(),
              searchText: buildListingSearchText([
                item.title,
                dto.description,
                category.name,
                item.subcategory,
                dto.location,
                productCode,
                orderCode,
              ]),
              condition: item.condition,
              price: item.price,
              totalQuantity: item.quantity,
              location: dto.location.trim(),
              deliveryMethod: dto.deliveryMethod,
              contactType: ContactType.FACEBOOK,
              contactValue: user.facebookProfileUrl!,
              allowAdminMediation: dto.allowAdminMediation,
              moderationStatus,
              publishedAt: moderationStatus === "APPROVED" ? new Date() : null,
              sharedPhotoGroupId,
              sharedPhotoItemCount: dto.items.length,
              images: {
                create: dto.images.map((image, sortOrder) => ({
                  ...image,
                  sortOrder,
                })),
              },
            },
            include: listingInclude,
          });
        }),
      );
    });
  }

  private validateSeller(user: User, sellerPolicyAccepted: boolean) {
    if (user.status !== "ACTIVE")
      throw new BadRequestException("Tài khoản không thể đăng bài");
    if (!user.canPostListings)
      throw new ForbiddenException(
        user.postingRestrictionReason
          ? `Quyền đăng bài đã bị tạm khóa: ${user.postingRestrictionReason}`
          : "Quyền đăng bài của tài khoản đã bị tạm khóa",
      );
    if (
      !user.profileCompletedAt ||
      !user.phoneNumber ||
      !user.facebookProfileUrl
    )
      throw new BadRequestException(
        "Vui lòng hoàn thiện thông tin liên hệ trước khi đăng bài",
      );
    if (!sellerPolicyAccepted)
      throw new BadRequestException("Bạn cần xác nhận cam kết cộng đồng");
  }

  private async rememberSellerPolicy(tx: Prisma.TransactionClient, user: User) {
    if (user.sellerPolicyAcceptedAt) return;
    await tx.user.update({
      where: { id: user.id },
      data: { sellerPolicyAcceptedAt: new Date(), sellerPolicyVersion: "1.0" },
    });
  }

  private moderationStatus(): ModerationStatus {
    return this.config.get("LISTING_REQUIRES_APPROVAL", "false") === "true"
      ? "PENDING"
      : "APPROVED";
  }

  private createSlug(title: string) {
    const slugBase = buildListingSearchText([title]).replace(/\s+/g, "-");
    return `${slugBase || "mon-do"}-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`;
  }

  private createProductCode() {
    return `SP-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  }

  private async createOrderCode(tx: Prisma.TransactionClient) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const numeric = (
        parseInt(randomUUID().replace(/-/g, "").slice(0, 10), 16) % 1_000_000
      )
        .toString()
        .padStart(6, "0");
      const code = `D-${numeric}`;
      const existing = await tx.listing.findFirst({
        where: { orderCode: code },
        select: { id: true },
      });
      if (!existing) return code;
    }
    throw new BadRequestException(
      "Không thể cấp mã đơn mới. Vui lòng thử lại.",
    );
  }
}
