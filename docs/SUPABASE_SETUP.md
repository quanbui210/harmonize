# Supabase Setup Guide for HarmonizeAI

This guide walks you through setting up Supabase storage buckets and Row Level Security (RLS) policies for the HarmonizeAI application.

## Prerequisites

- A Supabase project (create one at https://supabase.com)
- Your project's Supabase URL and service role key
- Access to your Supabase dashboard

## Step 1: Create Storage Buckets

Navigate to **Storage** in your Supabase dashboard and create the following buckets:

### 1. `dossiers` Bucket

**Purpose:** Store generated PDF reasoning dossiers

**Settings:**
- **Name:** `dossiers`
- **Public:** `No` (private bucket)
- **File size limit:** 10 MB
- **Allowed MIME types:** `application/pdf`

**Create the bucket:**
1. Go to Storage → Buckets
2. Click "New bucket"
3. Name: `dossiers`
4. Uncheck "Public bucket"
5. Click "Create bucket"

### 2. `vault-files` Bucket

**Purpose:** Store supplier-uploaded compliance documents (MSDS, invoices, photos, etc.)

**Settings:**
- **Name:** `vault-files`
- **Public:** `No` (private bucket)
- **File size limit:** 50 MB
- **Allowed MIME types:** `application/pdf`, `image/jpeg`, `image/png`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

**Create the bucket:**
1. Go to Storage → Buckets
2. Click "New bucket"
3. Name: `vault-files`
4. Uncheck "Public bucket"
5. Click "Create bucket"

### 3. `audit-packages` Bucket

**Purpose:** Store exported audit zip files

**Settings:**
- **Name:** `audit-packages`
- **Public:** `No` (private bucket)
- **File size limit:** 100 MB
- **Allowed MIME types:** `application/zip`

**Create the bucket:**
1. Go to Storage → Buckets
2. Click "New bucket"
3. Name: `audit-packages`
4. Uncheck "Public bucket"
5. Click "Create bucket"

## Step 2: Verify Table Name

**IMPORTANT:** First, check what your actual table name is. Run this in Supabase SQL Editor:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name ILIKE '%membership%';
```

This will show you the exact table name (could be `Membership`, `memberships`, or `Membership`).

## Step 3: Create Helper Function

Create a helper function to get the user's organization ID. This makes the policies cleaner:

```sql
CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  org_id text;
BEGIN
  -- Try different possible table names
  SELECT organization_id::text INTO org_id
  FROM "Membership"
  WHERE "userId" = auth.uid()
  LIMIT 1;
  
  -- If not found, try lowercase
  IF org_id IS NULL THEN
    SELECT organization_id::text INTO org_id
    FROM memberships
    WHERE user_id = auth.uid()
    LIMIT 1;
  END IF;
  
  -- If still not found, try with capital M but lowercase other parts
  IF org_id IS NULL THEN
    SELECT "organizationId"::text INTO org_id
    FROM "Membership"
    WHERE "userId" = auth.uid()
    LIMIT 1;
  END IF;
  
  RETURN org_id;
END;
$$;
```

**Note:** Adjust the column names (`userId` vs `user_id`, `organizationId` vs `organization_id`) based on your Prisma schema. Check your actual table structure:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Membership' OR table_name = 'memberships';
```

## Step 4: Configure Row Level Security (RLS) Policies

For each bucket, we need to set up RLS policies to ensure users can only access files from their own organization.

### RLS Policy for `dossiers` Bucket

**Policy 1: Allow authenticated users to upload dossiers**

```sql
CREATE POLICY "Users can upload dossiers to their organization"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'dossiers' AND
  (storage.foldername(name))[1] = get_user_organization_id()
);
```

**Policy 2: Allow authenticated users to read their organization's dossiers**

```sql
CREATE POLICY "Users can read dossiers from their organization"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'dossiers' AND
  (storage.foldername(name))[1] = get_user_organization_id()
);
```

### RLS Policy for `vault-files` Bucket

**Policy 1: Allow authenticated users to upload vault files**

```sql
CREATE POLICY "Users can upload vault files to their organization"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'vault-files' AND
  (storage.foldername(name))[1] = get_user_organization_id()
);
```

**Policy 2: Allow authenticated users to read their organization's vault files**

```sql
CREATE POLICY "Users can read vault files from their organization"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'vault-files' AND
  (storage.foldername(name))[1] = get_user_organization_id()
);
```

**Policy 3: Allow public uploads via supplier links (optional - for supplier uploads)**

```sql
CREATE POLICY "Public can upload via supplier links"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'vault-files' AND
  -- Add token validation logic here if needed
  true
);
```

### RLS Policy for `audit-packages` Bucket

**Policy 1: Allow authenticated users to upload audit packages**

```sql
CREATE POLICY "Users can upload audit packages to their organization"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'audit-packages' AND
  (storage.foldername(name))[1] = get_user_organization_id()
);
```

**Policy 2: Allow authenticated users to read their organization's audit packages**

```sql
CREATE POLICY "Users can read audit packages from their organization"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'audit-packages' AND
  (storage.foldername(name))[1] = get_user_organization_id()
);
```

## Step 5: Enable RLS on Storage Objects

Run this SQL in your Supabase SQL Editor:

```sql
-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
```

## Step 6: Create Helper Function for Folder Name Extraction

If the `storage.foldername()` function doesn't exist, create it:

```sql
CREATE OR REPLACE FUNCTION storage.foldername(name text)
RETURNS text[]
LANGUAGE sql
AS $$
  SELECT string_to_array(trim(both '/' from name), '/');
$$;
```

## Step 7: Verify Setup

1. **Test bucket access:**
   - Try uploading a file from your application
   - Verify the file appears in the correct bucket
   - Check that users from different organizations cannot access each other's files

2. **Test RLS policies:**
   - Create a test user in a different organization
   - Verify they cannot access files from other organizations
   - Verify they can access files from their own organization

## Step 6: Environment Variables

Make sure your `.env` file includes:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Troubleshooting

### Issue: "Permission denied" when uploading files

**Solution:**
- Verify RLS policies are correctly set up
- Check that the user is authenticated
- Ensure the folder structure matches the policy (organizationId as first folder)

### Issue: Files not appearing in bucket

**Solution:**
- Check Supabase logs for errors
- Verify bucket name matches exactly (case-sensitive)
- Ensure file size is within limits
- Check MIME type is allowed

### Issue: Cannot read files after upload

**Solution:**
- Verify SELECT policy is correctly configured
- Check that the file path matches the organization ID
- Ensure signed URLs are generated correctly

## Security Best Practices

1. **Never expose service role key** in client-side code
2. **Use signed URLs** for temporary file access (expire after 1 hour)
3. **Validate file types** on both client and server
4. **Hash files** before storage (SHA-256) for integrity verification
5. **Regular audits** of RLS policies to ensure they're working correctly

## Next Steps

After completing this setup:

1. Test file uploads from your application
2. Test dossier generation
3. Test supplier link functionality
4. Test audit package export

Your Supabase storage is now configured and ready for use!

