# WhatsApp Bot — Setup Checklist (Phase 2, Step 1)

Everything here is free. Test mode allows messaging up to 5 numbers you pre-approve.

## 1. Meta account (≈20 min, once)

1. Go to <https://developers.facebook.com> → sign up / log in with your Facebook account.
2. Create an app → type **Business** → add the **WhatsApp** product.
3. In **WhatsApp → API Setup** you get a free **test phone number**. Note down:
   - **Phone number ID**
   - A **temporary access token** (lasts 24h; fine for testing — a permanent token comes later via System User in Business Settings)
4. Under **WhatsApp → Configuration**, add your webhook:
   - Callback URL: `https://<your-project-ref>.supabase.co/functions/v1/whatsapp-webhook`
   - Verify token: any string you make up (e.g. `villagestock-verify-<random>`)
5. Add yourself (and up to 4 others) as **allowed test numbers** — only these can message the bot in test mode.

## 2. Anthropic key (≈2 min)

1. <https://console.anthropic.com> → API Keys → Create key.
2. Add a few dollars of credit if needed (testing costs pennies).

## 3. Secrets (paste in terminal, in the repo root)

```bash
supabase secrets set \
  WHATSAPP_VERIFY_TOKEN="the-token-you-picked" \
  WHATSAPP_TOKEN="your-meta-access-token" \
  WHATSAPP_PHONE_NUMBER_ID="from-meta-dashboard" \
  ANTHROPIC_API_KEY="sk-ant-..."

supabase functions deploy whatsapp-webhook --no-verify-jwt
```

`--no-verify-jwt` is required: Meta calls the webhook without a Supabase JWT. The
GET handshake check + scoping by `whatsapp_links` is the security boundary.

## 4. Apply the database migration

```bash
supabase db push
```

## 5. Link your shop to your WhatsApp

For testing, insert the link directly (service-role equivalent) via Supabase Studio
SQL editor — replace the UUID with your auth user id:

```sql
insert into public.whatsapp_links (phone_msisdn, business_id, verified, verified_at)
values ('2348031234567', 'your-user-uuid', true, now());
```

(An in-app "Link WhatsApp" screen with a code flow replaces this in a later step.)

## 6. Test

Message the test number from your allowed WhatsApp:

- *"how much did I make today"*
- *"what phones do I have in stock"*
- *"who owes me money"*

The bot should reply within a couple of seconds. Check
`supabase functions logs whatsapp-webhook` if nothing comes back.

## Later (production, still free to obtain)

- Permanent token: Business Settings → System Users → generate token with `whatsapp_business_messaging` permission.
- Business verification to move past the 5-number test limit.
