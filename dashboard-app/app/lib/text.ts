const amountFormatter = new Intl.NumberFormat("es-PA", { maximumFractionDigits: 1 });

const dateTimeFormatter = new Intl.DateTimeFormat("es-PA", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "America/Panama",
});

/** Acentos y mayúsculas fuera, para comparar texto escrito por personas. */
export function plainText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function slugify(value: string) {
  return plainText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function formatAmount(value: number) {
  return amountFormatter.format(value);
}

export function formatDateTime(date: Date) {
  return dateTimeFormatter.format(date);
}
