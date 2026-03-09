# Admin Panel Execution Plan

## Goal
Create a secure Admin Panel to:
1. Manage users (view list).
2. Manually ingest BTI rulings (via CSV upload).
3. Trigger AI enrichment for new rulings.
4. Secure access to a specific `admin@admin.com` account (System Admin).

## Phase 1: Database & Schema
- [ ] **Schema Update**:
  - Add `enum SystemRole { USER, ADMIN }` to `prisma/schema.prisma`.
  - Add `systemRole SystemRole @default(USER)` to `User` model.
- [ ] **Migration**:
  - Generate the SQL migration for the above change.
- [ ] **Seeding**:
  - Create `scripts/seed-admin.ts` to ensure `admin@admin.com` exists with `systemRole: ADMIN`.

## Phase 2: Logic Refactoring
- [ ] **Refactor Ingestion**:
  - Extract logic from `scripts/ingest-bti.ts` to `src/lib/bti/ingestion.ts`.
  - Adapt to accept file buffer/stream instead of hardcoded path.
- [ ] **Refactor Enrichment**:
  - Extract logic from `scripts/enrich-bti-fi.ts` to `src/lib/bti/enrichment.ts`.
  - Make it callable as a function.

## Phase 3: Server Actions & Auth
- [ ] **Admin Auth**:
  - Create `src/lib/auth/admin.ts` with `requireSystemAdmin()` function.
- [ ] **Server Actions**:
  - Create `src/server/actions/admin.ts`:
    - `uploadBtiCsvAction(formData)`
    - `triggerEnrichmentAction()`
    - `getSystemStatsAction()`
    - `getUsersAction()`

## Phase 4: Frontend Implementation
- [ ] **Layout**:
  - Create `src/app/admin/layout.tsx` (Protected route).
- [ ] **Dashboard**:
  - Create `src/app/admin/page.tsx` (Overview & Navigation).
- [ ] **Rulings Page**:
  - Create `src/app/admin/rulings/page.tsx`.
  - Implement CSV Upload UI.
  - Implement "Start Enrichment" button.
- [ ] **Users Page**:
  - Create `src/app/admin/users/page.tsx` (Table view).

## Phase 5: Verification
- [ ] Run seed script.
- [ ] Login as admin.
- [ ] Test access control (try as normal user).
- [ ] Test CSV upload.
- [ ] Test enrichment trigger.
