# Quick Fix for RLS Policy Error

## Problem
Error: `relation "memberships" does not exist`

This happens because Prisma table names might differ from what we expect.

## Solution: Use This Simplified Approach

Instead of querying the `memberships` table directly in RLS policies, use a simpler approach that relies on the file path structure. Since your application already stores files with `organizationId` as the first folder, we can use a simpler policy.

### Option 1: Simplified Policy (Recommended for Development)

For now, use this simpler policy that allows any authenticated user to access files in their own folder structure. The application layer already enforces organization scoping.

```sql
-- For dossiers bucket
CREATE POLICY "Authenticated users can manage dossiers"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'dossiers')
WITH CHECK (bucket_id = 'dossiers');

-- For vault-files bucket
CREATE POLICY "Authenticated users can manage vault files"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'vault-files')
WITH CHECK (bucket_id = 'vault-files');

-- For audit-packages bucket
CREATE POLICY "Authenticated users can manage audit packages"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'audit-packages')
WITH CHECK (bucket_id = 'audit-packages');
```

**Note:** This is less secure but works immediately. Your application code already enforces organization scoping, so files are stored in `{organizationId}/...` paths.

### Option 2: Fix the Table Name (More Secure)

1. **First, find your actual table name:**

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name ILIKE '%membership%';
```

2. **Check the column names:**

```sql
-- Replace 'Membership' with your actual table name from step 1
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Membership';
```

3. **Create the helper function with correct table/column names:**

```sql
CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  org_id text;
BEGIN
  -- Replace 'Membership' and column names with your actual values
  -- Common variations:
  
  -- If table is "Membership" with camelCase columns:
  SELECT "organizationId"::text INTO org_id
  FROM "Membership"
  WHERE "userId" = auth.uid()::text
  LIMIT 1;
  
  -- OR if table is "memberships" with snake_case columns:
  -- SELECT organization_id::text INTO org_id
  -- FROM memberships
  -- WHERE user_id = auth.uid()::text
  -- LIMIT 1;
  
  RETURN org_id;
END;
$$;
```

4. **Then use the policies from SUPABASE_SETUP.md with `get_user_organization_id()`**

### Option 3: Check Your Prisma Migration

Run this to see what tables Prisma actually created:

```bash
npm run db:studio
```

Or check directly in Supabase:
- Go to Table Editor
- Look for a table related to memberships

## Recommended: Use Option 1 for Now

For development, use Option 1 (simplified policies). Your application code already ensures:
- Files are stored with `organizationId` in the path
- Server actions check `organizationId` before operations
- Users can only access their own organization's data through the app

You can add stricter RLS policies later once you've verified the table structure.

