import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

@ApiTags("system")
@Controller("health")
export class HealthController {
  @Get()
  health() {
    return { status: "ok", service: "tws-marketplace-api", timestamp: new Date().toISOString() };
  }
}

