import {
  IsBoolean,
  IsInt,
  IsOptional,
  Max,
  Min,
} from "class-validator";

export class UpdateInventoryItemDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  stockQuantity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  lowStockThreshold?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
