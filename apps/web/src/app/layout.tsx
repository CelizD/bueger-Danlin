import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Burger Danlin",
  description: "Pedidos de hamburguesas para entrega programada.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
