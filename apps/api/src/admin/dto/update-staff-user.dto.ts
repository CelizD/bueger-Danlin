import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import type { StaffRole } from "../../auth/auth.types.js";

export class UpdateStaffUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsIn(["ADMIN", "KITCHEN", "DELIVERY"])
  role?: StaffRole;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
