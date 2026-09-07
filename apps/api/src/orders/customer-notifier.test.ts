import { describe, expect, it } from "vitest";
import type { Order, OrderStatus } from "@mikki-shop/shared-types";
import { customerText } from "./customer-notifier";

const order = (status: OrderStatus): Order => ({
  number: 42,
  status,
  createdAt: "2026-09-07T12:00:00.000Z",
  customerName: "Денис",
  phone: "+7 916 123-45-67",
  delivery: "courier",
  total: 1180,
  lines: [],
});

describe("customerText", () => {
  it("называет номер заказа и что с ним стало", () => {
    expect(customerText(order("CONFIRMED"))).toContain("Заказ 42 подтверждён");
    expect(customerText(order("SHIPPED"))).toContain("Заказ 42 отправлен");
    expect(customerText(order("DONE"))).toContain("Заказ 42 получен");
    expect(customerText(order("CANCELLED"))).toContain("Заказ 42 отменён");
  });

  // Покупатель только что оформил заказ и видит его на экране «Мои заказы» —
  // сообщать ему об этом же нечего.
  it("молчит про только что созданный заказ", () => {
    expect(customerText(order("NEW"))).toBeNull();
  });

  // Правила бренда: факт и что дальше, без восклицаний.
  it("говорит без восклицаний", () => {
    const texts = (["CONFIRMED", "SHIPPED", "DONE", "CANCELLED"] as const).map((status) =>
      customerText(order(status)),
    );

    for (const text of texts) expect(text).not.toContain("!");
  });
});
