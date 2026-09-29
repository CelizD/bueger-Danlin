import {
  IsISO8601,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class CreatePickupEventDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  locationLabel!: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  locationAddress?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number | null;

  @IsISO8601()
  startsAt!: string;

  @IsISO8601()
  closesAt!: string;

  @IsInt()
  @Min(1)
  @Max(500)
  maxCombos!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  freeDeliveryMinPaidCombos?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  transportCostCents?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;
}
