✅ PRE-LAUNCH ROADMAP
PHASE 1 — Core Stability & Blocking Bugs (Week 1–2)

Absolute must-fix items needed to prevent broken functionality at launch.

1. Email Delivery Completion (Critical)

Implement missing flujo email sending (app/api/obras/route.ts:197)

Add tenant-aware reminder emails (fix tenant_id missing in scheduled reminders)

Implement invitation email sending (app/admin/users/invitation-actions.ts)

Add retry logic for all notification endpoints (queue or scheduled retry)

Add unsubscribe links + email preferences (basic MVP)

2. Asynchronous Workflow Fixes

Convert synchronous flujo execution → background job / queue
(avoids timeouts & unlocks scalable workflows)

Add retries + error propagation across async tasks

3. Multi-Tenant Isolation (Critical)

Ensure all scheduled jobs include tenant_id

Add audit logging for cross-tenant risks

PHASE 2 — High-Impact Performance & UX (Week 2–3) 4. Performance Optimization

Add caching layer (server-side caching + browser caching)

Add DB connection pooling config

Audit DB indexes + add missing ones

Optimize large dataset queries and pagination

5. Frontend Reliability

Implement React error boundaries (global + module-specific)

Resolve TODOs in Viewer component (9 items)

Add loading skeletons / fallback UI where needed

PHASE 3 — Security Hardening (Week 3) 6. API & Application Security

Add rate limiting (per IP & per tenant)

Add Zod validation on ALL API routes

Add request signing for sensitive endpoints (HMAC/JWT)

Secrets rotation strategy (Resend, OpenAI, Supabase)

SQL injection audit

XSS & CSRF audit

PHASE 4 — Operational Readiness (Week 3–4) 7. Monitoring, Logging & Observability

Integrate error tracking (Sentry)

Add uptime monitoring (UptimeRobot/Pingdom)

Centralize logs (Logtail or Supabase logs)

Add notifications for production failures (Slack/Email)

8. Infrastructure Resilience

Verify Supabase backup restorability

Load testing (baseline concurrency test)

Review synchronous workflows & convert remaining ones

Evaluate database growth risks (indexes, partitions)

PHASE 5 — Data Integrity (Week 4) 9. Data Protection

Add soft deletes across all critical tables

Implement orphan record cleanup jobs
(certificates, obras, related artifacts)

Add referential integrity constraints where missing

PHASE 6 — Product Completeness (Week 4–5) 10. Testing Coverage

Unit tests on critical business logic

Integration tests for all API routes

E2E test suite for major workflows (invites, creating obra, certificates)

11. CI/CD Pipeline

Deployment pipeline with manual production approval

Automatic migrations during deploy

Pre-deploy test suite gate

PHASE 7 — Business Requirements (Week 5–6) 12. Billing & Subscription System

Subscription plans (Free / Pro / Enterprise)

Usage limits enforcement

Invoice generation

Cancellation & grace period logic

Webhook handling for billing provider (Stripe recommended)

13. Onboarding Experience

In-app product tour

Sample data for new tenants

Quick-start wizard

14. Documentation (Internal + External)

User documentation / help center

Admin guide

API route documentation

Disaster recovery procedures (internal)

🚀 Sequence Summary
Launch Blockers

Email delivery + retries

Async workflows

Multi-tenant correctness

Basic performance & caching

Security essentials

Monitoring/logging

Automated tests (minimal)

Pre-launch Nice-but-Necessary

Viewer TODO cleanup

Soft deletes & orphan cleanup

Billing system

Onboarding improvements

Documentation
