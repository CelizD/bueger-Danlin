-- Numeric domain invariants enforced at the PostgreSQL layer.
-- Keep these constraints even though Prisma schema.prisma cannot model CHECK constraints directly.

ALTER TABLE "User"
  ADD CONSTRAINT "ck_user_failed_login_attempts_nonneg"
    CHECK ("failedLoginAttempts" >= 0),
  ADD CONSTRAINT "ck_user_mfa_last_used_step_nonneg"
    CHECK ("mfaLastUsedStep" >= 0);

ALTER TABLE "Product"
  ADD CONSTRAINT "ck_product_price_cents_nonneg"
    CHECK ("priceCents" >= 0),
  ADD CONSTRAINT "ck_product_stock_quantity_nonneg"
    CHECK ("stockQuantity" >= 0);

ALTER TABLE "ModifierGroup"
  ADD CONSTRAINT "ck_modifier_group_min_select_nonneg"
    CHECK ("minSelect" >= 0),
  ADD CONSTRAINT "ck_modifier_group_max_select_gte_min"
    CHECK ("maxSelect" >= "minSelect");

ALTER TABLE "PickupEvent"
  ADD CONSTRAINT "ck_pickup_event_max_combos_positive"
    CHECK ("maxCombos" > 0),
  ADD CONSTRAINT "ck_pickup_event_free_delivery_min_positive"
    CHECK ("freeDeliveryMinPaidCombos" > 0),
  ADD CONSTRAINT "ck_pickup_event_free_delivery_min_lte_max"
    CHECK ("freeDeliveryMinPaidCombos" <= "maxCombos"),
  ADD CONSTRAINT "ck_pickup_event_transport_cost_nonneg"
    CHECK ("transportCostCents" >= 0),
  ADD CONSTRAINT "ck_pickup_event_final_paid_combos_nonneg"
    CHECK ("groupDeliveryFinalPaidCombos" >= 0),
  ADD CONSTRAINT "ck_pickup_event_final_transport_cost_nonneg"
    CHECK ("groupDeliveryFinalTransportCostCents" >= 0),
  ADD CONSTRAINT "ck_pickup_event_final_assigned_nonneg"
    CHECK ("groupDeliveryFinalAssignedCents" >= 0),
  ADD CONSTRAINT "ck_pickup_event_final_cancelled_pending_nonneg"
    CHECK ("groupDeliveryFinalCancelledPendingOrders" >= 0),
  ADD CONSTRAINT "ck_pickup_event_telegram_paid_combos_nonneg"
    CHECK ("telegramGroupCompletedPaidCombos" >= 0);

ALTER TABLE "Order"
  ADD CONSTRAINT "ck_order_subtotal_cents_nonneg"
    CHECK ("subtotalCents" >= 0),
  ADD CONSTRAINT "ck_order_total_cents_nonneg"
    CHECK ("totalCents" >= 0),
  ADD CONSTRAINT "ck_order_combo_quantity_positive"
    CHECK ("comboQuantity" > 0),
  ADD CONSTRAINT "ck_order_group_min_paid_combos_positive"
    CHECK ("groupDeliveryMinPaidCombosAtOrder" > 0),
  ADD CONSTRAINT "ck_order_group_transport_cost_nonneg"
    CHECK ("groupDeliveryTransportCostCentsAtOrder" >= 0),
  ADD CONSTRAINT "ck_order_group_paid_combos_nonneg"
    CHECK ("groupDeliveryPaidCombosAtOrder" >= 0),
  ADD CONSTRAINT "ck_order_group_estimated_fee_nonneg"
    CHECK ("groupDeliveryEstimatedFeeCentsAtOrder" >= 0),
  ADD CONSTRAINT "ck_order_group_final_fee_nonneg"
    CHECK ("groupDeliveryFinalFeeCents" >= 0),
  ADD CONSTRAINT "ck_order_group_collected_fee_nonneg"
    CHECK ("groupDeliveryFeeCollectedCents" >= 0);

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "ck_order_item_unit_price_nonneg"
    CHECK ("unitPriceCents" >= 0),
  ADD CONSTRAINT "ck_order_item_quantity_positive"
    CHECK ("quantity" > 0),
  ADD CONSTRAINT "ck_order_item_line_total_nonneg"
    CHECK ("lineTotalCents" >= 0);

ALTER TABLE "OrderItemModifier"
  ADD CONSTRAINT "ck_order_item_modifier_quantity_positive"
    CHECK ("quantity" > 0);

ALTER TABLE "Payment"
  ADD CONSTRAINT "ck_payment_amount_cents_nonneg"
    CHECK ("amountCents" >= 0);

ALTER TABLE "PaymentWebhookEvent"
  ADD CONSTRAINT "ck_payment_webhook_attempt_count_nonneg"
    CHECK ("attemptCount" >= 0);

ALTER TABLE "InventoryItem"
  ADD CONSTRAINT "ck_inventory_item_stock_quantity_nonneg"
    CHECK ("stockQuantity" >= 0),
  ADD CONSTRAINT "ck_inventory_item_low_stock_threshold_nonneg"
    CHECK ("lowStockThreshold" >= 0);

ALTER TABLE "InventoryUsage"
  ADD CONSTRAINT "ck_inventory_usage_quantity_positive"
    CHECK ("quantity" > 0);

ALTER TABLE "InventoryAllocation"
  ADD CONSTRAINT "ck_inventory_allocation_quantity_positive"
    CHECK ("quantity" > 0);

ALTER TABLE "EmailNotification"
  ADD CONSTRAINT "ck_email_notification_attempt_count_nonneg"
    CHECK ("attemptCount" >= 0);
