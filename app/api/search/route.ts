import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const bedrock = new BedrockRuntimeClient({ region: 'ap-south-1' });
const DEFAULT_PINECONE_HOST = 'https://disaster-reports-27mvwjb.svc.aped-4627-b74a.pinecone.io';
const DEFAULT_PINECONE_NAMESPACE = 'emergency-reports';

export async function POST(req: Request) {
  try {
    const pineconeApiKey = process.env.PINECONE_API_KEY;
    const pineconeHost = process.env.PINECONE_HOST ?? DEFAULT_PINECONE_HOST;
    const pineconeNamespace = process.env.PINECONE_NAMESPACE ?? DEFAULT_PINECONE_NAMESPACE;

    if (!pineconeApiKey) {
      return NextResponse.json({ error: 'Missing PINECONE_API_KEY' }, { status: 500 });
    }

    const { query } = (await req.json()) as { query?: string };

    if (!query || !query.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const embedCmd = new InvokeModelCommand({
      modelId: 'amazon.titan-embed-text-v2:0',
      body: JSON.stringify({ inputText: query, dimensions: 1024, normalize: true }),
      contentType: 'application/json',
      accept: 'application/json',
    });

    const embedRes = await bedrock.send(embedCmd);
    const embedBody = new TextDecoder().decode(embedRes.body);
    const vector = JSON.parse(embedBody).embedding as number[];

    const pineconeRes = await fetch(`${pineconeHost}/query`, {
      method: 'POST',
      headers: {
        'Api-Key': pineconeApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vector,
        topK: 5,
        includeMetadata: true,
        namespace: pineconeNamespace,
      }),
    });

    if (!pineconeRes.ok) {
      const errorText = await pineconeRes.text();
      return NextResponse.json(
        { error: 'Pinecone query failed', details: errorText },
        { status: pineconeRes.status }
      );
    }

    const results = await pineconeRes.json();
    return NextResponse.json(results.matches ?? []);
  } catch (error) {
    console.error('Search failed', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
