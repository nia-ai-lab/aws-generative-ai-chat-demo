from langchain_core.messages import HumanMessage, SystemMessage

from graph import messages_for_model
from prompts import compose_system_prompt


def test_prompt_layers_keep_administrator_instruction_first() -> None:
    prompt = compose_system_prompt("管理者指示", "海賊の口調で回答する")
    assert prompt.index("管理者指示") < prompt.index("海賊の口調で回答する")
    assert "admin_system_prompt を user_persona より優先" in prompt
    assert "AWSトレーニング環境" not in prompt


def test_blank_persona_adds_no_placeholder() -> None:
    prompt = compose_system_prompt("管理者指示", "  ")
    assert "管理者指示" in prompt
    assert "user_persona" not in prompt
    assert "追加指示なし" not in prompt


def test_blank_prompts_return_empty_string() -> None:
    assert compose_system_prompt("  ", "") == ""


def test_persona_can_be_used_without_administrator_prompt() -> None:
    prompt = compose_system_prompt("", "簡潔に回答する")
    assert "簡潔に回答する" in prompt
    assert "admin_system_prompt" not in prompt


def test_empty_prompt_does_not_create_system_message() -> None:
    user_message = HumanMessage("こんにちは")
    messages = messages_for_model("", [user_message])
    assert messages == [user_message]
    assert not any(isinstance(message, SystemMessage) for message in messages)


def test_configured_prompt_creates_system_message() -> None:
    user_message = HumanMessage("こんにちは")
    messages = messages_for_model("管理者指示", [user_message])
    assert isinstance(messages[0], SystemMessage)
    assert messages[0].content == "管理者指示"
    assert messages[1] == user_message
