# A Few Less Hub

## Setup

1. Clone this repo
2. `npm install`
3. Copy `.env.example` to `.env.local` and fill in values
4. `npm run dev`

## Deploy to Vercel

1. Push to GitHub
2. Import in Vercel
3. Set environment variables in Vercel dashboard:
   - `ANTHROPIC_API_KEY` — your Anthropic API key
   - `AGENDA_DB_ID` — 028c9e700c294b7dbe2200653660a031
   - `CONTENT_DB_ID` — f8c9b42b72a14708acad52d04f984817

## Usage

Open the app and enter your Notion token in Settings.
The Anthropic API key goes in Vercel environment variables (not the app).
