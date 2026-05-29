# Password Reset — Setup Guide for arendapro.com

## How the flow works (end to end)

```
User enters email → clicks "Ai uitat parola?"
  → app calls Supabase resetPasswordForEmail()
    → Supabase/Resend sends email with a one-time link
      → user clicks link in email
        → browser hits: https://arendapro.com/auth/callback?code=XXX&next=/reset-password
          → /auth/callback exchanges the code for a session
            → redirects to: https://arendapro.com/reset-password
              → user enters new password → done
```

No manual URL changes needed in the code — it's already wired correctly.
You only need to configure **3 places in Supabase Dashboard**.

---

## Step 1 — Set the Site URL

**Supabase Dashboard → Project Settings → Authentication → URL Configuration**

Set **Site URL** to:
```
https://arendapro.com
```

---

## Step 2 — Add the Redirect URL to the Allowlist

**Same page → Redirect URLs section → Add URL**

Add this exact URL:
```
https://arendapro.com/auth/callback
```

> Without this, Supabase will block the redirect and the reset link won't work.

---

## Step 3 — Configure Email Sending via Resend

**Supabase Dashboard → Project Settings → Authentication → SMTP Settings**

Enable "Custom SMTP" and fill in:

| Field | Value |
|---|---|
| Host | `smtp.resend.dev` |
| Port | `587` |
| Username | `resend` |
| Password | your Resend API key (from https://resend.com/api-keys) |
| Sender name | `ArendaPro` |
| Sender email | `noreply@arendapro.com` (must be a verified domain in Resend) |

> If you haven't verified `arendapro.com` in Resend yet:
> 1. Go to https://resend.com/domains
> 2. Add `arendapro.com`
> 3. Add the DNS records they give you (TXT/MX records) to your domain registrar
> 4. Click "Verify" in Resend after adding DNS records

---

## Step 4 — Verify the Email Template (optional but recommended)

**Supabase Dashboard → Authentication → Email Templates → Reset Password**

The template already contains a reset link placeholder. You don't need to change it.

Just confirm the template has `{{ .ConfirmationURL }}` somewhere — that's the link Supabase generates, which will point to:
```
https://arendapro.com/auth/callback?code=XXX&next=/reset-password
```

> The `redirectTo` is passed from the code automatically — you don't add `?next=` manually in the template.

---

## Test the flow

1. Go to **https://arendapro.com/login**
2. Enter a real email address in the field
3. Click **"Ai uitat parola?"** (do NOT click Login)
4. You should see a green toast: _"Email de resetare trimis!"_
5. Check your inbox (and spam folder)
6. Click the link in the email
7. You should land on **https://arendapro.com/reset-password** with the password form
8. Enter new password → click Salvează → success screen → redirects to dashboard

---

## Troubleshooting

**Toast says error / nothing happens after clicking "Ai uitat parola?"**
- Supabase SMTP not configured → do Step 3 above
- Check: Supabase Dashboard → Logs → Auth for error details

**Email arrives but clicking the link shows "Invalid link" or redirects to login**
- Redirect URL not in allowlist → do Step 2 above
- Check that Site URL in Step 1 matches exactly (no trailing slash)

**Reset page loads but shows "Se încarcă sesiunea..." forever**
- The `?code=` was not exchanged successfully
- Check: Supabase Logs → Auth → look for `exchangeCodeForSession` errors
- Most common cause: Redirect URL not in allowlist (Step 2)

**Reset page form appears but submit gives "Auth session missing" error**
- Same root cause — session was not created from the code exchange
- Fix: Step 2 (add callback URL to allowlist)

**Email never arrives even after SMTP is configured**
- Sender domain `arendapro.com` not verified in Resend → do domain verification (Step 3)
- Resend free tier: can only send to verified email addresses — upgrade or verify domain
- Check Resend dashboard → Logs for delivery status
