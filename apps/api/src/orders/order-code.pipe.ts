import {
  BadRequestException,
  Injectable,
  type PipeTransform,
} from "@nestjs/common";

const ORDER_CODE_PATTERN = /^H-[A-F0-9]{8}$/;

@Injectable()
export class OrderCodePipe implements PipeTransform<string, string> {
  transform(value: string) {
    const normalized = value.trim().toUpperCase();

    if (!ORDER_CODE_PATTERN.test(normalized)) {
      throw new BadRequestException("Código de pedido inválido.");
    }

    return normalized;
  }
}
