import { Module } from "@nestjs/common";
import { CartController } from "./cart.controller";
import { CartService } from "./cart.service";

@Module({
  controllers: [CartController],
  providers: [CartService],
  // Оформление заказа считает состав тем же сервисом, что рисует корзину:
  // цены и наличие должны совпадать до копейки.
  exports: [CartService],
})
export class CartModule {}
