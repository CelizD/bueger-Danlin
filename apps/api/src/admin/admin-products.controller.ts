import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiConsumes,
  ApiCookieAuth,
  ApiTags,
} from "@nestjs/swagger";
import { AdminGuard } from "../auth/admin.guard.js";
import { StaffAuthGuard } from "../auth/staff-auth.guard.js";
import type { StaffRequest } from "../auth/auth.types.js";
import {
  AdminProductsService,
  MAX_PRODUCT_IMAGE_BYTES,
  type ProductImageUpload,
} from "./admin-products.service.js";

@ApiTags("Admin products")
@ApiCookieAuth("burger_staff_session")
@Controller("admin/products")
@UseGuards(StaffAuthGuard, AdminGuard)
export class AdminProductsController {
  constructor(
    private readonly products:
      AdminProductsService,
  ) {}

  @Get()
  list() {
    return this.products.list();
  }

  @Post(":id/image")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(
    FileInterceptor("image", {
      limits: {
        files: 1,
        fileSize:
          MAX_PRODUCT_IMAGE_BYTES,
      },
    }),
  )
  uploadImage(
    @Param("id") id: string,
    @UploadedFile()
    file:
      | ProductImageUpload
      | undefined,
    @Req() request: StaffRequest,
  ) {
    return this.products.uploadImage(
      id,
      file,
      request.user!.sub,
    );
  }

  @Delete(":id/image")
  removeImage(
    @Param("id") id: string,
    @Req() request: StaffRequest,
  ) {
    return this.products.removeImage(
      id,
      request.user!.sub,
    );
  }
}
