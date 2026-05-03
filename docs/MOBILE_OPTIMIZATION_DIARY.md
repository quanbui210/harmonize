# Mobile Optimization Diary

## 2026-05-03

### Entry 1 - Kickoff

Scope confirmed:

- implement clean cursor pagination for products, classifications, and labels together
- use FlatList first (not FlashList) for scalable mobile list rendering
- do a clean contract change (no temporary legacy list response shape)

Implementation plan for this run:

1. add React Query default options in mobile root layout
2. add paginated response contracts in mobile types and API client
3. implement backend cursor pagination for the three main list endpoints
4. migrate library and products screens to paginated FlatList flows
5. validate with diagnostics and lint/type-check

### Entry 2 - Query Defaults Applied

Changed file:

- `mobile/app/_layout.tsx`

What changed:

- added shared React Query defaults:
  - `staleTime: 15s`
  - `gcTime: 5m`
  - `retry: 1` for queries
  - `refetchOnWindowFocus: false` for mobile behavior
  - `retry: 0` for mutations

Why:

- reduce noisy refetching and network churn
- keep a predictable baseline cache policy before pagination refactor

### Entry 3 - Pagination Contracts Added (Mobile Types + Client)

Changed files:

- `mobile/types/api.ts`
- `mobile/lib/api-client.ts`

What changed:

- added shared `CursorPaginatedResponse<T>` contract:
  - `items`
  - `nextCursor`
  - `hasMore`
- replaced array-returning list methods with clean paginated methods:
  - `listProducts(...)`
  - `listClassifications(...)`
  - `listLabels(...)`
- added a shared pagination query builder in API client

Why:

- enforce one clean list contract across the app
- prepare both backend and screens for cursor pagination without mixed legacy shapes

### Entry 4 - Backend Cursor Pagination Implemented

Changed files:

- `src/app/api/v1/products/route.ts`
- `src/app/api/v1/classifications/route.ts`
- `src/app/api/v1/labels/route.ts`

What changed:

- added cursor-based pagination with consistent response shape:
  - `items`
  - `nextCursor`
  - `hasMore`
- added shared limit guardrails in each endpoint:
  - default `20`
  - max `100`
- added stable sort + cursor comparison:
  - products: `createdAt desc, id desc`
  - classifications: `updatedAt desc, id desc`
  - labels: `generatedAt desc, id desc`

Why:

- remove full-list fetch behavior for main saved-work flows
- support infinite loading in mobile screens
- keep a consistent contract for all three list domains

### Entry 5 - Mobile Screen Migration to Paginated Lists (In Progress)

Changed files:

- `mobile/app/products/index.tsx`
- `mobile/app/library.tsx`
- `mobile/app/products/[id].tsx`

What changed:

- moved products history screen to `FlatList` + `useInfiniteQuery`
- added cursor-based `onEndReached` loading for products
- moved library screen to `FlatList` + `useInfiniteQuery`
- added per-section paginated loading in library with section-aware active query
- updated product detail classification list usage to new paginated response shape

Why:

- enable virtualization and incremental loading
- remove render-all list behavior in key saved-work screens
- align all list consumers to one clean paginated contract

### Entry 6 - Validation Complete

Validation performed:

- diagnostics on updated mobile + API + diary files
- `mobile` lint run
- root `type-check` run

Result:

- diagnostics clean
- lint passed
- type-check passed

Current state:

- clean cursor pagination contract is active end-to-end for products, classifications, and labels
- products and library screens now use paginated `FlatList` rendering
- implementation diary will continue for subsequent optimization phases

### Entry 7 - Dashboard Payload Trimmed for Mobile

Changed files:

- `src/server/queries/dashboard.ts`
- `src/app/api/v1/dashboard/route.ts`
- `mobile/types/api.ts`

What changed:

- added optional query flags in `getDashboardOverview(...)`:
  - `includeActiveImports`
  - `includeRecentShipments`
  - `actionItemsLimit`
- mobile dashboard API now requests a trimmed shape:
  - skips active imports query
  - skips recent shipments query
  - caps action items for mobile payload
- mobile dashboard response now returns only fields used by mobile screen
- tightened mobile dashboard typing with `DashboardActionItem` instead of `any[]`

Why:

- reduce unnecessary DB work for mobile dashboard calls
- reduce mobile payload size
- improve type safety for dashboard rendering logic

### Entry 8 - Cache Policy Refinements

Changed files:

- `mobile/app/(tabs)/index.tsx`
- `mobile/app/library.tsx`
- `mobile/app/products/index.tsx`
- `mobile/app/products/[id].tsx`
- `mobile/app/classifications/[id].tsx`

What changed:

- tuned per-screen query stale times:
  - account identity (`me`): longer stale window
  - dashboard: medium stale window
  - paginated library/products lists: medium stale window
  - product detail and classification detail: shorter stale windows
- removed loose `any` usage in dashboard activity mapping

Why:

- lower redundant refetching while keeping data freshness where it matters
- improve perceived performance in repeated navigation flows

### Entry 9 - Post-Refactor Validation + Fix

Validation run:

- diagnostics on updated files
- `mobile` lint
- root `type-check`

Issue found:

- during `type-check`, `approvedCount`/`pendingCount` declarations were missing in `src/server/queries/dashboard.ts` after refactor

Fix applied:

- restored explicit declarations:
  - `approvedCount = totalWithDossiers`
  - `pendingCount = totalClassifications - totalWithDossiers`

Final result:

- diagnostics clean
- mobile lint passed
- type-check passed

### Entry 10 - CORS Audit and Endpoint Hardening

Request:

- revisit mobile-used API endpoints and fix remaining CORS inconsistencies

Audit approach:

