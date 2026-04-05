import json
import os
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from urllib import error, request

import boto3

bedrock = boto3.client("bedrock-runtime", region_name=os.environ.get("AWS_REGION", "ap-south-1"))
sns = boto3.client("sns", region_name=os.environ.get("AWS_REGION", "ap-south-1"))
dynamodb = boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION", "ap-south-1"))

PINECONE_HOST = os.environ.get("PINECONE_HOST", "")
PINECONE_API_KEY = os.environ.get("PINECONE_API_KEY", "")
PINECONE_NAMESPACE = os.environ.get("PINECONE_NAMESPACE", "emergency-reports")
SNS_TOPIC_ARN = os.environ.get("SNS_TOPIC_ARN", "")
DDB_TABLE_NAME = os.environ.get("DDB_TABLE_NAME", "")


def _embed_text(text: str):
    body = {
        "inputText": text,
        "dimensions": 1024,
        "normalize": True,
    }
    response = bedrock.invoke_model(
        modelId="amazon.titan-embed-text-v2:0",
        contentType="application/json",
        accept="application/json",
        body=json.dumps(body),
    )

    payload = json.loads(response["body"].read())
    return payload["embedding"]


def _publish_critical_alert(report: dict):
    urgency = int(report.get("urgency", 0))
    if urgency < 9 or not SNS_TOPIC_ARN:
        return

    lat = report.get("lat", report.get("latitude"))
    lng = report.get("lng", report.get("longitude"))
    map_link = f"https://www.google.com/maps?q={lat},{lng}" if lat is not None and lng is not None else "Location unavailable"

    message = "\n".join(
        [
            "CRITICAL ALERT",
            "",
            f"Summary: {str(report.get('text', ''))[:180]}",
            f"Location: {map_link}",
        ]
    )

    sns.publish(
        TopicArn=SNS_TOPIC_ARN,
        Subject="Priority Disaster Report",
        Message=message,
    )


def _put_report_dynamodb(report: dict):
    if not DDB_TABLE_NAME:
        return

    table = dynamodb.Table(DDB_TABLE_NAME)
    report_id = str(report.get("id") or uuid.uuid4())
    timestamp = int(report.get("timestamp") or 0)
    urgency = int(report.get("urgency", 5))
    category = str(report.get("category", "other"))
    summary = str(report.get("text", ""))[:180]
    lat = report.get("lat", report.get("latitude"))
    lng = report.get("lng", report.get("longitude"))

    item = {
        "reports_id": report_id,
        "timestamp": timestamp,
        "timestramp": timestamp,
        "urgency": urgency,
        "category": category,
        "summary": summary,
        "status": "PROCESSED",
    }

    if lat is not None:
        item["latitude"] = Decimal(str(lat))
    if lng is not None:
        item["longitude"] = Decimal(str(lng))

    table.put_item(Item=item)


def _upsert_pinecone(vector, report: dict):
    if not PINECONE_HOST or not PINECONE_API_KEY:
        raise RuntimeError("PINECONE_HOST and PINECONE_API_KEY must be configured")

    vector_id = str(report.get("id") or uuid.uuid4())
    metadata = {
        "text": report.get("text", ""),
        "summary": str(report.get("text", ""))[:180],
        "category": report.get("category", "other"),
        "urgency": int(report.get("urgency", 5)),
        "timestamp": int(report.get("timestamp", 0)),
    }

    latitude = report.get("latitude", report.get("lat"))
    longitude = report.get("longitude", report.get("lng"))

    if latitude is not None:
        metadata["latitude"] = latitude
    if longitude is not None:
        metadata["longitude"] = longitude
    if report.get("locationAccuracyM") is not None:
        metadata["locationAccuracyM"] = report.get("locationAccuracyM")

    payload = {
        "namespace": PINECONE_NAMESPACE,
        "vectors": [
            {
                "id": vector_id,
                "values": vector,
                "metadata": metadata,
            }
        ],
    }

    req = request.Request(
        url=f"{PINECONE_HOST}/vectors/upsert",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Api-Key": PINECONE_API_KEY,
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=20) as res:
            if res.status >= 400:
                raise RuntimeError(f"Pinecone upsert failed with status {res.status}")
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Pinecone upsert failed: {exc.code} {body}") from exc


def handler(event, context):
    failures = []

    for record in event.get("Records", []):
        message_id = record.get("messageId", "unknown")
        try:
            report = json.loads(record.get("body", "{}"))
            text = str(report.get("text", "")).strip()
            if not text:
                raise ValueError("Missing report text")

            vector = _embed_text(text)
            _upsert_pinecone(vector, report)
            _put_report_dynamodb(report)
            _publish_critical_alert(report)
        except Exception as exc:  # noqa: BLE001
            print(f"Failed record {message_id}: {str(exc)}")
            failures.append({"itemIdentifier": message_id})

    if failures:
        return {"batchItemFailures": failures}

    return {"ok": True}
