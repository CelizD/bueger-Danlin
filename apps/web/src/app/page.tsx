import { OrderApp } from "../components/order-app";
import { getPublicPrivacyConfig } from "@/features/privacy/privacy-config";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <OrderApp
      privacy={getPublicPrivacyConfig()}
    />
  );
}
