import json

from guardrail_trace import merge_guardrail_traces, summarize_guardrail_trace


def test_summarizes_intervened_policies_without_exposing_matches_or_model_output() -> None:
    trace = summarize_guardrail_trace({
        "trace": {
            "guardrail": {
                "modelOutput": ["blocked model output"],
                "inputAssessment": {
                    "guardrail-id": {
                        "appliedGuardrailDetails": {
                            "guardrailId": "guardrail-id",
                            "guardrailVersion": "2",
                        },
                        "topicPolicy": {
                            "topics": [{
                                "name": "Travel",
                                "type": "DENY",
                                "action": "BLOCKED",
                                "detected": True,
                            }],
                        },
                        "wordPolicy": {
                            "customWords": [{
                                "match": "secret blocked word",
                                "action": "BLOCKED",
                                "detected": True,
                            }],
                        },
                        "sensitiveInformationPolicy": {
                            "piiEntities": [{
                                "match": "private@example.com",
                                "type": "EMAIL",
                                "action": "ANONYMIZED",
                                "detected": True,
                            }],
                            "regexes": [],
                        },
                    },
                },
            },
        },
    })

    assert trace is not None
    assert trace["result"] == "BLOCKED"
    assert trace["guardrails"] == [{"id": "guardrail-id", "version": "2"}]
    assert {item["policy"] for item in trace["assessments"]} == {
        "topic",
        "word",
        "sensitive-information",
    }
    serialized = json.dumps(trace)
    assert "private@example.com" not in serialized
    assert "secret blocked word" not in serialized
    assert "blocked model output" not in serialized


def test_summarizes_output_content_filter_details() -> None:
    trace = summarize_guardrail_trace({
        "trace": {
            "guardrail": {
                "outputAssessments": {
                    "guardrail-id": [{
                        "appliedGuardrailDetails": {
                            "guardrailId": "guardrail-id",
                            "guardrailVersion": "4",
                        },
                        "contentPolicy": {
                            "filters": [{
                                "type": "VIOLENCE",
                                "confidence": "HIGH",
                                "filterStrength": "MEDIUM",
                                "action": "BLOCKED",
                                "detected": True,
                            }],
                        },
                    }],
                },
            },
        },
    })

    assert trace == {
        "result": "BLOCKED",
        "guardrails": [{"id": "guardrail-id", "version": "4"}],
        "assessments": [{
            "source": "output",
            "policy": "content",
            "name": "VIOLENCE",
            "action": "BLOCKED",
            "confidence": "HIGH",
            "filterStrength": "MEDIUM",
            "detected": True,
        }],
    }


def test_creates_minimal_blocked_summary_when_stop_reason_intervened() -> None:
    trace = merge_guardrail_traces([], intervened=True)
    assert trace is not None
    assert trace["result"] == "BLOCKED"
    assert trace["guardrails"] == []
    assert trace["assessments"] == []


def test_uses_requested_version_when_applied_details_are_absent() -> None:
    trace = summarize_guardrail_trace(
        {
            "trace": {
                "guardrail": {
                    "inputAssessment": {
                        "guardrail-id": {
                            "topicPolicy": {
                                "topics": [{
                                    "name": "Travel",
                                    "type": "DENY",
                                    "action": "BLOCKED",
                                }],
                            },
                        },
                    },
                },
            },
        },
        "guardrail-id",
        "7",
    )

    assert trace is not None
    assert trace["guardrails"] == [{"id": "guardrail-id", "version": "7"}]
