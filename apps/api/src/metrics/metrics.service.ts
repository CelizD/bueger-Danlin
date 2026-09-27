import { Injectable } from "@nestjs/common";

type MetricLabels = {
  method: string;
  route: string;
  status: string;
};

type HistogramState = {
  labels: MetricLabels;
  buckets: number[];
  count: number;
  sum: number;
};

export type MetricsSnapshot = {
  databaseUp: boolean;
  databaseLatencySeconds?: number;
  orderCounts?: Array<{
    status: string;
    count: number;
  }>;
  paymentCounts?: Array<{
    status: string;
    count: number;
  }>;
  inventory?: Array<{
    key: string;
    stockQuantity: number;
    lowStockThreshold: number;
  }>;
};

const HTTP_DURATION_BUCKETS = [
  0.05,
  0.1,
  0.25,
  0.5,
  1,
  2.5,
  5,
];

function escapeLabel(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll('"', '\\"');
}

function labelsText(labels: object) {
  return Object.entries(labels)
    .map(
      ([key, value]) =>
        `${key}="${escapeLabel(value)}"`,
    )
    .join(",");
}

function metricKey(labels: MetricLabels) {
  return [
    labels.method,
    labels.route,
    labels.status,
  ].join("\u0000");
}

function finite(value: number) {
  return Number.isFinite(value) ? value : 0;
}

@Injectable()
export class MetricsService {
  private readonly httpRequests = new Map<
    string,
    {
      labels: MetricLabels;
      count: number;
    }
  >();

  private readonly httpDuration = new Map<
    string,
    HistogramState
  >();

  observeHttpRequest(input: {
    method: string;
    route: string;
    statusCode: number;
    durationSeconds: number;
  }) {
    const labels: MetricLabels = {
      method: input.method.toUpperCase(),
      route: input.route,
      status: String(input.statusCode),
    };
    const key = metricKey(labels);

    const counter = this.httpRequests.get(key) ?? {
      labels,
      count: 0,
    };
    counter.count += 1;
    this.httpRequests.set(key, counter);

    const histogram = this.httpDuration.get(key) ?? {
      labels,
      buckets: HTTP_DURATION_BUCKETS.map(() => 0),
      count: 0,
      sum: 0,
    };

    const durationSeconds = Math.max(
      0,
      finite(input.durationSeconds),
    );

    for (
      let index = 0;
      index < HTTP_DURATION_BUCKETS.length;
      index += 1
    ) {
      if (
        durationSeconds <=
        HTTP_DURATION_BUCKETS[index]!
      ) {
        histogram.buckets[index] += 1;
      }
    }

    histogram.count += 1;
    histogram.sum += durationSeconds;
    this.httpDuration.set(key, histogram);
  }

  render(snapshot: MetricsSnapshot) {
    const lines: string[] = [];

    lines.push(
      "# HELP burger_http_requests_total Total HTTP requests handled by the API.",
      "# TYPE burger_http_requests_total counter",
    );

    for (const { labels, count } of this.httpRequests.values()) {
      lines.push(
        `burger_http_requests_total{${labelsText(labels)}} ${count}`,
      );
    }

    lines.push(
      "# HELP burger_http_request_duration_seconds HTTP request duration in seconds.",
      "# TYPE burger_http_request_duration_seconds histogram",
    );

    for (const histogram of this.httpDuration.values()) {
      const baseLabels = labelsText(
        histogram.labels,
      );

      HTTP_DURATION_BUCKETS.forEach(
        (bucket, index) => {
          lines.push(
            `burger_http_request_duration_seconds_bucket{${baseLabels},le="${bucket}"} ${histogram.buckets[index]}`,
          );
        },
      );

      lines.push(
        `burger_http_request_duration_seconds_bucket{${baseLabels},le="+Inf"} ${histogram.count}`,
        `burger_http_request_duration_seconds_sum{${baseLabels}} ${histogram.sum}`,
        `burger_http_request_duration_seconds_count{${baseLabels}} ${histogram.count}`,
      );
    }

    const memory = process.memoryUsage();

    lines.push(
      "# HELP burger_process_resident_memory_bytes Resident memory used by the API process.",
      "# TYPE burger_process_resident_memory_bytes gauge",
      `burger_process_resident_memory_bytes ${memory.rss}`,
      "# HELP burger_process_heap_used_bytes V8 heap currently used by the API process.",
      "# TYPE burger_process_heap_used_bytes gauge",
      `burger_process_heap_used_bytes ${memory.heapUsed}`,
      "# HELP burger_process_uptime_seconds API process uptime.",
      "# TYPE burger_process_uptime_seconds gauge",
      `burger_process_uptime_seconds ${process.uptime()}`,
      "# HELP burger_database_up Whether PostgreSQL is reachable from the API.",
      "# TYPE burger_database_up gauge",
      `burger_database_up ${snapshot.databaseUp ? 1 : 0}`,
    );

    if (
      snapshot.databaseLatencySeconds !== undefined
    ) {
      lines.push(
        "# HELP burger_database_ping_seconds PostgreSQL SELECT 1 latency.",
        "# TYPE burger_database_ping_seconds gauge",
        `burger_database_ping_seconds ${finite(snapshot.databaseLatencySeconds)}`,
      );
    }

    lines.push(
      "# HELP burger_orders Current orders grouped by status.",
      "# TYPE burger_orders gauge",
    );
    for (const item of snapshot.orderCounts ?? []) {
      lines.push(
        `burger_orders{status="${escapeLabel(item.status)}"} ${item.count}`,
      );
    }

    lines.push(
      "# HELP burger_payments Current payments grouped by status.",
      "# TYPE burger_payments gauge",
    );
    for (const item of snapshot.paymentCounts ?? []) {
      lines.push(
        `burger_payments{status="${escapeLabel(item.status)}"} ${item.count}`,
      );
    }

    lines.push(
      "# HELP burger_inventory_stock Current inventory stock quantity.",
      "# TYPE burger_inventory_stock gauge",
      "# HELP burger_inventory_low_stock_threshold Configured low-stock threshold.",
      "# TYPE burger_inventory_low_stock_threshold gauge",
    );
    for (const item of snapshot.inventory ?? []) {
      const labels = labelsText({
        item: item.key,
      });

      lines.push(
        `burger_inventory_stock{${labels}} ${item.stockQuantity}`,
        `burger_inventory_low_stock_threshold{${labels}} ${item.lowStockThreshold}`,
      );
    }

    return `${lines.join("\n")}\n`;
  }
}
