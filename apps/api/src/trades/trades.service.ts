import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, type User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const activeTradeInclude = {
  buyer: {
    select: { id: true, displayName: true, avatarUrl: true, role: true },
  },
  seller: {
    select: { id: true, displayName: true, avatarUrl: true, role: true },
  },
  listing: {
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      contactType: true,
      contactValue: true,
      totalQuantity: true,
      reservedQuantity: true,
      soldQuantity: true,
      productCode: true,
      orderCode: true,
    },
  },
  mediationRequest: { select: { id: true, status: true } },
  reviews: {
    select: {
      id: true,
      reviewerId: true,
      revieweeId: true,
      rating: true,
      comment: true,
      createdAt: true,
    },
  },
};

type InventoryListing = {
  id: string;
  status: string;
  totalQuantity: number;
  reservedQuantity: number;
  soldQuantity: number;
};

const identityLabel = (user: { displayName: string; role: string }) =>
  user.role === "ADMIN" ? `${user.displayName} (ADMIN)` : user.displayName;

@Injectable()
export class TradesService {
  constructor(private readonly prisma: PrismaService) {}

  async requestContact(
    listingId: string,
    buyer: User,
    requestedQuantity = 1,
    mediationRequestId?: string,
  ) {
    return this.withListingLock(listingId, async (tx) => {
      const listing = await tx.listing.findFirst({
        where: { id: listingId, deletedAt: null, moderationStatus: "APPROVED" },
        include: { seller: { select: { displayName: true, role: true } } },
      });
      if (!listing) throw new NotFoundException("Không tìm thấy bài đăng");
      if (listing.status === "SOLD" || listing.status === "HIDDEN")
        throw new BadRequestException("Sản phẩm không còn nhận giao dịch mới");
      if (listing.sellerId === buyer.id)
        throw new BadRequestException("Bạn không thể mua sản phẩm của chính mình");
      if (!Number.isInteger(requestedQuantity) || requestedQuantity < 1)
        throw new BadRequestException("Số lượng mua không hợp lệ");
      if (requestedQuantity > listing.totalQuantity)
        throw new BadRequestException(
          `Mỗi yêu cầu chỉ được đặt tối đa ${listing.totalQuantity} sản phẩm`,
        );

      const existing = await tx.listingTrade.findFirst({
        where: {
          listingId,
          buyerId: buyer.id,
          status: { in: ["ACTIVE", "QUEUED"] },
        },
        include: activeTradeInclude,
        orderBy: { createdAt: "desc" },
      });
      if (existing)
        return this.tradeResult(
          existing,
          listing,
          existing.status === "ACTIVE",
        );

      const availableQuantity = this.available(listing);
      const allocatedQuantity = Math.min(requestedQuantity, availableQuantity);
      const status = allocatedQuantity > 0 ? "ACTIVE" : "QUEUED";
      const queuedCount =
        status === "QUEUED"
          ? await tx.listingTrade.count({ where: { listingId, status: "QUEUED" } })
          : 0;
      const queuePosition = status === "QUEUED" ? queuedCount + 1 : null;
      const trade = await tx.listingTrade.create({
        data: {
          listingId,
          buyerId: buyer.id,
          sellerId: listing.sellerId,
          status,
          queuePosition,
          requestedQuantity,
          allocatedQuantity,
          mediationRequestId,
          activatedAt: status === "ACTIVE" ? new Date() : null,
        },
        include: activeTradeInclude,
      });

      const updatedListing =
        status === "ACTIVE"
          ? await tx.listing.update({
              where: { id: listingId },
              data: {
                reservedQuantity: { increment: allocatedQuantity },
                status:
                  availableQuantity - allocatedQuantity === 0
                    ? "RESERVED"
                    : "AVAILABLE",
              },
            })
          : listing;
      const buyerName = identityLabel(buyer);
      const sellerName = identityLabel(listing.seller);
      const partial = allocatedQuantity < requestedQuantity;
      await tx.notification.createMany({
        data: [
          {
            userId: listing.sellerId,
            type: "TRADE_REQUESTED",
            title: `${buyerName} muốn mua ${requestedQuantity} × ${listing.title}`,
            message:
              status === "ACTIVE"
                ? `${buyerName} được giữ ${allocatedQuantity} sản phẩm${partial ? ` thay vì ${requestedQuantity} do tồn kho hiện tại` : ""}.`
                : `${buyerName} đã vào hàng chờ ở vị trí ${queuePosition} vì toàn bộ tồn kho đang được giao dịch.`,
            targetUrl: "/account/listings",
          },
          {
            userId: buyer.id,
            type: status === "ACTIVE" ? "TRADE_ACTIVATED" : "TRADE_QUEUED",
            title:
              status === "ACTIVE"
                ? `Đã giữ ${allocatedQuantity} sản phẩm từ ${sellerName}`
                : `Đã vào hàng chờ của ${sellerName}`,
            message:
              status === "ACTIVE"
                ? partial
                  ? `Bạn yêu cầu ${requestedQuantity}, hệ thống đã giữ ${allocatedQuantity} sản phẩm còn lại của ${listing.title}.`
                  : `Bạn đang giao dịch ${allocatedQuantity} × ${listing.title} với ${sellerName}.`
                : `Vị trí chờ của bạn: ${queuePosition}. Hệ thống sẽ tự cấp hàng khi có giao dịch bị hủy.`,
            targetUrl: `/marketplace/${listing.slug}`,
          },
        ],
      });
      return this.tradeResult(
        trade,
        updatedListing,
        status === "ACTIVE",
      );
    });
  }

