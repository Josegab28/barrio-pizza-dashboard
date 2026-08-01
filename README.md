# Reto técnico — Práctica de IA · Barrio Pizza

## El contexto

Barrio Pizza es una cadena de pizzerías con 10 sucursales en Panamá. Cada semana, **cada sucursal arma su orden de compra de insumos**. A veces piden de más (plata inmovilizada y comida que se vence) y a veces de menos (se quedan sin producto en pleno servicio). Hoy esas órdenes se aprueban al ojo. Esto conlleva mucho tiempo que le tiene que dedicar la gerente de compras para evaluarlas y puede llevar a errores.

**Queremos una herramienta que las revise automáticamente.**

## Tu misión

Con los datos de **4 sucursales** que te damos, construí un **dashboard** —una herramienta visual— que revise las órdenes de compra de la semana y **muestre automáticamente las alertas**: *¿están pidiendo lo que realmente necesitan? ¿piden de más? ¿se olvidaron de algo?*

> **La visión (para que entiendas el norte):** en la vida real, la gerente de compras cargaría todas las órdenes de la semana en esta herramienta y esta le arrojaría las alertas al instante, sin tener que revisar producto por producto. No tenés que construir toda esa versión final — pero queremos ver esa idea reflejada en tu dashboard.

## Los datos (4 archivos CSV)

Están en la carpeta [`/datos`](datos) de este repositorio. Descargá el repo completo (botón verde **Code → Download ZIP**) o cloná con git.

| Archivo | Qué contiene |
|---|---|
| `ingredientes.csv` | Catálogo: proveedor, unidad, **formato de compra** (ej. "Saco 25 kg") y si es perecedero |
| `consumo_historico.csv` | Cuánto consumió cada sucursal de cada ingrediente en las **últimas 6 semanas** |
| `inventario_actual.csv` | Stock actual de cada ingrediente por sucursal |
| `orden_compra_semana.csv` | Lo que cada sucursal **está pidiendo** esta semana (en formatos: `3` = 3 sacos) |

> **Ojo con las unidades:** el consumo y el inventario están en unidad base (kg, L, unidades), pero las órdenes están en **formatos**. Vas a tener que convertir.

## Qué debe hacer tu herramienta (lo mínimo)

1. **Proyectar** el consumo de la próxima semana de cada ingrediente, por sucursal, usando las 6 semanas de histórico.
2. Calcular la **necesidad real** = consumo proyectado − inventario actual.
3. **Comparar con la orden de compra** y generar **alertas claras y accionables**, en este estilo:
   > *"ALERTA: \<sucursal\> está pidiendo \<cantidad\> \<unidad\> de \<ingrediente\> menos que lo proyectado → riesgo de quiebre."*
4. **Mostrar todo en un dashboard** (obligatorio): una pantalla visual donde las alertas se vean de un vistazo. El usuario no debería tener que leer código ni tablas crudas para entender qué está mal. Pensalo como algo que la gerente de compras usaría, no como un archivo de salida.

> **Sobre el redondeo:** los insumos solo se compran en formatos completos (no existe medio saco). Un excedente **menor a un formato completo** es redondeo normal, no un sobre-pedido.

## Para destacar (opcional, suma puntos)

Elegí **al menos una**:
- Un **método de proyección más inteligente** que un promedio simple (que capte tendencias de crecimiento o ignore semanas atípicas).
- Un **"chat con los datos":** un cuadro donde el usuario escribe una pregunta en español normal —por ejemplo *"¿qué sucursal está pidiendo demasiado queso esta semana?"*— y la herramienta le responde en texto, sin que tenga que leer tablas. Por dentro usa un modelo de IA conectado a los datos.
- **Detección de órdenes raras** comparando una sucursal contra las demás (ej. una pide mucho más de un insumo, por cliente, que el resto).
- **Organizar el pedido corregido por proveedor:** como a cada proveedor se le manda una orden aparte, agrupar la lista por proveedor para poder reenviarle a cada uno su parte directamente.
- Que el usuario pueda **cargar o editar las órdenes desde la misma interfaz** (subir el archivo o cambiar cantidades) y ver las alertas actualizarse — acercándose a la visión final de la herramienta.

No necesitás usar Odoo. Pero en tu README o video, contanos **cómo conectarías esto a un sistema como Odoo** si tuvieras que llevarlo a producción.

## Qué entregar (por el formulario)

1. **Link a un repo de GitHub** con el código + un **README** (cómo correrlo y qué supuestos hiciste).
2. **Video de 3–5 min** mostrándolo funcionar y explicando tu razonamiento (ver instrucciones abajo).
3. *(Opcional)* Link a la app en vivo.
4. Una explicación de **cómo usaste IA** para resolverlo.

### Cómo grabar y subir el video

**Qué mostrar:** un recorrido por tu dashboard funcionando + tu razonamiento (por qué proyectaste el consumo así, cómo manejaste los casos raros). No hace falta que salgas en cámara; con tu voz y la pantalla basta.

**Cómo grabarlo** (elegí la opción que te sea más fácil, todas gratis):
- **Loom** (loom.com) — la más simple: graba pantalla + voz y te genera el link para compartir automáticamente. **Recomendada.**
- **Windows:** `Win + G` (Xbox Game Bar) graba la pantalla.
- **Otras:** OBS Studio, una reunión de Zoom con vos solo, o el celular grabando la pantalla.

**Cómo compartir el link (¡lo más importante!):**
- Con Loom el link ya queda listo.
- Si grabás un archivo, subilo a **YouTube como "No listado"**, o a **Google Drive / OneDrive** con la opción "cualquiera con el link puede ver".
- **Probá tu link en una ventana de incógnito antes de enviarlo.** Si te pide permiso o iniciar sesión, no vamos a poder verlo y tu entrega quedará incompleta.

## Reglas del juego

- Usá el lenguaje y las herramientas que quieras, **incluida la IA** (Claude, ChatGPT, Copilot, lo que sea). **Usar IA suma — no lo escondas.** Lo que evaluamos es cómo la usás para construir.
- **Todo el reto se puede completar con herramientas 100% gratuitas** — no hace falta pagar ninguna suscripción. Algunas que podés explorar: Streamlit, Gradio, Hugging Face Spaces, Vercel, Netlify, GitHub, Loom, y las IA que prefieras (Claude, ChatGPT, Gemini, Copilot). *Descubrir cuál te sirve para cada cosa es parte del reto.* (Tip: como estudiante calificás al GitHub Student Developer Pack, que suma varias herramientas gratis.)
- **Fecha límite: sábado 8 de agosto, 11:59 p.m.** No se reciben entregas después.
- **¿Dudas?** Escribí a **martin@barriopizza.com** — cualquier pregunta es bienvenida.

## Cómo lo evaluamos

Que **funcione** y detecte bien los problemas · tu manejo de las **unidades** y de **datos incompletos** · qué tan bien **usaste la IA** · tu **razonamiento** · y la **claridad** con que lo explicás.

> No buscamos perfección, ni un sistema terminado, ni que seas un programador experto. Buscamos ver tu **razonamiento y tu estructura**: que construyas algo que funcione y que pienses como alguien que resuelve problemas de un negocio real. Éxitos.
