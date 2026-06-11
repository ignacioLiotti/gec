# 0018 - Company global files use a tenant-scoped storage prefix

## Status

Accepted

## Context

The dashboard now needs a company-level file area that is not tied to a single obra. Existing document manager storage is obra-scoped: paths in the `obra-documents` bucket start with an obra id and are governed by obra membership, delete lifecycle, and extraction rules.

Using an obra folder for company-wide files would mix tenant documents with obra documents and could incorrectly expose them in extraction and delete flows.

## Decision

Company global files are stored in the existing `obra-documents` bucket under:

```text
_company-files/{tenantId}/{fileName}
```

Access is only through `/api/company-files` and `/api/company-files/access`. These routes resolve the authenticated tenant, use the Supabase service role for Storage operations, and validate that every requested path starts with the current tenant prefix.

Uploads are counted as tenant storage usage with the `company_files_upload` usage context.

## Consequences

- Company files stay separate from obra file trees, OCR mappings, extraction pipelines, and obra document delete lifecycle.
- Storage RLS for direct browser access does not apply to this prefix; the API route is the authorization boundary.
- If company files later need folders, soft delete, audit metadata, or per-role permissions, add a dedicated metadata table and update this ADR.
