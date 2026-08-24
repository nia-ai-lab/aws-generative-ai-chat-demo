"""Dynamic participant access control for AgentCore Runtime invocations."""

from __future__ import annotations

import os
from typing import Any, Protocol

import boto3
import jwt

CONFIG_KEY = "APP_CONFIG"
ADMIN_GROUP = "Admins"


class RequestContextLike(Protocol):
    request_headers: dict[str, str] | None


class ParticipantAccessDisabledError(Exception):
    """Raised when a non-administrator invokes a disabled application."""


_table: Any | None = None


def _config_table() -> Any:
    global _table
    if _table is None:
        table_name = os.environ.get("CONFIG_TABLE_NAME")
        if not table_name:
            raise RuntimeError("CONFIG_TABLE_NAME is not configured.")
        _table = boto3.resource("dynamodb").Table(table_name)
    return _table


def _authorization_header(context: RequestContextLike) -> str:
    headers = context.request_headers or {}
    return headers.get("Authorization", headers.get("authorization", ""))


def _is_admin(context: RequestContextLike) -> bool:
    value = _authorization_header(context)
    token = value[7:] if value.lower().startswith("bearer ") else ""
    if not token:
        return False
    claims: dict[str, Any] = jwt.decode(
        token,
        options={"verify_signature": False, "verify_aud": False, "verify_exp": False},
    )
    groups = claims.get("cognito:groups", [])
    return isinstance(groups, list) and ADMIN_GROUP in groups


def _participant_access_enabled() -> bool:
    response = _config_table().get_item(
        Key={"pk": CONFIG_KEY},
        ProjectionExpression="participantAccessEnabled",
        ConsistentRead=True,
    )
    item = response.get("Item") or {}
    value = item.get("participantAccessEnabled", True)
    return value is True


def require_participant_access(context: RequestContextLike) -> None:
    """Allow administrators, or participants while the administrator switch is on."""
    if _is_admin(context):
        return
    if not _participant_access_enabled():
        raise ParticipantAccessDisabledError
