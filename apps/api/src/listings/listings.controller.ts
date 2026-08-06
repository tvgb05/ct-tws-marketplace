import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateListingBatchDto } from "./dto/create-listing-batch.dto";
import { CreateListingDto } from "./dto/create-listing.dto";
import { ListListingsDto } from "./dto/list-listings.dto";
import {
  ListingImagesService,
  UploadedListingFile,
} from "./listing-images.service";
import { ListingsService } from "./listings.service";

@ApiTags("listings")
@Controller("listings")
export class ListingsController {
  constructor(
    private readonly listings: ListingsService,
    private readonly images: ListingImagesService,
  ) {}

  @Get()
  findAll(@Query() query: ListListingsDto) {
    return this.listings.findAll(query);
  }

  @Get("mine")
  @ApiCookieAuth("tws_session")
  @UseGuards(JwtAuthGuard)
  mine(@CurrentUser() user: User) {
    return this.listings.findMine(user);
  }

  @Post("images")
  @ApiCookieAuth("tws_session")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 8 * 1024 * 1024 } }),
  )
  uploadImage(
    @CurrentUser() user: User,
    @UploadedFile() file?: UploadedListingFile,
  ) {
    if (!user.canPostListings)
      throw new ForbiddenException(
        "Quyền đăng bài của tài khoản đã bị tạm khóa",
      );
    return this.images.upload(file);
  }

  @Post("batch")
  @ApiCookieAuth("tws_session")
  @UseGuards(JwtAuthGuard)
  createBatch(@CurrentUser() user: User, @Body() dto: CreateListingBatchDto) {
    return this.listings.createBatch(user, dto);
  }

  @Get(":slug")
  findOne(@Param("slug") slug: string) {
    return this.listings.findOne(slug);
  }

  @Post()
  @ApiCookieAuth("tws_session")
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: User, @Body() dto: CreateListingDto) {
    return this.listings.create(user, dto);
  }
}
