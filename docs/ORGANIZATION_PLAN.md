# Multi-Organization & User Management Plan

## Current State Analysis ✅

**What's Already Working:**
- ✅ `MembershipRole` enum exists: `OWNER`, `ADMIN`, `CONTRIBUTOR`, `REVIEWER`, `VIEWER`
- ✅ `Membership` model links users to organizations (many-to-many)
- ✅ Auto-organization creation on first Google login
- ✅ First user automatically gets `OWNER` role
- ✅ `getPrimaryMembership()` function (returns first org by creation date)
- ✅ All data is scoped by `organizationId`

**What Needs Implementation:**
- ❌ Organization selection UI (when user has multiple orgs)
- ❌ Invitation system (email-based)
- ❌ Admin-only features (remove users, view audit logs)
- ❌ Organization switching/switcher
- ❌ Future: Subscription/credits structure

---

## Recommended Architecture

### 1. Organization Structure ✅ (Already Good)

**Recommendation: Keep current structure**
- ✅ **1 business/client = 1 organization** (simple billing, clear data isolation)
- ✅ **Users CAN belong to multiple organizations** (via `Membership` model)
- ✅ Each organization is isolated (all data scoped by `organizationId`)

**Key Distinction:**
- **"1 client = 1 org"** means: Each business/client should have ONE organization
- **"Users in multiple orgs"** means: A single USER can be a member of MULTIPLE organizations

**Why this is powerful:**
- ✅ Employee of Company A can also create their own business (Company B)
- ✅ Freelancer can work for multiple clients (each client = separate org)
- ✅ Consultant can join multiple client organizations
- ✅ User can switch between orgs seamlessly

**Why 1 business = 1 org (not multiple orgs per business)?**
- Simpler billing/subscription model (one subscription per business)
- Clearer data isolation (all company data in one place)
- Easier to manage permissions (one set of roles per business)
- If needed later, businesses can create multiple orgs (each with separate subscription)

**The system already supports this!** The `Membership` model has `@@unique([userId, organizationId])` which means:
- ✅ One user can have multiple memberships (to different orgs)
- ✅ Each membership has its own role (e.g., ADMIN in Org A, CONTRIBUTOR in Org B)
- ✅ Data is properly isolated per organization

**Real-World Use Cases:**
1. **Employee + Entrepreneur**: User works at Company A (as CONTRIBUTOR), but also owns their own business (Company B as OWNER)
2. **Multi-Company Employee**: User works at Company A (as ADMIN), then joins Company C as a new employee (as CONTRIBUTOR)
3. **Freelancer/Consultant**: User provides services to multiple clients, each client = separate organization
4. **Side Projects**: User has a day job (Org A) but also runs side projects (Org B, Org C)

**This is why organization selection/switching is critical!** When a user logs in with multiple orgs, they need to:
- See all organizations they belong to
- Switch between them easily
- Each org maintains its own data, members, and settings

---

## Implementation Plan

### Phase 1: Organization Selection & Switching (Priority: HIGH)

#### 1.1 Update Database Schema
```prisma
// Add to Organization model (if not exists):
model Organization {
  // ... existing fields ...
  createdById String?  // Track who created the org (first OWNER)
  createdBy   User?    @relation("OrganizationCreator", fields: [createdById], references: [id])
}

// Add relation to User:
model User {
  // ... existing fields ...
  createdOrganizations Organization[] @relation("OrganizationCreator")
}
```

#### 1.2 Organization Selection Flow
**When user logs in:**
1. Check: `SELECT COUNT(*) FROM memberships WHERE userId = ?`
2. If count = 0: Create org (existing flow)
3. If count = 1: Use `getPrimaryMembership()` → redirect to dashboard
4. If count > 1: Show organization selection page

**New Route:** `/select-organization`
- List all organizations user belongs to
- Show role badge (OWNER, ADMIN, etc.)
- Allow switching between orgs
- Store selected org in session/cookie

#### 1.3 Organization Switcher Component
**Add to topbar/sidebar:**
- Dropdown showing current organization
- List of all user's organizations
- "Switch Organization" option
- Only show if user has multiple orgs

