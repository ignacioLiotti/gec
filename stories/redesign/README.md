# Propuesta: papel, capas y luz

Exploración aislada en Storybook. No cambia la aplicación publicada, contratos de componentes ni datos reales.

Abrir `Rediseño/Propuesta/Revision` para revisar siete pantallas y comparar la biblioteca actual local con la propuesta. El catálogo se obtiene del índice de Storybook: incluye todas las historias de App UI, Shared system y Patterns, con sus variantes. La cobertura por módulo está en `stories/coverage.md`.

## Material

- Fondo cálido y mate; hojas blancas sobre bandejas suaves, con pie expuesto.
- Sombras cortas y difusas alrededor de toda la superficie. Sin franjas de color ni sombras decorativas en un solo lateral.
- Selección mediante relleno completo y relieve ligero.
- Vidrio esmerilado reservado para tooltips y pequeñas superficies flotantes; gráfico claro u oscuro.
- Naranja para acciones, conservando colores semánticos de estado. La propuesta usa un naranja más profundo en botones para texto blanco; no pretende reproducir el token publicado.
- La misma implementación y comportamiento de cada componente, con tokens y selectores exclusivos de Storybook. Los portales reciben el material desde el documento de su historia.

## Pantallas

Las siete pantallas comparten `stories/vibe/paper-frame.tsx`, extraído de Inicio: marca, navegación, atención, barra superior, hoja principal y controles de material. Excel, Obra, Documentos y General conservan el contenido y los eventos de sus ejemplos interactivos, pero no montan el marco ni los controles de la comparación de animaciones. `paper-screens.css` adapta la composición interior a esta misma estructura. Macrotablas y Reportes son prototipos con componentes compartidos y datos ficticios: búsqueda, estado, período, vista previa y descarga CSV operan sobre la misma selección.

La comparación muestra la implementación **local actual**, no una captura de sintesis.dev. Cada lado tiene estado interactivo independiente. El tema y el selector global Diseño permiten explorar la biblioteca también fuera del comparador.

## Propuesta de adopción

1. Revisar material, contraste y estados de controles con este comparador.
2. Tras validar la dirección, trasladar los tokens acordados a la capa compartida y los contenedores a sus componentes propietarios.
3. Aplicar navegación y contenedores a las pantallas reales, verificando sus flujos y documentando los cambios de producto en FigJam.

Esta iteración no cambia flujos de producto, arquitectura ni almacenamiento; no requiere ADR ni actualización de FigJam. La guía de producción conserva sus reglas hasta aprobar la adopción.
