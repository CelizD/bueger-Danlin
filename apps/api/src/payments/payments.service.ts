import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import { InventoryService } from "../inventory/inventory.service.js";
import { GroupTelegramNotificationService } from "../notifications/group-telegram-notification.service.js";
import { TelegramNotificationService } from "../notifications/telegram-notification.service.js";
import { confirmMockOrderPayment } from "./mock-payment-confirmation.js";
import { createPaymentCheckout } from "./payment-checkout.js";
import { PaymentProviderRegistry } from "./payment-provider.registry.js";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly paymentProviderRegistry: PaymentProviderRegistry,
    private readonly telegram?: TelegramNotificationService,
    private readonly groupTelegram?: GroupTelegramNotificationService,
  ) {}

  async createCheckout(
    orderCode: string,
    verificationToken: string,
  ) {
    return createPaymentCheckout(
      this.prisma,
      this.paymentProviderRegistry,
      orderCode,
      verificationToken,
    );
  }

  async confirmMockPayment(
    orderCode: string,
    verificationToken: string,
  ) {
    return confirmMockOrderPayment(
      this.prisma,
      this.inventory,
      this.paymentProviderRegistry,
      this.telegram,
      this.groupTelegram,
      orderCode,
      verificationToken,
    );
  }
}
