---

🔍 COMPREHENSIVE PROJECT AUDIT

Multi-Tenant Construction Management SaaS

Date: November 25, 2025
Project: Multi-Tenant Construction Project Management Platform
Tech Stack: Next.js 16 + React 19 + Supabase + PostgreSQL

---

📊 1. CURRENT FEATURES (What You Have Built)

✅ Core Platform Features

Multi-Tenancy & User Management

- ✅ Full tenant isolation with PostgreSQL RLS
- ✅ Organization-level workspaces (tenants)
- ✅ User invitations with token-based system (72h expiry)
- ✅ Membership management (owner/admin/member roles)
- ✅ Custom role creation per tenant
- ✅ Fine-grained permission system with user overrides
- ✅ Admin impersonation mode for support

Construction Project Management (Obras)

- ✅ Project CRUD operations with 15+ data fields
- ✅ Financial tracking: budget, certified amounts, invoicing
- ✅ Progress tracking (percentage completion)
- ✅ Timeline management
- ✅ Bulk import/export via Excel API
- ✅ Auto-completion detection

Certificate Management (Certificados)

- ✅ Certificate tracking with obra association
- ✅ Invoice tracking (facturado/cobrado status)
- ✅ Amount and date management
- ✅ Advanced search and filtering
- ✅ Dedicated certificates report view

Material Orders

- ✅ Order creation with supplier/requester details
- ✅ Line item management (qty, unit, price)
- ✅ Obra association
- ✅ Bulk import capability

Notifications System

- ✅ In-app notifications with unread tracking
- ✅ Real-time delivery via Supabase subscriptions
- ✅ Multiple notification types (success, reminder, info, workflow)
- ✅ Email infrastructure (Resend integration)
- ⚠️ Email delivery partially implemented

Document Workflow Automation (Pendientes + Flujo)

- ✅ Pending document tracking per obra
- ✅ Due date management with multi-stage reminders
- ✅ 4-stage reminder system (7d, 3d, 1d, due date)
- ✅ On-completion workflow triggers
- ✅ Timing modes: immediate, offset, scheduled
- ✅ Multi-recipient support

Calendar & Events

- ✅ Team calendar with CRUD operations
- ✅ Drag-and-drop event scheduling
- ✅ Audience targeting (me, user, role, tenant)
- ✅ Multiple view modes (week/month/day/agenda)

Audit & Compliance

- ✅ Comprehensive audit log on key tables
- ✅ Before/after data capture
- ✅ User attribution tracking
- ✅ Admin-only access control

Authentication & Security

- ✅ Supabase Auth (Google OAuth + Email/Password)
- ✅ JWT-based session management
- ✅ Row-level security on all tables
- ✅ Route-based authorization
- ✅ Role-based UI filtering (sidebar)

UI/UX Components

- ✅ Advanced data tables with sorting/filtering/pagination
- ✅ Form validation with Zod
- ✅ Responsive design (mobile-first)
- ✅ Dark mode support
- ✅ PDF viewer component
- ✅ Toast notifications (Sonner)
- ✅ Loading states and error handling

---

⚠️ 2. CURRENT TECHNICAL DEBT

🚨 CRITICAL (Must Fix Before Launch)

| #   | Issue                                    | Location                                  | Impact                                                       | Effort   |
| --- | ---------------------------------------- | ----------------------------------------- | ------------------------------------------------------------ | -------- |
| 1   | Email notifications not sent             | app/api/obras/route.ts:197                | Flujo actions create email notifications but never send them | 2-3 days |
| 2   | Missing tenant_id in scheduled reminders | app/api/schedules/dispatch/route.ts       | Breaks multi-tenant isolation in audit logs                  | 1 day    |
| 3   | No email sending for invitations         | app/admin/users/invitation-actions.ts:121 | Users don't receive invitation emails (TODO comment exists)  | 2 days   |
| 4   | No error retry logic                     | All notification endpoints                | Failed emails/notifications are silently dropped             | 3 days   |
| 5   | Synchronous flujo execution              | app/api/obras/route.ts                    | Can timeout with many actions, blocks API response           | 2 days   |

