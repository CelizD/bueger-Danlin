export type StaffUser = {
  sub: string;
  name: string;
  email: string;
  role: "ADMIN" | "KITCHEN" | "DELIVERY";
};

export type DeliveryOrder = {
  id: string;
  orderCode: string;
  status: "READY" | "DELIVERED";
  comboQuantity: number;
  totalCents: number;
  deliveredAt?: string | null;
  customer: {
    name: string;
    phone: string;
    email: string | null;
  };
  pickupEvent: {
    locationLabel: string;
    startsAt: string;
  };
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
  }>;
};

export type ScanResult = DeliveryOrder & {
  alreadyDelivered: boolean;
};

export type DeliveryScanStatus = {
  kind: "success" | "warning";
  message: string;
  orderCode: string;
};
