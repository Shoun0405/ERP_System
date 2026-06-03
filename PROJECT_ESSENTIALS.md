# 📊 Project Essentials — ERP System

**Prepared by:** Technical Project Manager · **Date:** 2026-06-03 (rev. after Phase 16 merge) · **Branch:** `main`

---

## 1. Executive Summary

A **mature, full-stack ERP** for textile/building-materials trading (Uzbek UI, UZS currency). The product is **production-ready for LAN deployment (5–20 internal users)**. Engineering discipline is high: 81/81 automated tests passing, atomic DB transactions, SQL aggregation (no N+1), RBAC enforced, security hardened.

**Recent change:** Phase 16 (`scaling-architecture-planning` branch) was fast-forward merged into `main` and pushed — closing risks **H-1, H-5, H-6, M-2** and adding the Audit Trail UI (M-7). The DB was migrated to `Decimal(18,2)` for money fields.

**Headline risk:** one **CRITICAL financial-integrity gap (C-2)** remains open — the server trusts client-supplied sale line totals instead of recalculating them. This must close before any multi-user financial reliance.

| Dimension | Status |
|---|---|
| Core ERP features | 🟢 Complete (Phases 1–13) |
| Authentication & RBAC | 🟢 Done (Phase 14) |
| Audit / reports / Decimal | 🟢 Done (Phase 16) |
| Financial integrity | 🔴 **Open (C-2)** |
| Inventory / stock | 🟡 Not started (Phase 15) |
| Test coverage | 🟢 81/81 passing |
| CI/CD & Docker | 🔴 None (Phase 17) |

---

## 2. Technology Stack

**Backend** — Node.js / CommonJS
- Express **5**, Prisma **6** ORM, PostgreSQL (`erp_db`), connection pooling (limit 20)
- Auth: `jsonwebtoken` + `bcryptjs`, helmet, express-rate-limit, cors, cookie-parser
- Validation: **Zod** (centralized in `routes/_schemas.js`)
- Document export: Puppeteer (HTML→PDF), docxtemplater + LibreOffice (Word→PDF), pdf-lib (merge), ExcelJS
- Tests: **Vitest + Supertest**

**Frontend** — ESM
- **React 19**, Vite 8, **Tailwind CSS v4** (Vite plugin), React Router 7
- Axios (shared instance + 401 interceptor), react-hot-toast, Chart.js, lucide-react
- State: hooks + Context only (no Redux/Zustand) — appropriate for current scale
- Tests: **Playwright E2E**

> ⚠️ **Doc drift:** CLAUDE.md still says *"There is no test suite"* — outdated. A Vitest + Playwright suite now exists. Recommend updating CLAUDE.md.

---

## 3. Architecture Design

**Clean separation of concerns**, two independent Node projects.

- **Backend:** `server.js` (15-line entry) → `app.js` (middleware + mounting) → 16 entity routers. Shared Prisma singleton. Debt is **never stored** — always computed `SUM(sales) − SUM(payments)`. Multi-table writes wrapped in `$transaction`. 13 Prisma models with UUID PKs, FK indexes, cascade deletes, and an `AuditLog` model.
- **Security layers:** JWT (enforced 32-char secret, 24h TTL) → auth middleware → **in-memory token revocation** → RBAC (`requirePermission(module, action)`, granular read/create/update/delete).
- **Frontend:** Permission-driven route rendering, httpOnly-cookie sessions, global date-filter context (1C-style), dark/light theming via CSS variables.

**Architectural strengths:** no N+1 queries, idempotent scripts, centralized error masking (no Prisma stack leaks to client), DRY helpers. The codebase faithfully follows its own 23 AI-coding rules.

---

## 4. Risk Register (audit 2026-06-02, updated after Phase 16 merge)

| ID | Severity | Issue | Status |
|---|---|---|---|
| C-1 | 🔴 Critical | JWT fallback secret | ✅ Fixed |
| **C-2** | 🔴 **Critical** | **Server doesn't recalc sale `rowAmount` — trusts client** | ❌ **OPEN (Phase 15)** |
| C-3 | 🔴 Critical | GET endpoints lacked RBAC | ✅ Fixed |
| H-1 | 🟠 High | VAT hardcoded 12% despite settings field | ✅ Fixed (Phase 16) |
| H-2 | 🟠 High | Contract-numbering race condition | ❌ Open (Phase 15) |
| H-5 | 🟠 High | Report endpoints scan full tables (DoS at 10k+ rows) | ✅ Fixed (Phase 16) |
| H-6 | 🟠 High | `xlsx@0.18.5` — known CVE (proto pollution / ReDoS) | ✅ Fixed (removed, Phase 16) |
| M-2 | 🟡 Med | Money fields are `Float`, not `Decimal(18,2)` | ✅ Fixed (Phase 16 + DB migrated) |
| M-7 | 🟡 Med | Audit-log payload not sanitized | ✅ Fixed (Phase 16) |

---

## 5. Roadmap

- **Phase 16** — ✅ **DONE** — Audit-log viewer UI, `Decimal(18,2)` money migration, configurable VAT, report optimization, batch ZIP export, `xlsx` removal. *(Merged to `main`, DB migrated.)*
- **Phase 15** — 🔜 **NEXT (highest priority)** — Inventory (stock journal, over-sell lock via `SELECT…FOR UPDATE`) + **C-2 financial integrity** + contract-numbering lock (H-2).
- **Phase 17** — CI (GitHub Actions), extended test coverage. *No Docker/CI exists today.*
- **Scaling** — see `MIQYOSLASH.md` (preventive scaling/architecture roadmap added in Phase 16).

---

## 6. PM Recommendations

1. **Block financial trust until C-2 ships** — server-side recalculation of all sale totals is non-negotiable before relying on the system for accounting. This is now the single most important open item.
2. **Bundle the race conditions into Phase 15** — H-2 (contract numbering) fits naturally into the same transaction/locking work as C-2.
3. **Refresh CLAUDE.md** — remove the stale "no test suite" note (suite now has 81 tests); document the export stack's LibreOffice/Puppeteer system dependency.
4. **Stand up CI early (Phase 17)** — 81 passing tests deliver little value if not gated on every commit.
5. ~~Patch the `xlsx` CVE (H-6)~~ ✅ Done — package removed in Phase 16.
6. ~~Migrate money to `Decimal` (M-2)~~ ✅ Done — schema + live DB migrated to `Decimal(18,2)`.

**Overall verdict:** 🟢 **Healthy, well-engineered project.** Disciplined execution and strong test coverage (81/81). Phase 16 closed four security/integrity risks. The remaining gap between "running" and "trustworthy for finance" is narrow and well-understood — almost entirely **Phase 15 (C-2 + inventory)**, which is now the immediate sprint priority.
