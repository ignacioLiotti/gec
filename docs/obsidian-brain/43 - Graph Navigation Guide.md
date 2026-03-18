# Graph Navigation Guide

tags: #reference #overview

## Color Legend

The graph uses **14 color groups** where the **last matching tag wins** per note. Each color maps to a domain cluster:

| Color | Cluster | Hex | Key Tags |
|-------|---------|-----|----------|
| 🔵 Steel Indigo | Architecture / Code Reference | `#5C6BC0` | `#architecture` `#api` `#libraries` |
| 🟤 Brown | Infrastructure / DevOps / Config | `#6D4C41` | `#testing` `#config` `#billing` `#jobs` |
| 🟡 Amber-Gold | Database / Migrations | `#F9A825` | `#database` `#migrations` `#postgresql` |
| 🟣 Deep Violet | AI / OCR / Extraction | `#6A1B9A` | `#ocr` `#ai` `#extraction` |
| 🟡 Amber | Data Tables | `#FFB300` | `#tablas` `#schema` `#data` |
| 🔵 Teal-Cyan | User Flows / UX / Onboarding | `#00838F` | `#user-flow` `#ux` `#onboarding` |
| 🔵 Dark Blue | Reporting / Analytics | `#1565C0` | `#reporting` `#analytics` `#signals` |
| 🟢 Dark Teal | Notifications / Calendar / Comms | `#00897B` | `#notifications` `#calendar` `#whatsapp` |
| 🟢 Green | Workflow / Automation | `#43A047` | `#workflow` `#flujo` `#engine` |
| 🟣 Purple | Admin / Permissions / Roles | `#7B1FA2` | `#admin` `#permissions` `#rbac` |
| 🔴 Red | Security / RLS / Audit | `#C62828` | `#security` `#rls` `#audit` `#secrets` |
| 🩷 Pink | Auth / Identity / Invitations | `#AD1457` | `#auth` `#tenancy` `#invitations` |
| 🟠 Deep Orange | Core Domain Features | `#F4511E` | `#obras` `#certificates` `#materials` `#documents` |
| 🔵 Sky Blue | Navigation / Pages / UI | `#039BE5` | `#routing` `#excel` `#ui` `#sidebar` |

> **Hub note** (`00 - Home`) has no tags and appears as the default color — visually distinct as the central connector.

---

## Filtered Graph Views

Open the graph view, click the **Filter** caret (top-left panel), and paste one of these queries into the search box:

### 🏗️ Architecture & Code
Shows the meta-documentation, API reference, and library docs.
```
tag:#architecture OR tag:#api OR tag:#libraries OR tag:#reference
```

### 🧱 Core Domain Features
Shows obras, certificates, materials, documents — the main product entities.
```
tag:#obras OR tag:#certificates OR tag:#materials OR tag:#documents OR tag:#tablas
```

### 🔐 Security & Auth Cluster
Shows all security, RLS, auth, and secrets documentation.
```
tag:#security OR tag:#auth OR tag:#rls OR tag:#audit OR tag:#secrets OR tag:#invitations
```

### 🗄️ Database Deep-Dives
Shows all database schema, migration, and pattern notes.
```
tag:#database OR tag:#migrations OR tag:#schema OR tag:#patterns
```

### ⚙️ Automation & Workflows
Shows workflow, flujo, engine, and background job notes.
```
tag:#workflow OR tag:#flujo OR tag:#engine OR tag:#jobs OR tag:#automation
```

### 📬 Notifications & Comms
Shows notifications, calendar, WhatsApp, reminders.
```
tag:#notifications OR tag:#calendar OR tag:#whatsapp OR tag:#reminders OR tag:#email
```

### 📊 Reporting & Analytics
Shows reporting, signals, findings, and report UI notes.
```
tag:#reporting OR tag:#analytics OR tag:#signals OR tag:#reports
```

### 🛡️ Admin & Permissions
Shows admin panel, permissions system, role management.
```
tag:#admin OR tag:#permissions OR tag:#rbac OR tag:#roles OR tag:#configuration
```

### 🤖 AI & OCR
Shows the OCR pipeline, AI extraction, and related imports.
```
tag:#ocr OR tag:#ai OR tag:#extraction
```

### 🚀 User Journeys
Shows onboarding, UX flows, user walkthrough, auth flows.
```
tag:#user-flow OR tag:#onboarding OR tag:#ux OR tag:#walkthrough OR tag:#auth OR tag:#tenants
```

### 🏠 Pages & Navigation
Shows all routing, UI pages, sidebar, and workspace notes.
```
tag:#routing OR tag:#ui OR tag:#navigation OR tag:#excel OR tag:#workspace
```

### ☁️ Infrastructure & Config
Shows testing, observability, env vars, billing, background jobs.
```
tag:#testing OR tag:#config OR tag:#environment OR tag:#billing OR tag:#jobs
```

---

## Tips for Using the Graph

### Local Graph
Right-click any note → **Open local graph** to see only the connections _from that specific note_. Great for understanding what a single module touches.

### Depth Control
In the graph panel, increase **Depth** to 2 or 3 to see indirect connections (neighbors of neighbors). Useful for seeing how a feature connects to security, database, AND notifications simultaneously.

### Hide Orphans
Toggle **Show orphan notes** off to see only connected notes. Since all notes link to related ones, this should show a single connected cluster.

### Combining Filters
You can **exclude** categories:
```
-tag:#reference -tag:#testing
```
Or combine include + exclude:
```
(tag:#security OR tag:#auth) -tag:#database
```

---

## Understanding the Cluster Layout

The graph should naturally form these visual clusters when you open it:

```
                    [Architecture Hub]
                           │
          ┌────────────────┼────────────────┐
          │                │                │
   [Security/Auth]   [Domain Features]   [Admin/Config]
          │                │                │
     [Database]      [Automation]      [Notifications]
          │                │                │
    [Migrations]     [Reporting]        [Calendar]
```

Notes with many cross-domain links (like `02 - Multi-Tenancy`) will appear near the center, while highly specialized deep-dives (like `38 - Soft Delete Pattern`) will be on the periphery.

---

## Related Notes

- [[00 - Home]]
- [[01 - Architecture Overview]]