#### 1.4 Update Middleware & Layout
- Check for `organizationId` in session/cookie
- If missing but user has 1 org → auto-select
- If missing and user has multiple → redirect to `/select-organization`
- Update `AppLayout` to use selected org instead of `getPrimaryMembership()`

---

### Phase 2: Invitation System (Priority: HIGH)

#### 2.1 Database Schema
```prisma
model OrganizationInvitation {
  id             String   @id @default(cuid())
  organizationId String
  email          String
  role           MembershipRole @default(CONTRIBUTOR)
  invitedById    String   // Admin who sent invitation
  token          String   @unique // Secure token for acceptance
  expiresAt      DateTime
  acceptedAt     DateTime?
  createdAt      DateTime @default(now())
  
  organization   Organization @relation(fields: [organizationId], references: [id])
  invitedBy      User         @relation(fields: [invitedById], references: [id])
  
  @@unique([organizationId, email]) // One pending invitation per email per org
  @@index([token])
  @@index([email])
}

// Add to Organization:
model Organization {
  // ... existing fields ...
  invitations    OrganizationInvitation[]
}

// Add to User:
model User {
  // ... existing fields ...
  sentInvitations OrganizationInvitation[]
}
```

#### 2.2 Invitation Flow
**Send Invitation (Admin/Owner only):**
1. Admin enters email + selects role
2. Generate secure token (crypto.randomBytes)
3. Create `OrganizationInvitation` record
4. Send email with acceptance link: `/invite/accept?token={token}`
5. Token expires in 7 days (configurable)

**Accept Invitation:**
1. User clicks link → `/invite/accept?token={token}`
2. Validate token (exists, not expired, not accepted)
3. If user not logged in → redirect to login → then back to accept
4. If user logged in:
   - Check if email matches invitation email
   - Create `Membership` with specified role
   - Mark invitation as accepted
   - Redirect to organization dashboard

**Edge Cases:**
- User already has membership → Show error
- Token expired → Show error with "Request new invitation"
- Email mismatch → Show error (invitation was for different email)

#### 2.3 UI Components
**Admin Panel:**
- `/settings/members` page
- List current members (name, email, role, joined date)
- "Invite Member" button
- Remove member button (Admin/Owner only)
- Resend invitation button

**Invitation Form:**
- Email input
- Role selector (CONTRIBUTOR, REVIEWER, VIEWER - not OWNER/ADMIN)
- Send button

---

### Phase 3: Admin Features & Permissions (Priority: MEDIUM)

#### 3.1 Permission System
**Create helper functions:**
```typescript
// src/lib/permissions.ts
export function canManageMembers(role: MembershipRole): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

export function canViewAuditLogs(role: MembershipRole): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

export function canInviteUsers(role: MembershipRole): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

export function canRemoveUser(
  actorRole: MembershipRole,
  targetRole: MembershipRole
): boolean {
  // Only OWNER/ADMIN can remove
  if (!canManageMembers(actorRole)) return false;
  // OWNER can remove anyone (including other OWNERs)
  if (actorRole === 'OWNER') return true;
  // ADMIN can remove CONTRIBUTOR, REVIEWER, VIEWER (not OWNER/ADMIN)
  if (actorRole === 'ADMIN') {
    return targetRole !== 'OWNER' && targetRole !== 'ADMIN';
  }
  return false;
}
```

#### 3.2 Remove User Feature
**Server Action:**
```typescript
// src/server/actions/organizations.ts
export async function removeMemberAction(input: {
  organizationId: string;
  userIdToRemove: string;
}) {
  const user = await requireAuthenticatedUser();
  const membership = await getMembership(user.id, input.organizationId);
  
  if (!canManageMembers(membership.role)) {
    throw new Error("Unauthorized");
  }
  
  const targetMembership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: input.userIdToRemove,
        organizationId: input.organizationId,
      },
    },
  });
  
  if (!targetMembership) {
    throw new Error("User not found in organization");
  }
  
  if (!canRemoveUser(membership.role, targetMembership.role)) {
    throw new Error("Insufficient permissions to remove this user");
  }
  
  // Audit log
  await createAuditLogEntry({
    organizationId: input.organizationId,
    userId: user.id,
    entityType: "MEMBERSHIP",
    entityId: targetMembership.id,
    action: "REMOVE",
    payload: {
      removedUserId: input.userIdToRemove,
      removedUserRole: targetMembership.role,
    },
  });
  
  await prisma.membership.delete({
    where: { id: targetMembership.id },
  });
}
```

