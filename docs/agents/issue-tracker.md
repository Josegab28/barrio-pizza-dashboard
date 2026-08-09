# Issue tracker: GitHub

Los Issues y especificaciones de este repositorio se gestionan en GitHub Issues:

`Josegab28/barrio-pizza-dashboard`

Usar GitHub CLI para todas las operaciones e indicar siempre el repositorio con `-R Josegab28/barrio-pizza-dashboard`, porque el clon también conserva el remoto del reto original.

## Convenciones

- **Crear un Issue**: `gh issue create -R Josegab28/barrio-pizza-dashboard --title "..." --body "..."`
- **Leer un Issue**: `gh issue view <número> -R Josegab28/barrio-pizza-dashboard --comments`
- **Listar Issues**: `gh issue list -R Josegab28/barrio-pizza-dashboard --state open`
- **Comentar**: `gh issue comment <número> -R Josegab28/barrio-pizza-dashboard --body "..."`
- **Aplicar o eliminar etiquetas**: usar `gh issue edit <número> -R Josegab28/barrio-pizza-dashboard` con `--add-label` o `--remove-label`.
- **Cerrar un Issue**: `gh issue close <número> -R Josegab28/barrio-pizza-dashboard --comment "..."`

## Pull Requests como superficie de solicitudes

**PRs como superficie de solicitudes: no.**

Los Pull Requests no deben entrar automáticamente en la cola de solicitudes o triage. Esta opción puede cambiarse directamente en este archivo si el flujo del repositorio cambia.

## Instrucciones para las habilidades

- Cuando una habilidad indique “publicar en el issue tracker”, crear un GitHub Issue en `Josegab28/barrio-pizza-dashboard`.
- Cuando una habilidad indique “buscar el ticket relevante”, usar `gh issue view` con el número y el repositorio explícito.
