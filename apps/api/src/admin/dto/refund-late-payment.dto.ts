import {
  Equals,
  IsBoolean,
} from "class-validator";

export class RefundLatePaymentDto {
  @IsBoolean()
  @Equals(true)
  confirm!: boolean;
}
