"""Retrieval from the training knowledge base."""

from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass
from pathlib import PurePosixPath
from typing import Any

import boto3
from botocore.config import Config

REGION = os.getenv("AWS_REGION", "ap-northeast-1")
KNOWLEDGE_BASE_ID = os.getenv("KNOWLEDGE_BASE_ID", "")

POLICY_TITLES = {
    "01-work-hours": "就業・勤務時間規程",
    "02-leave": "休暇規程",
    "03-remote-work": "リモートワーク規程",
    "04-information-security": "情報セキュリティ基本規程",
    "05-generative-ai": "生成AI利用規程",
    "06-expenses": "経費精算規程",
    "07-business-travel": "国内・海外出張規程",
    "08-data-classification": "データ分類・個人情報取扱規程",
    "09-business-continuity": "災害対応・事業継続規程",
    "10-harassment": "ハラスメント防止・相談規程",
    "11-side-jobs": "副業・利益相反規程",
    "12-device-management": "端末・記録媒体管理規程",
}

_client = boto3.client(
    "bedrock-agent-runtime",
    region_name=REGION,
    config=Config(
        retries={"total_max_attempts": 3, "mode": "adaptive"},
        connect_timeout=5,
        read_timeout=20,
    ),
)


@dataclass(frozen=True)
class RagResult:
    title: str
    text: str
    uri: str


def _source_uri(result: dict[str, Any]) -> str:
    location = result.get("location", {})
    for value in location.values():
        if isinstance(value, dict):
            uri = value.get("uri") or value.get("url")
            if isinstance(uri, str):
                return uri
    metadata = result.get("metadata", {})
    if isinstance(metadata, dict):
        for key in ("x-amz-bedrock-kb-source-uri", "source_uri", "uri"):
            value = metadata.get(key)
            if isinstance(value, str):
                return value
    return ""


def _title_from_uri(uri: str, index: int, text: str) -> str:
    filename = PurePosixPath(uri).name.removesuffix(".md") if uri else ""
    if filename in POLICY_TITLES:
        return POLICY_TITLES[filename]
    first_line = text.splitlines()[0].strip() if text.splitlines() else ""
    if first_line.startswith("#"):
        return first_line.lstrip("# ").strip()
    return filename or f"社内規定 {index + 1}"


def _retrieve_sync(query: str) -> list[RagResult]:
    if not KNOWLEDGE_BASE_ID:
        raise RuntimeError("Knowledge base is not configured.")
    response = _client.retrieve(
        knowledgeBaseId=KNOWLEDGE_BASE_ID,
        retrievalQuery={"text": query},
        retrievalConfiguration={"vectorSearchConfiguration": {"numberOfResults": 4}},
    )
    results: list[RagResult] = []
    for index, item in enumerate(response.get("retrievalResults", [])):
        content = item.get("content", {})
        text = content.get("text") if isinstance(content, dict) else None
        if not isinstance(text, str) or not text.strip():
            continue
        uri = _source_uri(item)
        clean_text = text.strip()
        results.append(RagResult(title=_title_from_uri(uri, index, clean_text), text=clean_text, uri=uri))
    return results


async def retrieve_policies(query: str) -> list[RagResult]:
    """Retrieve the four most relevant fictional policy chunks."""
    return await asyncio.to_thread(_retrieve_sync, query)
