import pytest
from pydantic import ValidationError

from schemas import ChatInvocation


def valid_invocation() -> dict[str, str]:
    return {
        "requestId": "550e8400-e29b-41d4-a716-446655440000",
        "actorId": "a" * 64,
        "conversationSessionId": "b52817f8-3778-45be-8ca6-5ad67956b9f7",
        "runtimeSessionId": "b" * 64,
        "modelId": "global.anthropic.claude-sonnet-5",
        "modelKey": "claude-sonnet-5",
        "message": "前の発言を覚えていますか？",
        "adminSystemPrompt": "安全に回答してください。",
        "userSystemPrompt": "",
    }


def test_runtime_session_id_is_accepted() -> None:
    invocation = ChatInvocation.model_validate(valid_invocation())
    assert invocation.runtimeSessionId == "b" * 64


def test_runtime_session_id_must_be_server_derived_hash() -> None:
    with pytest.raises(ValidationError):
        ChatInvocation.model_validate({**valid_invocation(), "runtimeSessionId": "not-a-hash"})
