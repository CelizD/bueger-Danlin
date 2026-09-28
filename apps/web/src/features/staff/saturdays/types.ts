export type StaffUser = {
  sub: string;
  name: string;
  email: string;
  role: "ADMIN" | "KITCHEN" | "DELIVERY";
};

export type PickupEvent = {
  id: string;
  code: string;
  name: string;
  locationLabel: string;
  pickupPoint: {
    id: string;
    code: string;
    name: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    active: boolean;
  };
  timezone: string;
  startsAt: string;
  closesAt: string;
  maxCombos: number;
  status:
    | "DRAFT"
    | "OPEN"
    | "SOLD_OUT"
    | "CLOSED"
    | "COMPLETED"
    | "CANCELLED";
  paidCombos: number;
  pendingReservedCombos: number;
  reservedCombos: number;
  remainingCombos: number;
  orderCount: number;
  createdAt: string;
  updatedAt: string;
};

export type SaturdayFormState = {
  locationLabel: string;
  pickupDate: string;
  pickupTime: string;
  closeDate: string;
  closeTime: string;
  maxCombos: string;
};
