import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const { buildOrderPdf, downloadOrderPdf } = await import("../../app/lib/orderPdf.ts");

const GENERATED_AT = new Date("2026-08-07T15:00:00Z");

function line(overrides = {}) {
  return {
    branch: "San Francisco",
    ingredient: "Mozzarella",
    supplier: "Distribuidora Central",
    unit: "kg",
    pack: "Caja 10 kg",
    ordered: 5,
    recommended: 8,
    ...overrides,
  };
}

// jsPDF keeps the drawing operators of every page as text, so the rendered
// labels can be asserted without parsing the binary output.
function pdfText(doc) {
  return doc.internal.pages
    .slice(1)
    .map((page) => page.join("\n"))
    .join("\n");
}

test("titles the document by scope and stamps the Panama date", () => {
  const doc = buildOrderPdf([line()], { branchLabel: "Todas las sucursales", generatedAt: GENERATED_AT });
  const text = pdfText(doc);

  assert.match(text, /Orden de compra corregida/);
  assert.match(text, /Alcance: Todas las sucursales/);
  assert.match(text, /SEMANA 7/);
  assert.match(text, /7 de agosto de 2026, 10:00/);
  assert.match(text, /P.gina 1 de 1/);
});

test("names the document after the supplier when the export is scoped to one", () => {
  const doc = buildOrderPdf([line()], {
    branchLabel: "San Francisco",
    supplier: "Distribuidora Central",
    generatedAt: GENERATED_AT,
  });

  assert.match(pdfText(doc), /Orden para Distribuidora Central/);
});

test("summarises suppliers, purchase lines, total formats and adjustments", () => {
  const doc = buildOrderPdf(
    [
      line({ ordered: 5, recommended: 8 }),
      line({ ingredient: "Harina", supplier: "Molinos del Istmo", ordered: 2, recommended: 2 }),
      line({ ingredient: "Sal", supplier: "Molinos del Istmo", ordered: 4, recommended: 0 }),
    ],
    { branchLabel: "Todas las sucursales", generatedAt: GENERATED_AT },
  );
  const text = pdfText(doc);

  assert.match(text, /PROVEEDORES/);
  assert.match(text, /L.NEAS A COMPRAR/);
  assert.match(text, /FORMATOS TOTALES/);
  assert.match(text, /AJUSTES/);
  // 2 suppliers with purchases, 2 purchase lines, 10 formats, 2 adjusted lines.
  const cardValues = [...text.matchAll(/\(([-\d]+)\) Tj/g)].map((match) => match[1]);
  assert.deepEqual(cardValues.slice(0, 4), ["2", "2", "10", "2"]);
});

test("excludes lines that must not be purchased and flags them as a review note", () => {
  const doc = buildOrderPdf(
    [line({ ingredient: "Sal", supplier: "Molinos del Istmo", ordered: 4, recommended: 0 })],
    { branchLabel: "Todas las sucursales", generatedAt: GENERATED_AT },
  );
  const text = pdfText(doc);

  assert.doesNotMatch(text, /Molinos del Istmo/);
  assert.match(text, /NOTA DE REVISI.N/);
  assert.match(text, /1 l.nea de la orden original queda en cero/);
});

test("pluralises the review note when several lines drop to zero", () => {
  const doc = buildOrderPdf(
    [
      line({ ingredient: "Sal", ordered: 4, recommended: 0 }),
      line({ ingredient: "Or.gano", ordered: 1, recommended: 0 }),
    ],
    { branchLabel: "Todas las sucursales", generatedAt: GENERATED_AT },
  );

  assert.match(pdfText(doc), /2 l.neas de la orden original quedan en cero/);
});

test("omits the review note when every ordered line is still purchased", () => {
  const doc = buildOrderPdf([line()], { branchLabel: "San Francisco", generatedAt: GENERATED_AT });

  assert.doesNotMatch(pdfText(doc), /NOTA DE REVISI.N/);
});

