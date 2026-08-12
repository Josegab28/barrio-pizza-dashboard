"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { BranchMap, type BranchMapStat } from "./BranchMap";
import { downloadOrderPdf } from "./lib/orderPdf";
import {
  compareByUrgency,
  countByStatus,
  findMentions,
  groupBySupplier,
  lineKey,
  matchesMentions,
  rowKey,
  summarizeBySupplier,
  sumRecommended,
  type LineStatus,
} from "./lib/orderLines";
import { formatAmount, plainText } from "./lib/text";

type Ingredient = {
  ingrediente_id: string;
  nombre: string;
  proveedor: string;
  unidad_base: string;
  formato_compra: string;
  unidad_base_por_formato: string;
  es_perecedero: string;
};

type Consumption = {
  sucursal: string;
  ingrediente_id: string;
  semana: string;
  consumo_unidad_base: string;
};

type Inventory = {
  sucursal: string;
  ingrediente_id: string;
  stock_actual_unidad_base: string;
};

type Order = {
  sucursal: string;
  ingrediente_id: string;
  cantidad_formatos: string;
};

type Line = {
  branch: string;
  ingredientId: string;
  ingredient: string;
  supplier: string;
  unit: string;
  pack: string;
  perishable: boolean;
  projected: number;
  stock: number;
  need: number;
  ordered: number;
  recommended: number;
  orderedBase: number;
  deltaBase: number;
  status: LineStatus;
};

type View = "overview" | "orders" | "data";
type ChatMessage = { role: "assistant" | "user"; text: string; source?: "ai" | "local" };

const navItems: { id: View; label: string; icon: string }[] = [
  { id: "overview", label: "Resumen", icon: "◫" },
  { id: "orders", label: "Pedido corregido", icon: "▤" },
  { id: "data", label: "Datos y edición", icon: "⌁" },
];

function parseCsv<T>(text: string): T[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    if (char === '"' && quoted && normalized[i + 1] === '"') {
      field += '"';
      i += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      row.push(field.trim());
      field = "";
    } else if (char === "\n" && !quoted) {
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field || row.length) {
    row.push(field.trim());
    rows.push(row);
  }
  const headers = rows.shift() ?? [];
  return rows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])) as T,
  );
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function projectNextWeek(values: number[]) {
  if (!values.length) return 0;
  const center = median(values);
  const mad = median(values.map((value) => Math.abs(value - center)));
  const cleaned = values.map((value) => {
    if (mad === 0) return value;
    const limit = 2.5 * mad;
    return Math.max(center - limit, Math.min(center + limit, value));
  });
  const weights = [1, 1, 2, 2, 3, 4].slice(-cleaned.length);
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const recent = cleaned.reduce((sum, value, index) => sum + value * weights[index], 0) / weightTotal;
  const xAverage = (cleaned.length + 1) / 2;
  const yAverage = cleaned.reduce((sum, value) => sum + value, 0) / cleaned.length;
  const slopeNumerator = cleaned.reduce(
    (sum, value, index) => sum + (index + 1 - xAverage) * (value - yAverage),
    0,
  );
  const slopeDenominator = cleaned.reduce(
    (sum, _value, index) => sum + (index + 1 - xAverage) ** 2,
    0,
  );
  const slope = slopeDenominator ? slopeNumerator / slopeDenominator : 0;
  const trend = Math.max(-recent * 0.15, Math.min(recent * 0.15, slope * 1.5));
  return Math.max(0, recent + trend);
}

const DEMO_EMAIL = "admin@barriopizza.com";
const DEMO_PASSWORD = "barrio2026";
const DEMO_ACCESS_KEY = "barrio-demo-access";
const UNIT_ORDER = ["kg", "L", "und"];

const demoAccessListeners = new Set<() => void>();

function subscribeDemoAccess(listener: () => void) {
  demoAccessListeners.add(listener);
  return () => demoAccessListeners.delete(listener);
}

function readDemoAccess() {
  return sessionStorage.getItem(DEMO_ACCESS_KEY) === "active";
}

