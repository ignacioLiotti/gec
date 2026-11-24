# ADR 0048. Caché de miniaturas autorizadas

## Estado

Implementado en Documentos de obra, vista de tarjetas, en `final-a`.

## Decisión

- El listado aporta la fecha de modificación del objeto de Storage. La firma por lote valida obra, archivo y estado antes de entregar la URL y el ámbito de caché del usuario y la organización.
- El endpoint autorizado de documentos puede devolver una portada WebP de hasta 220 px. El proceso reutiliza derivadas por objeto y versión de Storage, con límite de tamaño, concurrencia y vigencia. Si el renderer no está disponible o el archivo supera el límite, la vista puede generarla desde la URL autorizada.
- IndexedDB guarda solo miniaturas. La clave incluye cuenta, tenant, ruta, versión y tamaño. Para reutilizar una entrada se exige que la sesión haya obtenido acceso a esa ruta por el lote vigente. Cerrar sesión, cambiar de cuenta o cambiar de organización dentro de la pestaña descarta las entradas locales. Las sesiones demo y las simulaciones de permisos quedan fuera de IndexedDB.

## Consecuencias

Una recarga de la misma carpeta puede evitar descargar y renderizar los originales. La primera visita desde un navegador y un servidor con caché vacía todavía requiere leer los originales de Storage. La caché de servidor vive en cada proceso y se vacía al reiniciarlo. IndexedDB puede ser purgada por el navegador. Las previsualizaciones se regeneran bajo demanda.
