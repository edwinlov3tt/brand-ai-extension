# Quick Start Guide

## Getting Started with Brand Profile & Ad Copy Generation

### Prerequisites

1. **Cloudflare Account** (free): https://dash.cloudflare.com/sign-up
2. **Claude API Key**: https://console.anthropic.com/
3. **Node.js 18+**: https://nodejs.org/
4. **Chrome Browser**: For extension testing

---

## Step 1: Deploy the Worker (10 minutes)

```bash
# Install Wrangler globally
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Navigate to worker directory
cd /Users/edwinlovettiii/brand-ai-extension/worker

# Install dependencies
npm install

# Create D1 database
wrangler d1 create brand-inspector-db
# Copy the database_id from output

# Update wrangler.toml with your database_id
# Edit line 9: database_id = "paste-your-id-here"

# Run database schema
wrangler d1 execute brand-inspector-db --file=schema.sql

# Set Claude API key as secret
wrangler secret put ANTHROPIC_API_KEY
# When prompted, paste your sk-ant-... key

# Deploy to production
npm run deploy

# Note the Worker URL from output (e.g., https://brand-inspector-worker.your-account.workers.dev)
```

---

## Step 2: Configure the Extension

1. **Update Worker URL in ProfileTab**:
   ```javascript
   // Edit: extension/sidepanel/components/ProfileTab.js
   // Line 6: Update constructor
   constructor(workerUrl = 'https://your-worker-url.workers.dev') {
   ```

2. **Add Profile Tab CSS** (see IMPLEMENTATION_SUMMARY.md for styles)

3. **Load Extension in Chrome**:
   - Open Chrome
   - Go to `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select `/Users/edwinlovettiii/brand-ai-extension/extension`

---

## Step 3: Test the Extension

1. **Navigate to a website** (e.g., https://stripe.com)

2. **Click the extension icon** to open side panel

3. **Go to Profile tab**

4. **Click "Generate Brand Profile"**
   - Wait 10-20 seconds for Claude to analyze
   - Profile will display with brand identity, voice, audience

5. **Generate Ad Copy**:
   - Select a tactic (e.g., "Facebook Ad Title")
   - Enter campaign objective (e.g., "Increase signups")
   - Click "Generate Ad Copy"
   - View 3-5 variations with char/word counts

6. **Copy ads to clipboard** by clicking copy icon

---

## Step 4: View All Brands (Optional)

Access the full-width management page:

```
https://your-worker-url.workers.dev/
```

*(Note: Full-width page implementation is pending - see IMPLEMENTATION_SUMMARY.md)*

---

## Troubleshooting

### "Failed to generate profile"
- Check Worker logs: `wrangler tail`
- Verify Claude API key: `wrangler secret list`
- Check D1 database: `wrangler d1 execute brand-inspector-db --command="SELECT COUNT(*) FROM brand_profiles"`

### "Failed to load tactics"
- Verify Worker URL in ProfileTab.js
- Check browser console for CORS errors
- Test API directly: `curl https://your-worker-url.workers.dev/api/tactics`

### Extension not loading
- Check browser console (F12) for errors
- Verify all files exist in `extension/` directory
- Reload extension from `chrome://extensions/`

---

## Quick Commands

```bash
# Deploy Worker
cd worker && npm run deploy

# View Worker logs
cd worker && npm run tail

# Test locally
cd worker && npm run dev

# Query database
wrangler d1 execute brand-inspector-db --command="SELECT domain, name FROM brand_profiles"

# Update API key
wrangler secret put ANTHROPIC_API_KEY

# Reload extension
# Go to chrome://extensions/ and click reload icon
```

---

## What's Next?

1. **Add Profile Tab CSS** - See IMPLEMENTATION_SUMMARY.md
2. **Build Full-Width Page** - See plan.md
3. **Deploy to Production** - Update Worker URL in extension
4. **Publish Extension** - Submit to Chrome Web Store

---

## Cost Breakdown

**Free Tier Limits**:
- Cloudflare Workers: 100,000 requests/day
- D1 Database: 5GB storage, 5M reads/day
- Claude API: Pay per use (~$0.01 per profile)

**Expected Monthly Cost**:
- Light use (10 profiles/day): ~$3/month
- Medium use (50 profiles/day): ~$15/month
- Heavy use (200 profiles/day): ~$60/month

---

## Support Resources

- **Cloudflare Docs**: https://developers.cloudflare.com/workers/
- **Claude API Docs**: https://docs.anthropic.com/
- **Chrome Extensions**: https://developer.chrome.com/docs/extensions/
- **Project Docs**: See IMPLEMENTATION_SUMMARY.md and plan.md
