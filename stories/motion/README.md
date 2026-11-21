# Comparación de movimiento

Abrir **Motion / Comparacion / Playground**. El catálogo contiene 40 ejemplos: 26 de Interior y 14 de Beautiful UI. El selector, la búsqueda y los filtros permiten recorrer acciones, campos, navegación, capas, estados y datos. Las variantes viven en el mismo playground.

Las dos columnas muestran el mismo ejemplo con movimiento reducido y con el movimiento de origen. Sus estados son independientes. Reiniciar vuelve a montar ambas muestras y repite las secuencias automáticas. La preferencia de movimiento reducido del sistema tiene prioridad. La columna reducida **no representa el comportamiento actual del producto**.

## Fuentes y adaptaciones

- [Interior](https://github.com/ddoemonn/interior/tree/52988dcc82c9ef2c21bc6b288207a2b850f9b318), commit `52988dcc82c9ef2c21bc6b288207a2b850f9b318`.
- [Beautiful UI](https://github.com/slev12397/beautiful-ui/tree/06557d7ff33a1eb70d5987bae9ac4c70fa0e20c4), commit `06557d7ff33a1eb70d5987bae9ac4c70fa0e20c4`.

Cada ejemplo enlaza al archivo original. Las licencias MIT están en [vendor/interior/LICENSE](./vendor/interior/LICENSE) y [vendor/beautiful/LICENSE](./vendor/beautiful/LICENSE). El [manifiesto](./vendor/manifest.json) registra la procedencia y los hashes de 69 archivos. Los resortes, keyframes, duraciones, gestos y secuencias proceden de esos archivos, no de un perfil genérico por biblioteca.

Cambios de integración:

- Imports locales; no se ejecutan scripts ni se instalan dependencias de las referencias.
- Paleta semántica y neutros mapeados a tokens de Síntesis. Se conservan las composiciones, geometría y textos de las demos de origen; no son réplicas de las pantallas de Síntesis.
- El ejemplo de carga usa el `Button` canónico de Síntesis, el hook asíncrono de Interior y su coreografía original de estados. El ejemplo circular combina el anillo de Beautiful con `Badge` y `Button` compartidos.
- CSS y nombres de keyframes aislados. Los portales conservan el contexto de tokens y movimiento reducido de su muestra.
- Los iconos de Selection Actions usan Lucide, ya instalado, en lugar de agregar Iconoir. La animación no cambia.
- Corrección de accesibilidad en Tabs de Interior: se componen la ref de medición y la ref del hook. El original reemplazaba la segunda y no movía el foco con las flechas.
- La demo de popover recibe una altura de 240 px porque posiciona sus disparadores absolutamente.

El importador reproducible es `scripts/import-motion-references.mjs`. Recibe dos checkouts locales y no accede a la red. Para actualizar una fuente, revisar el commit, ejecutar el importador, revisar el diff del manifiesto y ejecutar las verificaciones. Los archivos de `vendor` no se refactorizan con las convenciones internas: se revisan como código de terceros y se compilan y prueban en navegador.

## Cobertura

| Biblioteca | Ejemplos |
| --- | --- |
| Interior · acciones | Carga con éxito/error/deshabilitado, copiar, mantener para confirmar, profundidad, iconos, ripple |
| Interior · campos | Etiquetas, validación, búsqueda expandible |
| Interior · navegación y capas | Acordeón, pestañas, segmentos, dropdown, modal, drawer, popover, tooltips |
| Interior · estados y datos | Progreso, skeleton, pasos, tabla ordenable, grilla filtrable, árbol, reordenamiento, cambio de valores, avisos |
| Beautiful · composición | Carga Drive/Dots/Orbit, Thinking Steps/Reasoning/Search/Coding, Tool Chips, Task Rows Capsules/List, Filter Table, Records Table, Diff Table, Search, Selection Actions, Streaming Text |
| Beautiful · controles | Seis variantes y tres tamaños de Button, Switch, Segmented Control, Progress Ring con cuatro tonos |

Esto amplía las seis aproximaciones anteriores; no es una importación completa de ambos sitios. Se excluyen el video Surfer, las experiencias de chat completas, gráficos, imágenes y gestos sin equivalente directo en las pantallas revisadas. No se presentan versiones inventadas de una biblioteca para componentes que no ofrece.

## Verificación

```sh
npm run typecheck:storybook
npm run build-storybook
node scripts/check-motion-storybook.mjs
npm run test:storybook
```

La prueba recorre los 40 ejemplos y sus variantes en claro/oscuro, verifica los hashes, parámetros CSS de origen, ancho del botón durante carga, éxito/error/deshabilitado, teclado, foco del diálogo, movimiento reducido, búsqueda del catálogo y ancho móvil. El suite general también renderiza las demás stories y comprueba sus contrastes e interacciones.

`npm run storybook:preview` sirve el build estático en el puerto 6006. Recompilar y refrescar después de editar.

No cambian componentes productivos, pantallas, filtros, persistencia ni flujos. El laboratorio no requiere actualizar mapas de producto en FigJam ni una nueva ADR: es una comparación experimental dentro del catálogo definido por ADR 0034.
