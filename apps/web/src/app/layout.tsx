import { ClientErrorObserver } from "@/components/observability/client-error-observer";
import { WebVitals } from "@/components/observability/web-vitals";
import type { Metadata } from "next";
import { connection } from "next/server";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Burger Danlin",
    template: "%s | Burger Danlin",
  },
  description: "Hamburguesas por pedido con entrega programada.",
  applicationName: "Burger Danlin",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "es_MX",
    siteName: "Burger Danlin",
    title: "Burger Danlin",
    description: "Hamburguesas por pedido con entrega programada.",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // A request-scoped CSP nonce requires dynamic rendering so Next.js can
  // attach the nonce to framework and page scripts for every response.
  await connection();

  return (
    <html lang="es">
      <body>
        <WebVitals />
        <ClientErrorObserver />
        <a className="skip-link" href="#main-content">
          Saltar al contenido
        </a>
        <div id="main-content" tabIndex={-1}>
          {children}
        </div>
      </body>
    </html>
  );
}
