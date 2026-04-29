# Persist chat per user and tenant

Status: accepted

The assistant chat stores conversations and messages per tenant and user, including tool calls, tool results, model and token usage metadata. Tools operate inside the tenant access context and expose structured data such as obras, tables and extracted rows with bounded analysis windows.

The alternative was a stateless page assistant. Persistence is needed for continuity, auditability and later debugging of tool-assisted answers, while per-user ownership keeps conversations private by default.
