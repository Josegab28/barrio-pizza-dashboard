import { plainText } from "./text.ts";

export type LineStatus = "critical" | "warning" | "ok";

export type StatusLine = { status: LineStatus; deltaBase: number };
export type SupplierLine = { supplier: string; recommended: number };
export type BranchLine = { branch: string; ingredientId: string };

export type StatusCounts = { critical: number; warning: number; ok: number };

export type SupplierTotal = { supplier: string; formats: number; lines: number };

export type Mentions = { query: string; branch?: string; ingredient?: { ingrediente_id: string; nombre: string } };

/** Clave sucursal::ingrediente usada para cruzar catálogo, histórico, inventario y orden. */
export function lineKey(branch: string, ingredientId: string) {
  return `${branch}::${ingredientId}`;
}

export function rowKey(row: { sucursal: string; ingrediente_id: string }) {
  return lineKey(row.sucursal, row.ingrediente_id);
}

export function countByStatus(lines: StatusLine[]): StatusCounts {
  return lines.reduce<StatusCounts>(
    (counts, line) => {
      counts[line.status] += 1;
      return counts;
    },
    { critical: 0, warning: 0, ok: 0 },
  );
}

export function sumRecommended(lines: SupplierLine[]) {
  return lines.reduce((sum, line) => sum + line.recommended, 0);
}

/** Quiebres primero y, dentro de cada estado, la mayor desviación en unidad base. */
export function compareByUrgency(a: StatusLine, b: StatusLine) {
  if (a.status !== b.status) return a.status === "critical" ? -1 : 1;
  return Math.abs(b.deltaBase) - Math.abs(a.deltaBase);
}

export function groupBySupplier<T extends SupplierLine>(
  lines: T[],
  compareLines?: (a: T, b: T) => number,
): [string, T[]][] {
  const groups = new Map<string, T[]>();
  lines
    .filter((line) => line.recommended > 0)
    .forEach((line) => groups.set(line.supplier, [...(groups.get(line.supplier) ?? []), line]));
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "es"))
    .map(([supplier, group]) => [supplier, compareLines ? [...group].sort(compareLines) : group]);
}

/** Formatos recomendados por proveedor, del pedido más grande al más pequeño. */
export function summarizeBySupplier(lines: SupplierLine[]): SupplierTotal[] {
  return [...new Set(lines.map((line) => line.supplier))]
    .map((supplier) => {
      const supplierLines = lines.filter((line) => line.supplier === supplier);
      return {
        supplier,
        formats: sumRecommended(supplierLines),
        lines: supplierLines.filter((line) => line.recommended > 0).length,
      };
    })
    .sort((a, b) => b.formats - a.formats);
}

export function findMentions(
  question: string,
  branches: string[],
  ingredients: { ingrediente_id: string; nombre: string }[],
): Mentions {
  const query = plainText(question);
  return {
    query,
    branch: branches.find((branch) => query.includes(plainText(branch))),
    ingredient: ingredients.find((ingredient) => query.includes(plainText(ingredient.nombre))),
  };
}

export function matchesMentions(line: BranchLine, mentions: Mentions) {
  if (mentions.branch && line.branch !== mentions.branch) return false;
  if (mentions.ingredient && line.ingredientId !== mentions.ingredient.ingrediente_id) return false;
  return true;
}
