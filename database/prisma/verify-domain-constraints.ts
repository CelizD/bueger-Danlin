import "dotenv/config";
import pg from "pg";

const expectedConstraints = [
  "ck_user_failed_login_attempts_nonneg",
  "ck_user_mfa_last_used_step_nonneg",
  "ck_product_price_cents_nonneg",
  "ck_product_stock_quantity_nonneg",
  "ck_modifier_group_min_select_nonneg",
  "ck_modifier_group_max_select_gte_min",
  "ck_pickup_event_max_combos_positive",
  "ck_pickup_event_free_delivery_min_positive",
  "ck_pickup_event_free_delivery_min_lte_max",
  "ck_pickup_event_transport_cost_nonneg",
  "ck_pickup_event_final_paid_combos_nonneg",
  "ck_pickup_event_final_transport_cost_nonneg",
  "ck_pickup_event_final_assigned_nonneg",
  "ck_pickup_event_final_cancelled_pending_nonneg",
  "ck_pickup_event_telegram_paid_combos_nonneg",
  "ck_order_subtotal_cents_nonneg",
  "ck_order_total_cents_nonneg",
  "ck_order_combo_quantity_positive",
  "ck_order_group_min_paid_combos_positive",
  "ck_order_group_transport_cost_nonneg",
  "ck_order_group_paid_combos_nonneg",
  "ck_order_group_estimated_fee_nonneg",
  "ck_order_group_final_fee_nonneg",
  "ck_order_group_collected_fee_nonneg",
  "ck_order_item_unit_price_nonneg",
  "ck_order_item_quantity_positive",
  "ck_order_item_line_total_nonneg",
  "ck_order_item_modifier_quantity_positive",
  "ck_payment_amount_cents_nonneg",
  "ck_payment_webhook_attempt_count_nonneg",
  "ck_inventory_item_stock_quantity_nonneg",
  "ck_inventory_item_low_stock_threshold_nonneg",
  "ck_inventory_usage_quantity_positive",
  "ck_inventory_allocation_quantity_positive",
  "ck_email_notification_attempt_count_nonneg",
] as const;

async function main() {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    const result = await client.query<{
      conname: string;
      convalidated: boolean;
    }>(
      `
        SELECT conname, convalidated
        FROM pg_constraint
        WHERE contype = 'c'
          AND conname = ANY($1::text[])
      `,
      [expectedConstraints],
    );

    const found = new Map(
      result.rows.map((row) => [
        row.conname,
        row.convalidated,
      ]),
    );

    const missing = expectedConstraints.filter(
      (name) => !found.has(name),
    );
    const unvalidated = expectedConstraints.filter(
      (name) => found.get(name) === false,
    );

    if (missing.length > 0 || unvalidated.length > 0) {
      if (missing.length > 0) {
        console.error(
          `Missing CHECK constraints: ${missing.join(", ")}`,
        );
      }

      if (unvalidated.length > 0) {
        console.error(
          `Unvalidated CHECK constraints: ${unvalidated.join(", ")}`,
        );
      }

      process.exitCode = 1;
      return;
    }

    console.log(
      `Verified ${expectedConstraints.length} numeric domain CHECK constraints.`,
    );
  } finally {
    await client.end();
  }
}

void main();
