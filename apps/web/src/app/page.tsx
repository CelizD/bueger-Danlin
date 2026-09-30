import { SiteFooter } from "@/components/site-footer";
import { getPublicPrivacyConfig } from "@/features/privacy/privacy-config";
import { getPublicSellerConfig } from "@/features/seller/seller-config";
import { OrderApp } from "../components/order-app";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const seller =
    getPublicSellerConfig();

  return (
    <>
      <OrderApp
        privacy={getPublicPrivacyConfig()}
        seller={seller}
      />
      <SiteFooter seller={seller} />
    </>
  );
}
