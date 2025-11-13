# Brand Inspector Cloudflare Worker

API backend for Brand Inspector Chrome extension - handles brand profile generation and ad copy creation using Claude AI.

## Setup

### 1. Install Dependencies

```bash
cd worker
npm install
```

### 2. Create D1 Database

```bash
# Create database
wrangler d1 create brand-inspector-db

# Copy the database ID from output and update wrangler.toml

# Run schema
wrangler d1 execute brand-inspector-db --file=schema.sql
```

### 3. Set API Key

```bash
# Set Claude API key as secret
wrangler secret put ANTHROPIC_API_KEY
# Paste your sk-ant-... key when prompted
```

### 4. Deploy

```bash
# Deploy to production
npm run deploy

# Or run locally
npm run dev
```

## API Endpoints

### Generate Brand Profile
```http
POST /api/brand-profile
Content-Type: application/json

{
  "domain": "example.com",
  "url": "https://example.com",
  "title": "Page Title",
  "description": "Meta description",
  "text": "Full page text content...",
  "headings": ["Heading 1", "Heading 2"],
  "metadata": {},
  "quickMode": false
}
```

### Get Brand Profile
```http
GET /api/brand-profile/:domain
```

### Generate Ad Copy
```http
POST /api/generate-ad-copy
Content-Type: application/json

{
  "domain": "example.com",
  "tactic": "facebook_title",
  "campaignObjective": "Increase signups",
  "variations": 3
}
```

### Get Tactics
```http
GET /api/tactics
```

### Rate Ad Copy
```http
POST /api/ad-copy/:id/rate
Content-Type: application/json

{
  "rating": 1  // 1 for thumbs up, -1 for thumbs down
}
```

### List All Brands
```http
GET /api/brands
```

## Available Ad Tactics

- **facebook_title** - Facebook Ad Title (40 chars, 6 words)
- **google_headline** - Google Search Headline (30 chars, 5 words)
- **linkedin_intro** - LinkedIn Ad Intro (150 chars, 25 words)
- **instagram_caption** - Instagram Caption (125 chars, 20 words)
- **email_subject** - Email Subject Line (50 chars, 8 words)
- **twitter_post** - Twitter/X Post (280 chars, 45 words)

## Development

```bash
# Run locally with hot reload
npm run dev

# View logs
npm run tail

# Query D1 database
wrangler d1 execute brand-inspector-db --command="SELECT * FROM brand_profiles LIMIT 5"
```

## Environment Variables

- `ANTHROPIC_API_KEY` - Claude API key (set via `wrangler secret`)

## Architecture

```
src/
├── index.js           # Main Worker entry + routing
├── brand-profile.js   # Brand profile generation logic
├── ad-copy.js         # Ad copy generation logic
├── tactics.js         # Ad tactics configuration
└── schema.js          # Data validation and serialization
```

## Database Schema

See `schema.sql` for complete schema. Main tables:

- `brand_profiles` - Stores generated brand profiles
- `ad_copies` - Stores generated ad copy variations

## CORS

All endpoints support CORS for Chrome extension access. The Worker automatically adds appropriate headers.