Total Critical Debt: ~10 days

⚠️ HIGH PRIORITY

| #   | Issue                               | Impact                                    | Effort  |
| --- | ----------------------------------- | ----------------------------------------- | ------- |
| 6   | No automated testing (0% coverage)  | Can't confidently deploy changes          | 2 weeks |
| 7   | No monitoring/logging/observability | Can't debug production issues             | 1 week  |
| 8   | No rate limiting on APIs            | Vulnerable to abuse/DDoS                  | 3 days  |
| 9   | Minimal input validation            | Edge case bugs, potential security issues | 1 week  |
| 10  | No CI/CD pipeline                   | Manual deployments, high risk             | 3 days  |
| 11  | No performance optimization         | Slow page loads with large datasets       | 1 week  |

Total High Priority: ~5 weeks

📝 MEDIUM PRIORITY

| #   | Issue                                      | Impact                       |
| --- | ------------------------------------------ | ---------------------------- |
| 12  | TypeScript any types in several components | Reduced type safety          |
| 13  | Hardcoded strings (no i18n constants)      | Maintenance difficulty       |
| 14  | No caching strategy                        | Unnecessary DB queries       |
| 15  | No database connection pooling config      | May hit connection limits    |
| 16  | Missing API documentation                  | Hard for new devs to onboard |
| 17  | No error boundaries in React               | Poor UX on component crashes |
| 18  | Viewer component has 9 TODOs               | Incomplete feature           |

---

👥 3. CURRENT USER WORKFLOWS

Workflow 1: New User Onboarding ✅

Sign up (Google/Email) → Email verification → Onboarding page →
Create/Join tenant → Redirected to dashboard → See pending invitations banner (if invited)
Status: Works well
Gaps: No welcome email, no guided tour

Workflow 2: Inviting Team Members ⚠️

Admin opens /admin/users → Click "Invite" → Enter email → Token generated →
❌ Email NOT sent → User must manually share link → User clicks link →
Accepts invitation → Membership created
Status: Broken (no email sending)
Gaps: Manual link sharing required

Workflow 3: Creating & Managing Obras ✅

User navigates to /excel → Click "+ New Obra" → Fill form → Save →
Auto-completion detection → Triggers flujo actions (if configured) →
❌ Emails NOT sent → In-app notifications work
Status: Partially works
Gaps: Email notifications missing

Workflow 4: Certificate Tracking ✅

Navigate to /certificados → View all certificates → Search/filter →
Click certificate → View details → Update status (facturado/cobrado) → Save
Status: Works well
Gaps: No bulk operations, no export

Workflow 5: Document Reminders ✅

Admin sets pending document with due date → Cron job runs daily →
Checks due dates → Schedules 4-stage reminders →
Notifications sent at each stage → Users notified in-app
Status: Works (in-app only)
Gaps: No email reminders, cron must be manually triggered

Workflow 6: Calendar Events ✅

User opens calendar → Creates event → Sets audience (role/user/tenant) →
Event saved → Recipients notified → Event appears in calendar
Status: Works well
Gaps: No Google Calendar integration, no recurring events

Workflow 7: Role Management ✅

Admin navigates to /admin/roles → Creates custom role (e.g., "Contador") →
Assigns permissions → Assigns role to users → Users see filtered UI
Status: Works well
Gaps: No permission templates, manual setup required

Workflow 8: Audit Review ✅

Admin opens /admin/audit-log → Views change history →
Filters by table/date/user → Reviews before/after data
Status: Works well
Gaps: No export, no alerts on suspicious activity

---

🔐 4. CURRENT RISKS TO BE FIXED

SECURITY RISKS 🔴

