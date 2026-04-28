import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const runtime = 'nodejs';

const AWS_REGION = process.env.AWS_REGION ?? 'ap-south-1';
const S3_BUCKET = process.env.S3_BUCKET;

const s3 = new S3Client({ region: AWS_REGION });

export async function POST(req: Request) {
  try {
    if (!S3_BUCKET) {
      return NextResponse.json({ error: 'S3_BUCKET not configured' }, { status: 500 });
    }

    const { filename, contentType } = (await req.json()) as {
      filename?: string;
      contentType?: string;
    };

    if (!filename || !contentType) {
      return NextResponse.json({ error: 'filename and contentType required' }, { status: 400 });
    }

    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${filename}`;

    const putCmd = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: contentType,
    });

    const signedUrl = await getSignedUrl(s3, putCmd, { expiresIn: 300 });

    const objectUrl = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;

    return NextResponse.json({ signedUrl, objectUrl, key });
  } catch (err) {
    console.error('Presign failed', err);
    return NextResponse.json({ error: 'Presign failed' }, { status: 500 });
  }
}
