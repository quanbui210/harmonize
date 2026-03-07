# Authentication Flow Documentation

This document provides a comprehensive overview of the authentication system in TulliCheck, detailing the step-by-step flow, key components, and implementation details.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Authentication Flow](#authentication-flow)
4. [Key Components](#key-components)
5. [Session Management](#session-management)
6. [Logout Flow](#logout-flow)
7. [Error Handling](#error-handling)
8. [Security Considerations](#security-considerations)

---

## Overview

TulliCheck uses **Supabase Authentication** with **Google OAuth** as the primary authentication provider. The application is built on **Next.js 14+** with the App Router, utilizing Server Components, Server Actions, and middleware for authentication handling.

### JWT Tokens: Yes, But Abstracted

**Important Clarification:** Supabase uses **JWT (JSON Web Tokens)** internally for authentication, but the application code does **not directly work with JWTs**. 

- ✅ **Supabase generates and manages JWTs** (access tokens and refresh tokens)
- ✅ **JWTs are stored in HTTP-only cookies** (secure, not accessible to JavaScript)
- ✅ **Supabase automatically validates JWTs** on every request
- ❌ **Application code never directly accesses, decodes, or validates JWTs**
- ❌ **No manual JWT parsing or token management in the codebase**

Instead, the application uses Supabase's high-level APIs:
- `supabase.auth.getSession()` - Gets current session (Supabase handles JWT validation)
- `supabase.auth.getUser()` - Gets authenticated user (Supabase validates JWT)
- `supabase.auth.signOut()` - Logs out (Supabase invalidates JWT)

This abstraction provides security and simplicity - you get the benefits of JWT tokens without the complexity of managing them manually.

### Key Technologies

- **Supabase Auth**: OAuth provider and session management (uses JWT tokens internally)
- **Next.js Middleware**: Route protection and session validation
- **Server Actions**: Server-side authentication operations
- **Cookie-based Sessions**: Secure HTTP-only cookies storing JWT tokens
- **JWT Tokens**: Used by Supabase internally (not directly accessed by application code)

---

## Architecture

### Authentication Stack

```
┌─────────────────┐
│   User Browser  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│ Next.js App     │────▶│  Middleware  │────▶│  Supabase   │
│                 │     │              │     │    Auth     │
└─────────────────┘     └──────────────┘     └─────────────┘
         │                       │                     │
         │                       │                     │
         ▼                       ▼                     ▼
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│ Server Actions  │     │  Route Guard │     │  Google OAuth│
│                 │     │              │     │             │
└─────────────────┘     └──────────────┘     └─────────────┘
```

### Supabase Client Types

The application uses three types of Supabase clients:

1. **Server Client** (`getSupabaseServerClient`)
   - Used in Server Components and Server Actions
   - Reads/writes cookies via Next.js `cookies()` API
   - Auto-refresh disabled for Server Components

2. **Browser Client** (`getSupabaseBrowserClient`)
   - Used in Client Components
   - Manages client-side session state
   - Handles token refresh automatically

3. **Admin Client** (`getSupabaseAdminClient`)
   - Uses service role key
   - Bypasses Row Level Security (RLS)
   - Used for administrative operations (e.g., fetching user metadata)

---

## Authentication Flow

### Step-by-Step Flow Diagram

```
1. User visits protected route
   │
   ▼
2. Middleware checks session
   │
   ├─ No session → Redirect to /login
   │
   └─ Has session → Continue to route
   │
   ▼
3. User clicks "Sign in with Google"
   │
   ▼
4. Server Action: signInWithGoogle()
   │
   ├─ Creates OAuth URL with redirectTo parameter
   │
   └─ Redirects to Google OAuth
   │
   ▼
5. User authenticates with Google
   │
   ▼
6. Google redirects to /auth/callback?code=xxx
   │
   ▼
7. Middleware intercepts code parameter
   │
   ├─ Redirects to /auth/callback if code present
   │
   └─ Preserves redirectTo parameter
   │
   ▼
8. Callback route handler:
   │
   ├─ Exchanges code for session
   │
   ├─ Creates/updates user in database
   │
   ├─ Ensures user workspace exists
   │
   └─ Sets authentication cookies
   │
   ▼
9. Redirects to original destination (or /dashboard)
   │
   ▼
10. User is authenticated and can access protected routes
```

### Detailed Flow Breakdown

#### Phase 1: Initial Access

**1.1 User visits protected route (e.g., `/dashboard`)**

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const { data: { session } } = await supabase.auth.getSession()
  const publicRoute = isPublicPath(pathname)
  
  if (!session && !publicRoute) {
    // Redirect to login with redirectTo parameter
    redirectUrl.searchParams.set("redirectTo", `${pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(redirectUrl)
  }
}
```

**1.2 Middleware checks session**

- Creates Supabase server client from cookies
- Calls `supabase.auth.getSession()`
- If no session and route is protected → redirect to `/login?redirectTo=/dashboard`
- If session exists → allow access

#### Phase 2: Login Page

**2.1 User lands on `/login`**

```typescript
// src/app/login/page.tsx
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const redirectTo = searchParams?.redirectTo ?? "/dashboard"
  return <LoginPageClient redirectTo={redirectTo} signInAction={signInWithGoogle} />
}
```

**2.2 Client component checks for existing session**

```typescript
// src/components/login/login-page-client.tsx
useEffect(() => {
  const checkSession = async () => {
    const supabase = getSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (session) {
      setIsRedirecting(true)
      router.replace(redirectTo || "/dashboard")
      return
    }
    
    setIsChecking(false) // Show login form
  }
  
  checkSession()
}, [redirectTo, router])
```

**Key Points:**
- Uses browser client to check session (client-side)
- Shows loading screen while checking
- If session exists → redirects immediately
- If no session → shows login form

**2.3 User clicks "Sign in with Google"**

```typescript
// src/components/login/login-form.tsx
async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault()
  onPendingChange?.(true) // Show loading state
  startTransition(async () => {
    const formData = new FormData(e.currentTarget)
    await signInAction(formData) // Server Action
  })
}
```

#### Phase 3: OAuth Initiation

**3.1 Server Action creates OAuth URL**

```typescript
// src/app/login/page.tsx
async function signInWithGoogle(formData: FormData) {
  "use server"
  
  const redirectTo = (formData.get("redirectTo") as string | null) ?? "/dashboard"
  const appUrl = getAppUrl() // Gets app URL from env or headers
  
  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${appUrl}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  })
  
  if (data?.url) {
    redirect(data.url) // Redirects to Google OAuth
  }
}
```

**Key Parameters:**
- `redirectTo`: Where to send user after authentication
- `access_type: "offline"`: Request refresh token
- `prompt: "consent"`: Force consent screen (for refresh token)

#### Phase 4: Google OAuth

**4.1 User authenticates with Google**

- User is redirected to Google's OAuth consent screen
- User grants permissions
- Google generates authorization code

**4.2 Google redirects back**

```
GET /auth/callback?code=xxx&redirectTo=/dashboard
```

#### Phase 5: Middleware Interception

**5.1 Middleware catches OAuth code**

```typescript
// middleware.ts
const hasAuthCode = searchParams.has("code")

if (hasAuthCode && pathname !== "/auth/callback") {
  const redirectUrl = request.nextUrl.clone()
  redirectUrl.pathname = "/auth/callback"
  
  if (!redirectUrl.searchParams.has("redirectTo")) {
    redirectUrl.searchParams.set("redirectTo", "/dashboard")
  }
  
  return NextResponse.redirect(redirectUrl)
}
```

**Purpose:** Ensures OAuth callback always goes to `/auth/callback` route handler.

#### Phase 6: Callback Processing

**6.1 Exchange code for session**

```typescript
// src/app/auth/callback/route.ts
export async function GET(request: Request) {
  const code = requestUrl.searchParams.get("code")
  let redirectTo = requestUrl.searchParams.get("redirectTo") ?? "/dashboard"
  
  // Create response early so cookies can be set on it
  let response = NextResponse.redirect(new URL(redirectTo, requestUrl.origin))
  
  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll().map((cookie) => ({
          name: cookie.name,
          value: cookie.value,
        }))
      },
      setAll(cookiesToSet) {
        // Set cookies on response object
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })
  
  if (code) {
    // Exchange authorization code for session
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(new URL("/login?error=auth", requestUrl.origin))
    }
  }
}
```

**6.2 User workspace creation**

```typescript
const { data: userResponse } = await supabase.auth.getUser()
if (userResponse.user) {
  try {
    await ensureUserWorkspace(userResponse.user)
  } catch (error) {
    // Log but don't block auth flow
    console.error("Failed to ensure user workspace:", error)
  }
}
```

**6.3 `ensureUserWorkspace` function**

```typescript
// src/lib/users/sync-user.ts
export async function ensureUserWorkspace(user: User) {
  // 1. Upsert user in database
  const profile = await prisma.user.upsert({
    where: { id: user.id },
    update: {
      email: user.email,
      fullName: user.user_metadata?.full_name ?? null,
    },
    create: {
      id: user.id,
      email: user.email,
      fullName: user.user_metadata?.full_name ?? null,
      authProviderId: user.id,
    },
  })
  
  // 2. Check if user has existing organization
  const existingMembership = await prisma.membership.findFirst({
    where: { userId: profile.id },
  })
  
  if (existingMembership) {
    return existingMembership
  }
  
  // 3. Create default workspace if none exists
  const organizationName = profile.fullName 
    ? `${profile.fullName.split(" ")[0]}'s Workspace`
    : "Harmonize Workspace"
  
  const organization = await createWorkspace(organizationName, profile.id)
  
  // 4. Create membership with OWNER role
  return prisma.membership.create({
    data: {
      organizationId: organization.id,
      userId: profile.id,
      role: MembershipRole.OWNER,
    },
  })
}
```

**Key Points:**
- Creates user record in Prisma database
- Ensures user has at least one organization
- Creates default workspace if none exists
- Sets user as OWNER of their workspace

**6.4 Final redirect**

```typescript
// Update redirect URL if it changed (preserving cookies)
const finalRedirectUrl = new URL(redirectTo, requestUrl.origin).toString()
if (response.headers.get("location") !== finalRedirectUrl) {
  response.headers.set("location", finalRedirectUrl)
}

return response // Redirects with cookies set
```

#### Phase 7: Protected Route Access

**7.1 App Layout validates session**

```typescript
// src/app/(app)/layout.tsx
export default async function AppLayout({ children }: AppLayoutProps) {
  const user = await getOptionalUser() // Gets user from session
  
  if (!user) {
    redirect("/login")
  }
  
  const memberships = await getAllUserMemberships(user.id)
  
  if (memberships.length === 0) {
    redirect("/login?error=organization")
  }
  
  // Handle multiple organizations
  if (memberships.length > 1) {
    const selectedOrgId = await getSelectedOrganizationId(user.id)
    if (!selectedOrgId) {
      redirect("/select-organization")
    }
  }
  
  // Render app with authenticated user
  return <AppShell user={user} organization={...} memberships={...}>
    {children}
  </AppShell>
}
```

---

## Key Components

### 1. Middleware (`middleware.ts`)

**Purpose:** First line of defense for route protection

**Responsibilities:**
- Intercepts all requests (except static files, API routes)
- Validates session using Supabase
- Redirects unauthenticated users to login
- Handles OAuth code parameter routing
- Redirects authenticated users away from `/` to `/dashboard`

**Key Functions:**
- `isPublicPath()`: Determines if route is publicly accessible
- Session validation via `supabase.auth.getSession()`

### 2. Login Page (`src/app/login/page.tsx`)

**Type:** Server Component

**Responsibilities:**
- Handles OAuth code parameter (if present, redirects to callback)
- Renders `LoginPageClient` with server action
- Determines redirect destination

### 3. Login Page Client (`src/components/login/login-page-client.tsx`)

**Type:** Client Component

**Responsibilities:**
- Checks for existing session on mount
- Shows loading states during session check
- Renders login form if no session
- Handles redirect if session exists

**Loading States:**
- `isChecking`: Initial session check
- `isRedirecting`: Redirecting authenticated user
- `isLoggingIn`: User clicked login button

### 4. Login Form (`src/components/login/login-form.tsx`)

**Type:** Client Component

**Responsibilities:**
- Renders "Sign in with Google" button
- Handles form submission
- Manages pending state during OAuth initiation
- Calls server action `signInWithGoogle`

### 5. Auth Callback (`src/app/auth/callback/route.ts`)

**Type:** API Route Handler

**Responsibilities:**
- Exchanges OAuth code for session
- Creates/updates user in database
- Ensures user workspace exists
- Sets authentication cookies
- Redirects to final destination

**Error Handling:**
- OAuth errors → redirect to `/login?error=auth`
- Database errors → logged but don't block auth

### 6. User Sync (`src/lib/users/sync-user.ts`)

**Function:** `ensureUserWorkspace(user: User)`

**Responsibilities:**
- Upserts user record in Prisma database
- Syncs user metadata (email, fullName)
- Creates default organization if none exists
- Creates membership with OWNER role

### 7. Auth Utilities (`src/lib/supabase/auth.ts`)

**Functions:**
- `requireAuthenticatedUser()`: Gets user or redirects to login
- `getOptionalUser()`: Gets user or returns null

**Usage:**
- Server Components: Use `requireAuthenticatedUser()` for protected routes
- Optional checks: Use `getOptionalUser()` for conditional rendering

### 8. App Layout (`src/app/(app)/layout.tsx`)

**Type:** Server Component

**Responsibilities:**
- Validates user authentication
- Fetches user memberships
- Handles organization selection
- Renders `AppShell` with user context

---

## Session Management

### JWT Tokens (Under the Hood)

**Important:** While Supabase uses **JWT (JSON Web Tokens)** internally for authentication, the application code does **not directly interact with JWTs**. Instead, Supabase abstracts token management through its client libraries.

**How it works:**
- Supabase generates JWT tokens (access token and refresh token) after successful authentication
- These JWTs contain user identity and claims (user ID, email, etc.)
- Tokens are signed by Supabase and validated automatically
- The application never needs to decode, validate, or manually handle JWTs

**Why this matters:**
- **Security:** No risk of exposing tokens in client-side code
- **Simplicity:** No need to implement JWT validation logic
- **Automatic:** Token refresh, expiration, and validation handled by Supabase

### Cookie-Based Sessions

Supabase stores JWT tokens in HTTP-only cookies:

- **Cookie Names:** `sb-<project-ref>-auth-token` (contains access token and refresh token as JWTs)
- **Token Format:** JWT (JSON Web Token) - Base64 encoded, signed by Supabase
- **Security:** HTTP-only (prevents JavaScript access), Secure (HTTPS only), SameSite protection
- **Storage:** Managed by Supabase SSR library
- **Access:** Application uses `supabase.auth.getSession()` - never directly accesses JWT tokens

### Session Validation

**Server-Side:**
```typescript
const supabase = getSupabaseServerClient()
const { data: { session } } = await supabase.auth.getSession()
// Supabase automatically:
// 1. Reads JWT from HTTP-only cookie
// 2. Validates JWT signature
// 3. Checks expiration
// 4. Returns session object if valid
```

**Client-Side:**
```typescript
const supabase = getSupabaseBrowserClient()
const { data: { session } } = await supabase.auth.getSession()
// Same automatic validation as server-side
```

**What you get:**
- `session.access_token`: JWT access token (automatically validated)
- `session.refresh_token`: JWT refresh token (for token renewal)
- `session.user`: User object with ID, email, metadata
- **Note:** You rarely need to access `access_token` directly - Supabase handles API calls automatically

### Session Refresh

- **Automatic:** Browser client handles JWT token refresh automatically
- **Manual:** Server client has auto-refresh disabled (prevents cookie write issues in Server Components)
- **Refresh Token:** JWT refresh token stored in cookie, used automatically by Supabase
- **Process:** When access token expires, Supabase uses refresh token to get new access token (all automatic)

**Token Lifecycle:**
1. Access token expires (typically after 1 hour)
2. Supabase detects expiration on next API call
3. Automatically uses refresh token to get new access token
4. Updates cookie with new JWT
5. Retries original API call with new token
6. All happens transparently - no code changes needed

### Session Persistence

- Sessions persist across browser sessions (unless user logs out)
- Cookies are set with appropriate expiration
- Supabase handles token rotation automatically

---

## Logout Flow

### Step-by-Step Logout

```
1. User clicks "Log out" in UserMenu
   │
   ▼
2. Form submits logoutAction (Server Action)
   │
   ▼
3. Server Action calls supabase.auth.signOut()
   │
   ├─ Clears Supabase session cookies
   │
   └─ Invalidates refresh token
   │
   ▼
4. Redirects to "/" (landing page)
   │
   ▼
5. Middleware detects no session
   │
   └─ Allows access (landing page is public)
```

### Implementation

```typescript
// src/server/actions/auth.ts
export async function logoutAction() {
  "use server"
  
  const supabase = getSupabaseServerClient()
  await supabase.auth.signOut() // Clears session cookies
  redirect("/") // Redirects to landing page
}
```

**Key Points:**
- Logout is a Server Action (runs on server)
- Clears all Supabase auth cookies
- Redirects to landing page (not login page)
- Middleware allows access to public routes

---

## Error Handling

### OAuth Errors

**Scenario:** OAuth flow fails (e.g., user denies access)

```typescript
// src/app/login/page.tsx
if (error) {
  console.error("OAuth error:", error)
  redirect(`${appUrl}/login?error=auth`)
}
```

**User Experience:**
- Redirected to login page with error parameter
- Can retry authentication

### Session Exchange Errors

**Scenario:** Code exchange fails

```typescript
// src/app/auth/callback/route.ts
const { error } = await supabase.auth.exchangeCodeForSession(code)
if (error) {
  console.error("Error exchanging code for session:", error)
  return NextResponse.redirect(new URL("/login?error=auth", requestUrl.origin))
}
```

### Database Errors

**Scenario:** User workspace creation fails

```typescript
// src/app/auth/callback/route.ts
try {
  await ensureUserWorkspace(userResponse.user)
} catch (error) {
  // Log but don't block auth flow
  // User is authenticated, workspace creation can be retried later
  console.error("Failed to ensure user workspace:", error)
}
```

**Rationale:**
- Authentication succeeds even if database is temporarily unavailable
- Workspace creation can be retried on next request
- Prevents auth flow from being blocked by database issues

### Missing Organization

**Scenario:** User has no organization memberships

```typescript
// src/app/(app)/layout.tsx
if (memberships.length === 0) {
  redirect("/login?error=organization")
}
```

---

## Security Considerations

### 1. JWT Token Security

- **Automatic Validation:** Supabase validates JWT signatures automatically
- **No Manual Handling:** Application never decodes or validates JWTs manually
- **Token Rotation:** Refresh tokens can be rotated for enhanced security
- **Expiration:** Access tokens expire (typically 1 hour), refresh tokens have longer expiration

### 2. Cookie Security

- **HTTP-only:** Prevents JavaScript access to cookies (and JWT tokens inside)
- **Secure:** Only sent over HTTPS in production
- **SameSite:** Prevents CSRF attacks
- **Path:** Scoped to application domain
- **Content:** Contains JWT tokens, but they're never exposed to client-side JavaScript

### 2. Route Protection

- **Middleware:** First layer of protection
- **Server Components:** Validate session before rendering
- **Server Actions:** Require authentication via `requireAuthenticatedUser()`

### 3. OAuth Security

- **State Parameter:** Supabase handles OAuth state validation
- **PKCE:** Supabase uses PKCE for OAuth flows
- **Redirect Validation:** Only allows redirects to configured callback URL

### 4. Session Validation

- **Server-Side:** Always validate on server (never trust client)
- **JWT Validation:** Supabase automatically validates JWT signatures and expiration
- **Token Refresh:** Automatic and secure via Supabase (uses refresh token JWT)
- **Expiration:** Access tokens expire and refresh automatically
- **No Manual JWT Parsing:** Never decode or parse JWT tokens manually - always use Supabase APIs

### 5. Database Security

- **Row Level Security (RLS):** Supabase enforces RLS policies
- **Prisma:** Application-level access control
- **User Isolation:** Users can only access their own data

### 6. Error Information

- **No Sensitive Data:** Error messages don't leak sensitive information
- **Logging:** Errors logged server-side, not exposed to client
- **User-Friendly:** Generic error messages for users

---

## Environment Variables

Required environment variables for authentication:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Application URL (for OAuth redirects)
NEXT_PUBLIC_APP_URL=https://your-app.com
```

---

## Public Routes

Routes that don't require authentication:

- `/` - Landing page
- `/login` - Login page
- `/auth/callback` - OAuth callback (handled by middleware)
- `/api/public/*` - Public API endpoints
- `/vault/upload` - File upload endpoint

All other routes require authentication.

---

## Testing Authentication Flow

### Manual Testing Steps

1. **Unauthenticated Access:**
   - Visit `/dashboard` without session
   - Should redirect to `/login?redirectTo=/dashboard`

2. **Login Flow:**
   - Click "Sign in with Google"
   - Complete Google OAuth
   - Should redirect to `/dashboard`

3. **Session Persistence:**
   - Login and close browser
   - Reopen and visit `/dashboard`
   - Should remain authenticated

4. **Logout:**
   - Click "Log out" in user menu
   - Should redirect to `/` (landing page)
   - Visit `/dashboard` → should redirect to login

5. **Multiple Organizations:**
   - User with multiple orgs
   - Should redirect to `/select-organization` if none selected

---

## Troubleshooting

### Common Issues

**1. "Can't reach database server" during auth**
- **Cause:** Database connection issue
- **Solution:** Auth still succeeds, workspace creation retries later
- **Check:** Database URL, network connectivity

**2. Infinite redirect loop**
- **Cause:** Cookie issues or middleware misconfiguration
- **Solution:** Clear cookies, check middleware matcher
- **Check:** Cookie domain, SameSite settings

**3. OAuth callback fails**
- **Cause:** Redirect URL mismatch
- **Solution:** Verify `NEXT_PUBLIC_APP_URL` matches Supabase config
- **Check:** Supabase dashboard → Authentication → URL Configuration

**4. Session not persisting**
- **Cause:** Cookie settings or browser blocking
- **Solution:** Check cookie settings, browser privacy settings
- **Check:** Cookie expiration, Secure flag

---

## Summary

The authentication flow in HarmonizeAI is built on Supabase Auth with Google OAuth, providing:

- **Secure:** HTTP-only cookies, HTTPS-only, CSRF protection
- **User-Friendly:** Smooth login experience with loading states
- **Resilient:** Handles errors gracefully, doesn't block on database issues
- **Flexible:** Supports multiple organizations, workspace management
- **Maintainable:** Clear separation of concerns, well-documented code

The flow ensures users are authenticated before accessing protected routes, automatically creates workspaces for new users, and maintains sessions securely across browser sessions.
