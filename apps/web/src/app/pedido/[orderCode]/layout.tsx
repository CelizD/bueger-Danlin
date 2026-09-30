import { SiteFooter } from "@/components/site-footer";
import { getPublicSellerConfig } from "@/features/seller/seller-config";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true,
  },
};

export default function CustomerOrderLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const seller =
    getPublicSellerConfig();

  return (
    <>
      {children}
      <SiteFooter seller={seller} />
    </>
  );
}