#### 3.3 Audit Log Access
**Update audit log query:**
- Add role check: Only OWNER/ADMIN can view
- Filter by organization (already done)
- Add user filter option (for admins to see who did what)

---

### Phase 4: Future Subscription/Credits Structure (Priority: LOW - Design Now)

#### 4.1 Database Schema (Future)
```prisma
model Subscription {
  id             String   @id @default(cuid())
  organizationId String   @unique
  plan           String   // "free", "starter", "pro", "enterprise"
  status         String   // "active", "cancelled", "past_due"
  currentPeriodStart DateTime
  currentPeriodEnd   DateTime
  cancelAtPeriodEnd  Boolean @default(false)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  
  organization   Organization @relation(fields: [organizationId], references: [id])
}

model CreditBalance {
  id             String   @id @default(cuid())
  organizationId String   @unique
  credits        Int      @default(0)
  lastResetAt    DateTime @default(now())
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  
  organization   Organization @relation(fields: [organizationId], references: [id])
}

model CreditTransaction {
  id             String   @id @default(cuid())
  organizationId String
  amount         Int      // Positive = credit, Negative = debit
  type           String   // "purchase", "classification", "dossier", "refund"
  description    String?
  createdAt      DateTime @default(now())
  
  organization   Organization @relation(fields: [organizationId], references: [id])
  
  @@index([organizationId, createdAt])
}

// Add to Organization:
model Organization {
  // ... existing fields ...
  subscription   Subscription?
  creditBalance  CreditBalance?
  creditTransactions CreditTransaction[]
}
```

#### 4.2 Usage Limits (Future)
**Based on subscription plan:**
- Free: 10 classifications/month, 1 user
- Starter: 100 classifications/month, 5 users
- Pro: Unlimited classifications, 20 users
- Enterprise: Unlimited everything, custom user limit

**Credit System (Alternative):**
- Each classification costs X credits
- Each dossier generation costs Y credits
- Users can purchase credit packs
- Credits reset monthly (or roll over)

#### 4.3 Implementation Notes
- **Don't implement now**, but structure code to easily add:
  - Check limits before allowing actions
  - Deduct credits after actions
  - Show usage dashboard
  - Billing integration (Stripe, etc.)

---

## Implementation Order

### Sprint 1: Organization Selection
1. ✅ Add `createdById` to Organization (track first owner)
2. ✅ Create `/select-organization` page
3. ✅ Update middleware to handle org selection
4. ✅ Add organization switcher to topbar
5. ✅ Store selected org in session/cookie
6. ✅ Update all queries to use selected org

### Sprint 2: Invitation System
1. ✅ Create `OrganizationInvitation` model
2. ✅ Create invitation server actions (send, accept, list)
3. ✅ Create `/settings/members` page
4. ✅ Create invitation form component
5. ✅ Create `/invite/accept` page
6. ✅ Send email with invitation link (use Resend/SendGrid)
7. ✅ Handle edge cases (expired, already member, etc.)

### Sprint 3: Admin Features
1. ✅ Create permission helper functions
2. ✅ Add "Remove Member" functionality
3. ✅ Restrict audit log access to Admin/Owner
4. ✅ Add role badges throughout UI
5. ✅ Add confirmation dialogs for destructive actions

### Sprint 4: Polish & Testing
1. ✅ Test multi-org scenarios
2. ✅ Test invitation flow end-to-end
3. ✅ Test permission boundaries
4. ✅ Add loading states
5. ✅ Add error handling
6. ✅ Update documentation

---

## Key Design Decisions

### 1. Organization vs Workspace
**Decision: Keep "Organization"**
- More professional/business-oriented
- Clearer for B2B context
- Matches subscription model

