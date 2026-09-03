import { Controller, Get } from "@nestjs/common";
import type { HealthStatus } from "@mikki-shop/shared-types";
import { Public } from "../auth/public.decorator";

/** Проба живости. Публичная: её дёргает балансировщик, а не покупатель. */
@Public()
@Controller("health")
export class HealthController {
  @Get()
  check(): HealthStatus {
    return { status: "ok" };
  }
}
