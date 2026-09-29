import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class ScanDeliveryDto {
  @IsString()
  @MinLength(20)
  @MaxLength(220)
  qrPayload!: string;

  @IsOptional()
  @IsBoolean()
  deliveryFeeCollected?: boolean;
}
