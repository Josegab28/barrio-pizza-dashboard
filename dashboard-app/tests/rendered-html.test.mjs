import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/", init = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, init),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("keeps the Gemini key on the server and falls back safely when it is absent", async () => {
  const response = await render("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question: "¿Dónde falta mozzarella?", context: "Datos de prueba" }),
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    code: "not_configured",
    error: "El asistente con IA todavía no tiene una clave configurada.",
  });
});

test("server-renders the Barrio dashboard shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="es">/i);
  assert.match(html, /<title>Centro de compras \| Barrio Pizza<\/title>/i);
  assert.match(html, /Preparando el centro de compras/);
  assert.match(html, /og:image/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("keeps purchasing logic, AI guardrails, PDF export, data and social asset in the shipped project", async () => {
  const [dashboard, chatRoute, pdfBuilder, packageJson, envExample, ingredients, history, inventory, orders] = await Promise.all([
    readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/orderPdf.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../public/datos/ingredientes.csv", import.meta.url), "utf8"),
    readFile(new URL("../public/datos/consumo_historico.csv", import.meta.url), "utf8"),
    readFile(new URL("../public/datos/inventario_actual.csv", import.meta.url), "utf8"),
    readFile(new URL("../public/datos/orden_compra_semana.csv", import.meta.url), "utf8"),
  ]);

  assert.match(dashboard, /function projectNextWeek/);
  assert.match(dashboard, /Math\.ceil\(need \/ packSize\)/);
  assert.match(dashboard, /missingOrders/);
  assert.match(dashboard, /orphanOrders/);
  assert.match(dashboard, /<BranchMap/);
  assert.match(dashboard, /downloadOrderPdf/);
  assert.match(dashboard, /buildChatContext/);
  assert.doesNotMatch(dashboard, /Cómo se toma cada decisión/);
  assert.doesNotMatch(dashboard, /label: "Método"/);
  assert.match(dashboard, /if \(!exists\)/);
  assert.match(dashboard, /ingrediente_id: ingredientId/);
  assert.match(dashboard, /slice\(0, 18\)/);
  assert.match(chatRoute, /store: false/);
  assert.match(chatRoute, /generativelanguage\.googleapis\.com\/v1\/interactions/);
  assert.match(chatRoute, /max_output_tokens: 180/);
  assert.match(chatRoute, /thinking_level: "minimal"/);
  assert.match(chatRoute, /MAX_REQUESTS_PER_MINUTE = 8/);
  assert.match(chatRoute, /controller\.abort\(\), 55_000/);
  assert.match(chatRoute, /billing_required/);
  assert.match(pdfBuilder, /Orden de compra corregida/);
  assert.match(pdfBuilder, /Página \$\{page\} de \$\{pages\}/);
  assert.match(packageJson, /jspdf-autotable/);
  assert.match(envExample, /GEMINI_API_KEY=/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.equal(ingredients.trim().split(/\r?\n/).length, 23);
  assert.equal(history.trim().split(/\r?\n/).length, 529);
  assert.equal(inventory.trim().split(/\r?\n/).length, 89);
  assert.equal(orders.trim().split(/\r?\n/).length, 89);
  await access(new URL("../public/og.png", import.meta.url));
});
