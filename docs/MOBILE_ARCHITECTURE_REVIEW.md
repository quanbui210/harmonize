# TulliCheck Mobile Architecture Review

## Purpose

This document reviews the current TulliCheck mobile application architecture, focusing on:

- core mobile flow and screen responsibilities
- authentication and API access
- data fetching and cache behavior
- endpoint design and payload shape
- pagination and list scalability
- performance strengths and risks
- recommended optimization priorities

This is a review of the current implementation state. It does not change runtime behavior.

## Stack Summary

The mobile app currently uses:

- React Native with Expo and Expo Router
- Supabase authentication
- TanStack Query for server-state fetching and mutation invalidation
- a centralized typed API client
- Next.js App Router API endpoints under `/api/v1`
- Prisma-backed server data access

This is a good architectural base for a production mobile app. The main opportunity is not a full redesign, but improving scalability and data delivery for growing workspaces.

## Core Mobile Logic

### 1. App Shell

The root mobile shell is defined in:

- `mobile/app/_layout.tsx`
- `mobile/app/(tabs)/_layout.tsx`

Current responsibilities:

- boot the shared `QueryClientProvider`
- boot the shared `AuthProvider`
- gate tabs behind authentication
- register stack routes such as account, library, preview, classifications, products, and scan

### 2. Authentication Flow

Authentication is handled in:

- `mobile/components/AuthProvider.tsx`
- `mobile/lib/supabase.ts`
- `mobile/lib/api-client.ts`

Current behavior:

- session is restored with `supabase.auth.getSession()`
- auth state changes are subscribed to once
- the API client retrieves the latest access token before each request
- bearer auth is attached centrally in `fetchWithAuth(...)`

Benefits:

- simple and predictable auth boundary
- API calls do not duplicate token logic per screen
- sign-in and sign-out remain centralized

Trade-off:

- `supabase.auth.getSession()` is called for every authenticated API request, which is acceptable now but adds repeated async overhead

### 3. Main User Areas

#### Dashboard

Main file:

- `mobile/app/(tabs)/index.tsx`

Responsibilities:

- workspace identity header
- audit-readiness overview
- quick entry into scan and label generation
- summary counts
- recent activity
- top-right account/menu actions

Data used:

- `GET /auth/me`
- `GET /dashboard`

#### Library

Main file:

- `mobile/app/library.tsx`

Responsibilities:

- view all classifications
- view all labels
- view all dossiers
- reopen saved work

Data used:

- `GET /classifications`
- `GET /labels`
- dossiers derived from classifications with dossier data

#### Products / History

Main file:

- `mobile/app/products/index.tsx`

Responsibilities:

- show saved products and scan history
- local search over fetched products
- reopen a product
- add more photos to an existing product

Data used:

- `GET /products`

#### Classification Detail

Main file:

- `mobile/app/classifications/[id].tsx`

Responsibilities:

- fetch and render one classification record
- display customs code result and commercial impact
- show refinement questions
- allow refinement answers
- show import guidance, trade alerts, rationale, and follow-up actions
- route to label or dossier
- allow deletion

Data used:

- `GET /classifications/:id`
- `POST /classifications/:id/refinement`
- `DELETE /classifications/:id`
- `GET/POST /classifications/:id/dossier`

## Data Fetching Strategy

### Current Technique

The app uses TanStack Query for all main server-state flows.

Patterns currently in use:

- `useQuery(...)` for loading screens
- `useMutation(...)` for writes
- manual invalidation after mutations
- `enabled` flags when auth or IDs are required
- pull-to-refresh for user-driven refetching

This is the correct general technique for a mobile workspace app.

### What Is Working Well

- network state is separated from view state
- writes invalidate related query keys
- screens do not manually manage complex loading caches
- refetch behavior is understandable and debuggable
- data access is centralized through `ApiClient`

### What Is Not Optimized Yet

The app currently uses the default `QueryClient` with no shared query defaults.

That means:

- queries are stale immediately by default
- caching strategy is not tuned per screen type
- retries, stale windows, and garbage collection windows are not standardized

This is acceptable for an early build, but not ideal for performance-sensitive mobile usage.

## Current API Surface Used by Mobile

### Auth

- `GET /api/v1/auth/me`

### Dashboard

- `GET /api/v1/dashboard`

### Products

- `GET /api/v1/products`
- `POST /api/v1/products`
- `GET /api/v1/products/:productId`
- `PATCH /api/v1/products/:productId`
- `GET /api/v1/products/:productId/images`
- `POST /api/v1/products/:productId/images`

### Classifications

- `GET /api/v1/classifications`
- `POST /api/v1/classifications`
- `GET /api/v1/classifications/:classificationId`
- `DELETE /api/v1/classifications/:classificationId`
- `POST /api/v1/classifications/:classificationId/refinement`
- `GET /api/v1/classifications/:classificationId/dossier`
- `POST /api/v1/classifications/:classificationId/dossier`

### Labels

- `POST /api/v1/labels/generate`
- `GET /api/v1/labels`
- `GET /api/v1/labels/:labelId`
- `GET /api/v1/labels/:labelId/export`

### Vault

- `GET /api/v1/vault/files`
- `POST /api/v1/vault/upload-url`
- `POST /api/v1/vault/finalize-upload`

### Secondary Shared Client Domains

