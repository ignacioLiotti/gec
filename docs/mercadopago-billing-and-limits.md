# MercadoPago Billing + Tenant Limits (Estado Actual)

Este documento describe exactamente como funciona hoy la facturacion por tenant, el paywall, y la medicion/aplicacion de limites.

## 1) Objetivo de la implementacion

- Cobro de suscripciones por tenant con MercadoPago.
- Bloqueo de acceso (paywall) cuando la suscripcion no esta en estado permitido.
- Medicion de consumo por tenant (storage, IA, WhatsApp) con enforcement de limites.
- Override manual de limites por un unico usuario autorizado.

## 2) Componentes principales

- API estado + debug:
  - `GET /api/billing/subscription`
  - Archivo: `app/api/billing/subscription/route.ts`
- Inicio de checkout MercadoPago:
  - `POST /api/billing/mercadopago/checkout`
  - Archivo: `app/api/billing/mercadopago/checkout/route.ts`
- Webhook MercadoPago:
  - `POST /api/billing/mercadopago/webhook`
  - Archivo: `app/api/billing/mercadopago/webhook/route.ts`
- Logica MercadoPago (payload, firma, estado, plan config):
  - Archivo: `lib/billing/mercadopago.ts`
- Logica de acceso por estado de suscripcion:
  - Archivo: `lib/billing/subscription-access.ts`
- Paywall global en proxy:
  - Archivo: `proxy.ts`
- UI de billing:
  - `app/billing/page.tsx`
  - `app/billing/billing-client.tsx`

## 3) Modelo de datos relevante

- `subscription_plans`:
  - `plan_key`, `name`, `description`
  - limites base: `storage_limit_bytes`, `ai_token_budget`, `whatsapp_message_budget`
  - metadata para MercadoPago (`mercado_pago_*`)
- `tenant_subscriptions`:
  - `tenant_id`, `plan_key`, `status`
  - `current_period_start`, `current_period_end`
  - `external_customer_id`, `external_subscription_id`
  - `metadata` (incluye `mercadoPago.*`)
  - overrides de limites:
    - `storage_limit_bytes_override`
    - `ai_token_budget_override`
    - `whatsapp_message_budget_override`
- `tenant_api_expenses`:
  - snapshot de consumo del periodo actual
- `tenant_usage_events`:
  - log de eventos de consumo

## 4) Flujo de checkout (que pasa al pagar)

1. `/billing` llama `GET /api/billing/subscription`.
2. Usuario owner/admin hace click en "Pagar con MercadoPago".
3. `POST /api/billing/mercadopago/checkout`:
   - valida acceso tenant admin.
   - resuelve plan y config MP.
   - arma preapproval request y crea suscripcion en MP.
   - upsert en `tenant_subscriptions`.

### Detalle importante implementado

Si ya habia una suscripcion activa y MP devuelve estado `pending`, se preserva temporalmente:

- `status` activo existente
- `plan_key` existente

Esto evita cambiar limites antes de confirmacion real de pago.

Luego, cuando llega webhook con estado definitivo, se actualiza.

## 5) Flujo de webhook (fuente de verdad de estado)

`POST /api/billing/mercadopago/webhook`:

- Valida firma (`x-signature`, `x-request-id`) si `MERCADOPAGO_WEBHOOK_SECRET` existe.
- Resuelve `preapprovalId` desde query/body/resource.
- Consulta estado real en MP (`GET /preapproval/{id}`).
- Determina tenant/plan por `external_reference` (`tenant:<id>|plan:<key>`).
- Upsert de `tenant_subscriptions` con:
  - `status` mapeado (`authorized -> active`, `rejected -> past_due`, etc)
  - `current_period_end` con `next_payment_date`
  - ids externos y metadata.

## 6) Paywall (bloqueo de acceso)

Implementado en `proxy.ts` para usuarios no superadmin.

- Consulta `tenant_subscriptions` del tenant activo.
- Evalua estado via `evaluateTenantSubscriptionAccess`.
- Si bloquea:
  - rutas API: responde `402` JSON.
  - rutas app: redirige a `/billing?blocked=1&reason=...`.

### Rutas excluidas del paywall

- `/billing`
- `/api/billing/*`
- auth/onboarding/demo y assets internos definidos en `isBillingPaywallBypassPath`.

### Reglas de estado

En `lib/billing/subscription-access.ts`:

- Activo: `active`, `authorized`, `trialing`.
- Pendiente checkout: `pending`, `in_process` con gracia temporal por:
  - `SUBSCRIPTION_PENDING_GRACE_MINUTES` (default 60).
- Morosidad/pausa: `past_due`, `paused` con gracia por:
  - `SUBSCRIPTION_GRACE_DAYS`.
- Cancelado u otros no permitidos: bloquea.

## 7) Medicion y limites por tenant

Resolucion de limites efectiva (`fetchTenantPlan`):

- primero override del tenant (`tenant_subscriptions.*_override`)
- si no hay override, usa limites del plan base (`subscription_plans`).

### Donde se mide y aplica

- Storage:
  - upload de documentos suma bytes.
  - soft delete resta bytes.
  - restore vuelve a sumar bytes.
- IA tokens:
  - OCR single y OCR multi reservan/ajustan tokens (con rollback).
