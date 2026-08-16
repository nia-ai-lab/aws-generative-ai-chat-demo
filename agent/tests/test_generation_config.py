import graph


def test_model_uses_participant_generation_config(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def fake_model(**kwargs):
        captured.update(kwargs)
        return kwargs

    monkeypatch.setattr(graph, "ChatBedrockConverse", fake_model)
    graph.model_for.cache_clear()
    graph.model_for("global.anthropic.claude-sonnet-5", 0.8, 0.9, 2_048)

    assert captured["temperature"] == 0.8
    assert captured["top_p"] == 0.9
    assert captured["max_tokens"] == 2_048


def test_model_omits_top_p_when_model_default_is_selected(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def fake_model(**kwargs):
        captured.update(kwargs)
        return kwargs

    monkeypatch.setattr(graph, "ChatBedrockConverse", fake_model)
    graph.model_for.cache_clear()
    graph.model_for("global.anthropic.claude-sonnet-5", 0.3, None, 1_024)

    assert "top_p" not in captured
