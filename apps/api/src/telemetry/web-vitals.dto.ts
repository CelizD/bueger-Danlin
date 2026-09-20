import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class WebVitalsDto {
  @IsIn(["CLS", "FCP", "INP", "LCP", "TTFB"])
  name!: "CLS" | "FCP" | "INP" | "LCP" | "TTFB";

  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  value!: number;

  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  delta!: number;

  @IsIn(["good", "needs-improvement", "poor"])
  rating!: "good" | "needs-improvement" | "poor";

  @IsString()
  @MaxLength(80)
  metricId!: string;

  @IsString()
  @MaxLength(120)
  route!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  navigationType?: string;
}
