import { NextResponse } from 'next/server';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';

export const runtime = 'nodejs';

const SYNC_LAMBDA_URL =
  process.env.SYNC_LAMBDA_URL ??
  'https://jgbyiit7xe2c2s2f56pt4h5f340xqtyr.lambda-url.ap-south-1.on.aws';

const AWS_REGION = process.env.AWS_REGION ?? 'ap-south-1';
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;
const sns = new SNSClient({ region: AWS_REGION });

type SyncReport = {
  text?: string;
  category?: string;
  urgency?: number;
  latitude?: number;
  longitude?: number;
  timestamp?: number;
};

const sendCriticalAlert = async (report: SyncReport) => {
  if (typeof report.urgency !== 'number' || report.urgency < 9) {
    return {
      attempted: false,
      sent: false,
      reason: 'Urgency below critical threshold (9)',
    };
  }

  if (!SNS_TOPIC_ARN) {
    return {
      attempted: false,
      sent: false,
      reason: 'SNS_TOPIC_ARN is not configured',
    };
  }

  const mapLink =
    typeof report.latitude === 'number' && typeof report.longitude === 'number'
      ? `https://www.google.com/maps?q=${report.latitude},${report.longitude}`
      : 'Location unavailable';

  const subject = `[DisasterDoc] Critical Emergency Alert (Urgency ${report.urgency}/10)`;
  const message = [
    `Urgency: ${report.urgency}/10`,
    `Category: ${report.category ?? 'unknown'}`,
    `Timestamp: ${report.timestamp ? new Date(report.timestamp).toISOString() : 'unknown'}`,
    `Location: ${mapLink}`,
    '',
    'Report text:',
    report.text ?? '(no text provided)',
  ].join('\n');

  const publishRes = await sns.send(
    new PublishCommand({
      TopicArn: SNS_TOPIC_ARN,
      Subject: subject,
      Message: message,
    })
  );

  return {
    attempted: true,
    sent: true,
    reason: `SNS message published (${publishRes.MessageId ?? 'no-message-id'})`,
  };
};

export async function POST(request: Request) {
  try {
    const report = (await request.json()) as SyncReport;
    let alertStatus = {
      attempted: false,
      sent: false,
      reason: 'Not attempted',
    };

    // Non-blocking alert path: critical reports trigger SNS notifications if configured.
    try {
      alertStatus = await sendCriticalAlert(report);
    } catch (emailError) {
      console.error('Critical SNS alert failed', emailError);
      alertStatus = {
        attempted: true,
        sent: false,
        reason: emailError instanceof Error ? emailError.message : 'Unknown SNS error',
      };
    }

    const lambdaResponse = await fetch(SYNC_LAMBDA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(report),
    });

    const responseText = await lambdaResponse.text();

    if (!lambdaResponse.ok) {
      return NextResponse.json(
        {
          error: 'Lambda sync failed',
          status: lambdaResponse.status,
          details: responseText,
          emailAlert: alertStatus,
        },
        { status: lambdaResponse.status }
      );
    }

    let lambdaPayload: unknown = responseText;
    try {
      lambdaPayload = responseText ? JSON.parse(responseText) : { ok: true };
    } catch {
      lambdaPayload = responseText || { ok: true };
    }

    return NextResponse.json({ ok: true, lambda: lambdaPayload, emailAlert: alertStatus });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown sync error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
