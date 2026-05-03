# TulliCheck Mobile Optimization Implementation Plan

## Purpose

This plan turns the current mobile architecture review into an implementation sequence that is safe, measurable, and easy to approve phase by phase.

This document is for review before implementation.

## Goals

- improve scalability for larger workspaces
- reduce unnecessary network and database work
- improve render performance for long lists
- keep mobile behavior stable while optimizing
- avoid a risky broad refactor

## Non-Goals

This plan does not aim to:

- redesign the entire mobile UI again
- replace Expo Router or TanStack Query
- change the core business flow for classification, labels, or dossiers
- introduce offline-first sync in this pass

## Proposed Rollout

## Phase 1: Data Layer Foundations

### Objective

Standardize cache behavior and prepare the list APIs for scalable loading.

### Scope

- add shared `QueryClient` defaults in `mobile/app/_layout.tsx`
- document and standardize query keys where needed
- add typed list response envelopes for paginated endpoints
- define a cursor contract for:
  - products
  - classifications
  - labels

### Expected API Shape

Recommended list shape:

```ts
type PaginatedResponse<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};
```

Recommended request shape:

```ts
?limit=20&cursor=<opaque-or-record-id>
```

### Deliverables

- updated API types for paginated lists
- updated mobile API client methods for paginated fetching
- shared query defaults for dashboard, lists, and details

### Success Criteria

- no screen behavior regression
- stable query behavior across app launch, pull-to-refresh, and navigation
- paginated endpoints available for next phases

## Phase 2: Backend Pagination

### Objective

Make the main mobile list endpoints scalable.

### Scope

- update `GET /api/v1/products` to support cursor pagination
- update `GET /api/v1/classifications` to support cursor pagination
- update `GET /api/v1/labels` to support cursor pagination

### Notes

- use consistent ordering such as `updatedAt desc` plus stable cursor tiebreaking
- clamp page size on the server
- return `nextCursor` only when more results exist
- preserve backward compatibility if possible during migration

### Deliverables

- paginated Prisma queries
- typed mobile API responses
- clear server-side guardrails for `limit`

### Success Criteria

- endpoints no longer require full-list fetches
- pagination behaves consistently between first page and next pages
- list endpoints remain auth-safe and organization-scoped

## Phase 3: Virtualized List Screens

### Objective

Reduce render cost and improve scroll performance.

### Scope

- replace `ScrollView + map(...)` with `FlatList` or `FlashList` for:
  - library sections
  - products/history
  - any other long saved-work list that benefits

### Recommendation

- use `FlatList` first unless performance still needs more
- move to `FlashList` only if needed after profiling

### Deliverables

- virtualized list rendering
- `onEndReached` pagination loading
- list empty states and refresh states preserved

### Success Criteria

- smooth scrolling with larger datasets
- lower initial render cost
- no broken row actions or navigation

## Phase 4: Lazy Section Fetching

### Objective

Avoid loading data for tabs/sections the user has not opened yet.

### Scope

- change library screen so it fetches only the active section initially
- fetch labels only when the labels section is opened
- fetch dossiers via a dedicated filtered query strategy rather than deriving from the entire classification dataset

### Deliverables

- section-based query enablement
- lighter initial load for library
- reduced memory pressure

### Success Criteria

- initial library open becomes lighter
- switching sections still feels instant or near-instant
- no blank state regressions

## Phase 5: Dashboard Payload Trimming

### Objective

Remove backend work and payload data that mobile no longer needs.

### Scope

- review `getDashboardOverview(...)`
- remove or split out fields not used by the mobile dashboard:
  - `activeImports`
  - `recentShipments`
- tighten typing for dashboard action items

### Deliverables

- slimmer dashboard payload
- lower DB query load
- stronger mobile type safety

### Success Criteria

- mobile dashboard still renders the same UI
- dashboard endpoint performs less unnecessary work

## Phase 6: Targeted Cache Improvements

### Objective

Reduce unnecessary refetches after correctness is preserved.

### Scope

- keep broad invalidation where needed
- selectively replace some invalidations with `setQueryData(...)` for detail updates
- tune stale times per screen class
- review retry counts for mobile network behavior

### Deliverables

- fewer redundant requests after mutation
- more deliberate cache policy

### Success Criteria

- same correctness
- less network churn
- faster perceived UI updates after mutations

## Recommended Implementation Order

Recommended order for approval:

1. Phase 1
2. Phase 2
3. Phase 3
4. Phase 4
5. Phase 5
6. Phase 6

This order minimizes risk because:

- types and cache policy are standardized first
- server pagination arrives before UI pagination
- virtualized rendering only happens after data contracts are stable
- optimization of invalidation happens last, once correctness is already protected

## Risk Review

### Main Risks

- pagination bugs causing missing or duplicated rows
- list state regressions during screen refresh or section switching
- accidental API contract mismatch between server and mobile client
- breaking existing flows that assume full-list data

### Mitigations

- keep phases small and reviewable
- validate each endpoint with first page and next page behavior
- keep screen fallback states intact
- test mutation flows after pagination changes

## Validation Plan

Each phase should include:

- TypeScript validation
- lint pass for changed mobile files
- manual test of:
  - dashboard
  - library
  - products/history
  - classification detail
  - delete and refinement flows

For pagination phases specifically:

- first page load
- pull-to-refresh
- load more
- section switch persistence
- deletion while paginated

## Recommended Technical Decisions

### Query Defaults

Suggested starting defaults:

- dashboard: `staleTime: 30000`
- list screens: `staleTime: 15000`
- details: `staleTime: 10000`
- retry: low retry count, avoid aggressive repeated requests on unstable mobile networks

### Cursor Style

Recommended first version:

- use record ID cursor with stable `orderBy`
- or use composite cursor if `updatedAt` ordering requires it

### List Technology

Recommended first version:

- `FlatList`

Escalation option:

- `FlashList` only if profiling shows meaningful benefit

## Suggested First Implementation Batch

If approved, the best first implementation batch is:

1. add `QueryClient` defaults
2. add paginated contracts and client methods
3. paginate classifications, labels, and products endpoints
4. migrate library and products screens to paginated `FlatList`

This batch gives the largest performance improvement with the lowest UX disruption.

## Approval Questions

Before implementation, the key decisions for approval are:

1. Should products, classifications, and labels all move to cursor pagination in the same batch?
2. Do you want `FlatList` first, or should I go directly to `FlashList`?
3. Do you want backward compatibility on the old unpaginated response shape during transition, or can mobile move fully to the new list contract?

## Conclusion

This plan is designed to improve performance without destabilizing the app.

The highest-value implementation is:

- paginated list endpoints
- virtualized list screens
- lighter library loading
- query defaults

Once you confirm this plan, implementation can start phase by phase.
