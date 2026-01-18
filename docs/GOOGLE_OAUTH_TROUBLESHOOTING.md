# Google OAuth Troubleshooting Guide

## Common Error: `redirect_uri_mismatch`

If you're seeing "Error 400: redirect_uri_mismatch", this means the redirect URI in Google Cloud Console doesn't match what Supabase is sending.

---

## ✅ Correct Configuration

### In Google Cloud Console:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **APIs & Services** → **Credentials**
3. Find your OAuth 2.0 Client ID
4. Click **Edit**

5. **Authorized JavaScript origins:**
   ```
   https://your-production-domain.com
   http://localhost:3000  (for local testing only)
   ```

6. **Authorized redirect URIs:**
   ```
   https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
   http://localhost:3000/auth/callback  (for local testing only)
   ```

   ⚠️ **IMPORTANT:** Replace `YOUR_PROJECT_REF` with your actual Supabase project reference!

   To find your project reference:
   - Go to Supabase Dashboard
   - Look at your project URL: `https://YOUR_PROJECT_REF.supabase.co`
   - Or check `NEXT_PUBLIC_SUPABASE_URL` in your `.env` file

---

## ❌ Common Mistakes

### Mistake 1: Adding Your App's Callback URL

**WRONG:**
```
https://your-domain.com/auth/callback  ❌
```

**WHY IT'S WRONG:**
- Google redirects to **Supabase first**, not directly to your app
- The flow is: Google → Supabase → Your App
- Google only sees Supabase's callback URL

**CORRECT:**
```
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback  ✅
```

---

### Mistake 2: Wrong Supabase Project Reference

**WRONG:**
```
https://old-project.supabase.co/auth/v1/callback  ❌
```

**WHY IT'S WRONG:**
- You might have multiple Supabase projects
- Using the wrong project reference = mismatch error

**HOW TO FIX:**
1. Check your `.env` file for `NEXT_PUBLIC_SUPABASE_URL`
2. Extract the project reference from the URL
3. Use that exact reference in Google Cloud Console

---

### Mistake 3: Missing Protocol or Trailing Slash

**WRONG:**
```
YOUR_PROJECT_REF.supabase.co/auth/v1/callback  ❌ (missing https://)
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback/  ❌ (trailing slash)
```

**CORRECT:**
```
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback  ✅
```

---

### Mistake 4: Using Staging URL in Production

**WRONG:**
```
https://staging-project.supabase.co/auth/v1/callback  ❌ (if you're in production)
```

**WHY IT'S WRONG:**
- Production app should use production Supabase project
- Staging Supabase = staging redirect URI

**HOW TO FIX:**
- Use the Supabase project that matches your environment
- Production app → Production Supabase project
- Staging app → Staging Supabase project (or same project, but be aware of conflicts)

---

## 🔍 How to Verify Your Configuration

### Step 1: Check Your Supabase Project Reference

```bash
# Check your .env file
echo $NEXT_PUBLIC_SUPABASE_URL

# Or in PowerShell
$env:NEXT_PUBLIC_SUPABASE_URL
```

The URL should look like: `https://abcdefghijklmnop.supabase.co`

Your project reference is: `abcdefghijklmnop`

### Step 2: Check Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. **APIs & Services** → **Credentials**
3. Click your OAuth 2.0 Client ID
4. Check **Authorized redirect URIs**

It should contain:
```
https://abcdefghijklmnop.supabase.co/auth/v1/callback
```
(Replace with your actual project reference)

### Step 3: Check Supabase Configuration

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Authentication** → **Providers**
4. Click **Google**
5. Verify:
   - ✅ Provider is **Enabled**
   - ✅ **Client ID** matches Google Cloud Console
   - ✅ **Client Secret** matches Google Cloud Console

---

## 🛠️ Step-by-Step Fix

### If You're Getting `redirect_uri_mismatch`:

1. **Find your Supabase project reference:**
   ```bash
   # From your .env file
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   ```

2. **Go to Google Cloud Console:**
   - [console.cloud.google.com](https://console.cloud.google.com)
   - **APIs & Services** → **Credentials**
   - Click your OAuth 2.0 Client ID
   - Click **Edit**

3. **Add/Update redirect URI:**
   ```
   https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
   ```
   (Replace `YOUR_PROJECT_REF` with your actual project reference)

4. **Save changes**

5. **Wait 1-2 minutes** for changes to propagate

6. **Try logging in again**

---

## 🔄 OAuth Flow Explained

Understanding the flow helps debug issues:

```
1. User clicks "Sign in with Google" in your app
   ↓
2. App redirects to: Supabase OAuth endpoint
   ↓
3. Supabase redirects to: Google OAuth
   ↓
4. User authenticates with Google
   ↓
5. Google redirects to: https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
   ↑
   THIS is what Google sees - must be in Google Cloud Console!
   ↓
6. Supabase processes the callback
   ↓
7. Supabase redirects to: https://your-domain.com/auth/callback
   ↑
   This is configured in your app code (redirectTo parameter)
   ↓
8. Your app processes the callback and logs user in
```

**Key Point:** Google only sees Supabase's callback URL, not your app's callback URL.

---

## 📝 Quick Checklist

Before reporting an issue, verify:

- [ ] `NEXT_PUBLIC_SUPABASE_URL` is set correctly in your environment
- [ ] Google Cloud Console has: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
- [ ] Project reference matches between `.env` and Google Cloud Console
- [ ] No typos in the redirect URI (https://, no trailing slash)
- [ ] Supabase Google provider is enabled
- [ ] Client ID and Secret match between Google Cloud Console and Supabase
- [ ] Waited 1-2 minutes after making changes
- [ ] Cleared browser cache/cookies (sometimes helps)

---

## 🆘 Still Not Working?

### Check the Error Details

Click "error details" in the Google error page to see:
- What redirect URI Google received
- What redirect URIs are configured

Compare them - they must match exactly!

### Common Issues:

1. **Multiple Supabase Projects:**
   - Make sure you're using the correct project reference
   - Production vs Staging confusion

2. **Environment Variables:**
   - `NEXT_PUBLIC_APP_URL` should be your production domain
   - `NEXT_PUBLIC_SUPABASE_URL` should be your production Supabase URL

3. **Build-Time vs Runtime:**
   - `NEXT_PUBLIC_*` variables are baked into the build
   - After changing them, you must rebuild and redeploy

4. **Caching:**
   - Google may cache redirect URIs
   - Wait a few minutes after making changes
   - Try incognito/private browsing mode

---

## 💡 Pro Tips

1. **Use separate OAuth credentials for production and staging:**
   - Production: `https://prod-project.supabase.co/auth/v1/callback`
   - Staging: `https://staging-project.supabase.co/auth/v1/callback`

2. **Test locally first:**
   - Add `http://localhost:3000/auth/callback` to Google Cloud Console
   - Test the full flow locally before deploying

3. **Keep a checklist:**
   - Document your project references
   - Keep Google Cloud Console and Supabase URLs in sync

---

## 📚 Related Documentation

- [Supabase OAuth Guide](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Google OAuth Setup](https://developers.google.com/identity/protocols/oauth2)
- [Production Deployment Guide](./PRODUCTION_DEPLOYMENT_GUIDE.md)

