# Document flows as tenant extraction contract

Status: accepted

Document flows model tenant-level extraction contracts before documents are uploaded. A flow connects folders, document types, input method, OCR/spreadsheet/manual settings, table mapping, lineage policy and downstream consumers such as macrotables.

This records that a folder is not merely a storage path. Treating it as an extraction contract lets admins reason about the whole path from document to structured data, including conflicts and unsupported states, instead of debugging isolated OCR templates after the fact.