| Risk                           | Severity | Mitigation                                              |
| ------------------------------ | -------- | ------------------------------------------------------- |
| No rate limiting               | HIGH     | Add rate limiting middleware (e.g., @vercel/rate-limit) |
| Weak input validation          | MEDIUM   | Add Zod schemas to all API routes                       |
| No API request signing         | MEDIUM   | Add HMAC or JWT signing for sensitive endpoints         |
| No 2FA/MFA                     | MEDIUM   | Add optional 2FA via Supabase Auth                      |
| Audit logs modifiable by admin | LOW      | Make audit log table append-only                        |
| No secrets rotation            | MEDIUM   | Implement key rotation for Resend, OpenAI, etc.         |

OPERATIONAL RISKS 🟠

| Risk                               | Severity | Impact                                              |
| ---------------------------------- | -------- | --------------------------------------------------- |
| No monitoring/alerting             | HIGH     | Can't detect downtime or errors in production       |
| No backup verification             | HIGH     | Don't know if Supabase backups are restorable       |
| No load testing                    | HIGH     | Don't know how many concurrent users you can handle |
| Synchronous workflows              | MEDIUM   | API timeouts under load                             |
| No database indexes audit          | MEDIUM   | Slow queries with large datasets                    |
| Single point of failure (Supabase) | MEDIUM   | If Supabase goes down, entire app is down           |

DATA INTEGRITY RISKS 🟡

| Risk                                      | Impact                                        |
| ----------------------------------------- | --------------------------------------------- |
| No soft deletes (hard deletes everywhere) | Can't recover accidentally deleted data       |
| No data validation on import              | Bad Excel data can corrupt database           |
| No orphan record cleanup                  | Deleted obras may leave orphaned certificates |

COMPLIANCE RISKS 🟣

| Risk                                 | Impact                                     |
| ------------------------------------ | ------------------------------------------ |
| No GDPR data export                  | Can't fulfill data subject access requests |
| No data retention policy             | May store data longer than legally allowed |
| No privacy policy / terms of service | Legal exposure                             |
| No cookie consent banner             | GDPR non-compliance                        |

---

🚀 5. MISSING FEATURES FOR LAUNCH READINESS

ESSENTIAL (Must Have to Launch)

1. ✉️ Email Delivery Completion


    - Fix invitation emails
    - Fix flujo action emails
    - Add email templates (HTML)
    - Add unsubscribe links
    - Effort: 1 week

2. 🧪 Automated Testing


    - Unit tests for critical functions
    - Integration tests for API routes
    - E2E tests for key workflows
    - Effort: 2 weeks

3. 📊 Monitoring & Logging


    - Error tracking (e.g., Sentry)
    - Performance monitoring (e.g., Vercel Analytics)
    - Uptime monitoring (e.g., UptimeRobot)
    - Log aggregation (e.g., Logtail)
    - Effort: 3 days

4. 🛡️ Security Hardening


    - Rate limiting (per IP, per user)
    - Input validation on all endpoints
    - SQL injection prevention audit
    - XSS protection audit
    - Effort: 1 week

5. 🔄 CI/CD Pipeline


    - GitHub Actions for tests
    - Automated deployment to staging
    - Production deployment with approval
    - Database migration automation
    - Effort: 3 days

6. 📝 Legal Pages


    - Terms of Service
    - Privacy Policy
    - Cookie Policy
    - GDPR compliance (data export endpoint)
    - Effort: 1 week (including legal review)

7. 💳 Billing & Subscription System


    - Stripe integration
    - Subscription plans (e.g., Free/Pro/Enterprise)
    - Usage limits per plan
    - Invoice generation
    - Cancellation flow
    - Effort: 2-3 weeks

8. 🎯 Onboarding Improvements


    - Welcome email with getting started guide
    - In-app product tour
    - Sample data for new tenants
    - Effort: 1 week