test("groups the detail per supplier and shows the adjustment against the original order", () => {
  const doc = buildOrderPdf(
    [
      line({ branch: "San Francisco", ingredient: "Mozzarella", ordered: 5, recommended: 8 }),
      line({ branch: "El Cangrejo", ingredient: "Pepperoni", supplier: "Carnes Premium", ordered: 4, recommended: 3 }),
      line({ branch: "Costa del Este", ingredient: "Harina", ordered: 2, recommended: 2 }),
    ],
    { branchLabel: "Todas las sucursales", generatedAt: GENERATED_AT },
  );
  const text = pdfText(doc);

  assert.match(text, /Carnes Premium/);
  assert.match(text, /Distribuidora Central/);
  // Suppliers are sorted alphabetically, so Carnes Premium precedes Distribuidora Central.
  assert.ok(text.indexOf("Carnes Premium") < text.indexOf("Distribuidora Central"));
  assert.match(text, /Ingrediente/);
  assert.match(text, /Recomendado/);
  assert.match(text, /\(\+3\) Tj/);
  assert.match(text, /\(-1\) Tj/);
  assert.match(text, /Sin cambio/);
});

test("adds pages and numbers them when the detail does not fit", () => {
  const many = Array.from({ length: 60 }, (_unused, index) =>
    line({ ingredient: `Ingrediente ${index}`, supplier: `Proveedor ${index % 6}` }),
  );
  const doc = buildOrderPdf(many, { branchLabel: "Todas las sucursales", generatedAt: GENERATED_AT });

  assert.ok(doc.getNumberOfPages() > 1, "expected the detail to span several pages");
  const text = pdfText(doc);
  for (let page = 1; page <= doc.getNumberOfPages(); page += 1) {
    assert.match(text, new RegExp(`P.gina ${page} de ${doc.getNumberOfPages()}`));
  }
});

test("moves the review note to a new page when the detail fills the last one", () => {
  const lines = [
    ...Array.from({ length: 27 }, (_unused, index) => line({ ingredient: `Ingrediente ${index}` })),
    line({ ingredient: "Sal", ordered: 4, recommended: 0 }),
  ];
  const doc = buildOrderPdf(lines, { branchLabel: "Todas las sucursales", generatedAt: GENERATED_AT });
  const pages = doc.internal.pages.slice(1).map((page) => page.join("\n"));

  assert.ok(pages.length > 1, "expected the detail to span several pages");
  assert.match(pages.at(-1), /NOTA DE REVISI.N/);
  assert.doesNotMatch(pages.at(-1), /Ingrediente \d/);
});

test("produces a valid PDF payload", () => {
  const doc = buildOrderPdf([line()], { branchLabel: "San Francisco", generatedAt: GENERATED_AT });
  const bytes = new Uint8Array(doc.output("arraybuffer"));

  assert.equal(new TextDecoder().decode(bytes.subarray(0, 5)), "%PDF-");
  assert.ok(bytes.byteLength > 1000);
});

// Outside the browser jsPDF writes `save()` to the working directory, so the
// download name can be asserted from a scratch directory.
test("downloads the corrected order with a slug that includes the supplier", async () => {
  const directory = await mkdtemp(join(tmpdir(), "barrio-order-pdf-"));
  const previousCwd = process.cwd();

  try {
    process.chdir(directory);
    downloadOrderPdf([line()], { branchLabel: "Todas las sucursales", generatedAt: GENERATED_AT });
    downloadOrderPdf([line()], {
      branchLabel: "San Francisco",
      supplier: "Importadora Mediterránea & Co.",
      generatedAt: GENERATED_AT,
    });

    assert.deepEqual((await readdir(directory)).sort(), [
      "orden-compra-corregida-importadora-mediterranea-co.pdf",
      "orden-compra-corregida.pdf",
    ]);
    const saved = await readFile(join(directory, "orden-compra-corregida.pdf"));
    assert.equal(saved.subarray(0, 5).toString(), "%PDF-");
  } finally {
    process.chdir(previousCwd);
    await rm(directory, { recursive: true, force: true });
  }
});
