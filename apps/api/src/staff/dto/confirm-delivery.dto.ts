import { IsBoolean, IsOptional } from "class-validator";

export class ConfirmDeliveryDto {
  @IsOptional()
  @IsBoolean()
  deliveryFeeCollected?: boolean;
}