9. 📖 Documentation


    - User documentation / help center
    - API documentation (if exposing APIs)
    - Admin guide
    - Effort: 1-2 weeks

10. 🔔 Email Templates & Branding


    - Professional HTML email templates
    - Logo and branding
    - Email footer with unsubscribe
    - Effort: 3 days

Total Effort for Launch Readiness: 10-12 weeks

HIGHLY RECOMMENDED (Should Have)

11. Mobile app or PWA - Better mobile experience
12. Bulk operations - Bulk delete, bulk update obras/certificates
13. Advanced search - Full-text search across all entities
14. Export functionality - CSV/PDF export for all data tables
15. Webhook support - Allow integrations with external tools
16. Activity feed - Timeline of recent activity per tenant
17. Dashboard analytics - Charts showing project progress, financial metrics
18. File attachments - Upload files to obras (contracts, photos, etc.)

---

💡 6. POSSIBLE FUTURE FEATURES (Product Roadmap Ideas)

PHASE 2: Enhanced Productivity (3-6 months post-launch)

1. 📎 File Management System


    - Upload contracts, plans, photos to obras //already done in v0.1
    - Version control for documents
    - File viewer with annotations

2. 💬 Team Chat/Comments


    - In-app chat per obra //could repurpose slash clone the memoria descriptiva
    - @mentions and notifications
    - Comment threads on documents // same as file viewer with annotations

3. 📊 Advanced Analytics Dashboard


    - Financial metrics (burn rate, profitability)
    - Project timeline visualization (Gantt charts)
    - Certificate aging analysis //what?
    - Custom reports builder //already demo in certificados

//wont do any of these 4. 🔄 Integration Marketplace - QuickBooks/Xero accounting integration - Google Drive/Dropbox sync - Slack/Teams notifications - Zapier/Make.com webhooks 5. 📱 Mobile App (Native) - iOS and Android apps - Offline mode - Push notifications - Photo capture for site visits

PHASE 3: Advanced Features (6-12 months post-launch)

6. 🤖 AI-Powered Features


    - Auto-categorize documents with OpenAI  //yes
    - Natural language search //yes
    - Smart due date predictions  //why
    - Anomaly detection (budget overruns) //could

7. 📅 Advanced Scheduling


    - Resource allocation (workers, equipment) //yes
    - Drag-and-drop Gantt charts //meh
    - Critical path analysis //what
    - Dependency tracking //what

8. 💰 Financial Management


    - Budget vs actual tracking //yes
    - Cash flow forecasting //yes
    - Payment tracking //yes
    - Client invoicing //yessss

9. 📍 GPS/Map Integration


    - Obra locations on map //yes
    - Route planning for site visits // meh
    - Geofenced check-ins //what

//dont care 10. 🔐 Advanced Access Control - Field-level permissions - Time-based access (temporary access) - IP whitelisting - SSO/SAML integration (for enterprise)

PHASE 4: Enterprise Features (12+ months post-launch)

11. Multi-company support - Parent companies with multiple subsidiaries //could, already requested.
12. White-labeling - Customizable branding per tenant //yes
13. API marketplace - Public API for third-party integrations //meh
14. Advanced compliance - SOC 2, ISO 27001 certification //meh
15. Dedicated hosting - On-premise or private cloud options //meh
16. Custom workflows - Visual workflow builder (no-code) //could

---

🗺️ 7. COMPLETE ROADMAP TO FULLY FUNCTIONING SAAS

PHASE 0: Pre-Launch (NOW - Week 12) 🚦

Goal: Fix critical bugs, add essential features, prepare for first customers

Week 1-2: Critical Bug Fixes 🔴

- Fix email delivery for invitations (app/admin/users/invitation-actions.ts:121)
- Fix email delivery for flujo actions (app/api/obras/route.ts:197)
- Fix missing tenant_id in scheduled reminders (app/api/schedules/dispatch/route.ts)
- Add error retry logic for notifications
- Refactor synchronous flujo execution to async queue