- WhatsApp:
  - soporte de limites y metrica existe en capa de uso, pero no hay un flujo de envio WhatsApp nuevo en esta fase.

La operacion atomica principal es la RPC:

- `increment_tenant_api_usage` (migracion `0066_tenant_usage_enforcement.sql`)

Si excede limite, devuelve errores tipados:

- `storage_limit_exceeded`
- `ai_limit_exceeded`
- `whatsapp_limit_exceeded`

Las rutas convierten eso a `402`.

## 8) Quien puede modificar limites manualmente

Solo email exacto:

- `ignacioliotti@gmail.com`
- Archivo: `lib/admin/tenant-limit-access.ts`

Se aplica en:

- `app/admin/expenses/all/actions.ts`
- `app/admin/expenses/all/page.tsx`

## 9) Upgrade / downgrade / cancel: comportamiento actual

### Upgrade de plan

- Se inicia checkout del nuevo plan.
- Si queda `pending` y la suscripcion actual era activa:
  - se mantiene plan/estado anterior temporalmente.
- Al webhook autorizado:
  - pasa al plan nuevo y estado actualizado.

### Downgrade de plan

- Mismo comportamiento que upgrade (checkout del plan objetivo + confirmacion por webhook).

### Cancelacion

- Existe endpoint in-app:
  - `POST /api/billing/mercadopago/cancel`
  - programa cancelacion al final del ciclo (no inmediata).
- Comportamiento:
  - mantiene categoria/acceso hasta `current_period_end`.
  - intenta evitar nuevo cobro programando `auto_recurring.end_date` en MP.
  - guarda `cancelAtPeriodEnd=true` y `scheduledCancellationAt` en metadata.
  - despues de esa fecha, paywall bloquea aunque status siga `active`.

### Fallo de pago

- Estado suele terminar en `past_due` o similar por webhook.
- Con gracia configurable en dias para `past_due/paused`.
- Fuera de gracia: bloqueado por paywall.

## 10) Si el tenant se pasa de limites

- Storage:
  - upload/restore devuelven `402` y no completan (o hacen rollback).
- IA:
  - OCR devuelve `402` y revierte reserva cuando corresponde.
- WhatsApp:
  - la capa de limites devuelve `whatsapp_limit_exceeded` si se integra flujo de consumo.

## 11) Variables de entorno requeridas

Base:

- `APP_URL` (en prod, `https://sintesis.dev`)
- `MERCADOPAGO_ACCESS_TOKEN` (versionado opcional soportado)
- `MERCADOPAGO_WEBHOOK_SECRET`
- `MERCADOPAGO_API_BASE_URL` (normalmente default)
- `SUBSCRIPTION_GRACE_DAYS`
- `SUBSCRIPTION_PENDING_GRACE_MINUTES`

Planes (uno por `plan_key`):

- `MERCADOPAGO_PLAN_<PLAN>_PREAPPROVAL_PLAN_ID` o
- `MERCADOPAGO_PLAN_<PLAN>_AMOUNT_ARS`
- opcional:
  - `MERCADOPAGO_PLAN_<PLAN>_FREQUENCY`
  - `MERCADOPAGO_PLAN_<PLAN>_FREQUENCY_TYPE`

Testing:

- `MERCADOPAGO_TEST_PAYER_EMAIL` para evitar mezcla de cuentas.

## 12) Checklist de salida a produccion

1. Confirmar token correcto del vendedor para el flujo de suscripciones.
2. Configurar webhook en modo productivo:
   - URL: `https://sintesis.dev/api/billing/mercadopago/webhook`
   - evento: `Planes y suscripciones`
   - clave secreta igual a env.
3. Definir config de todos los planes (metadata o env).
4. Verificar `APP_URL=https://sintesis.dev`.
5. Ejecutar smoke test:
   - abrir `/billing`
   - iniciar checkout
   - confirmar recepcion webhook
   - validar `tenant_subscriptions` y acceso.
6. Revisar si se desea mantener visible el bloque debug en `/billing` en produccion.

## 13) Gaps actuales conocidos

- No hay endpoint dedicado de reactivacion de cancelacion programada (se revierte implicitamente con un nuevo checkout).
- No hay orquestacion de prorrateo interna; depende del comportamiento de MP/preapproval.
- El debug de billing es intencional y visible para troubleshooting; puede ocultarse luego.

## 14) Troubleshooting rapido

### Error: "una de las partes ... es de prueba"

- Hay mezcla entre credenciales/cuenta test y real.
- Verificar:
  - token y cuenta de vendedor coherentes con el flujo elegido
  - comprador del mismo ambiente
  - `payer_email` resuelto en `/billing` dentro de `mercadoPagoDebug.runtime`

### Error: "Cannot operate between different countries"

- Vendedor y comprador no son del mismo pais/sitio.
- Para Argentina: usar cuentas test/real del sitio `MLA` en ambos extremos.
- Validar el `payer_email` efectivo en debug.

### Webhook no actualiza estado

- Revisar URL productiva configurada en MP:
  - `https://sintesis.dev/api/billing/mercadopago/webhook`
- Verificar `MERCADOPAGO_WEBHOOK_SECRET`.
- Confirmar que llegan eventos de "Planes y suscripciones".
