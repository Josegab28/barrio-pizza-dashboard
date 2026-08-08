import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildOrderPdf } from "../app/lib/orderPdf.ts";

const lines = [
  ["San Francisco", "Mozzarella", "Distribuidora Central", "kg", "Caja 10 kg", 5, 8],
  ["Costa del Este", "Mozzarella", "Distribuidora Central", "kg", "Caja 10 kg", 7, 7],
  ["Brisas del Golf", "Harina", "Distribuidora Central", "kg", "Saco 25 kg", 2, 4],
  ["El Cangrejo", "Salsa de tomate", "Distribuidora Central", "L", "Caja 12 L", 5, 6],
  ["San Francisco", "Pepperoni", "Carnes Premium", "kg", "Caja 5 kg", 3, 4],
  ["Costa del Este", "Jamón", "Carnes Premium", "kg", "Caja 5 kg", 4, 3],
  ["Brisas del Golf", "Tocineta", "Carnes Premium", "kg", "Caja 4 kg", 2, 3],
  ["El Cangrejo", "Pollo", "Carnes Premium", "kg", "Caja 5 kg", 1, 2],
  ["San Francisco", "Pimentón", "Frescos del Istmo", "kg", "Canasta 6 kg", 2, 3],
  ["Costa del Este", "Cebolla", "Frescos del Istmo", "kg", "Saco 10 kg", 3, 3],
  ["Brisas del Golf", "Hongos", "Frescos del Istmo", "kg", "Caja 4 kg", 1, 2],
  ["El Cangrejo", "Albahaca", "Frescos del Istmo", "kg", "Caja 2 kg", 2, 1],
  ["San Francisco", "Aceite de oliva", "Importadora Mediterránea", "L", "Caja 6 L", 2, 3],
  ["Costa del Este", "Aceitunas", "Importadora Mediterránea", "kg", "Caja 4 kg", 1, 2],
  ["Brisas del Golf", "Orégano", "Importadora Mediterránea", "kg", "Caja 1 kg", 2, 2],
  ["El Cangrejo", "Levadura", "Panamá Food Service", "kg", "Caja 2 kg", 1, 2],
  ["San Francisco", "Sal", "Panamá Food Service", "kg", "Saco 10 kg", 1, 0],
].map(([branch, ingredient, supplier, unit, pack, ordered, recommended]) => ({
  branch,
  ingredient,
  supplier,
  unit,
  pack,
  ordered,
  recommended,
}));

const outputDir = fileURLToPath(new URL("../output/pdf/", import.meta.url));
await mkdir(outputDir, { recursive: true });
const outputPath = fileURLToPath(new URL("../output/pdf/orden-compra-corregida-muestra.pdf", import.meta.url));
const document = buildOrderPdf(lines, {
  branchLabel: "Todas las sucursales",
  generatedAt: new Date("2026-08-07T10:00:00-05:00"),
});
await writeFile(outputPath, Buffer.from(document.output("arraybuffer")));
console.log(outputPath);
