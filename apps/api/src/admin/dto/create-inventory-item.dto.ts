import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class CreateInventoryItemDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  unit!: string;

  @IsInt()
  @Min(0)
  @Max(100000)
  stockQuantity!: number;

  @IsInt()
  @Min(0)
  @Max(100000)
  lowStockThreshold!: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
