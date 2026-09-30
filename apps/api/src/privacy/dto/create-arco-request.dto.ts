import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  Equals,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export const ARCO_RIGHTS = [
  "ACCESS",
  "RECTIFICATION",
  "CANCELLATION",
  "OPPOSITION",
] as const;

export type ArcoRightInput =
  (typeof ARCO_RIGHTS)[number];

export class CreateArcoRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(160)
  email!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9()\-\s]{7,24}$/, {
    message:
      "phone debe contener un número telefónico válido",
  })
  phone?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @ArrayUnique()
  @IsIn(ARCO_RIGHTS, {
    each: true,
  })
  rights!: ArcoRightInput[];

  @IsString()
  @MinLength(10)
  @MaxLength(3000)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  locatorInfo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rectificationDetails?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  cancellationReason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  oppositionReason?: string;

  @IsBoolean()
  @Equals(true, {
    message:
      "Debes confirmar que comprendes que se solicitará verificación de identidad antes de hacer efectivo un derecho ARCO.",
  })
  identityVerificationAcknowledged!: boolean;
}
