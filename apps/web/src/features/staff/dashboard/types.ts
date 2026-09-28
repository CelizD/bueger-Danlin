import type { AdminDayPanelData } from "../components/admin-day-panel";

export type StaffUser = {
  sub: string;
  name: string;
  email: string;
  role: "ADMIN" | "KITCHEN" | "DELIVERY";
};

export type DashboardEvent = {
  id: string;
  code: string;
  name: string;
  locationLabel: string;
  startsAt: string;
  closesAt: string;
  status: string;
};

export type DashboardData = {
  filter: {
    pickupEventId: string | null;
    selectedEvent: DashboardEvent | null;
    events: DashboardEvent[];
  };
  day: AdminDayPanelData | null;
  metrics: {
    revenueCents: number;
    combosSold: number;
    cokesSold: number;
    averageTicketCents: number;
    effectiveOrders: number;
    cancelledOrders: number;
    refundedOrders: number;
    noShowOrders: number;
  };
  topExtras: Array<{
    name: string;
    quantity: number;
    revenueCents: number;
  }>;
  salesByEvent: Array<{
    id: string;
    code: string;
    name: string;
    startsAt: string;
    revenueCents: number;
    combosSold: number;
    paidOrders: number;
  }>;
};
