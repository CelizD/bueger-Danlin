import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import {
  commitInventoryOrder,
  type PreparedInventoryItem,
  releaseExpiredInventoryReservations,
  releaseInventoryOrder,
  reserveInventoryForOrder,
} from "./inventory-allocations.js";
import {
  createInventoryItem,
  deleteInventoryItem,
  updateInventoryItem,
} from "./inventory-item-mutations.js";
import {
  getPublicInventoryAvailability,
  listAdminInventory,
} from "./inventory-queries.js";

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  publicAvailability() {
    return getPublicInventoryAvailability(
      this.prisma,
    );
  }

  adminList() {
    return listAdminInventory(this.prisma);
  }

  createItem(
    data: {
      name: string;
      unit: string;
      stockQuantity: number;
      lowStockThreshold: number;
      active?: boolean;
    },
    actorUserId: string,
  ) {
    return createInventoryItem(
      this.prisma,
      data,
      actorUserId,
    );
  }

  updateItem(
    id: string,
    data: {
      name?: string;
      unit?: string;
      stockQuantity?: number;
      lowStockThreshold?: number;
      active?: boolean;
    },
    actorUserId: string,
  ) {
    return updateInventoryItem(
      this.prisma,
      id,
      data,
      actorUserId,
    );
  }

  deleteItem(
    id: string,
    actorUserId: string,
  ) {
    return deleteInventoryItem(
      this.prisma,
      id,
      actorUserId,
    );
  }

  reserveForOrder(
    tx: any,
    orderId: string,
    preparedItems: PreparedInventoryItem[],
  ) {
    return reserveInventoryForOrder(
      tx,
      orderId,
      preparedItems,
    );
  }

  commitOrder(
    tx: any,
    orderId: string,
  ) {
    return commitInventoryOrder(
      tx,
      orderId,
    );
  }

  releaseOrder(
    tx: any,
    orderId: string,
  ) {
    return releaseInventoryOrder(
      tx,
      orderId,
    );
  }

  releaseExpiredReservations(tx: any) {
    return releaseExpiredInventoryReservations(
      tx,
    );
  }
}
