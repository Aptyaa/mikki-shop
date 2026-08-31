import { Controller, Get } from "@nestjs/common";
import type { HealthStatus } from "@mikki-shop/shared-types";

@Controller("health")
export class HealthController {
  @Get()
  check(): HealthStatus {
    return { status: "ok" };
  }
}
