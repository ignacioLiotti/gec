# Laboratorio de recorridos

Seis propuestas navegables para discutir la simplificación de Síntesis. Usan ejemplos preparados; no están conectadas al backend. El modo Existente muestra un esquema basado en código, no una copia de las pantallas actuales.

Desde la raíz de este worktree:

```powershell
node prototypes/user-flows/serve.mjs
```

Abrir `http://127.0.0.1:4318`. Para otro puerto, definir `FLOW_LAB_PORT` antes de iniciar. El servidor escucha únicamente en loopback y permite solo los archivos del laboratorio, los tokens y el informe.

- Elegir un recorrido en la columna izquierda.
- Alternar Existente / Propuesta o usar su checkbox independiente.
- Probar los botones del recorrido y cambiar el selector Estado.
- Las preferencias se conservan en localStorage y la URL. Los borradores de ejemplo solo viven mientras la página está abierta; cambiar de variante los conserva. Reiniciar pide descartar si hubo edición.
- El reporte permite descargar un CSV ficticio. Los enlaces compartidos, documentos, extracción, consultas y aprobaciones son simulados.

No requiere dependencias para ejecutarse. Usa los tokens del proyecto y HTML/CSS/JS locales; no agrega rutas de Next ni flags de producción.

La [investigación](../../docs/ux/2026-09-simplification.md) contiene cobertura, 15 propuestas, fuentes, riesgos y orden de integración. El [pendiente FigJam](../../docs/ux/figjam-simplification-pending.md) explica el bloqueo de cupo y los mapas a actualizar.

## Verificación

Con `@playwright/test` disponible y Microsoft Edge instalado:

```powershell
node prototypes/user-flows/verify.cjs
```

Si las dependencias están en otro checkout, definir `PLAYWRIGHT_MODULE_ROOT` con la ruta de ese repositorio. Opcionalmente, `FLOW_LAB_URL` cambia la URL a verificar. No hace falta copiar `.env` ni instalar dependencias de producción.

Los resultados y capturas se guardan en `verification/`. Esta prueba cubre el laboratorio; no verifica el backend de Síntesis ni sustituye las pruebas de una integración futura.
