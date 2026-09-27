import {
  describe,
  expect,
  it,
} from "vitest";
import { MetricsService } from "./metrics.service.js";

describe("MetricsService", () => {
  it("exports bounded HTTP labels and process/business metrics", () => {
    const service = new MetricsService();

    service.observeHttpRequest({
      method: "get",
      route: "/api/v1/orders/:orderCode",
      statusCode: 200,
      durationSeconds: 0.12,
    });

    const output = service.render({
      databaseUp: true,
      databaseLatencySeconds: 0.004,
      orderCounts: [
        {
          status: "DELIVERED",
          count: 12,
        },
      ],
      paymentCounts: [
        {
          status: "PAID",
          count: 10,
        },
      ],
      inventory: [
        {
          key: "meat",
          stockQuantity: 44,
          lowStockThreshold: 10,
        },
      ],
    });

    expect(output).toContain(
      'burger_http_requests_total{method="GET",route="/api/v1/orders/:orderCode",status="200"} 1',
    );
    expect(output).toContain(
      'burger_http_request_duration_seconds_bucket{method="GET",route="/api/v1/orders/:orderCode",status="200",le="0.25"} 1',
    );
    expect(output).toContain(
      "burger_database_up 1",
    );
    expect(output).toContain(
      'burger_orders{status="DELIVERED"} 12',
    );
    expect(output).toContain(
      'burger_inventory_stock{item="meat"} 44',
    );
  });
});
