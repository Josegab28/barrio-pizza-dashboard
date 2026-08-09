# Domain docs

Este repositorio utiliza una estructura de documentación de **contexto único**.

## Antes de explorar el proyecto

Leer cuando existan:

- `CONTEXT.md` en la raíz del repositorio.
- Los ADR relevantes dentro de `docs/adr/`.

Si alguno de estos archivos no existe, continuar silenciosamente. La documentación se crea progresivamente cuando se resuelven conceptos o decisiones del dominio.

## Estructura

```text
/
├── CONTEXT.md
└── docs/
    └── adr/
        ├── 0001-...md
        └── 0002-...md
```

## Vocabulario del dominio

Usar en Issues, pruebas, propuestas y código los términos definidos en `CONTEXT.md`. Evitar sinónimos que contradigan el glosario existente.

Si un concepto necesario todavía no está definido, reconsiderar si se está introduciendo lenguaje ajeno al proyecto o registrar la brecha para una futura sesión de modelado del dominio.

## Conflictos con ADR

Si una propuesta contradice una decisión documentada, señalar el conflicto explícitamente en lugar de reemplazarla de forma silenciosa.
