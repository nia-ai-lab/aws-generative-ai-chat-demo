"""IAM-authenticated AgentCore Web Search client."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any

from mcp import ClientSession
from mcp_proxy_for_aws.client import aws_iam_streamablehttp_client

GATEWAY_REGION = os.getenv("WEB_SEARCH_GATEWAY_REGION", "us-east-1")
GATEWAY_URL = os.getenv("WEB_SEARCH_GATEWAY_URL", "")


@dataclass(frozen=True)
class WebResult:
    title: str
    text: str
    url: str
    published_date: str


def _payload_from_result(result: Any) -> dict[str, Any]:
    structured = getattr(result, "structuredContent", None)
    if isinstance(structured, dict) and isinstance(structured.get("results"), list):
        return structured
    for item in getattr(result, "content", []):
        text = getattr(item, "text", None)
        if not isinstance(text, str):
            continue
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict) and isinstance(parsed.get("results"), list):
            return parsed
    return {"results": []}


async def search_web(query: str, max_results: int = 5) -> list[WebResult]:
    """Invoke the managed WebSearch MCP tool and retain its source metadata."""
    if not GATEWAY_URL:
        raise RuntimeError("Web Search Gateway is not configured.")
    safe_query = query.strip()[:200]
    if not safe_query:
        raise ValueError("A search query is required.")

    transport = aws_iam_streamablehttp_client(
        endpoint=GATEWAY_URL,
        aws_region=GATEWAY_REGION,
        aws_service="bedrock-agentcore",
        timeout=20,
        sse_read_timeout=30,
    )
    async with transport as (read_stream, write_stream, _get_session_id):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            tools = await session.list_tools()
            tool = next((item for item in tools.tools if item.name.endswith("___WebSearch")), None)
            if tool is None:
                tool = next((item for item in tools.tools if item.name == "WebSearch"), None)
            if tool is None:
                raise RuntimeError("WebSearch tool was not discovered.")
            response = await session.call_tool(
                tool.name,
                {"query": safe_query, "maxResults": min(max(max_results, 1), 5)},
            )

    payload = _payload_from_result(response)
    results: list[WebResult] = []
    for item in payload.get("results", []):
        if not isinstance(item, dict):
            continue
        text = item.get("text")
        if not isinstance(text, str) or not text.strip():
            continue
        results.append(WebResult(
            title=str(item.get("title") or item.get("url") or "Web検索結果"),
            text=text.strip(),
            url=str(item.get("url") or ""),
            published_date=str(item.get("publishedDate") or ""),
        ))
    return results
