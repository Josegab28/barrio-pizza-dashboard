# Barrio · Centro de compras

Dashboard administrativo para revisar automáticamente las órdenes semanales de Barrio Pizza. Convierte los formatos de compra a su unidad base, proyecta el consumo, descuenta el inventario y señala qué debe corregirse antes de aprobar el pedido.

## Qué incluye

- Resumen ejecutivo con riesgos de quiebre, sobrepedidos, formatos a ajustar y líneas correctas.
- Mapa interactivo de las cuatro sucursales con alertas y stock actual desglosado por unidad al seleccionar cada marcador.
- Alertas accionables con la cantidad pedida y la cantidad recomendada.
- Simulador para editar cantidades o cargar una nueva orden CSV y recalcular todo al instante.
- Pedido corregido agrupado por proveedor y exportable como un PDF listo para revisar o enviar; el CSV se conserva como respaldo técnico.
- Asistente en español conectado a la API de Gemini, limitado a los datos calculados por el dashboard y con respaldo local automático.
- Revisión explícita de calidad de datos: líneas omitidas, líneas sin inventario/histórico y semanas atípicas.
- Diseño adaptable para computador, tableta y móvil.

## Cómo correrlo

Requiere Node.js 22.13 o superior.

```bash
cd dashboard-app
npm install
npm run dev
```

Abrir `http://localhost:3000`.

Para activar la IA real, crear `dashboard-app/.env.local` a partir de `.env.example` y colocar la clave únicamente allí:

```text
GEMINI_API_KEY=tu_clave
GEMINI_MODEL=gemini-3.5-flash-lite
```

La clave nunca se envía al navegador ni debe subirse a GitHub. En la versión publicada se configura como variable secreta del sitio.

Para validar la versión de producción:

```bash
cd dashboard-app
npm run build
```

## Datos

La aplicación consume copias de los cuatro archivos de `/datos` desde `dashboard-app/public/datos`:

- `ingredientes.csv`
- `consumo_historico.csv`
- `inventario_actual.csv`
- `orden_compra_semana.csv`

El cargador de la interfaz reemplaza únicamente la orden semanal. Espera estas columnas:

```text
sucursal,ingrediente_id,cantidad_formatos
```

## Método de proyección

Para cada combinación sucursal–ingrediente:

1. Se revisan las seis semanas históricas.
2. Se limitan picos aislados usando la mediana y la desviación absoluta mediana (MAD).
3. Se calcula un promedio ponderado que da más importancia a las semanas recientes.
4. Se añade una tendencia lineal acotada a ±15% para evitar proyecciones extremas.
5. `necesidad real = max(0, consumo proyectado − inventario actual)`.
6. `formatos recomendados = ceil(necesidad real / unidad_base_por_formato)`.

Una orden genera riesgo de quiebre cuando su equivalente en unidad base no cubre la necesidad. Solo genera sobrepedido cuando supera la cantidad de formatos recomendada; el excedente menor a un formato completo se considera redondeo normal.

## Hallazgos de calidad de datos

Los archivos tienen catálogo, histórico e inventario completos para 88 combinaciones (4 sucursales × 22 ingredientes), pero la orden contiene:

- una línea esperada ausente: `Brisas del Golf · mozzarella`; se interpreta como cero para detectar el posible olvido;
- una línea sin inventario ni histórico: `Costa del Este · aji_chombo`; se muestra como dato sin respaldo y no se recomienda automáticamente.

No se encontraron claves duplicadas, valores vacíos ni cantidades negativas. La interfaz expone ambos casos para no confundir “dato faltante” con “consumo cero”.

## Chat con los datos

El chat envía a Gemini un contexto compacto construido por el motor de reglas: resumen global, estado por sucursal, totales por proveedor y hasta 18 líneas relevantes. El modelo redacta la explicación, pero no calcula ni sustituye las recomendaciones. Si la API no está configurada, excede el límite o no responde, el dashboard usa automáticamente un intérprete local para preguntas frecuentes y muestra el motivo del cambio de modo, por ejemplo:

- “¿Dónde hay mayor riesgo de quiebre?”
- “¿Qué sucursal está pidiendo demasiado?”
- “¿Dónde falta mozzarella?”
- “Resume el pedido por proveedor.”

Si el proyecto de Gemini agota sus créditos prepagados, la interfaz lo indica expresamente. Google no devuelve automáticamente esos proyectos al Free Tier: hay que agregar saldo, desactivar la facturación del proyecto para intentar volver al nivel gratuito o usar una clave de otro proyecto con cuota disponible.

Controles de uso incluidos:

- máximo 280 caracteres por pregunta;
- máximo 8 consultas con IA por sesión del navegador;
- máximo 8 solicitudes por minuto e IP como protección de primera línea;
- respuesta limitada a 180 tokens y 55 segundos;
- `store: false`, para no guardar la interacción en Gemini;
- contexto máximo de 14.000 caracteres y prompt que prohíbe inventar cifras.

El límite del servidor es deliberadamente liviano y complementa —no reemplaza— los presupuestos y límites de uso configurados en Google AI Studio.

## Orden de compra en PDF

La descarga principal genera un documento con identidad visual de Barrio Pizza que incluye fecha, alcance, resumen de proveedores, líneas a comprar, formatos totales y ajustes. El detalle se separa por proveedor y muestra ingrediente, sucursal, formato, cantidad original, recomendación y ajuste. También se puede descargar un PDF individual desde cada tarjeta de proveedor.

## Supuestos

- La orden corresponde a una sola semana futura (semana 7).
- Inventario y consumo usan la unidad base definida en el catálogo.
- `cantidad_formatos` es un entero no negativo.
- Las coordenadas del mapa son aproximadas y se usan solo para la experiencia visual.
- No se calcula impacto monetario porque el reto no incluye costos unitarios.
- La proyección se conserva deliberadamente explicable para que compras pueda auditarla.

## Cómo lo conectaría con Odoo

1. Leer productos, empaques, inventario por ubicación y borradores de compra mediante la API de Odoo.
2. Mapear `ingrediente_id` a `product.product` y cada sucursal a su `stock.location`.
3. Ejecutar la proyección en un servicio programado al cierre de cada semana.
4. Guardar recomendación, alerta y explicación en una tabla auditable.
5. Permitir que compras apruebe cambios en el dashboard y, solo después, actualizar o crear los `purchase.order` separados por proveedor.
6. Mantener permisos, registro de quién aprobó cada ajuste y alertas de datos incompletos.

## Uso de IA durante el desarrollo

La IA se utilizó como copiloto para estructurar el problema, comparar alternativas de proyección, implementar la aplicación, detectar casos de calidad de datos, revisar la conversión de unidades y preparar pruebas. Las decisiones de negocio —redondeo por formato, tratamiento de faltantes y límites de la tendencia— quedaron explícitas y verificables en el código y en la interfaz.

## Estructura

```text
reto-practicante-ia/
├── datos/                    # CSV originales del reto
├── dashboard-app/
│   ├── app/                  # interfaz, cálculos y mapa
│   ├── app/api/chat/         # conexión segura con Gemini
│   ├── app/lib/orderPdf.ts   # generador de órdenes PDF
│   ├── public/datos/         # datos usados por la demo
│   └── public/og.png         # tarjeta para compartir la app
```
