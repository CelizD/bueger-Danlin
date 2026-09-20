import { IsString, Matches, MaxLength } from "class-validator";

export class MfaCodeDto {
  @IsString()
  @MaxLength(20)
  @Matches(/^(?:\d{6}|[A-Fa-f0-9]{5}-?[A-Fa-f0-9]{5})$/)
  code!: string;
}
