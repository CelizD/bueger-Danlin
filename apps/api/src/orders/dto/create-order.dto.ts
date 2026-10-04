import { BURGER_MAX_INGREDIENT_QUANTITY } from "@burger/types";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class CreateOrderCustomerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsString()
  @Matches(/^\+52\d{10}$/, {
    message: "phone debe estar en formato +52 seguido de 10 dígitos",
  })
  phone!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;
}

export class CreateOrderModifierQuantityDto {
  @IsString()
  @MinLength(1)
  modifierOptionId!: string;

  @IsInt()
  @Min(1)
  @Max(BURGER_MAX_INGREDIENT_QUANTITY)
  quantity!: number;
}

export class CreateOrderItemDto {
  @IsString()
  @MinLength(1)
  productId!: string;

  @IsInt()
  @Min(1)
  @Max(20)
  quantity!: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  removedModifierOptionIds: string[] = [];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  extraModifierOptionIds: string[] = [];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderModifierQuantityDto)
  modifierQuantities?: CreateOrderModifierQuantityDto[];
}

export class CreateOrderDto {
  @IsString()
  @MinLength(1)
  pickupEventId!: string;

  @IsBoolean()
  @Equals(true, {
    message:
      "Debes aceptar los términos y condiciones de compra antes de continuar.",
  })
  purchaseTermsAccepted!: boolean;

  @IsBoolean()
  @Equals(true, {
    message:
      "Debes confirmar que eres mayor de edad o que cuentas con autorización de tu madre, padre o tutor.",
  })
  ageAuthorizationConfirmed!: boolean;

  @IsBoolean()
  @Equals(true, {
    message:
      "Debes aceptar las condiciones de entrega grupal antes de continuar.",
  })
  groupDeliveryTermsAccepted!: boolean;

  @ValidateNested()
  @Type(() => CreateOrderCustomerDto)
  customer!: CreateOrderCustomerDto;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}
