# Multi-Tenant Construction SaaS — Second Brain

> **Stack:** Next.js 16 (App Router) · React 19 · Supabase (PostgreSQL + RLS + Realtime) · TanStack React Query · shadcn/ui (orange theme) · Resend (email) · Sentry (observability)

This vault is a full second-brain documentation of the codebase. Navigate via graph view or the links below.

---

## Core Concepts (Start Here)

- [[01 - Architecture Overview]] — Tech stack, file structure, data flow
- [[02 - Multi-Tenancy & Auth]] — How tenants, users, roles, and sessions work
- [[03 - Routing & Navigation]] — Pages, layouts, sidebar, route guards

## Domain Features

- [[04 - Obras (Construction Projects)]] — The central entity of the app
- [[05 - Tablas (Data Tables)]] — Per-obra structured data tables with OCR/CSV import
- [[06 - Excel View]] — Spreadsheet-like UI with tabs per obra
- [[07 - Macro Tables]] — Cross-obra aggregation and reporting
- [[08 - Certificados (Certificates)]] — Financial certificate tracking
- [[09 - Materials & Orders]] — Material order management with OCR import
- [[10 - Documents & File Manager]] — Supabase storage, folder structure, APS 3D viewer
- [[11 - Quick Actions]] — Tenant-configured multi-step workflows on obras

## Automation & Communication

- [[12 - Workflow & Flujo System]] — Obra completion flows, automation
- [[13 - Notifications Engine]] — In-app, email, and event-driven notifications
- [[14 - Calendar & Events]] — Team calendar, drag-drop, event targeting
- [[15 - Document Reminders & Pendientes]] — Due-date reminders and pending items
- [[16 - WhatsApp Integration]] — Webhook for WhatsApp messages

## Reporting & Exports

- [[17 - Reports System]] — Configurable reports, share links, PDF export
- [[18 - OCR Pipeline]] — AI-powered document data extraction

## Admin & Ops

- [[19 - Admin Panel]] — Users, roles, obra defaults, audit log
- [[20 - Permissions System]] — Role matrix, user overrides, route access
- [[21 - Tenant Secrets & Security]] — Request signing, rate limiting, secrets
- [[22 - Expenses & Usage Tracking]] — AI cost tracking, subscription plans
- [[23 - Observability & Testing]] — Sentry, Vitest, Playwright

## Data & Code Reference

- [[24 - Database Schema]] — Key tables and relationships
- [[25 - API Reference]] — All API routes mapped
- [[26 - Key Libraries & Utilities]] — tablas.ts, macro-tables.ts, date parsing, etc.
- [[27 - User Flow Walkthrough]] — End-to-end user journeys

## Deep Dives (Advanced)

- [[28 - Database Migrations]] — All 86 migrations with phase map and SQL patterns
- [[29 - Signals, Findings & Reporting Engine]] — Computed KPIs, rule engine, PMC metrics
- [[30 - Background Jobs]] — Async job queue, cron processing
- [[31 - RLS & Security Policies]] — All RLS policy layers, recursion fix, SECURITY DEFINER
- [[32 - Environment Variables & Config]] — All env vars with defaults and failure modes
- [[33 - Superadmin Implementation]] — Hardcoded UUID, auto-enrollment triggers, impersonation
- [[34 - Invitation System]] — Token-based invitations, 72h expiry, SECURITY DEFINER helpers
- [[35 - Usage Metering & Subscriptions]] — AI token/storage/WhatsApp tracking, plan limits
- [[36 - Dynamic Tables Deep Dive]] — obra_tablas schema, JSONB rows, OCR chain, PMC presets
- [[37 - Audit Log System]] — Configurable trigger, 14 tracked tables, noise reduction
- [[38 - Soft Delete Pattern]] — Trigger-based soft delete, orphan cleanup, restore
- [[39 - API Secrets & Request Signing]] — HMAC-SHA256, key rotation, rate limiting
- [[40 - Flow Engine (PMC State Machine)]] — Event-sourced state machine, PMC flow, engine-mvp branch
- [[41 - Onboarding Flow]] — New user signup, tenant creation, invitation acceptance
- [[42 - Flujo Actions & Workflow Runtime]] — Durable workflow steps, sleep, cancellation, delivery

## Graph Guide

- [[43 - Graph Navigation Guide]] — Color legend, filter queries for focused views, layout tips

---

## Quick Orientation

```
app/                     # Next.js App Router pages & API routes
  admin/                 # Admin-only pages (users, roles, macro-tables, etc.)
  api/                   # REST API endpoints (all server-side)
  excel/[obraId]/        # Main obra workspace (tabs: general, documents, flujo, etc.)
  macro/                 # Macro table viewer
  certexampleplayground/ # Dev playground for certificate import
components/              # Shared React components
  app-sidebar.tsx        # Main navigation sidebar
  form-table/            # Core spreadsheet table component
  event-calendar/        # Full calendar with drag-drop
  report/                # Report rendering system
  viewer/                # PDF + 3D document viewer
lib/                     # Server-side utilities and shared logic
  tablas.ts              # Tabla schema, parsing, formula evaluation
  macro-tables.ts        # Macro table types and mapping
  notifications/         # Notification engine (rules, recipients, delivery)
  workflow/              # Workflow execution helpers
  email/                 # Resend email wrappers
  security/              # Rate limiting, request signing
utils/supabase/          # Supabase client factories (server/client/admin)
tests/                   # Vitest unit tests + Playwright e2e tests
```