- reviewed all `/api/v1` routes used by the mobile API client
- verified each route for:
  - `OPTIONS` preflight support
  - `jsonWithCors(...)` response usage
  - `handleApiError(error, request)` usage in catch paths

Patched routes:

- `src/app/api/v1/vault/upload-url/route.ts`
- `src/app/api/v1/vault/finalize-upload/route.ts`
- `src/app/api/v1/vault/files/route.ts`
- `src/app/api/v1/products/[productId]/images/route.ts`
- `src/app/api/v1/labels/generate/route.ts`
- `src/app/api/v1/labels/[labelId]/route.ts`
- `src/app/api/v1/labels/[labelId]/export/route.ts`
- `src/app/api/v1/classifications/[classificationId]/dossier/route.ts`
- `src/app/api/v1/chat/route.ts`
- `src/app/api/v1/shipments/route.ts`
- `src/app/api/v1/shipments/[shipmentId]/route.ts`
- `src/app/api/v1/rulings/route.ts`
- `src/app/api/v1/rulings/[rulingId]/route.ts`

Result:

- mobile-used v1 routes now consistently support preflight and CORS response headers
- success and error paths are aligned to CORS-safe wrappers

### Entry 11 - Targeted Cache Update Phase

Changed file:

- `mobile/app/classifications/[id].tsx`

What changed:

- reduced broad refetch behavior for refinement-answer and delete mutations
- added targeted cache operations for classification collections:
  - replace updated classification in cached lists (both paginated and non-paginated cache shapes)
  - remove deleted classification from cached lists
- kept `dashboard` and `product` invalidation where cross-entity freshness is still important
- removed direct dependency on full `classifications` invalidation as the primary update mechanism for these flows

Why:

- lower mutation-triggered network churn
- keep UI responsive after answer/delete actions
- preserve correctness while reducing unnecessary refetches

### Entry 12 - Library Classification Thumbnails

Changed files:

- `src/app/api/v1/classifications/route.ts`
- `mobile/app/library.tsx`

What changed:

- classification list API now includes one latest product image for each row (`take: 1`)
- API signs that image server-side and returns `signedUrl` in `product.images[0]`
- library classification rows now render product thumbnail image when available
- existing icon remains as fallback when no image is present

Why:

- improve visual recognition in Saved items by showing the real product image
- keep payload light while still supporting row thumbnails

### Entry 13 - Scan/Classify Cache Churn Reduction + Dossier Thumbnails

Changed files:

- `mobile/app/scan/classify.tsx`
- `mobile/app/products/[id]/scan.tsx`
- `mobile/app/products/[id].tsx`
- `mobile/app/library.tsx`

What changed:

- replaced broad scan/classify invalidation patterns with targeted cache updates:
  - upsert classification into cached `classifications` collections
  - upsert product into cached `products` collections when payload includes product
  - set classification detail cache directly (`['classification', id]`)
- refined `products/[id]/scan` upload success path:
  - append uploaded image into `['product', productId]` cache instead of broad list invalidation
- kept `dashboard` invalidation as selective cross-entity refresh
- added same thumbnail rendering for dossier rows in library for visual consistency

Why:

- reduce network churn after repeated scan/classify actions
- keep detail/list screens responsive after mutation-heavy flows
- maintain consistent visual row treatment for both classifications and dossiers

### Entry 14 - Origin/Destination Scan Context + Duty Copy Clarification

Changed files:

- `mobile/app/scan/classify.tsx`
- `mobile/app/products/[id]/scan.tsx`
- `src/app/api/v1/classifications/route.ts`
- `src/server/actions/classification-search.ts`
- `mobile/app/classifications/[id].tsx`

What changed:

- added trade-context inputs in scan screens:
  - `origin country`
  - `destination country`
- scan-first classify flow now requires both values before starting scan/classify
- product rescan flow now persists context to product metadata before reclassification
- classification API productId path now carries destination country from product evidence into classification action
- classification action now persists `destinationCountry` in product metadata (create + update)
- clarified duty wording in classification detail:
  - section title: `Estimated import charges`
  - metric label: `Estimated customs duty (third-country)`

Why:

- improve duty/VAT estimate quality by including route context early
- align scan/recheck experience with customs reality (origin + destination matter)
- reduce user confusion around “third country duty” terminology

### Entry 15 - Web Parity For Origin/Destination Capture

Changed files:

- `src/components/classification/classification-search-form.tsx`
- `src/components/classification/product-scan-section.tsx`

What changed:

- manual web classification now requires both `originCountry` and `destinationCountry`
- manual flow now includes `destinationCountry` in the loading payload sent to classification action
- scan web flow now validates both origin/destination before quick classify
- scan destination country defaults to `Finland` for practical VAT-path onboarding consistency

Why:

- align web behavior with mobile trade-context capture
- ensure classification action receives complete route context for duty/VAT logic
- prevent silent missing-context runs from web classify forms

### Entry 16 - Mobile Google OAuth + Themed Dual-Option Login

Changed files:

- `mobile/components/AuthProvider.tsx`
- `mobile/app/sign-in.tsx`
- `mobile/app/auth/callback.tsx`

What changed:

- added Google OAuth sign-in for mobile using secure system browser auth session
- implemented deep-link callback parsing and Supabase session completion:
  - supports code exchange (`exchangeCodeForSession`)
  - supports token callback fallback (`setSession`)
- added auth URL listeners for initial URL and runtime URL events
- redesigned sign-in screen to current mobile theme with both options:
  - `Continue with Google`
  - username/email + password sign-in
- added dedicated `auth/callback` route to provide stable redirect landing behavior

Why:

- enable shared web/mobile account login without embedded WebView OAuth risks
- keep authentication UX clean and aligned with existing app design language
- support robust callback completion across app resume and cold-start scenarios