### 2. Role Hierarchy
```
OWNER > ADMIN > CONTRIBUTOR > REVIEWER > VIEWER
```
- **OWNER**: Full control (can't be removed, can remove anyone)
- **ADMIN**: Manage members, view audit logs (can't remove other OWNERs/ADMINs)
- **CONTRIBUTOR**: Create/edit classifications, products
- **REVIEWER**: Review classifications, approve/reject
- **VIEWER**: Read-only access

### 3. Organization Selection Storage
**Option A: Session Cookie** (Recommended)
- Stored server-side
- Secure
- Expires on logout

**Option B: Database (User preference)**
- Persists across sessions
- More complex
- Need to handle org deletion

**Decision: Use session cookie for now, can migrate to DB later**

### 4. Invitation Token Security
- Use `crypto.randomBytes(32)` for tokens
- Store hashed in DB (bcrypt)
- Expire after 7 days
- One-time use (mark as accepted)

### 5. Email Service
**Recommendation: Use Resend or SendGrid**
- Resend: Simple, good free tier
- SendGrid: More features, better for scale
- Store templates in codebase

---

## Security Considerations

1. **Invitation Tokens**: Hash before storing, validate on acceptance
2. **Permission Checks**: Always verify on server-side (never trust client)
3. **Organization Isolation**: All queries must filter by `organizationId`
4. **Role Escalation**: Prevent users from changing their own role
5. **Audit Logging**: Log all admin actions (invite, remove, role change)

---

## Testing Checklist

- [ ] User with 1 org → auto-selects, no selection page
- [ ] User with multiple orgs → shows selection page
- [ ] Organization switching works
- [ ] Invitation sent → email received
- [ ] Invitation accepted → membership created
- [ ] Expired invitation → shows error
- [ ] Admin can remove member
- [ ] Non-admin cannot remove member
- [ ] OWNER can remove ADMIN
- [ ] ADMIN cannot remove OWNER
- [ ] Audit logs only visible to Admin/Owner
- [ ] All data properly scoped by organization

---

## Future Enhancements (Post-MVP)

1. **Organization Settings Page**
   - Rename organization
   - Change timezone
   - Upload logo
   - Delete organization (OWNER only)

2. **Advanced Permissions**
   - Custom roles
   - Resource-level permissions
   - Team management

3. **Billing Integration**
   - Stripe integration
   - Subscription management
   - Usage tracking
   - Invoice generation

4. **Analytics Dashboard**
   - Usage statistics per org
   - User activity
   - Classification trends

---

## Questions to Consider

1. **Can users create new organizations?**
   - ✅ **YES** (Recommended): Allow "Create Organization" button
   - This enables: Employee creates their own business, freelancer creates new client org, etc.
   - Each new org = new subscription (future billing)
   - User becomes OWNER of new org

2. **Can users be in multiple organizations?**
   - ✅ **YES** (Already supported by database schema)
   - Use cases: Employee + entrepreneur, multi-company employee, freelancer with multiple clients
   - Each membership has independent role
   - Organization switcher allows easy navigation

3. **What happens when last OWNER leaves?**
   - Option A: Prevent removal if last OWNER (safest)
   - Option B: Auto-promote ADMIN to OWNER
   - Option C: Require transfer before leaving
   - **Recommendation**: Option A + allow OWNER to transfer ownership to another member

4. **Can users leave organizations?**
   - ✅ **YES** (Recommended): Add "Leave Organization" option
   - OWNER cannot leave (must transfer ownership first)
   - Other roles can leave (removes their membership)
   - Audit log entry created

5. **Organization deletion?**
   - Soft delete (mark as deleted) - Recommended
   - Hard delete (remove all data) - Risky, require confirmation
   - Require OWNER role + confirmation + backup option

---

## Summary

Your plan is **solid**! The current structure already supports most of what you need. The main additions are:

1. **Organization selection UI** (when multiple orgs)
2. **Invitation system** (email-based)
3. **Admin features** (remove users, restricted audit logs)
4. **Future-proofing** (subscription structure)

The implementation is straightforward and builds on your existing architecture. Start with Phase 1 (organization selection) as it's the foundation for everything else.

