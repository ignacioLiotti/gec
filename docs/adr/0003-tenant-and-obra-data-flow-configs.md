# Tenant and obra data-flow configs

Status: accepted

Data-flow is split into a tenant-level general config and an obra-level local config. Tenant config owns shared calculations, results and General-tab layout defaults; obra config stores local overrides, and runtime evaluation uses the effective config produced by merging tenant first and obra second.

The alternative was to keep all calculation config inside each obra or hardcode the common KPIs in the page. The merged model keeps shared indicators such as contrato, certificado, saldo and avance consistent across the tenant, while preserving obra-specific exceptions without mutating the tenant defaults.
