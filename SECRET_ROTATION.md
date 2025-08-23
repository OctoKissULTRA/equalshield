# 🔐 Secret Rotation Runbook

## When to Rotate Secrets

- **Immediately**: After any suspected compromise
- **Quarterly**: Regular rotation for high-value secrets
- **On Employee Departure**: When team members with access leave
- **After Incidents**: Following any security incident

## Secret Rotation Procedures

### 1. Stripe Webhook Secret Rotation

**Zero-downtime rotation procedure:**

```bash
# Step 1: Generate new webhook endpoint in Stripe Dashboard
# Dashboard → Developers → Webhooks → Add endpoint
# Copy the new signing secret (whsec_new_...)

# Step 2: Add both secrets to environment
STRIPE_WEBHOOK_SECRET=whsec_current_...
STRIPE_WEBHOOK_SECRET_NEW=whsec_new_...

# Step 3: Update webhook handler to accept both
# app/api/stripe/webhook/route.ts
const sig = headers.get('stripe-signature');
let event;
try {
  event = stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET);
} catch (err) {
  // Try new secret if old fails
  try {
    event = stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET_NEW);
  } catch {
    return new Response('Invalid signature', { status: 400 });
  }
}

# Step 4: Deploy and monitor for 24-48 hours

# Step 5: Switch primary secret
STRIPE_WEBHOOK_SECRET=whsec_new_...
# Remove STRIPE_WEBHOOK_SECRET_NEW

# Step 6: Delete old webhook endpoint in Stripe Dashboard
```

### 2. Database Credentials Rotation (Supabase)

```bash
# Step 1: Generate new service role key in Supabase Dashboard
# Settings → API → Service role key → Regenerate

# Step 2: Update in parallel (both keys work temporarily)
SUPABASE_SERVICE_ROLE_KEY_OLD=eyJ...old
SUPABASE_SERVICE_ROLE_KEY=eyJ...new

# Step 3: Deploy with new key
# Step 4: Remove old key after confirming deployment
```

### 3. OpenAI API Key Rotation

```bash
# Step 1: Create new API key at platform.openai.com
# Step 2: Test new key locally
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer sk-new-key"

# Step 3: Update environment
OPENAI_API_KEY=sk-new-key

# Step 4: Deploy
# Step 5: Delete old key from OpenAI dashboard
```

### 4. Cron Secret Rotation

```bash
# Step 1: Generate new secret
openssl rand -base64 32

# Step 2: Update environment
TRUST_CRON_SECRET_OLD=old-secret
TRUST_CRON_SECRET=new-secret

# Step 3: Update cron auth to accept both temporarily
# lib/security/cron-auth.ts
if (token !== expectedSecret && token !== process.env.TRUST_CRON_SECRET_OLD) {
  throw new CronAuthError('Invalid cron secret', 403);
}

# Step 4: Update Vercel/Railway cron job headers
# Step 5: Remove old secret after confirming cron runs
```

### 5. JWT Secret Rotation

```bash
# Step 1: Generate new secret
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Step 2: Dual-secret period (1 week)
JWT_SECRET=new-secret
JWT_SECRET_OLD=old-secret

# Step 3: Update session validation to try both
# Step 4: After all sessions expire (7 days), remove old secret
```

## Emergency Rotation Script

```bash
#!/bin/bash
# emergency-rotate.sh

echo "🚨 Emergency Secret Rotation"

# 1. Generate all new secrets
NEW_CRON_SECRET=$(openssl rand -base64 32)
NEW_JWT_SECRET=$(openssl rand -base64 32)

# 2. Update locally
cat > .env.emergency <<EOF
TRUST_CRON_SECRET=$NEW_CRON_SECRET
JWT_SECRET=$NEW_JWT_SECRET
# Copy other non-rotated values from .env.local
EOF

# 3. Deploy immediately
vercel env rm TRUST_CRON_SECRET --yes
vercel env add TRUST_CRON_SECRET production < <(echo $NEW_CRON_SECRET)

vercel env rm JWT_SECRET --yes  
vercel env add JWT_SECRET production < <(echo $NEW_JWT_SECRET)

# 4. Trigger deployment
vercel --prod

echo "✅ Emergency rotation complete"
echo "⚠️  Update cron job configurations manually"
```

## Secret Security Checklist

### Storage
- [ ] Never commit secrets to git (use .gitignore)
- [ ] Use environment variables or secret management service
- [ ] Encrypt secrets at rest
- [ ] Limit access to production secrets

### Access Control
- [ ] Use principle of least privilege
- [ ] Rotate on employee departure
- [ ] Audit access logs regularly
- [ ] Use MFA for secret management platforms

### Monitoring
- [ ] Alert on authentication failures
- [ ] Monitor for exposed secrets in logs
- [ ] Regular secret scanning in repositories
- [ ] Track secret age and rotation schedule

## Rotation Schedule

| Secret | Rotation Frequency | Last Rotated | Next Rotation |
|--------|-------------------|--------------|---------------|
| STRIPE_WEBHOOK_SECRET | Quarterly | - | - |
| SUPABASE_SERVICE_ROLE_KEY | Quarterly | - | - |
| OPENAI_API_KEY | Monthly | - | - |
| TRUST_CRON_SECRET | Quarterly | - | - |
| JWT_SECRET | Annually | - | - |
| Database Password | Quarterly | - | - |

## Post-Rotation Verification

```bash
# Run after each rotation
npm run env:check
npm run env:doctor
curl -s https://app.example.com/api/admin/env | jq '.health'
```

## Incident Response

If a secret is compromised:

1. **Immediate**: Rotate the compromised secret
2. **Assess**: Check logs for unauthorized usage
3. **Notify**: Inform security team and affected users
4. **Audit**: Review all systems using the secret
5. **Document**: Record incident and response
6. **Improve**: Update procedures to prevent recurrence