# 5 · Administración

Sección para usuarios con rol **owner** o **admin** de la empresa.

## Usuarios e invitaciones

En **Administración → Usuarios** podés:

- **Invitar usuarios** por email, individualmente o en lote, asignando el rol al invitar.
- **Ver invitaciones pendientes**: reenviarlas o revocarlas mientras no fueron aceptadas.
- **Gestionar miembros**: cambiar roles o quitar acceso.

Los usuarios solo ven los datos de tu empresa; el aislamiento entre empresas es total.

## Roles y permisos

- Roles base: **owner**, **admin** y roles operativos definidos por tu empresa.
- Los permisos controlan qué secciones y acciones ve cada rol; también se pueden **denegar permisos puntuales** por usuario o por rol cuando hace falta afinar.
- Las acciones sensibles (migraciones destructivas, aprobación de documentos, configuración de la empresa) están reservadas a owner/admin.

## Configuración de la empresa (plantilla)

Desde administración se define la **plantilla** que estructura todas las obras:

- **Carpetas por defecto** y su tipo documental.
- **Tablas y columnas** comunes, con su tipo de dato.
- **Flujos documentales**: cómo se extrae cada tipo de documento y a qué tabla va.
- **Data-flow general**: cálculos, indicadores y layout de la solapa General.

Reglas importantes:

- Los cambios **no destructivos** (agregar carpetas, columnas o cálculos) pueden sincronizarse con obras existentes. Revisá el alcance y el resultado de la operación.
- Los cambios **destructivos** están bloqueados en la interfaz actual. No elimines estructuras por SQL o llamadas directas: la acción quedará disponible cuando exista una **migración explícita** con vista previa, aprobación y resultado auditable.

## Otros temas de administración

- **Facturación y plan**: suscripción, límites de uso (OCR, almacenamiento, IA) y consumo actual.
- **Notificaciones y recordatorios**: reglas de vencimientos de documentos y pólizas.
- **WhatsApp**: canal de captura operativa (si está habilitado para tu empresa), con plantillas de mensaje aprobadas.
- **Auditoría**: las acciones importantes (aprobaciones, migraciones, cambios de permisos) quedan registradas con quién, cuándo y por qué.

---

¿Volver al inicio? [Índice de la guía](README.md)
