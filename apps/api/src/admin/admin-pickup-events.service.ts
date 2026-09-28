import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import { GroupDeliverySettlementService } from "../group-delivery/group-delivery-settlement.service.js";
import { CreatePickupEventDto } from "./dto/create-pickup-event.dto.js";
import { UpdatePickupEventDto } from "./dto/update-pickup-event.dto.js";
import { listAdminPickupEvents } from "./admin-pickup-event-list.js";
import {
  createAdminPickupEvent,
  openAdminPickupEvent,
  updateAdminPickupEvent,
} from "./admin-pickup-event-mutations.js";

@Injectable()
export class AdminPickupEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groupDeliverySettlement: GroupDeliverySettlementService,
  ) {}

  async list() {
    const now = new Date();

    await this.groupDeliverySettlement.settleExpired(now);

    return listAdminPickupEvents(this.prisma, now);
  }

  create(
    dto: CreatePickupEventDto,
    userId: string,
  ) {
    return createAdminPickupEvent(
      this.prisma,
      dto,
      userId,
    );
  }

  update(
    id: string,
    dto: UpdatePickupEventDto,
    userId: string,
  ) {
    return updateAdminPickupEvent(
      this.prisma,
      id,
      dto,
      userId,
    );
  }

  open(id: string, userId: string) {
    return openAdminPickupEvent(
      this.prisma,
      id,
      userId,
    );
  }

  close(id: string, userId: string) {
    return this.groupDeliverySettlement.settleEvent(id, {
      force: true,
      actorUserId: userId,
      reason: "manual",
    });
  }
}
