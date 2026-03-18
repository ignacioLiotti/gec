# Materials & Orders

tags: #materials #orders #ocr #import

## What are Materials?

**Materials** (materiales) track purchase orders for materials on each obra. An order has a header (supplier, requester, order number) and line items (quantity, unit, description, unit price).

---

## Data Model

### Material Order
```
obra_material_orders
  id, obra_id, tenant_id
  nro_orden          — order number
  solicitante        — requester name
  gestor             — procurement manager
  proveedor          — supplier name
  created_at
```

### Order Items
```
obra_material_order_items
  id, order_id
  cantidad           — quantity
  unidad             — unit (kg, m², etc.)
  material           — material description
  precio_unitario    — unit price
```

---

## OCR Import Flow

The **primary way** to add materials is via AI-powered OCR from a physical/digital purchase order document.

```
User uploads PDF/image to Materials folder in Obra
    ↓
POST /api/obras/[id]/materials/import
    ↓
Claude AI (vision model) reads document
    ↓
MATERIALS_OCR_PROMPT (from lib/tablas.ts):
  "Extraé una orden de compra de materiales en formato JSON...
   items: cantidad (número), unidad (texto), material (texto), precioUnitario
   Detectá y normalizá números con separador decimal coma.
   Extraé también: nroOrden, solicitante, gestor, proveedor."
    ↓
AI returns JSON → parsed and validated
    ↓
Order + items inserted to DB
    ↓
lib/ai-pricing.ts tracks token usage (model, input_tokens, output_tokens)
    ↓
Usage saved to tenant_expenses
```

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/obras/[id]/materials` | List material orders for obra |
| POST | `/api/obras/[id]/materials` | Create order manually |
| POST | `/api/obras/[id]/materials/import` | Import via OCR |

---

## UI

Materials Tab in Excel View:
- Accordion-style list of orders per obra
- Shows order header + expandable items table
- Link to source document

---

## Related Notes

- [[04 - Obras (Construction Projects)]]
- [[06 - Excel View]]
- [[18 - OCR Pipeline]]
- [[22 - Expenses & Usage Tracking]]