Week 3-4: Security & Infrastructure 🛡️

- Implement rate limiting (use @upstash/ratelimit or similar)
- Add Zod validation to all API routes
- Security audit (SQL injection, XSS, CSRF)
- Set up error tracking (Sentry)
- Set up performance monitoring (Vercel Analytics)
- Configure uptime monitoring

Week 5-7: Billing & Payments 💳

- Integrate Stripe
- Define subscription tiers (Free/Pro/Enterprise)
- Implement usage limits per tier
- Add billing portal
- Build subscription management UI
- Add invoice generation

Week 8-9: Testing & Quality 🧪

- Write unit tests for critical functions (80% coverage goal)
- Write integration tests for API routes
- Set up E2E tests with Playwright or Cypress
- Load testing (find breaking point)
- Fix performance bottlenecks

Week 10: Legal & Compliance 📝

- Draft Terms of Service
- Draft Privacy Policy
- Add GDPR data export endpoint
- Implement cookie consent banner
- Add unsubscribe links to all emails

Week 11: Onboarding & UX 🎯

- Build welcome email sequence
- Add in-app product tour (e.g., using Intro.js)
- Create sample data for new tenants
- Improve error messages

Week 12: CI/CD & Deployment 🚀

- Set up GitHub Actions (lint, test, deploy)
- Configure staging environment
- Set up database migration automation
- Create deployment checklist
- Soft launch to pilot customers 🎉

---

PHASE 1: Launch & Stabilization (Months 3-6) 🌟

Goal: Acquire first 50 paying customers, iterate based on feedback //para pue loco, con 50 users soy gardel

Month 3: Launch

- Public launch
- Marketing website with landing page
- Setup customer support (email, chat)
- User documentation / help center
- Set up analytics (Mixpanel, Amplitude)

Month 4: Feedback & Iteration

- Collect user feedback
- Fix top 10 bugs reported by users
- Add most-requested features (likely: bulk operations, export)
- Improve onboarding based on drop-off data

Month 5: Optimization

- Database query optimization
- Add caching layer (Redis)
- CDN for static assets
- Improve mobile responsiveness

Month 6: Growth

- Add referral program
- Implement user satisfaction surveys (NPS)
- A/B test pricing
- First customer success stories / case studies

KPIs: 50 paying customers, <5% churn, >4.0 NPS

---

PHASE 2: Product Enhancement (Months 7-12) 📈

Goal: Scale to 200 customers, add differentiating features

Q3 Features

- File management system (upload docs to obras)
- Advanced analytics dashboard
- Bulk operations (import/export CSV)
- Webhook support for integrations
- Activity feed / timeline

Q4 Features

- Team chat/comments
- Mobile app (PWA first, then native)
- Integration with accounting software (QuickBooks)
- Custom roles & permissions templates
- Advanced search with filters

KPIs: 200 paying customers, <3% churn, expand to 2-3 verticals

---

PHASE 3: Scale & Enterprise (Months 13-18) 🏢

Goal: Enterprise-ready, scale to 500+ customers

Features

- AI-powered document categorization
- Advanced financial management
- SSO/SAML for enterprise
- API marketplace & developer docs
- White-labeling options
- SOC 2 compliance
- Dedicated hosting options

KPIs: 500+ customers, enterprise contracts (>$10k/year)

---

📋 SUMMARY & RECOMMENDATIONS

Current State Assessment

| Category             | Grade | Notes                                           |
| -------------------- | ----- | ----------------------------------------------- |
| Architecture         | A-    | Excellent multi-tenant design, proper RLS       |
| Features             | B+    | Core features complete, some gaps               |
| Security             | C+    | RLS strong, but missing rate limits, validation |
| Code Quality         | B     | Clean code, but no tests                        |
| Production Readiness | D     | Critical bugs, no monitoring                    |
| UX/UI                | B+    | Modern, responsive, good components             |

