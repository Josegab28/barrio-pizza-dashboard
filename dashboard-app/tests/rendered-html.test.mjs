import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

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

test("keeps purchasing logic, data and social asset in the shipped project", async () => {
  const [dashboard, packageJson, ingredients, history, inventory, orders] = await Promise.all([
    readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
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
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.equal(ingredients.trim().split(/\r?\n/).length, 23);
  assert.equal(history.trim().split(/\r?\n/).length, 529);
  assert.equal(inventory.trim().split(/\r?\n/).length, 89);
  assert.equal(orders.trim().split(/\r?\n/).length, 89);
  await access(new URL("../public/og.png", import.meta.url));
});
