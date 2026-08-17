import pytest
from pydantic import ValidationError

from schemas import ChatInvocation


def valid_invocation() -> dict[str, object]:
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
        "generationConfig": {
            "temperature": 0.3,
            "topP": None,
            "maxOutputTokens": 1_024,
        },
        "guardrailId": "",
        "guardrailVersion": "",
    }


def test_runtime_session_id_is_accepted() -> None:
    invocation = ChatInvocation.model_validate(valid_invocation())
    assert invocation.runtimeSessionId == "b" * 64
    assert invocation.webSearchEnabled is False
    assert invocation.ragEnabled is False


def test_runtime_session_id_must_be_server_derived_hash() -> None:
    with pytest.raises(ValidationError):
        ChatInvocation.model_validate({**valid_invocation(), "runtimeSessionId": "not-a-hash"})


def test_empty_admin_system_prompt_is_accepted() -> None:
    invocation = ChatInvocation.model_validate({**valid_invocation(), "adminSystemPrompt": ""})
    assert invocation.adminSystemPrompt == ""


def test_generation_config_boundaries_are_enforced() -> None:
    with pytest.raises(ValidationError):
        ChatInvocation.model_validate(
            {
                **valid_invocation(),
                "generationConfig": {
                    "temperature": 1.1,
                    "topP": None,
                    "maxOutputTokens": 1_024,
                },
            }
        )

    with pytest.raises(ValidationError):
        ChatInvocation.model_validate(
            {
                **valid_invocation(),
                "generationConfig": {
                    "temperature": 0.3,
                    "topP": None,
                    "maxOutputTokens": 4_097,
                },
            }
        )


def test_guardrail_id_and_version_must_be_supplied_together() -> None:
    with pytest.raises(ValidationError):
        ChatInvocation.model_validate({**valid_invocation(), "guardrailId": "guardrail-id"})

    invocation = ChatInvocation.model_validate(
        {
            **valid_invocation(),
            "guardrailId": "guardrail-id",
            "guardrailVersion": "1",
        }
    )
    assert invocation.guardrailVersion == "1"
