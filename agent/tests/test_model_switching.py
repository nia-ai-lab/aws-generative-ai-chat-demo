from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage

import graph

REASONING = {
    "type": "reasoning_content",
    "reasoning_content": {"text": "", "signature": "signed-by-claude"},
}


def test_prior_turn_reasoning_is_removed_for_cross_model_history() -> None:
    history = [
        HumanMessage("私の名前はミナトです。"),
        AIMessage(content=[REASONING, {"type": "text", "text": "覚えました。"}]),
        HumanMessage("私の名前は？"),
    ]

    cleaned = graph.without_prior_turn_reasoning(history)

    assert cleaned[1].content == [{"type": "text", "text": "覚えました。"}]
    assert history[1].content[0] == REASONING  # stored history is not mutated


def test_current_turn_reasoning_is_kept_for_claude_tool_loops() -> None:
    tool_turn = AIMessage(
        content=[REASONING],
        tool_calls=[{"name": "web_search", "args": {"query": "q"}, "id": "tool-1"}],
    )
    history = [
        HumanMessage("調べて"),
        tool_turn,
        ToolMessage(content="{}", tool_call_id="tool-1"),
    ]

    cleaned = graph.without_prior_turn_reasoning(history)

    assert cleaned[1].content == [REASONING]


def test_reasoning_only_prior_answer_keeps_a_text_placeholder() -> None:
    history = [
        HumanMessage("こんにちは"),
        AIMessage(content=[REASONING]),
        HumanMessage("続けて"),
    ]

    cleaned = graph.without_prior_turn_reasoning(history)

    assert cleaned[1].content == [{"type": "text", "text": "(no text response)"}]


def test_messages_for_model_applies_reasoning_cleanup_after_system_prompt() -> None:
    history = [
        HumanMessage("A"),
        AIMessage(content=[REASONING, {"type": "text", "text": "B"}]),
        HumanMessage("C"),
    ]

    messages = graph.messages_for_model("system", "", history)

    assert isinstance(messages[0], SystemMessage)
    assert messages[2].content == [{"type": "text", "text": "B"}]
