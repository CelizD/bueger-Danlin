import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export const ARCO_REQUEST_STATUSES = [
  "IDENTITY_VERIFICATION_REQUIRED",
  "IN_REVIEW",
  "RESOLVED",
  "DENIED",
] as const;

export type ArcoRequestStatusInput =
  (typeof ARCO_REQUEST_STATUSES)[number];

export class UpdateArcoRequestDto {
  @IsOptional()
  @IsIn(ARCO_REQUEST_STATUSES)
  status?: ArcoRequestStatusInput;

  @IsOptional()
  @IsBoolean()
  identityVerified?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNote?: string;
}
