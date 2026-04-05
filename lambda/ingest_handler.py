import json
import os
from datetime import datetime, timezone

import boto3

sqs = boto3.client("sqs")
QUEUE_URL = os.environ.get("SQS_QUEUE_URL", "")


def _response(status_code: int, payload: dict):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(payload),
    }


def _parse_event_body(event: dict):
    body = event.get("body", {})

    if isinstance(body, str):
        if not body.strip():
            return {}
        return json.loads(body)

    if isinstance(body, dict):
        return body

    return {}


def handler(event, context):
    if not QUEUE_URL:
        return _response(500, {"error": "SQS_QUEUE_URL is not configured"})

    try:
        report = _parse_event_body(event)
    except json.JSONDecodeError as exc:
        return _response(400, {"error": f"Invalid JSON body: {str(exc)}"})

    text = str(report.get("text", "")).strip()
    if not text:
        return _response(400, {"error": "Field 'text' is required"})

    payload = {
        "id": report.get("id"),
        "text": text,
        "category": report.get("category", "other"),
        "urgency": int(report.get("urgency", 5)),
        "timestamp": int(report.get("timestamp") or datetime.now(timezone.utc).timestamp() * 1000),
        "latitude": report.get("latitude", report.get("lat")),
        "longitude": report.get("longitude", report.get("lng")),
        "locationAccuracyM": report.get("locationAccuracyM"),
    }

    sqs.send_message(
        QueueUrl=QUEUE_URL,
        MessageBody=json.dumps(payload),
    )

    return _response(200, {"ok": True, "queued": True})