  listMine(user: User) {
    return this.prisma.listingTrade.findMany({
      where:
        user.role === "ADMIN"
          ? {}
          : { OR: [{ sellerId: user.id }, { buyerId: user.id }] },
      include: activeTradeInclude,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
  }

  async activate(tradeId: string, seller: User) {
    const candidate = await this.prisma.listingTrade.findUnique({
      where: { id: tradeId },
      select: { listingId: true },
    });
    if (!candidate) throw new NotFoundException("Không tìm thấy giao dịch");
    return this.withListingLock(candidate.listingId, async (tx) => {
      const selected = await tx.listingTrade.findUnique({
        where: { id: tradeId },
        include: activeTradeInclude,
      });
      if (!selected) throw new NotFoundException("Không tìm thấy giao dịch");
      if (selected.sellerId !== seller.id)
        throw new ForbiddenException("Chỉ người bán có thể chọn người mua");
      if (selected.status !== "QUEUED")
        throw new BadRequestException("Giao dịch này không còn trong hàng chờ");
      const listing = await tx.listing.findUniqueOrThrow({
        where: { id: selected.listingId },
      });
      const availableQuantity = this.available(listing);
      if (availableQuantity < 1)
        throw new BadRequestException(
          "Chưa có tồn kho trống. Hãy hủy một giao dịch đang hoạt động để hệ thống tự cấp cho hàng chờ.",
        );
      const allocatedQuantity = Math.min(
        selected.requestedQuantity,
        availableQuantity,
      );
      const trade = await tx.listingTrade.update({
        where: { id: selected.id },
        data: {
          status: "ACTIVE",
          allocatedQuantity,
          queuePosition: null,
          activatedAt: new Date(),
          cancelledAt: null,
        },
        include: activeTradeInclude,
      });
      await this.reindexQueue(tx, selected.listingId);
      const updatedListing = await tx.listing.update({
        where: { id: selected.listingId },
        data: {
          reservedQuantity: { increment: allocatedQuantity },
          status:
            availableQuantity === allocatedQuantity ? "RESERVED" : "AVAILABLE",
        },
      });
      await tx.notification.create({
        data: {
          userId: selected.buyerId,
          type: "TRADE_ACTIVATED",
          title: `${identityLabel(seller)} đã cấp hàng cho bạn`,
          message: `Bạn được giữ ${allocatedQuantity} × ${selected.listing.title}.`,
          targetUrl: `/marketplace/${selected.listing.slug}`,
        },
      });
      return {
        trade,
        inventory: this.inventory(updatedListing),
        listingStatus: updatedListing.status,
      };
    });
  }

  async complete(tradeId: string, seller: User) {
    const trade = await this.prisma.listingTrade.findUnique({
      where: { id: tradeId },
      include: activeTradeInclude,
    });
    if (!trade) throw new NotFoundException("Không tìm thấy giao dịch");
    if (trade.sellerId !== seller.id)
      throw new ForbiddenException("Chỉ người bán có thể hoàn tất giao dịch");
    if (trade.status !== "ACTIVE")
      throw new BadRequestException("Giao dịch này không ở trạng thái đang thực hiện");
    if (trade.mediationRequestId)
      throw new BadRequestException("Giao dịch trung gian cần admin xác nhận hoàn tất");
    return this.finishTrade(tradeId, seller.id, false);
  }

  async adminComplete(tradeId: string, admin: User) {
    if (admin.role !== "ADMIN")
      throw new ForbiddenException("Chỉ admin có thể xác nhận giao dịch trung gian");
    const trade = await this.prisma.listingTrade.findUnique({
      where: { id: tradeId },
      include: activeTradeInclude,
    });
    if (!trade?.mediationRequestId)
      throw new BadRequestException("Đây không phải giao dịch trung gian");
    return this.finishTrade(tradeId, admin.id, true);
  }

  private async finishTrade(
    tradeId: string,
    actorId: string,
    completedByAdmin: boolean,
  ) {
    const candidate = await this.prisma.listingTrade.findUnique({
      where: { id: tradeId },
      select: { listingId: true },
    });
    if (!candidate) throw new NotFoundException("Không tìm thấy giao dịch");
    return this.withListingLock(candidate.listingId, async (tx) => {
      const trade = await tx.listingTrade.findUniqueOrThrow({
        where: { id: tradeId },
        include: activeTradeInclude,
      });
      if (trade.status !== "ACTIVE")
        throw new BadRequestException("Giao dịch này không còn hoạt động");
      const listing = await tx.listing.findUniqueOrThrow({
        where: { id: trade.listingId },
      });
      const soldQuantity = Math.min(
        listing.totalQuantity,
        listing.soldQuantity + trade.allocatedQuantity,
      );
      const reservedQuantity = Math.max(
        0,
        listing.reservedQuantity - trade.allocatedQuantity,
      );
      const soldOut = soldQuantity >= listing.totalQuantity;
      const listingStatus = soldOut
        ? "SOLD"
        : listing.totalQuantity - soldQuantity - reservedQuantity > 0
          ? "AVAILABLE"
          : "RESERVED";
      const completed = await tx.listingTrade.update({
        where: { id: tradeId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          completedByAdminId: completedByAdmin ? actorId : null,
        },
        include: activeTradeInclude,
      });
      const updatedListing = await tx.listing.update({
        where: { id: trade.listingId },
        data: { soldQuantity, reservedQuantity, status: listingStatus },
      });
      const queuedTrades = soldOut
        ? await tx.listingTrade.findMany({
            where: { listingId: trade.listingId, status: "QUEUED" },
            select: { id: true, buyerId: true },
          })
        : [];
      if (soldOut)
        await tx.listingTrade.updateMany({
          where: { listingId: trade.listingId, status: "QUEUED" },
          data: { status: "DECLINED", cancelledAt: new Date() },
        });
      if (trade.mediationRequestId)
        await tx.mediationRequest.update({
          where: { id: trade.mediationRequestId },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
            assignedAdminId: completedByAdmin ? actorId : undefined,
          },
        });
      const completingAdmin = completedByAdmin
        ? await tx.user.findUnique({
            where: { id: actorId },
            select: { displayName: true, role: true },
          })
        : null;
      const adminConfirmation = completingAdmin
        ? ` sau khi ${identityLabel(completingAdmin)} xác nhận`
        : "";
      const sellerName = identityLabel(trade.seller);
      const buyerName = identityLabel(trade.buyer);
      await tx.notification.createMany({
        data: [
          {
            userId: trade.buyerId,
            type: "TRADE_COMPLETED",
            title: `${sellerName} đã hoàn tất đơn bán`,
            message: `${trade.allocatedQuantity} × ${trade.listing.title} đã hoàn tất${adminConfirmation}.`,
            targetUrl: `/marketplace/${trade.listing.slug}`,
          },
          {
            userId: trade.sellerId,
            type: "TRADE_COMPLETED",
            title: `Đã bán ${trade.allocatedQuantity} sản phẩm cho ${buyerName}`,
            message: `Còn ${updatedListing.totalQuantity - updatedListing.soldQuantity - updatedListing.reservedQuantity} sản phẩm chưa được giữ.`,
            targetUrl: "/account/listings",
          },
          ...queuedTrades.map(({ buyerId }) => ({
            userId: buyerId,
            type: "TRADE_COMPLETED" as const,
            title: `${sellerName} đã bán hết ${trade.listing.title}`,
            message: "Sản phẩm đã hết hàng nên hàng chờ được đóng.",
            targetUrl: `/marketplace/${trade.listing.slug}`,
          })),
        ],
      });
      return {
        trade: completed,
        inventory: this.inventory(updatedListing),
        listingStatus: updatedListing.status,
      };
    });
  }

  async cancel(tradeId: string, seller: User) {
    const candidate = await this.prisma.listingTrade.findUnique({
      where: { id: tradeId },
      select: { listingId: true },
    });
    if (!candidate) throw new NotFoundException("Không tìm thấy giao dịch");
    return this.withListingLock(candidate.listingId, async (tx) => {
      const trade = await tx.listingTrade.findUnique({
        where: { id: tradeId },
        include: activeTradeInclude,
      });
      if (!trade) throw new NotFoundException("Không tìm thấy giao dịch");
      if (trade.sellerId !== seller.id)
        throw new ForbiddenException("Chỉ người bán có thể dừng giao dịch");
      if (trade.status !== "ACTIVE")
        throw new BadRequestException("Giao dịch này không hoạt động");
      const listing = await tx.listing.findUniqueOrThrow({
        where: { id: trade.listingId },
      });
      const cancelled = await tx.listingTrade.update({
        where: { id: tradeId },
        data: { status: "CANCELLED", cancelledAt: new Date() },
        include: activeTradeInclude,
      });
      const releasedListing = {
        ...listing,
        reservedQuantity: Math.max(
          0,
          listing.reservedQuantity - trade.allocatedQuantity,
        ),
      };
      const promoted = await this.promoteQueue(
        tx,
        releasedListing,
        identityLabel(trade.seller),
      );
      await tx.notification.createMany({
        data: [
          {
            userId: trade.buyerId,
            type: "TRADE_CANCELLED",
            title: `${identityLabel(trade.seller)} đã dừng giao dịch`,
            message: `Giao dịch ${trade.allocatedQuantity} × ${trade.listing.title} chưa đạt thỏa thuận.`,
            targetUrl: `/marketplace/${trade.listing.slug}`,
          },
          {
            userId: trade.sellerId,
            type: "TRADE_CANCELLED",
            title: `Đã dừng giao dịch với ${identityLabel(trade.buyer)}`,
            message: promoted.promotedCount
              ? `${promoted.promotedCount} người trong hàng chờ đã được tự động cấp hàng.`
              : "Số lượng vừa giữ đã được trả lại tồn kho.",
            targetUrl: "/account/listings",
          },
        ],
      });
      return {
        trade: cancelled,
        inventory: this.inventory(promoted.listing),
        listingStatus: promoted.listing.status,
      };
    });
  }

  private async promoteQueue(
    tx: Prisma.TransactionClient,
    listing: InventoryListing,
    sellerName: string,
  ) {
    let reservedQuantity = listing.reservedQuantity;
    let availableQuantity =
      listing.totalQuantity - listing.soldQuantity - reservedQuantity;
    let promotedCount = 0;
    const queued = await tx.listingTrade.findMany({
      where: { listingId: listing.id, status: "QUEUED" },
      include: { buyer: { select: { id: true, displayName: true } } },
      orderBy: [{ queuePosition: "asc" }, { createdAt: "asc" }],
    });
    const remainingIds: string[] = [];
    for (const trade of queued) {
      if (availableQuantity < 1) {
        remainingIds.push(trade.id);
        continue;
      }
      const allocatedQuantity = Math.min(
        trade.requestedQuantity,
        availableQuantity,
      );
      await tx.listingTrade.update({
        where: { id: trade.id },
        data: {
          status: "ACTIVE",
          allocatedQuantity,
          queuePosition: null,
          activatedAt: new Date(),
          cancelledAt: null,
        },
      });
      await tx.notification.create({
        data: {
          userId: trade.buyerId,
          type: "TRADE_ACTIVATED",
          title: `Đã đến lượt giao dịch với ${sellerName}`,
          message:
            allocatedQuantity < trade.requestedQuantity
              ? `Bạn yêu cầu ${trade.requestedQuantity}, hệ thống đã cấp ${allocatedQuantity} sản phẩm còn lại.`
              : `Hệ thống đã tự động giữ ${allocatedQuantity} sản phẩm cho bạn.`,
          targetUrl: `/marketplace/${(await tx.listing.findUniqueOrThrow({ where: { id: listing.id }, select: { slug: true } })).slug}`,
        },
      });
      reservedQuantity += allocatedQuantity;
      availableQuantity -= allocatedQuantity;
      promotedCount += 1;
    }
    for (const [index, id] of remainingIds.entries())
      await tx.listingTrade.update({
        where: { id },
        data: { queuePosition: index + 1 },
      });
    const status =
      listing.soldQuantity >= listing.totalQuantity
        ? "SOLD"
        : availableQuantity > 0
          ? "AVAILABLE"
          : "RESERVED";
    const updatedListing = await tx.listing.update({
      where: { id: listing.id },
      data: { reservedQuantity, status },
    });
    return { listing: updatedListing, promotedCount };
  }

  private async reindexQueue(tx: Prisma.TransactionClient, listingId: string) {
    const queued = await tx.listingTrade.findMany({
      where: { listingId, status: "QUEUED" },
      select: { id: true },
      orderBy: [{ queuePosition: "asc" }, { createdAt: "asc" }],
    });
    for (const [index, trade] of queued.entries())
      await tx.listingTrade.update({
        where: { id: trade.id },
        data: { queuePosition: index + 1 },
      });
  }

  private async withListingLock<T>(
    listingId: string,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT "id" FROM "Listing" WHERE "id" = ${listingId} FOR UPDATE`,
      );
      if (!rows.length) throw new NotFoundException("Không tìm thấy bài đăng");
      return work(tx);
    });
  }

  private available(listing: InventoryListing) {
    return Math.max(
      0,
      listing.totalQuantity - listing.soldQuantity - listing.reservedQuantity,
    );
  }

  private inventory(listing: InventoryListing) {
    return {
      totalQuantity: listing.totalQuantity,
      inTransactionQuantity: listing.reservedQuantity,
      soldQuantity: listing.soldQuantity,
      availableQuantity: this.available(listing),
    };
  }

  private tradeResult(
    trade: {
      status: string;
      listing: { contactType: string; contactValue: string };
    },
    listing: InventoryListing,
    revealContact: boolean,
  ) {
    return {
      trade,
      contact: revealContact
        ? {
            type: trade.listing.contactType,
            value: trade.listing.contactValue,
          }
        : null,
      inventory: this.inventory(listing),
      listingStatus: listing.status,
    };
  }
}
