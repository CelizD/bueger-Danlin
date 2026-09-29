export interface MercadoPagoCreateOrderBody {
  type: "online";
  processing_mode: "manual";
  capture_mode?: "automatic" | "automatic_async";
  total_amount: string;
  external_reference?: string;
  expiration_time?: string;
  description?: string;
  payer?: {
    email: string;
  };
  config?: {
    online?: {
      success_url?: string;
      failure_url?: string;
      pending_url?: string;
      auto_return?: "approved" | "all";
    };
  };
}

export interface MercadoPagoOrderResponse {
  id: string;
  status: string;
  status_detail?: string;
  checkout_url?: string;
  total_amount: string;
  total_paid_amount?: string;
  external_reference?: string;
  last_updated_date?: string;
}

export interface MercadoPagoCreateOrderInput {
  idempotencyKey: string;
  body: MercadoPagoCreateOrderBody;
}

export interface MercadoPagoRefundOrderInput {
  orderId: string;
  idempotencyKey: string;
}

export interface MercadoPagoRefundOrderResponse {
  id: string;
  status: string;
  status_detail?: string;
  transactions?: {
    refunds?: Array<{
      id?: string;
      transaction_id?: string;
      reference_id?: string;
      amount: string;
      status?: string;
    }>;
  };
}
