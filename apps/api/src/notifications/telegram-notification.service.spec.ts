import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { TelegramNotificationService } from "./telegram-notification.service.js";

const original = {
  enabled: process.env.TELEGRAM_NOTIFICATIONS_ENABLED,
  token: process.env.TELEGRAM_BOT_TOKEN,
  chatId: process.env.TELEGRAM_CHAT_ID,
  groupCompleted: process.env.TELEGRAM_NOTIFY_GROUP_COMPLETED,
  groupClosed: process.env.TELEGRAM_NOTIFY_GROUP_CLOSED,
};

describe("TelegramNotificationService", () => {
  beforeEach(() => {
    process.env.TELEGRAM_NOTIFICATIONS_ENABLED = "true";
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.TELEGRAM_CHAT_ID = "12345";
  });

  afterEach(() => {
    vi.restoreAllMocks();

    for (const [key, value] of Object.entries({
      TELEGRAM_NOTIFICATIONS_ENABLED: original.enabled,
      TELEGRAM_BOT_TOKEN: original.token,
      TELEGRAM_CHAT_ID: original.chatId,
      TELEGRAM_NOTIFY_GROUP_COMPLETED: original.groupCompleted,
      TELEGRAM_NOTIFY_GROUP_CLOSED: original.groupClosed,
    })) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("envía un resumen sin PII del cliente", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ ok: true }),
          { status: 200 },
        ),
      );

    const service = new TelegramNotificationService();

    service.notifyOrderCreated({
      orderCode: "H-A1B2C3D4",
      comboQuantity: 2,
      totalCents: 26000,
      currency: "MXN",
      locationLabel: "Universidad",
    });

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const body = JSON.parse(
      String(fetchMock.mock.calls[0]?.[1]?.body),
    );

    expect(body.chat_id).toBe("12345");
    expect(body.text).toContain("H-A1B2C3D4");
    expect(body.text).toContain("Universidad");
    expect(body.text).not.toContain("cliente@example.com");
    expect(body.text).not.toContain("+52664");
  });

  it("envía resumen grupal sin PII y reporta éxito", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
        }),
      );

    const service = new TelegramNotificationService();

    const sent = await service.notifyGroupClosed({
      locationLabel: "Universidad",
      paidComboCount: 3,
      minPaidCombos: 5,
      transportCostCents: 10_000,
      assignedCents: 10_000,
      freeDeliveryUnlocked: false,
      cancelledPendingOrders: 1,
    });

    expect(sent).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const body = JSON.parse(
      String(fetchMock.mock.calls[0]?.[1]?.body),
    );

    expect(body.text).toContain("Universidad");
    expect(body.text).toContain("3 de 5");
    expect(body.text).toContain("Combos pagados");
    expect(body.text).toContain("$100.00");
    expect(body.text).toContain("cancelados: 1");
    expect(body.text).not.toContain("cliente@example.com");
    expect(body.text).not.toContain("+52664");
  });

  it("devuelve false si Telegram rechaza el aviso grupal", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("error", { status: 500 }),
    );

    const service = new TelegramNotificationService();

    await expect(
      service.notifyGroupCompleted({
        locationLabel: "Cucapá",
        paidComboCount: 5,
        minPaidCombos: 5,
      }),
    ).resolves.toBe(false);
  });

  it("no llama Telegram cuando está deshabilitado", () => {
    process.env.TELEGRAM_NOTIFICATIONS_ENABLED = "false";
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const service = new TelegramNotificationService();

    service.notifyTest();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
