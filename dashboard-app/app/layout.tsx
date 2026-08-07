import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Centro de compras | Barrio Pizza",
  description:
    "Dashboard administrativo para anticipar quiebres y corregir órdenes de compra.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Barrio · Centro de compras",
    description: "Órdenes correctas, alertas claras y menos desperdicio.",
    type: "website",
    images: [{ url: "/og.png", width: 1734, height: 907, alt: "Barrio Centro de compras" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Barrio · Centro de compras",
    description: "Órdenes correctas, alertas claras y menos desperdicio.",
    images: ["/og.png"],
  },
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
