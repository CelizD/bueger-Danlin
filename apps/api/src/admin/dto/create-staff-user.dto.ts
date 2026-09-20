import {
  IsEmail,
  IsIn,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import type { StaffRole } from "../../auth/auth.types.js";

export class CreateStaffUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsEmail()
  @MaxLength(160)
  email!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @IsIn(["ADMIN", "KITCHEN", "DELIVERY"])
  role!: StaffRole;
}
