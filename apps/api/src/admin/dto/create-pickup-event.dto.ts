import {
  IsISO8601,
  IsInt,
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

  @IsISO8601()
  startsAt!: string;

  @IsISO8601()
  closesAt!: string;

  @IsInt()
  @Min(1)
  @Max(500)
  maxCombos!: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;
}
