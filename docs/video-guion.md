# Guion sugerido para el video (3–5 minutos)

## 0:00–0:30 · El problema

“Cada sucursal arma su orden al ojo. Construí un centro de compras que cruza consumo, inventario y formatos para mostrar qué corregir antes de aprobar.”

Mostrar el encabezado, el porcentaje de líneas correctas y las cuatro tarjetas.

## 0:30–1:20 · Alertas y mapa

Seleccionar una sucursal desde el mapa. Explicar que rojo significa riesgo de quiebre, amarillo sobrepedido y que cada marcador resume las alertas. Abrir una alerta y comparar `orden → recomendación`.

## 1:20–2:10 · Razonamiento

Abrir “Método”. Explicar brevemente:

- se controlan semanas atípicas;
- se priorizan semanas recientes;
- se descuenta el inventario;
- se redondea a formatos completos.

Mencionar que no se inventó un ahorro en dólares porque no hay costos en los datos.

## 2:10–3:00 · Simulación y calidad de datos

Abrir “Datos y edición”, cambiar una cantidad y mostrar cómo cambia el estado. Señalar los dos casos detectados: una orden omitida y una línea sin histórico/inventario. Explicar que el sistema no trata un dato faltante como consumo cero.

## 3:00–3:40 · Chat y proveedores

Preguntar “¿Dónde falta mozzarella?” y “¿Qué sucursal pide demasiado?”. Luego abrir “Pedido corregido” y mostrar la agrupación por proveedor y la descarga del CSV.

## 3:40–4:20 · Producción

Cerrar explicando que una integración con Odoo leería inventario y borradores de compra, dejaría a la gerente aprobar las recomendaciones y solo después actualizaría las órdenes por proveedor. Indicar que el prototipo usa un chat local verificable y que un modelo de lenguaje podría redactar respuestas manteniendo los cálculos en el motor de reglas.

## Cierre

“La meta no fue agregar gráficos por agregar, sino reducir el tiempo de revisión y hacer visible cada decisión de compra.”
