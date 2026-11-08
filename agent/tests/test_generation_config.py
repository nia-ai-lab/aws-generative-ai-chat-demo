import pytest

import graph


def test_model_uses_participant_generation_config(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    def fake_model(**kwargs: object) -> dict[str, object]:
        captured.update(kwargs)
        return kwargs

    monkeypatch.setattr(graph, "ChatBedrockConverse", fake_model)
    graph.model_for.cache_clear()
    graph.model_for("global.anthropic.claude-sonnet-5-5", 0.8, 0.9, 2_048, "", "")

    assert captured["temperature"] == 0.8
    assert captured["top_p"] == 0.9
    assert captured["max_tokens"] == 2_048


def test_model_omits_top_p_when_model_default_is_selected(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    def fake_model(**kwargs: object) -> dict[str, object]:
        captured.update(kwargs)
        return kwargs

    monkeypatch.setattr(graph, "ChatBedrockConverse", fake_model)
    graph.model_for.cache_clear()
    graph.model_for("global.anthropic.claude-sonnet-5-5", 0.3, None, 1_024, "", "")

    assert "top_p" not in captured


def test_model_applies_selected_versioned_guardrail(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    def fake_model(**kwargs: object) -> dict[str, object]:
        captured.update(kwargs)
        return kwargs

    monkeypatch.setattr(graph, "ChatBedrockConverse", fake_model)
    graph.model_for.cache_clear()
    graph.model_for("global.anthropic.claude-sonnet-5-5", 0.3, None, 1_024, "guardrail-id", "3")

    assert captured["guardrails"] == {
        "guardrailIdentifier": "guardrail-id",
        "guardrailVersion": "3",
        "trace": "enabled",
        "streamProcessingMode": "sync",
    }


def test_model_omits_sampling_parameters_when_not_supplied(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    def fake_model(**kwargs: object) -> dict[str, object]:
        captured.update(kwargs)
        return kwargs

    monkeypatch.setattr(graph, "ChatBedrockConverse", fake_model)
    graph.model_for.cache_clear()
    graph.model_for("global.anthropic.claude-sonnet-5-5", None, None, 1_024, "", "")

    assert "temperature" not in captured
    assert "top_p" not in captured
    assert captured["max_tokens"] == 1_024


def test_model_forces_streaming_for_every_catalog_model(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    def fake_model(**kwargs: object) -> dict[str, object]:
        captured.update(kwargs)
        return kwargs

    monkeypatch.setattr(graph, "ChatBedrockConverse", fake_model)
    graph.model_for.cache_clear()
    graph.model_for("global.anthropic.claude-haiku-5-5", None, None, 1_024, "", "")

    assert captured["disable_streaming"] is False

