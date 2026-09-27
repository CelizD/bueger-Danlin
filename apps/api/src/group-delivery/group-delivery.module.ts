import { Global, Module } from "@nestjs/common";
import { GroupDeliverySettlementService } from "./group-delivery-settlement.service.js";

@Global()
@Module({
  providers: [GroupDeliverySettlementService],
  exports: [GroupDeliverySettlementService],
})
export class GroupDeliveryModule {}
