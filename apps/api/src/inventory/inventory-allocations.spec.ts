import { describe, expect, it, vi } from "vitest";
import { reserveInventoryForOrder } from "./inventory-allocations.js";

describe("reserveInventoryForOrder", () => {
  it("descuenta base, extras y bebidas sin descontar un ingrediente removido", async () => {
    const stock = new Map([
      ["meat", 100],
      ["fries", 100],
      ["cheese", 100],
      ["bacon", 100],
      ["coke", 100],
    ]);

    const usages = [
      {
        inventoryItemId: "meat",
        productId: "combo",
        modifierOptionId: null,
        quantity: 1,
        inventoryItem: { id: "meat", name: "Carne", active: true },
        modifierOption: null,
      },
      {
        inventoryItemId: "fries",
        productId: "combo",
        modifierOptionId: null,
        quantity: 1,
        inventoryItem: { id: "fries", name: "Papas", active: true },
        modifierOption: null,
      },
      {
        inventoryItemId: "cheese",
        productId: "combo",
        modifierOptionId: null,
        quantity: 1,
        inventoryItem: { id: "cheese", name: "Queso", active: true },
        modifierOption: null,
      },
      {
        inventoryItemId: "bacon",
        productId: "combo",
        modifierOptionId: "included-bacon",
        quantity: 1,
        inventoryItem: { id: "bacon", name: "Tocino", active: true },
        modifierOption: { kind: "REMOVABLE" },
      },
      {
        inventoryItemId: "meat",
        productId: "combo",
        modifierOptionId: "extra-meat",
        quantity: 1,
        inventoryItem: { id: "meat", name: "Carne", active: true },
        modifierOption: { kind: "EXTRA" },
      },
      {
        inventoryItemId: "cheese",
        productId: "combo",
        modifierOptionId: "extra-cheese",
        quantity: 1,
        inventoryItem: { id: "cheese", name: "Queso", active: true },
        modifierOption: { kind: "EXTRA" },
      },
      {
        inventoryItemId: "coke",
        productId: "coke-product",
        modifierOptionId: null,
        quantity: 1,
        inventoryItem: { id: "coke", name: "Coca-Cola", active: true },
        modifierOption: null,
      },
    ];

    const decrements = new Map<string, number>();
    const allocations: Array<{
      orderId: string;
      inventoryItemId: string;
      quantity: number;
      status: string;
    }> = [];

    const tx = {
      inventoryAllocation: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn(),
        create: vi.fn().mockImplementation(({ data }) => {
          allocations.push(data);
          return Promise.resolve(data);
        }),
      },
      inventoryUsage: {
        findMany: vi.fn().mockResolvedValue(usages),
      },
      inventoryItem: {
        findUnique: vi.fn().mockImplementation(({ where }) =>
          Promise.resolve({
            id: where.id,
            name: usages.find(
              (usage) => usage.inventoryItemId === where.id,
            )?.inventoryItem.name,
            active: true,
            stockQuantity: stock.get(where.id) ?? 0,
          }),
        ),
        update: vi.fn().mockImplementation(({ where, data }) => {
          const amount = data.stockQuantity.decrement as number;
          decrements.set(where.id, amount);
          stock.set(where.id, (stock.get(where.id) ?? 0) - amount);
          return Promise.resolve({});
        }),
      },
      $queryRawUnsafe: vi.fn().mockResolvedValue([]),
    };

    await reserveInventoryForOrder(tx, "order-1", [
      {
        productId: "combo",
        quantity: 1,
        modifiers: [
          {
            modifierOptionId: "included-bacon",
            quantity: 1,
            removed: true,
          },
        ],
      },
      {
        productId: "combo",
        quantity: 1,
        modifiers: [
          {
            modifierOptionId: "extra-meat",
            quantity: 1,
            removed: false,
          },
          {
            modifierOptionId: "extra-cheese",
            quantity: 1,
            removed: false,
          },
        ],
      },
      {
        productId: "coke-product",
        quantity: 2,
        modifiers: [],
      },
    ]);

    expect(Object.fromEntries(decrements)).toEqual({
      bacon: 1,
      cheese: 3,
      coke: 2,
      fries: 2,
      meat: 3,
    });

    expect(stock.get("cheese")).toBe(97);
    expect(stock.get("meat")).toBe(97);
    expect(stock.get("fries")).toBe(98);
    expect(stock.get("bacon")).toBe(99);
    expect(stock.get("coke")).toBe(98);

    expect(allocations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          orderId: "order-1",
          inventoryItemId: "cheese",
          quantity: 3,
          status: "RESERVED",
        }),
        expect.objectContaining({
          orderId: "order-1",
          inventoryItemId: "meat",
          quantity: 3,
          status: "RESERVED",
        }),
      ]),
    );
  });

  it("descuenta varias porciones del mismo ingrediente y extra", async () => {
    const stock = new Map([
      ["lettuce", 20],
      ["meat", 20],
    ]);

    const usages = [
      {
        inventoryItemId: "lettuce",
        productId: "combo",
        modifierOptionId: "included-lettuce",
        quantity: 1,
        inventoryItem: {
          id: "lettuce",
          name: "Lechuga",
          active: true,
        },
        modifierOption: {
          kind: "REMOVABLE",
        },
      },
      {
        inventoryItemId: "meat",
        productId: "combo",
        modifierOptionId: "extra-meat",
        quantity: 1,
        inventoryItem: {
          id: "meat",
          name: "Carne",
          active: true,
        },
        modifierOption: {
          kind: "EXTRA",
        },
      },
    ];

    const decrements =
      new Map<string, number>();

    const tx = {
      inventoryAllocation: {
        findMany: vi
          .fn()
          .mockResolvedValue([]),
        updateMany: vi.fn(),
        create: vi
          .fn()
          .mockResolvedValue({}),
      },
      inventoryUsage: {
        findMany: vi
          .fn()
          .mockResolvedValue(
            usages,
          ),
      },
      inventoryItem: {
        findUnique: vi
          .fn()
          .mockImplementation(
            ({ where }) =>
              Promise.resolve({
                id: where.id,
                name:
                  usages.find(
                    (usage) =>
                      usage.inventoryItemId ===
                      where.id,
                  )?.inventoryItem
                    .name,
                active: true,
                stockQuantity:
                  stock.get(
                    where.id,
                  ) ?? 0,
              }),
          ),
        update: vi
          .fn()
          .mockImplementation(
            ({ where, data }) => {
              const amount =
                data.stockQuantity
                  .decrement as number;
              decrements.set(
                where.id,
                amount,
              );
              return Promise.resolve(
                {},
              );
            },
          ),
      },
      $queryRawUnsafe: vi
        .fn()
        .mockResolvedValue([]),
    };

    await reserveInventoryForOrder(
      tx,
      "order-quantities",
      [
        {
          productId: "combo",
          quantity: 1,
          modifiers: [
            {
              modifierOptionId:
                "included-lettuce",
              quantity: 3,
              removed: false,
            },
            {
              modifierOptionId:
                "extra-meat",
              quantity: 3,
              removed: false,
            },
          ],
        },
      ],
    );

    expect(
      Object.fromEntries(
        decrements,
      ),
    ).toEqual({
      lettuce: 3,
      meat: 3,
    });
  });

});