These exist in the mobile client but are not central to the current mobile redesign:

- shipments
- rulings
- compliance chat

## Pagination Review

## Verdict

The mobile app does not yet have a strong scalable pagination strategy for its main list views.

### Classifications

Current state:

- `GET /api/v1/classifications` accepts `limit`
- server caps results with `take`
- there is no `cursor`
- there is no `nextCursor`
- there is no `hasMore`

Assessment:

- acceptable for small datasets
- not enough for large workspaces

### Labels

Current state:

- `GET /api/v1/labels` accepts `limit`
- server caps results with `take`
- there is no `cursor`
- there is no `nextCursor`
- there is no `hasMore`

Assessment:

- same limitation as classifications

### Products

Current state:

- `GET /api/v1/products` returns the full product list
- there is no limit, offset, or cursor

Assessment:

- this is the highest list-scaling risk in the current mobile app

### Shipments and Rulings

Current state:

- some endpoints support `limit` and `offset`

Assessment:

- better than the main mobile lists in one sense
- still not ideal compared with cursor-based mobile list pagination

## Rendering Performance Review

### Good

- detail screens are divided into reasonably isolated sections
- some derived values are memoized
- expensive logic is not deeply repeated in render for most screens
- mutation logic is centralized and invalidates correctly

### Main Risks

#### 1. Non-virtualized Large Lists

Current pattern:

- main list screens use `ScrollView` and `.map(...)`

Impact:

- all visible and offscreen rows are rendered together
- memory and layout cost increase as data grows

Recommendation:

- move list-heavy screens to `FlatList` or `FlashList`

#### 2. Eager Fetching in Library

Current pattern:

- library loads classifications and labels immediately
- dossier tab is derived from all classifications

Impact:

- extra network work before it is needed
- more memory retained in one screen

Recommendation:

- lazy-load the active library section
- fetch dossiers as a dedicated view or a filtered paginated classification query

#### 3. Untuned Cache Defaults

Current pattern:

- no global stale time policy

Impact:

- more frequent refetching than needed
- less predictable network usage

Recommendation:

- add per-query-category defaults for dashboard, lists, and detail screens

#### 4. Full Dataset Search on Client

Current pattern:

- products are fully fetched and then filtered locally

Impact:

- fine for small lists
- inefficient for large saved histories

Recommendation:

- move toward server-supported search or cursor pagination plus client filter over loaded pages

## Payload and Endpoint Efficiency Review

### Good

- the mobile API is relatively clean and focused
- detail endpoints include the related entities actually used by the UI
- serializers normalize complex fields like `humanNotes`
- classification detail already limits nested images and labels

### Needs Improvement

#### Dashboard Payload

The current dashboard query still fetches and returns:

- `activeImports`
- `recentShipments`

The redesigned mobile dashboard no longer needs these fields.

Impact:

- unnecessary database work
- unnecessary payload size

Recommendation:

- create a mobile-optimized dashboard payload or trim unused fields from the shared overview

#### Response Typing

Some mobile API types are still too loose, especially:

- `DashboardOverview.actionItems`
- `DashboardOverview.activeImports`
- `DashboardOverview.recentShipments`

Impact:

- lower confidence when trimming payloads
- easier to accidentally overfetch or misuse data

Recommendation:

- tighten mobile-facing API types before a larger optimization pass

## Cache and Mutation Review

### Good

The app already uses a correct invalidation pattern after writes.

Examples:

- classification answer updates invalidate classification, classifications, dashboard, products, and product detail
- deletion invalidates related top-level collections

This is functionally safe and keeps mobile state consistent.

### Improvement Opportunity

Current invalidations are broad.

This is safe, but can cause more refetching than necessary.

Possible future improvement:

- keep broad invalidation for correctness in phase 1
- later narrow invalidation or use `setQueryData(...)` selectively where beneficial

## Overall Assessment

## Architecture Score

Current qualitative assessment:

- architecture foundation: strong
- correctness and flow support: strong
- scalability of list data: moderate
- performance tuning maturity: moderate to low

## Summary

The current mobile app is built on the right architectural choices:

- Expo Router
- Supabase auth
- TanStack Query
- centralized API client
- dedicated mobile API endpoints

This means the app is already in a good state for product iteration.

The main issue is not architectural quality, but list scalability and data-delivery efficiency.

## Recommended Priority Order

1. add cursor pagination for products, classifications, and labels
2. switch list-heavy screens to virtualized lists
3. lazy-load library sections instead of fetching all sections immediately
4. add shared React Query defaults for stale times and retries
5. trim dashboard payloads to what mobile actually uses
6. tighten response typing for mobile-facing data contracts

## Suggested Query Defaults

These are reasonable starting values for review:

- dashboard: `staleTime` 30 to 60 seconds
- list screens: `staleTime` 15 to 30 seconds
- detail screens: short stale time with pull-to-refresh kept available
- retry: limited retries for mobile network conditions

## Conclusion

The mobile app is already well structured enough to optimize incrementally without rewriting core flows.

The next engineering step should be a focused optimization pass, not a redesign:

- improve list delivery
- improve render scalability
- improve cache policy
- trim unused payload work

See `docs/MOBILE_OPTIMIZATION_IMPLEMENTATION_PLAN.md` for the proposed rollout plan.
