import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type PdfOrderLine = {
  branch: string;
  ingredient: string;
  supplier: string;
  unit: string;
  pack: string;
  ordered: number;
  recommended: number;
};

type PdfOptions = {
  branchLabel: string;
  supplier?: string;
  generatedAt?: Date;
};

const COLORS = {
  ink: [23, 43, 37] as [number, number, number],
  tomato: [217, 74, 51] as [number, number, number],
  gold: [232, 173, 69] as [number, number, number],
  cream: [245, 241, 232] as [number, number, number],
  muted: [103, 119, 111] as [number, number, number],
  line: [222, 219, 209] as [number, number, number],
};

function safeFilename(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-PA", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Panama",
  }).format(date);
}

export function buildOrderPdf(allLines: PdfOrderLine[], options: PdfOptions) {
  const generatedAt = options.generatedAt ?? new Date();
  const purchaseLines = allLines.filter((line) => line.recommended > 0);
  const suppliers = [...new Set(purchaseLines.map((line) => line.supplier))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );
  const changedLines = allLines.filter((line) => line.ordered !== line.recommended).length;
  const removedLines = allLines.filter((line) => line.ordered > 0 && line.recommended === 0).length;
  const totalFormats = purchaseLines.reduce((sum, line) => sum + line.recommended, 0);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;

  doc.setFillColor(...COLORS.ink);
  doc.rect(0, 0, pageWidth, 42, "F");
  doc.setFillColor(...COLORS.tomato);
  doc.roundedRect(margin, 11, 14, 14, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("B", margin + 7, 20.3, { align: "center" });
  doc.setFontSize(8);
  doc.text("BARRIO PIZZA - CENTRO DE COMPRAS", margin + 20, 16);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(196, 210, 203);
  doc.setFontSize(7.5);
  doc.text("Orden preparada para revisión y envío al proveedor", margin + 20, 21.5);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("SEMANA 7", pageWidth - margin, 16, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(196, 210, 203);
  doc.setFontSize(7);
  doc.text(formatDate(generatedAt), pageWidth - margin, 21.5, { align: "right" });

  doc.setTextColor(...COLORS.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(options.supplier ? `Orden para ${options.supplier}` : "Orden de compra corregida", margin, 56);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.muted);
  doc.setFontSize(8.5);
  doc.text(`Alcance: ${options.branchLabel}. Cantidades expresadas en formatos completos.`, margin, 63);

  const cards = [
    ["PROVEEDORES", String(suppliers.length)],
    ["LÍNEAS A COMPRAR", String(purchaseLines.length)],
    ["FORMATOS TOTALES", String(totalFormats)],
    ["AJUSTES", String(changedLines)],
  ];
  const cardGap = 3;
  const cardWidth = (pageWidth - margin * 2 - cardGap * 3) / 4;
  cards.forEach(([label, value], index) => {
    const x = margin + index * (cardWidth + cardGap);
    doc.setFillColor(...COLORS.cream);
    doc.setDrawColor(...COLORS.line);
    doc.roundedRect(x, 70, cardWidth, 21, 2.4, 2.4, "FD");
    doc.setTextColor(...COLORS.muted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.7);
    doc.text(label, x + 4, 77);
    doc.setTextColor(...COLORS.ink);
    doc.setFontSize(13);
    doc.text(value, x + 4, 86);
  });

  let cursorY = 99;
  suppliers.forEach((supplier) => {
    const supplierLines = purchaseLines
      .filter((line) => line.supplier === supplier)
      .sort((a, b) => a.branch.localeCompare(b.branch, "es") || a.ingredient.localeCompare(b.ingredient, "es"));
    const estimatedSectionHeight = 18 + (supplierLines.length + 1) * 9.6;
    if (cursorY + estimatedSectionHeight > pageHeight - 17) {
      doc.addPage();
      cursorY = 18;
    }

    const supplierFormats = supplierLines.reduce((sum, line) => sum + line.recommended, 0);
    doc.setFillColor(...COLORS.ink);
    doc.roundedRect(margin, cursorY, pageWidth - margin * 2, 12, 2.5, 2.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(supplier, margin + 4, cursorY + 7.5);
    doc.setTextColor(239, 204, 132);
    doc.setFontSize(7.2);
    doc.text(`${supplierFormats} formatos`, pageWidth - margin - 4, cursorY + 7.5, { align: "right" });

    autoTable(doc, {
      startY: cursorY + 14,
      pageBreak: "avoid",
      margin: { left: margin, right: margin, bottom: 17 },
      head: [["Ingrediente", "Sucursal", "Formato", "Orden", "Recomendado", "Ajuste"]],
      body: supplierLines.map((line) => [
        line.ingredient,
        line.branch,
        line.pack,
        String(line.ordered),
        String(line.recommended),
        line.recommended === line.ordered
          ? "Sin cambio"
          : `${line.recommended > line.ordered ? "+" : ""}${line.recommended - line.ordered}`,
      ]),
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 7.1,
        cellPadding: 2.7,
        textColor: COLORS.ink,
        lineColor: COLORS.line,
        lineWidth: 0.15,
        valign: "middle",
      },
      headStyles: {
        fillColor: COLORS.cream,
        textColor: COLORS.muted,
        fontStyle: "bold",
        fontSize: 6.3,
      },
      alternateRowStyles: { fillColor: [252, 250, 245] },
      columnStyles: {
        0: { cellWidth: 38, fontStyle: "bold" },
        1: { cellWidth: 31 },
        2: { cellWidth: 47 },
        3: { cellWidth: 16, halign: "center" },
        4: { cellWidth: 22, halign: "center", fontStyle: "bold", textColor: COLORS.tomato },
        5: { cellWidth: 24, halign: "center" },
      },
    });
    cursorY = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY + 24) + 8;
  });

  if (removedLines > 0) {
    if (cursorY > pageHeight - 33) {
      doc.addPage();
      cursorY = 18;
    }
    doc.setFillColor(251, 242, 219);
    doc.setDrawColor(227, 197, 128);
    doc.roundedRect(margin, cursorY, pageWidth - margin * 2, 18, 2.4, 2.4, "FD");
    doc.setTextColor(114, 83, 23);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("NOTA DE REVISIÓN", margin + 4, cursorY + 6.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(
      `${removedLines} línea${removedLines === 1 ? "" : "s"} de la orden original queda${removedLines === 1 ? "" : "n"} en cero y no se incluye${removedLines === 1 ? "" : "n"} en la compra.`,
      margin + 4,
      cursorY + 12.5,
    );
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...COLORS.line);
    doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);
    doc.setTextColor(...COLORS.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text("Revisar y aprobar antes de enviar. Documento generado por Barrio Centro de Compras.", margin, pageHeight - 6.5);
    doc.text(`Página ${page} de ${pages}`, pageWidth - margin, pageHeight - 6.5, { align: "right" });
  }

  return doc;
}

export function downloadOrderPdf(lines: PdfOrderLine[], options: PdfOptions) {
  const doc = buildOrderPdf(lines, options);
  const suffix = options.supplier ? `-${safeFilename(options.supplier)}` : "";
  doc.save(`orden-compra-corregida${suffix}.pdf`);
}
