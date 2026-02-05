# OCR Improvements (Post‑v1.0)

This document captures OCR pipeline improvements that are **not** planned for v1.0, but are recommended for a future iteration.

## Current OCR Flow (Summary)
- OCR is configured per folder via defaults/tablas settings (`ocrFolder`, `dataInputMethod`, `ocrTemplateId`, `hasNestedData`).
- Documents tab uploads a file into an OCR folder and triggers OCR import.
- `/api/obras/[id]/tablas/[tablaId]/import/ocr` runs extraction synchronously and writes rows + status.
- Status & errors live in `ocr_document_processing` and are shown in the UI.

Key files:
- `app/admin/obra-defaults/page.tsx`
- `app/api/obra-defaults/route.ts`
- `app/excel/[obraid]/tabs/file-manager/file-manager.tsx`
- `app/api/obras/[id]/tablas/[tablaId]/import/ocr/route.ts`
- `app/api/obras/[id]/tablas/[tablaId]/documents/route.ts`

---

## Recommended Improvements (Post‑v1.0)

### 1) Make OCR Asynchronous
**Problem:** OCR runs inside the request, risking timeouts and slow UX.  
**Recommendation:** enqueue a job and process in background (Worker/queue/cron).  
**Benefit:** better reliability, retries, lower latency for UI.

### 2) Add Dedup / Idempotency
**Problem:** re‑uploading a file can duplicate OCR results.  
**Recommendation:** hash file contents and reuse results or skip duplicates.  
**Benefit:** cost reduction + cleaner data.

### 3) Decouple OCR from upload path
**Problem:** OCR only happens at upload time.  
**Recommendation:** allow explicit “re-run OCR” on an existing file path.  
**Benefit:** better recovery and manual control.

### 4) Server-side PDF rasterization
**Problem:** client rasterization is heavy and inconsistent.  
**Recommendation:** move PDF preprocessing to server/worker.  
**Benefit:** faster UI + consistent OCR inputs.

### 5) Slim down `ocr-links`
**Problem:** loads up to 500 rows per tabla, heavy on large obras.  
**Recommendation:** return metadata only; fetch rows lazily.  
**Benefit:** better performance + lower memory.

### 6) Stronger quota enforcement
**Problem:** token/storage usage checked mid‑process; not always preemptive.  
**Recommendation:** check limits before OCR job starts; if over limit, keep as pending/failed with explanation.  
**Benefit:** clearer UX + predictable cost control.

---

## Suggested Implementation Order
1) Async OCR jobs + queue  
2) `ocr-links` split: summary vs rows  
3) Dedup + idempotency  
4) Server-side PDF rasterization  
5) Retry/re-run actions in UI  

