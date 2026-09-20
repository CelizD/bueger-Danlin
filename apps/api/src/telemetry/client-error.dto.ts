import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class ClientErrorDto {
  @IsIn([
    "route-boundary",
    "window-error",
    "unhandled-rejection",
  ])
  kind!:
    | "route-boundary"
    | "window-error"
    | "unhandled-rejection";

  @IsString()
  @MaxLength(120)
  route!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  errorName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  digest?: string;
}