function writeDemoAccess(active: boolean) {
  if (active) sessionStorage.setItem(DEMO_ACCESS_KEY, "active");
  else sessionStorage.removeItem(DEMO_ACCESS_KEY);
  demoAccessListeners.forEach((listener) => listener());
}

export function Dashboard() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [consumption, setConsumption] = useState<Consumption[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [initialOrders, setInitialOrders] = useState<Order[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("Todas");
  const [view, setView] = useState<View>("overview");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState(DEMO_EMAIL);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Hola, soy tu analista de compras. Pregúntame dónde hay riesgo de quiebre, qué se está pidiendo de más o cómo queda el pedido por proveedor.",
    },
  ]);
  const uploadRef = useRef<HTMLInputElement>(null);
  const aiRequestCount = useRef(0);

  const demoAccess = useSyncExternalStore(subscribeDemoAccess, readDemoAccess, () => null);

  useEffect(() => {
    if (!demoAccess) return;
    Promise.all(
      ["ingredientes", "consumo_historico", "inventario_actual", "orden_compra_semana"].map(
        async (name) => {
          const response = await fetch(`/datos/${name}.csv`);
          if (!response.ok) throw new Error(`No se pudo cargar ${name}.csv`);
          return response.text();
        },
      ),
    )
      .then(([ingredientText, consumptionText, inventoryText, orderText]) => {
        const loadedOrders = parseCsv<Order>(orderText);
        setIngredients(parseCsv<Ingredient>(ingredientText));
        setConsumption(parseCsv<Consumption>(consumptionText));
        setInventory(parseCsv<Inventory>(inventoryText));
        setOrders(loadedOrders);
        setInitialOrders(loadedOrders);
      })
      .catch((error: Error) => setLoadError(error.message))
      .finally(() => setLoading(false));
  }, [demoAccess]);

  const lines = useMemo<Line[]>(() => {
    const ingredientMap = new Map(ingredients.map((item) => [item.ingrediente_id, item]));
    const history = new Map<string, number[]>();
    consumption.forEach((item) => {
      const key = rowKey(item);
      const current = history.get(key) ?? [];
      current.push(Number(item.consumo_unidad_base));
      history.set(key, current);
    });
    const orderMap = new Map(orders.map((item) => [rowKey(item), Number(item.cantidad_formatos)]));
    return inventory.map((item) => {
      const key = rowKey(item);
      const ingredient = ingredientMap.get(item.ingrediente_id)!;
      const projected = projectNextWeek(history.get(key) ?? []);
      const stock = Number(item.stock_actual_unidad_base);
      const need = Math.max(0, projected - stock);
      const packSize = Number(ingredient.unidad_base_por_formato);
      const recommended = need > 0 ? Math.ceil(need / packSize) : 0;
      const ordered = orderMap.get(key) ?? 0;
      const orderedBase = ordered * packSize;
      const status: LineStatus =
        orderedBase + 0.0001 < need ? "critical" : ordered > recommended ? "warning" : "ok";
      return {
        branch: item.sucursal,
        ingredientId: item.ingrediente_id,
        ingredient: ingredient.nombre,
        supplier: ingredient.proveedor,
        unit: ingredient.unidad_base,
        pack: ingredient.formato_compra,
        perishable: plainText(ingredient.es_perecedero) === "si",
        projected,
        stock,
        need,
        ordered,
        recommended,
        orderedBase,
        deltaBase: orderedBase - need,
        status,
      };
    });
  }, [ingredients, consumption, inventory, orders]);

  const branches = useMemo(() => [...new Set(lines.map((line) => line.branch))], [lines]);
  const dataGaps = useMemo(() => {
    const inventoryKeys = new Set(inventory.map(rowKey));
    const orderKeys = new Set(orders.map(rowKey));
    return {
      missingOrders: inventory.filter((item) => !orderKeys.has(rowKey(item))),
      orphanOrders: orders.filter((item) => !inventoryKeys.has(rowKey(item))),
    };
  }, [inventory, orders]);
  const visibleLines = useMemo(
    () => (selectedBranch === "Todas" ? lines : lines.filter((line) => line.branch === selectedBranch)),
    [lines, selectedBranch],
  );
  const issues = useMemo(
    () => visibleLines.filter((line) => line.status !== "ok").sort(compareByUrgency),
    [visibleLines],
  );

  const branchStats = useMemo<BranchMapStat[]>(
    () =>
      branches.map((branch) => {
        const branchLines = lines.filter((line) => line.branch === branch);
        const stockByUnit = branchLines.reduce((summary, line) => {
          summary.set(line.unit, (summary.get(line.unit) ?? 0) + line.stock);
          return summary;
        }, new Map<string, number>());
        const stockSummary =
          [...stockByUnit.entries()]
            .sort(([a], [b]) => {
              const rankA = UNIT_ORDER.indexOf(a);
              const rankB = UNIT_ORDER.indexOf(b);
              if (rankA !== rankB) return (rankA + 1 || UNIT_ORDER.length + 1) - (rankB + 1 || UNIT_ORDER.length + 1);
              return a.localeCompare(b);
            })
            .map(([unit, total]) => `${formatAmount(total)} ${unit}`)
            .join(" · ") || "sin datos";
        const counts = countByStatus(branchLines);
        return {
          name: branch,
          critical: counts.critical,
          excess: counts.warning,
          correct: counts.ok,
          stockSummary,
        };
      }),
    [branches, lines],
  );

  const totals = useMemo(() => {
    const counts = countByStatus(visibleLines);
    const formatsToAdjust = visibleLines.reduce(
      (sum, line) => sum + Math.abs(line.ordered - line.recommended),
      0,
    );
    return { critical: counts.critical, excess: counts.warning, correct: counts.ok, formatsToAdjust };
  }, [visibleLines]);

  const supplierGroups = useMemo(() => groupBySupplier(visibleLines), [visibleLines]);

  const setBranch = useCallback((branch: string) => {
    setSelectedBranch(branch);
    setView("overview");
  }, []);

  function updateOrder(branch: string, ingredientId: string, value: number) {
    const nextValue = String(Math.max(0, Math.floor(value || 0)));
    setOrders((current) => {
      const exists = current.some(
        (order) => order.sucursal === branch && order.ingrediente_id === ingredientId,
      );
      if (!exists) {
        return [
          ...current,
          { sucursal: branch, ingrediente_id: ingredientId, cantidad_formatos: nextValue },
        ];
      }
      return current.map((order) =>
        order.sucursal === branch && order.ingrediente_id === ingredientId
          ? { ...order, cantidad_formatos: nextValue }
          : order,
      );
    });
  }

  function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    void file.text().then((text) => {
      const next = parseCsv<Order>(text);
      const valid = next.length > 0 && next.every((row) => row.sucursal && row.ingrediente_id && row.cantidad_formatos !== "");
      if (!valid) {
        setToast("El CSV no contiene las columnas esperadas.");
        return;
      }
      const knownKeys = new Set(inventory.map(rowKey));
      if (next.some((row) => !knownKeys.has(rowKey(row)))) {
        setToast("El archivo contiene sucursales o ingredientes desconocidos.");
        return;
      }
      setOrders(next);
      setToast(`Orden actualizada: ${next.length} líneas procesadas.`);
      event.target.value = "";
    });
  }

  function downloadCorrectedOrder() {
    const csv = [
      "sucursal,ingrediente_id,cantidad_formatos",
      ...lines.map((line) => `${line.branch},${line.ingredientId},${line.recommended}`),
    ].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = "orden_compra_corregida.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function localDataAnswer(question: string) {
    const mentions = findMentions(question, branches, ingredients);
    const { query, branch: mentionedBranch, ingredient: mentionedIngredient } = mentions;
    const candidates = lines.filter((line) => matchesMentions(line, mentions));
    let answer = "";

    if (/demasiado|exceso|sobrepedido|sobre pedido|de mas/.test(query)) {
      const over = candidates
        .filter((line) => line.status === "warning")
        .sort((a, b) => b.deltaBase - a.deltaBase);
      answer = over.length
        ? `${over[0].branch} concentra el mayor sobrepedido: ${over[0].ingredient}. Ordenó ${over[0].ordered} formatos y recomiendo ${over[0].recommended}; son ${formatAmount(over[0].deltaBase)} ${over[0].unit} por encima de la necesidad.`
        : "No encuentro sobrepedidos con esos filtros. El redondeo menor a un formato se considera normal.";
    } else if (/quiebre|falta|riesgo|menos|olvid/.test(query)) {
      const short = candidates
        .filter((line) => line.status === "critical")
        .sort((a, b) => a.deltaBase - b.deltaBase);
      answer = short.length
        ? `El riesgo más alto está en ${short[0].branch}: faltan ${formatAmount(Math.abs(short[0].deltaBase))} ${short[0].unit} de ${short[0].ingredient}. La orden tiene ${short[0].ordered} formatos y debería tener ${short[0].recommended}.`
        : "No encuentro riesgos de quiebre con esos filtros.";
    } else if (/proveedor|proveedores/.test(query)) {
      const provider = summarizeBySupplier(candidates)[0];
      answer = provider
        ? `${provider.supplier} recibe el pedido corregido más grande: ${provider.formats} formatos en total. Puedes abrir “Pedido corregido” para ver el detalle listo para exportar.`
        : "No hay pedidos recomendados para ese filtro.";
    } else if (mentionedBranch || mentionedIngredient) {
      const counts = countByStatus(candidates);
      answer = `Para ${mentionedBranch ?? mentionedIngredient?.nombre}: veo ${counts.critical} riesgos de quiebre, ${counts.warning} sobrepedidos y ${counts.ok} líneas correctas.`;
    } else {
      const counts = countByStatus(lines);
      answer = `Esta semana hay ${counts.critical} riesgos de quiebre y ${counts.warning} sobrepedidos. Prueba: “¿dónde falta mozzarella?” o “¿qué sucursal pide demasiado?”.`;
    }
    return answer;
  }

  function buildChatContext(question: string) {
    const mentions = findMentions(question, branches, ingredients);
    const hasMention = Boolean(mentions.branch || mentions.ingredient);
    const relevant = lines
      .filter((line) => matchesMentions(line, mentions) && (hasMention || line.status !== "ok"))
      .sort(compareByUrgency)
      .slice(0, 18)
      .map((line) => ({
        sucursal: line.branch,
        ingrediente: line.ingredient,
        proveedor: line.supplier,
        formato: line.pack,
        unidad: line.unit,
        proyeccion: Number(line.projected.toFixed(1)),
        stock: line.stock,
        necesidad: Number(line.need.toFixed(1)),
        ordenado_formatos: line.ordered,
        recomendado_formatos: line.recommended,
        diferencia_unidad_base: Number(line.deltaBase.toFixed(1)),
        estado: line.status === "critical" ? "quiebre" : line.status === "warning" ? "sobrepedido" : "correcto",
      }));

    const supplierSummary = summarizeBySupplier(lines).map((total) => ({
      proveedor: total.supplier,
      formatos_recomendados: total.formats,
      lineas: total.lines,
    }));
    const counts = countByStatus(lines);

    return JSON.stringify({
      periodo: "semana 7",
      resumen_global: {
        riesgos_quiebre: counts.critical,
        sobrepedidos: counts.warning,
        lineas_correctas: counts.ok,
      },
      sucursales: branchStats,
      proveedores: supplierSummary,
      calidad_datos: {
        lineas_omitidas_en_orden: dataGaps.missingOrders.length,
        lineas_sin_inventario_historico: dataGaps.orphanOrders.length,
      },
      detalle_relevante: relevant,
      nota: "Las cifras provienen del motor de reglas; la IA solo debe explicarlas.",
    });
  }

  async function askData(question: string) {
    if (chatLoading) return;
    const cleanQuestion = question.trim().slice(0, 280);
    if (!cleanQuestion) return;

    setMessages((current) => [...current, { role: "user", text: cleanQuestion }]);
    setChatLoading(true);

    const fallback = (reason?: string) => {
      const answer = localDataAnswer(cleanQuestion);
      setMessages((current) => [
        ...current,
        { role: "assistant", text: answer, source: "local" },
      ]);
      if (reason) setToast(reason);
    };

    try {
      if (aiRequestCount.current >= 8) {
        fallback("Se alcanzó el límite de 8 consultas con IA de esta sesión. El respaldo local sigue activo.");
        return;
      }
      aiRequestCount.current += 1;
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: cleanQuestion, context: buildChatContext(cleanQuestion) }),
      });
      const payload = (await response.json()) as { answer?: string; code?: string; error?: string };
      if (!response.ok || !payload.answer) throw new Error(payload.code ?? "chat_error");
      setMessages((current) => [
        ...current,
        { role: "assistant", text: payload.answer!, source: "ai" },
      ]);
    } catch (error) {
      const code = error instanceof Error ? error.message : "chat_error";
      const notice = code === "billing_required"
        ? "La cuenta de Gemini no tiene créditos disponibles. Agrega saldo en AI Studio o usa una clave de un proyecto con Free Tier."
        : code === "rate_limited"
          ? "Gemini alcanzó el límite temporal. Se usó el respaldo local; intenta de nuevo en un minuto."
          : code === "timeout"
            ? "Gemini tardó demasiado. Se usó el respaldo local; puedes volver a intentarlo."
            : "Gemini no pudo responder. Se usó el respaldo local y puedes volver a intentarlo.";
      fallback(notice);
    } finally {
      setChatLoading(false);
    }
  }

  function submitChat(event: React.FormEvent) {
    event.preventDefault();
    if (!chatInput.trim()) return;
    void askData(chatInput.trim());
    setChatInput("");
  }

  function submitDemoLogin(event: React.FormEvent) {
    event.preventDefault();
    if (loginEmail.trim().toLowerCase() !== DEMO_EMAIL || loginPassword !== DEMO_PASSWORD) {
      setLoginError("Revisa las credenciales de demostración.");
      return;
    }
    setLoginError("");
    writeDemoAccess(true);
  }

  function closeDemoSession() {
    setLoginPassword("");
    setOrders(initialOrders);
    setSelectedBranch("Todas");
    setView("overview");
    writeDemoAccess(false);
  }

  if (demoAccess === null) {
    return (
      <main className="loading-screen">
        <div className="pizza-loader">B</div>
        <p>Preparando el centro de compras…</p>
      </main>
    );
  }

  if (!demoAccess) {
    return (
      <main className="demo-login-shell">
        <section className="demo-login-brand" aria-label="Barrio Pizza Centro de compras">
          <div className="demo-login-logo">B</div>
          <span>CENTRO DE COMPRAS</span>
          <h1>Decisiones de compra más claras para cada sucursal.</h1>
          <p>Inventario, proyección y órdenes semanales en un solo lugar.</p>
          <div className="demo-login-features">
            <span>✓ Riesgos de quiebre</span>
            <span>✓ Pedido por proveedor</span>
            <span>✓ Asistente con Gemini</span>
          </div>
        </section>
        <section className="demo-login-panel">
          <form className="demo-login-card" onSubmit={submitDemoLogin}>
            <span className="demo-pill">ACCESO DE DEMOSTRACIÓN</span>
            <h2>Bienvenido</h2>
            <p>Ingresa con las credenciales del entorno de prueba.</p>
            <label>
              <span>Correo</span>
              <input
                type="email"
                value={loginEmail}
                onChange={(event) => {
                  setLoginEmail(event.target.value);
                  setLoginError("");
                }}
                autoComplete="username"
                required
              />
            </label>
            <label>
              <span>Contraseña</span>
              <input
                type="password"
                value={loginPassword}
                onChange={(event) => {
                  setLoginPassword(event.target.value);
                  setLoginError("");
                }}
                autoComplete="current-password"
                placeholder="Ingresa la contraseña demo"
                required
              />
            </label>
            {loginError && <div className="demo-login-error" role="alert">{loginError}</div>}
            <button type="submit">Entrar al dashboard →</button>
            <div className="demo-credentials">
              <small>CREDENCIALES DEMO</small>
              <span>{DEMO_EMAIL}</span>
              <span>Contraseña: {DEMO_PASSWORD}</span>
            </div>
            <p className="demo-disclaimer">Acceso visual para fines de demostración. No reemplaza un sistema de autenticación de producción.</p>
          </form>
        </section>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="loading-screen">
        <div className="pizza-loader">B</div>
        <p>Preparando el centro de compras…</p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="loading-screen error-screen">
        <div className="pizza-loader">!</div>
        <h1>No pudimos cargar los datos</h1>
        <p>{loadError}</p>
      </main>
    );
  }

  const changed = JSON.stringify(orders) !== JSON.stringify(initialOrders);
  const selectedTitle = selectedBranch === "Todas" ? "Todas las sucursales" : selectedBranch;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <button className="brand-mark" aria-label="Barrio Pizza" onClick={() => setView("overview")}>B</button>
        <nav aria-label="Navegación principal">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "nav-item active" : "nav-item"}
              onClick={() => setView(item.id)}
              title={item.label}
            >
              <span>{item.icon}</span>
              <em>{item.label}</em>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-status"><i /><span>Datos cargados</span></div>
          <button className="demo-logout" onClick={closeDemoSession} title="Cerrar sesión demo" aria-label="Cerrar sesión demo">↪</button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">CENTRO DE COMPRAS · SEMANA 7</p>
            <h1>{view === "overview" ? selectedTitle : navItems.find((item) => item.id === view)?.label}</h1>
          </div>
          <div className="topbar-actions">
            <label className="branch-select">
              <span>Sucursal</span>
              <select value={selectedBranch} onChange={(event) => setSelectedBranch(event.target.value)}>
                <option>Todas</option>
                {branches.map((branch) => <option key={branch}>{branch}</option>)}
              </select>
            </label>
            <input ref={uploadRef} type="file" accept=".csv,text/csv" hidden onChange={handleUpload} />
            <button className="secondary-button" onClick={() => uploadRef.current?.click()}>↑ Cargar orden</button>
            <button
              className="primary-button"
              onClick={() => downloadOrderPdf(visibleLines, { branchLabel: selectedTitle })}
            >
              ↓ Descargar PDF
            </button>
          </div>
        </header>

        <div className="content-grid">
          <div className="main-column">
            {view === "overview" && (
              <>
                <section className="hero-strip">
                  <div className="hero-copy">
                    <span className="live-pill"><i /> REVISIÓN COMPLETA</span>
                    <h2>{totals.critical + totals.excess === 0 ? "El pedido está listo." : `${totals.critical + totals.excess} decisiones requieren atención.`}</h2>
                    <p>La orden se comparó contra inventario y una proyección robusta de seis semanas.</p>
                  </div>
                  <div className="hero-score">
                    <strong>{Math.round((totals.correct / Math.max(1, visibleLines.length)) * 100)}%</strong>
                    <span>líneas correctas</span>
                  </div>
                </section>

                <section className="kpi-grid" aria-label="Indicadores principales">
                  <article className="kpi-card critical-card">
                    <span>Riesgo de quiebre</span><strong>{totals.critical}</strong>
                    <small>líneas por debajo de la necesidad</small>
                  </article>
                  <article className="kpi-card warning-card">
                    <span>Sobrepedido</span><strong>{totals.excess}</strong>
                    <small>superan el redondeo normal</small>
                  </article>
                  <article className="kpi-card neutral-card">
                    <span>Formatos a ajustar</span><strong>{totals.formatsToAdjust}</strong>
                    <small>sumando aumentos y reducciones</small>
                  </article>
                  <article className="kpi-card success-card">
                    <span>Pedido correcto</span><strong>{totals.correct}</strong>
                    <small>líneas listas para aprobar</small>
                  </article>
                </section>

                {(dataGaps.missingOrders.length > 0 || dataGaps.orphanOrders.length > 0) && (
                  <section className="data-quality-banner" role="status">
                    <span>⌁</span>
                    <div>
                      <b>Calidad de datos: revisión necesaria</b>
                      <p>
                        {dataGaps.missingOrders.length} línea sin cantidad en la orden se interpreta como cero para detectar olvidos. {dataGaps.orphanOrders.length} línea de la orden no tiene inventario ni histórico y no se recomienda automáticamente.
                      </p>
                    </div>
                    <button onClick={() => setView("data")}>Revisar datos →</button>
                  </section>
                )}

                <section className="overview-pair">
                  <article className="panel map-panel">
                    <div className="panel-heading">
                      <div><span className="section-kicker">MAPA DE RIESGO</span><h3>Estado por sucursal</h3></div>
                      <div className="legend"><span><i className="dot critical-dot" />Quiebre</span><span><i className="dot warning-dot" />Exceso</span></div>
                    </div>
                    <BranchMap branches={branchStats} selected={selectedBranch} onSelect={setBranch} />
                  </article>

                  <article className="panel branch-panel">
                    <div className="panel-heading"><div><span className="section-kicker">COMPARACIÓN</span><h3>Líneas por estado</h3></div></div>
                    <div className="branch-bars">
                      {branchStats.map((branch) => {
                        const total = branch.critical + branch.excess + branch.correct;
                        return (
                          <button key={branch.name} onClick={() => setBranch(branch.name)} className={selectedBranch === branch.name ? "branch-row active" : "branch-row"}>
                            <span className="branch-row-label">
                              <span><b>{branch.name}</b><small>Stock actual: {branch.stockSummary}</small></span>
                              <em>{branch.critical + branch.excess} alertas</em>
                            </span>
                            <span className="stacked-bar" aria-label={`${branch.critical} quiebres, ${branch.excess} excesos, ${branch.correct} correctas`}>
                              <i className="bar-critical" style={{ width: `${(branch.critical / (total || 1)) * 100}%` }} />
                              <i className="bar-warning" style={{ width: `${(branch.excess / (total || 1)) * 100}%` }} />
                              <i className="bar-ok" style={{ width: `${(branch.correct / total) * 100}%` }} />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="chart-note">22 ingredientes evaluados por sucursal · unidad de análisis: línea de pedido</p>
                  </article>
                </section>

                <section className="panel alerts-panel">
                  <div className="panel-heading">
                    <div><span className="section-kicker">ACCIONES PRIORITARIAS</span><h3>Qué corregir antes de aprobar</h3></div>
                    <button className="text-button" onClick={() => setView("data")}>Editar cantidades →</button>
                  </div>
                  <div className="alert-list">
                    {issues.slice(0, 6).map((line) => (
                      <article className={`alert-row ${line.status}`} key={lineKey(line.branch, line.ingredientId)}>
                        <span className="alert-icon">{line.status === "critical" ? "!" : "↓"}</span>
                        <div className="alert-copy">
                          <div><b>{line.ingredient}</b><span>{line.branch}</span></div>
                          <p>{line.status === "critical" ? `Faltan ${formatAmount(Math.abs(line.deltaBase))} ${line.unit} para cubrir la proyección.` : `Sobran ${formatAmount(line.deltaBase)} ${line.unit}; excede un formato completo.`}</p>
                        </div>
                        <div className="alert-action"><span>{line.ordered} → <b>{line.recommended}</b></span><small>formatos</small></div>
                      </article>
                    ))}
                    {issues.length === 0 && <div className="empty-state">No hay alertas con el filtro actual.</div>}
                  </div>
                </section>
              </>
            )}

            {view === "orders" && (
              <section className="orders-view">
                <div className="view-intro view-intro-row">
                  <div><span className="section-kicker">LISTO PARA ENVIAR</span><h2>Pedido corregido por proveedor</h2><p>Cantidades expresadas en formatos completos, después de descontar el inventario disponible.</p></div>
                  <button className="secondary-button" onClick={downloadCorrectedOrder}>Descargar CSV</button>
                </div>
                <div className="supplier-grid">
                  {supplierGroups.map(([supplier, supplierLines]) => (
                    <article className="supplier-card" key={supplier}>
                      <div className="supplier-head"><div className="supplier-avatar">{supplier.slice(0, 1)}</div><div><span>PROVEEDOR</span><h3>{supplier}</h3></div><b>{sumRecommended(supplierLines)} formatos</b></div>
                      <div className="supplier-lines">
                        {supplierLines.map((line) => <div key={lineKey(line.branch, line.ingredientId)}><span><b>{line.ingredient}</b><small>{line.branch} · {line.pack}</small></span><strong>{line.recommended}</strong></div>)}
                      </div>
                      <button
                        className="supplier-download"
                        onClick={() => downloadOrderPdf(supplierLines, { branchLabel: selectedTitle, supplier })}
                      >
                        Descargar orden de {supplier} en PDF ↓
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {view === "data" && (
              <section className="data-view">
                <div className="view-intro"><span className="section-kicker">SIMULADOR</span><h2>Edita la orden y ve las alertas cambiar</h2><p>Los cálculos se actualizan al instante. El pedido recomendado siempre se redondea al siguiente formato completo.</p></div>
                <div className="table-actions">
                  <span>{visibleLines.length} líneas · {changed ? "con cambios sin exportar" : "orden original"}</span>
                  {changed && <button className="text-button" onClick={() => { setOrders(initialOrders); setToast("Se restauró la orden original."); }}>Restaurar original</button>}
                </div>
                {dataGaps.orphanOrders.length > 0 && (
                  <div className="orphan-note">
                    <b>Línea sin respaldo:</b> {dataGaps.orphanOrders.map((item) => `${item.sucursal} · ${item.ingrediente_id} (${item.cantidad_formatos} formatos)`).join(", ")}. Agrega inventario e histórico antes de aprobarla.
                  </div>
                )}
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead><tr><th>Ingrediente</th><th>Sucursal</th><th>Proyección</th><th>Stock</th><th>Necesidad</th><th>Orden</th><th>Recom.</th><th>Estado</th></tr></thead>
                    <tbody>
                      {visibleLines.map((line) => (
                        <tr key={lineKey(line.branch, line.ingredientId)}>
                          <td><b>{line.ingredient}</b><small>{line.pack}</small></td><td>{line.branch}</td><td>{formatAmount(line.projected)} {line.unit}</td><td>{formatAmount(line.stock)}</td><td>{formatAmount(line.need)}</td>
                          <td><input aria-label={`Cantidad de ${line.ingredient} para ${line.branch}`} type="number" min="0" value={line.ordered} onChange={(event) => updateOrder(line.branch, line.ingredientId, Number(event.target.value))} /></td>
                          <td><strong>{line.recommended}</strong></td><td><span className={`status-badge ${line.status}`}>{line.status === "critical" ? "Quiebre" : line.status === "warning" ? "Exceso" : "Correcto"}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

          </div>

          <aside className="chat-panel">
            <div className="chat-head"><div className="assistant-avatar">✦</div><div><span>ASISTENTE DE DATOS · IA</span><h3>Pregúntale a Barrio</h3></div><i className={chatLoading ? "thinking" : ""} /></div>
            <div className="chat-messages" aria-live="polite">
              {messages.slice(-6).map((message, index) => (
                <div key={index} className={`message ${message.role}`}>
                  {message.text}
                  {message.role === "assistant" && message.source && (
                    <small>{message.source === "ai" ? "Respuesta con Gemini" : "Respaldo local"}</small>
                  )}
                </div>
              ))}
              {chatLoading && <div className="message assistant typing"><span /><span /><span /></div>}
            </div>
            <div className="prompt-chips">
              <button disabled={chatLoading} onClick={() => void askData("¿Dónde hay mayor riesgo de quiebre?")}>Mayor riesgo</button>
              <button disabled={chatLoading} onClick={() => void askData("¿Qué sucursal pide demasiado?")}>Sobrepedidos</button>
              <button disabled={chatLoading} onClick={() => void askData("Resume el pedido por proveedor")}>Proveedores</button>
            </div>
            <form className="chat-form" onSubmit={submitChat}>
              <input maxLength={280} disabled={chatLoading} value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="Ej. ¿dónde falta mozzarella?" aria-label="Pregunta sobre los datos" />
              <button disabled={chatLoading} aria-label="Enviar pregunta">↑</button>
            </form>
            <p className="assistant-note">Gemini limitado a los datos cargados · respaldo local automático.</p>
          </aside>
        </div>
      </section>

      {toast && <button className="toast" onClick={() => setToast("")}>{toast}<span>×</span></button>}
    </main>
  );
}
