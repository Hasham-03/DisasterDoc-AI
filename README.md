# DisasterDoc AI

DisasterDoc AI is an offline-first emergency reporting and intelligence web app.
It allows users to submit disaster reports even without network connectivity, syncs pending reports when the internet is back, and supports semantic search over incidents using Bedrock embeddings plus Pinecone vector search.

## Live Links

- Live demo: https://main.d3o7s21c90yij3.amplifyapp.com
- Repository: https://github.com/Hasham-03/disaster-doc-ai

## Core Features

- Offline-first incident reporting with local persistence in IndexedDB (Dexie)
- Automatic background sync for pending and failed reports when connectivity returns
- Geolocation capture with accuracy metadata
- Semantic incident search via Bedrock Titan embeddings + Pinecone vector database
- Critical alert notifications through Amazon SNS for high-urgency reports
- Responsive UI with modern motion and dashboard filters
- PWA support with service worker registration and navigation caching

## Tech Stack

- Framework: Next.js App Router (TypeScript)
- UI: React, Tailwind CSS v4
- Local storage: Dexie + IndexedDB
- AI: Amazon Bedrock (amazon.titan-embed-text-v2:0)
- Vector DB: Pinecone
- Alerts: Amazon SNS
- Hosting: AWS Amplify

## Project Structure

- app/page.tsx: report submission UI (offline-first)
- app/dashboard/page.tsx: search and incident intelligence dashboard
- app/api/sync/route.ts: sync handler + critical SNS alerting
- app/api/search/route.ts: embedding generation + Pinecone query
- hooks/useSync.ts: retry/backoff sync orchestration
- lib/db.ts: Dexie schema and emergency report model
- app/sw.ts and public/sw.js: service worker and runtime caching

## Local Development

Prerequisites:

- Node.js 18+
- npm

Install and run:

```bash
npm install
npm run dev
```

App runs on http://localhost:3000

## Environment Variables

Create .env.local for local development and set the following values:

```env
PINECONE_API_KEY=
PINECONE_HOST=
PINECONE_NAMESPACE=emergency-reports
SNS_TOPIC_ARN=
AWS_REGION=ap-south-1
DDB_TABLE_NAME=
SYNC_LAMBDA_URL=
```

Notes:

- PINECONE_API_KEY is required for semantic search.
- SNS_TOPIC_ARN is required only for critical alert publishing.
- SYNC_LAMBDA_URL points to the ingestion Lambda URL.

## API Overview

POST /api/sync

- Accepts a report payload from local queue
- Publishes critical alerts to SNS when urgency >= 9
- Forwards report to the sync Lambda URL
- Returns sync status and alert metadata

POST /api/search

- Accepts a query string
- Generates query embedding through Bedrock
- Runs top-k vector similarity search in Pinecone
- Returns matched reports with metadata

## Deployment (AWS Amplify)

This repository includes amplify.yml for Amplify builds.

Required Amplify environment variables:

- PINECONE_API_KEY
- PINECONE_HOST
- PINECONE_NAMESPACE
- SNS_TOPIC_ARN
- DDB_TABLE_NAME
- AWS_REGION
- SYNC_LAMBDA_URL

Build command:

```bash
npm run build
```

## Resume-Ready Highlights

- Built and deployed a production-style, offline-capable disaster workflow
- Implemented semantic retrieval pipeline with Bedrock + Pinecone
- Solved real deployment issues involving cloud env loading and IAM permissions
- Added resilient sync with retries, backoff, and failure tracking

## Author

- GitHub: https://github.com/Hasham-03
- LinkedIn: https://www.linkedin.com/in/mohammed-hasham-38765a27a