Overall: B- (Not ready for production, but strong foundation)

Critical Path to Launch (12 weeks)

Week 1-2: Fix email bugs ✉️
Week 3-4: Security + monitoring 🛡️
Week 5-7: Billing system 💳
Week 8-9: Testing 🧪
Week 10: Legal 📝
Week 11: Onboarding 🎯
Week 12: CI/CD + Launch 🚀

Estimated Costs to Launch

| Item             | Monthly Cost               | Notes                   |
| ---------------- | -------------------------- | ----------------------- |
| Supabase (Pro)   | $25                        | 8GB database, 100K MAUs |
| Vercel (Pro)     | $20                        | Hosting                 |
| Resend (Starter) | $20                        | 50K emails/month        |
| Sentry (Team)    | $26                        | Error tracking          |
| Stripe fees      | 2.9% + $0.30               | Per transaction         |
| Total            | ~$91/mo + transaction fees |                         |

Recommended Next Steps

1. THIS WEEK: Fix the 5 critical bugs (email delivery, tenant_id, etc.)
2. NEXT 2 WEEKS: Add monitoring + security (rate limiting, validation)
3. NEXT 4 WEEKS: Build billing system (Stripe integration)
4. NEXT 3 WEEKS: Add automated testing
5. NEXT 2 WEEKS: Legal + compliance
6. WEEK 12: Deploy to production with first pilot customers

Success Metrics for Launch

- ✅ Zero critical bugs
- ✅ 80%+ test coverage
- ✅ <100ms API response time (p95)
- ✅ 99.9% uptime
- ✅ All legal pages live
- ✅ 10 pilot customers signed up
- ✅ <2 support tickets per customer per month

---

🎯 CONCLUSION

You have built a solid multi-tenant SaaS foundation with:

- Excellent database architecture
- Modern tech stack
- Comprehensive feature set for construction management
- Good security baseline (RLS)

However, to be production-ready, you need:

1. 12 weeks of focused work on critical bugs, testing, billing, and polish
2. ~$91/month infrastructure costs (scales with usage)
3. Legal review for terms/privacy
4. Customer support plan

Recommendation: Follow the 12-week roadmap above. You can have a fully functioning, launch-ready SaaS by early March 2026 if you start now.

Good luck with your launch! 🚀

● ---
I've completed a comprehensive audit of your multi-tenant construction management SaaS. Here's what I found:

Key Findings:

✅ Strengths:

- Excellent multi-tenant architecture with proper PostgreSQL RLS
- Modern tech stack (Next.js 16, React 19, Supabase)
- Comprehensive feature set for construction project management
- Strong core features: obras, certificates, notifications, roles, calendar

🚨 Critical Issues (Must Fix):

1. Email delivery is broken (invitations & flujo actions) - app/api/obras/route.ts:197, app/admin/users/invitation-actions.ts:121
2. Missing tenant_id in scheduled reminders
3. No error retry logic
4. Synchronous workflow execution (can timeout)
5. Zero automated tests

📊 Launch Readiness: D (Not production-ready)

Your Path to Launch:

12-Week Roadmap:

- Weeks 1-2: Fix critical email bugs
- Weeks 3-4: Add security (rate limiting, validation) + monitoring
- Weeks 5-7: Build billing system (Stripe)
- Weeks 8-9: Add automated testing
- Week 10: Legal compliance (Terms, Privacy, GDPR)
- Week 11: Improve onboarding & UX
- Week 12: CI/CD setup → LAUNCH 🚀

Estimated Monthly Costs: ~$91 (Supabase $25 + Vercel $20 + Resend $20 + Sentry $26)

The full audit above includes detailed user workflows, security risks, future feature suggestions, and an 18-month product roadmap.

Would you like me to start fixing the critical bugs first, or would you prefer to tackle a different section of the roadmap?
