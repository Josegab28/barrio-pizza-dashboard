## Comandos

La aplicación vive en `dashboard-app/` y requiere Node 22.13 o superior (`dashboard-app/.nvmrc`); con Node 20 la compilación falla con un error opaco de `vinext`.

```bash
cd dashboard-app
npm install      # instalar dependencias
npm run dev      # servidor de desarrollo en http://localhost:3000
npm run lint     # eslint
npm test         # build + tests de node:test
```

## Agent skills

### Issue tracker

Los Issues se gestionan en `Josegab28/barrio-pizza-dashboard` mediante GitHub Issues. Consulta `docs/agents/issue-tracker.md`.

### Domain docs

El repositorio utiliza documentación de dominio de contexto único. Consulta `docs/agents/domain.md`.
