import type { Metadata } from "next";
import { Dashboard } from "./Dashboard";

export const metadata: Metadata = {
  title: "Centro de compras | Barrio Pizza",
  description:
    "Revisión inteligente de órdenes de compra, inventario y consumo por sucursal.",
};

export default function Home() {
  return <Dashboard />;
}
