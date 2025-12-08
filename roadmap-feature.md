🌟 FEATURE ROADMAP (Parallel to Dev-Debt Roadmap)

Focus: New capabilities & product expansion, not fixes.

PHASE 1 — Core Product Expansion (v1.1–v1.3)

1. File Management System Enhancements

(Upload already done in v0.1)

Document version control

File viewer with annotations (text, highlights, drawings)

Comment threads directly on documents

Extracted Data Tables:

OCR pipeline for files in specific folders (e.g., “Contratos”, “Facturas”)

Automatic parsing → structured tables accessible in app

Ability to link extracted data to obras/certificados

PHASE 2 — Collaboration & Communication Layer (v1.3–v1.5) 2. Team Chat & Comments

In-app chat per obra (possibly repurpose Memoria Descriptiva UI)

Comment threads for documents

@mentions + notifications

Real-time presence / typing indicators

3. WhatsApp Integration

Add comments to obra via WhatsApp

Add items to Memoria Descriptiva via WhatsApp

Create/modify events directly from WhatsApp messages

Scheduled WhatsApp “check-in questions” sent to encargados de obra
(e.g., daily status, progress photos, blockers)

PHASE 3 — Analytics, Financials & Insights (v1.5–v2.0) 4. Advanced Analytics Dashboard

Financial metrics:

Burn rate

Profitability

Budget vs actual tracking

Cash flow forecasting

Payment tracking

Client invoicing UI

Project timeline visualization

Gantt chart for obra phases

Milestones + dependencies

Certificate aging analysis

Time elapsed between certificate creation → approval → payment

Bottleneck detection

Custom reports builder

Works with default datasets (obras, certificados)

Works with extracted OCR tables

Filtering, grouping, aggregations

Ability to save & share report templates

5. AI-Powered Features

Auto-categorize documents using OpenAI

Natural language search across:

Obras

Certificados

Extracted data tables

Files and OCR results

Anomaly detection

Budget overruns

Missing documents

Delayed certificates

Smart due date predictions

Based on historical obra timelines

(Optional if value unclear)

PHASE 4 — Scheduling, Resources & Allocation (v2.0+) 6. Advanced Scheduling System

Resource allocation

Workers

Teams

Equipment

Calendar integrations

WhatsApp/Chat actions can create events

Sync to Google/Outlook

Conflict detection

Double-booked equipment

Unavailable workers

PHASE 5 — Mapping & Location Intelligence (v2.1+) 7. GPS & Map Integration

Locate obras on an interactive map

Click → open obra overview

Add geotagged photos / progress updates

Worker check-in/check-out via location (optional future)

PHASE 6 — Unified Reporting & Knowledge Layer (v2.2+) 8. Cross-Dataset Custom Reports

Combine:

Obras

Certificados

Financials

OCR extracted tables

Scheduling + resources

Export to PDF / Excel

Scheduled reports via Slack/Email/WhatsApp

🔥 SEQUENCED DELIVERY SUMMARY
Short-Term Wins (High ROI)

Document versioning

File annotations

Team chat per obra

WhatsApp comments → obra

OCR → extracted data tables

Custom report builder

Mid-Term Wins

Financial dashboard (budget vs actual, invoicing)

Gantt charts

Natural language search

Long-Term Vision

Advanced scheduling & resource allocation

Map-based obra management

Predictive analytics & anomaly detection

› here are some todos left before releasing this app, create a step by step into implementing them

Add audit logging for cross-tenant risks 6. API & Application Security

Add rate limiting (per IP & per tenant)

Add Zod validation on ALL API routes

Add request signing for sensitive endpoints (HMAC/JWT)

Secrets rotation strategy (Resend, OpenAI, Supabase)

SQL injection audit

XSS & CSRF audit 7. Monitoring, Logging & Observability

Integrate error tracking (Sentry)

8. Infrastructure Resilience

Verify Supabase backup restorability

Load testing (baseline concurrency test)

PHASE 5 — Data Integrity (Week 4) 9. Data Protection

Add soft deletes across all critical tables

Implement orphan record cleanup jobs
(certificates, obras, related artifacts)

PHASE 6 — Product Completeness (Week 4–5) 10. Testing Coverage

Unit tests on critical business logic

Integration tests for all API routes
