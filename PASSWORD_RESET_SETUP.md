# Password Reset Flow Setup Guide

## Current Flow

1. User clicks "Ai uitat parola?" → triggers `handleForgotPassword()`
2. Supabase sends reset email via Resend to user's email
3. Email contains link: `YOUR_APP_URL/auth/callback?code=XXX&next=/reset-password`
4. User clicks link → `/auth/callback` exchanges code for session → redirects to `/reset-password`
5. User enters new password → `updateUser({ password })` → success page → redirect to dashboard

## ⚠️ Issue: "Nothing happens when I click the reset link"

**Possible causes:**
- ❌ Resend not configured in Supabase
- ❌ Email is not being sent at all
- ❌ Redirect URL in email template is pointing to wrong domain
- ❌ Session exchange failing silently

---

## Setup Steps (Required)

### Step 1: Verify Resend is configured in Supabase

**Go to:** Supabase Dashboard → Project → Authentication → Email Templates

**Check:**
- Provider should be "Custom SMTP" or "Resend"
- If using "Custom SMTP", you should have:
  - SMTP Host: `smtp.resend.dev` (for Resend)
  - SMTP Port: `587`
  - SMTP User: `resend` (or your Resend API key)
  - SMTP Pass: Your Resend API key

**If not configured:**
1. Get your Resend API key from https://resend.com/api-keys
2. Set up Custom SMTP with Resend details in Supabase

### Step 2: Check Email Template Configuration

**In Supabase → Authentication → Email Templates → "Reset Password" template:**

**Verify the "Redirect URL" is set to:**
```
https://YOUR_DOMAIN/auth/callback
```

(Do NOT include `?code=` or `&next=` — Supabase adds these automatically)

### Step 3: Test the Reset Flow

1. Go to `https://YOUR_DOMAIN/login`
2. Click "Ai uitat parola?"
3. Enter an email address
4. Check the email (including spam folder)
5. Click the reset link in the email
6. You should be redirected to `/reset-password` page

**If you don't get an email:**
- Check Supabase Logs: Authentication → Logs
- Look for `ResetPasswordForEmail` entries
- Check error messages

**If you get an error on the reset page:**
- Open browser DevTools → Console tab
- Look for error messages
- Check the Network tab to see if the auth callback succeeded

---

## Debug Checklist

### ✅ Email is being sent but reset not working
```
Issue: Email arrives, but clicking link shows error or redirects to login
Solution: Check Session Exchange
- The /auth/callback route handles code exchange
- Make sure redirectTo parameter in resetPasswordForEmail matches your domain
```

### ✅ No email arrives
```
Issue: User doesn't receive reset email
Solution: Check SMTP config
1. Verify Resend API key is correct in Supabase
2. Check Supabase logs for errors
3. Test with a different email address
4. Check email spam folder
```

### ✅ Reset page loads but submit fails
```
Issue: Can set password but get error on submit
Solution: 
- Check browser console for auth errors
- Verify session was successfully created by auth callback
- Make sure user is authenticated before calling updateUser()
```

---

## Code Reference

**In `apps/web/src/app/(auth)/login/page.tsx`:**
```typescript
async function handleForgotPassword() {
  if (!email) { toast.error('Introduceți email-ul mai întâi.'); return }
  const { error } = await createClient().auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
  })
  // ^ This URL must match your actual domain
  if (error) toast.error(error.message)
  else toast.success('Email de resetare trimis! Verificați căsuța poștală și urmați linkul.')
}
```

**In `apps/web/src/app/auth/callback/route.ts`:**
```typescript
// Already handles code exchange and redirects to /reset-password
// No changes needed here
```

**In `apps/web/src/app/(auth)/reset-password/page.tsx`:**
```typescript
async function handleSubmit(e: React.FormEvent) {
  // ... validation ...
  const { error } = await createClient().auth.updateUser({ password })
  if (error) { toast.error('Eroare: ' + error.message); return }
  setDone(true)
  // Auto-redirect after 2.5s
}
```

---

## Quick Test

Run this in browser console while logged out:
```javascript
const email = 'your-email@example.com';
// Check if Supabase is initialized
console.log(supabase);
// Try to trigger reset
// (You'll need access to Supabase client from the page)
```

---

## Production Checklist

Before deploying to production:
- ✅ Resend API key configured in Supabase
- ✅ Email template redirect URL set to production domain
- ✅ Test reset flow on staging environment
- ✅ Verify emails arrive from `noreply@resend.dev` or your Resend sender domain
- ✅ Check that callback redirects work on your deployed domain
