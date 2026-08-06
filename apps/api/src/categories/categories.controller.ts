import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("categories")
@Controller("categories")
export class CategoriesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll() {
    return this.prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
  }
}

