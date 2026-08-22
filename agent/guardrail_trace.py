"""Sanitize Amazon Bedrock Guardrail traces for the chat API."""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any, Literal, NotRequired, TypedDict

GuardrailTraceSource = Literal["input", "output"]
GuardrailTracePolicy = Literal[
    "content",
    "topic",
    "word",
    "sensitive-information",
    "contextual-grounding",
    "automated-reasoning",
]
GuardrailTraceResult = Literal["BLOCKED", "ANONYMIZED", "DETECTED"]


class AppliedGuardrailSummary(TypedDict):
    id: str
    version: str


class GuardrailAssessmentSummary(TypedDict):
    source: GuardrailTraceSource
    policy: GuardrailTracePolicy
    name: str
    action: str
    confidence: NotRequired[str]
    filterStrength: NotRequired[str]
    detected: NotRequired[bool]
    score: NotRequired[float]
    threshold: NotRequired[float]


class GuardrailTraceSummary(TypedDict):
    result: GuardrailTraceResult
    guardrails: list[AppliedGuardrailSummary]
    assessments: list[GuardrailAssessmentSummary]


def _mapping(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _items(value: Any) -> list[dict[str, Any]]:
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _text(value: Any, fallback: str = "") -> str:
    return value if isinstance(value, str) and value else fallback


def _number(value: Any) -> float | None:
    return float(value) if isinstance(value, int | float) and not isinstance(value, bool) else None


def _is_relevant(item: dict[str, Any]) -> bool:
    return _text(item.get("action"), "NONE").upper() != "NONE" or item.get("detected") is True


def _assessment(
    source: GuardrailTraceSource,
    policy: GuardrailTracePolicy,
    name: str,
    item: dict[str, Any],
) -> GuardrailAssessmentSummary | None:
    if not _is_relevant(item):
        return None
    summary: GuardrailAssessmentSummary = {
        "source": source,
        "policy": policy,
        "name": name,
        "action": _text(item.get("action"), "DETECTED").upper(),
    }
    confidence = _text(item.get("confidence"))
    if confidence:
        summary["confidence"] = confidence.upper()
    filter_strength = _text(item.get("filterStrength"))
    if filter_strength:
        summary["filterStrength"] = filter_strength.upper()
    if isinstance(item.get("detected"), bool):
        summary["detected"] = item["detected"]
    score = _number(item.get("score"))
    if score is not None:
        summary["score"] = score
    threshold = _number(item.get("threshold"))
    if threshold is not None:
        summary["threshold"] = threshold
    return summary


def _assessment_details(
    source: GuardrailTraceSource,
    assessment: dict[str, Any],
) -> list[GuardrailAssessmentSummary]:
    summaries: list[GuardrailAssessmentSummary] = []

    content_policy = _mapping(assessment.get("contentPolicy"))
    for item in _items(content_policy.get("filters")):
        summary = _assessment(source, "content", _text(item.get("type"), "CONTENT"), item)
        if summary:
            summaries.append(summary)

    topic_policy = _mapping(assessment.get("topicPolicy"))
    for item in _items(topic_policy.get("topics")):
        summary = _assessment(source, "topic", _text(item.get("name"), "TOPIC"), item)
        if summary:
            summaries.append(summary)

    word_policy = _mapping(assessment.get("wordPolicy"))
    for item in _items(word_policy.get("customWords")):
        summary = _assessment(source, "word", "CUSTOM_WORD", item)
        if summary:
            summaries.append(summary)
    for item in _items(word_policy.get("managedWordLists")):
        summary = _assessment(source, "word", _text(item.get("type"), "MANAGED_WORD"), item)
        if summary:
            summaries.append(summary)

    sensitive_policy = _mapping(assessment.get("sensitiveInformationPolicy"))
    for item in _items(sensitive_policy.get("piiEntities")):
        summary = _assessment(
            source,
            "sensitive-information",
            _text(item.get("type"), "PII"),
            item,
        )
        if summary:
            summaries.append(summary)
    for item in _items(sensitive_policy.get("regexes")):
        summary = _assessment(
            source,
            "sensitive-information",
            _text(item.get("name"), "REGEX"),
            item,
        )
        if summary:
            summaries.append(summary)

    grounding_policy = _mapping(assessment.get("contextualGroundingPolicy"))
    for item in _items(grounding_policy.get("filters")):
        summary = _assessment(
            source,
            "contextual-grounding",
            _text(item.get("type"), "GROUNDING"),
            item,
        )
        if summary:
            summaries.append(summary)

    reasoning_policy = _mapping(assessment.get("automatedReasoningPolicy"))
    for finding in _items(reasoning_policy.get("findings")):
        for finding_type in (
            "invalid",
            "satisfiable",
            "impossible",
            "translationAmbiguous",
            "tooComplex",
            "noTranslations",
        ):
            if finding_type in finding:
                summaries.append({
                    "source": source,
                    "policy": "automated-reasoning",
                    "name": finding_type,
                    "action": "DETECTED",
                    "detected": True,
                })
                break

    return summaries


def _applied_guardrail(
    assessment: dict[str, Any],
    fallback_id: str,
    fallback_version: str,
) -> AppliedGuardrailSummary | None:
    details = _mapping(assessment.get("appliedGuardrailDetails"))
    guardrail_id = _text(details.get("guardrailId"), fallback_id)
    version = _text(details.get("guardrailVersion"), fallback_version)
    if not guardrail_id or not version:
        return None
    return {"id": guardrail_id, "version": version}


def summarize_guardrail_trace(
    response_metadata: dict[str, Any],
    guardrail_id: str = "",
    guardrail_version: str = "",
) -> GuardrailTraceSummary | None:
    """Return only non-sensitive assessment fields from a Converse trace."""
    trace = _mapping(response_metadata.get("trace"))
    guardrail_trace = _mapping(trace.get("guardrail"))
    if not guardrail_trace:
        return None

    assessments: list[GuardrailAssessmentSummary] = []
    guardrails: list[AppliedGuardrailSummary] = []

    input_assessments = _mapping(guardrail_trace.get("inputAssessment"))
    for guardrail_id, raw_assessment in input_assessments.items():
        assessment = _mapping(raw_assessment)
        assessments.extend(_assessment_details("input", assessment))
        applied = _applied_guardrail(assessment, guardrail_id, guardrail_version)
        if applied:
            guardrails.append(applied)

    output_assessments = _mapping(guardrail_trace.get("outputAssessments"))
    for guardrail_id, raw_assessments in output_assessments.items():
        for raw_assessment in _items(raw_assessments):
            assessments.extend(_assessment_details("output", raw_assessment))
            applied = _applied_guardrail(raw_assessment, guardrail_id, guardrail_version)
            if applied:
                guardrails.append(applied)

    if not assessments:
        return None
    actions = {item["action"] for item in assessments}
    result: GuardrailTraceResult = (
        "BLOCKED" if "BLOCKED" in actions
        else "ANONYMIZED" if "ANONYMIZED" in actions
        else "DETECTED"
    )
    return merge_guardrail_traces(
        [{"result": result, "guardrails": guardrails, "assessments": assessments}],
    )


def merge_guardrail_traces(
    traces: Iterable[GuardrailTraceSummary],
    *,
    intervened: bool = False,
) -> GuardrailTraceSummary | None:
    """Merge traces from multiple model calls in one agent turn."""
    guardrails: list[AppliedGuardrailSummary] = []
    assessments: list[GuardrailAssessmentSummary] = []
    results: set[GuardrailTraceResult] = set()
    seen_guardrails: set[tuple[str, str]] = set()
    seen_assessments: set[tuple[tuple[str, str], ...]] = set()

    for trace in traces:
        results.add(trace["result"])
        for guardrail in trace["guardrails"]:
            guardrail_key = (guardrail["id"], guardrail["version"])
            if guardrail_key not in seen_guardrails:
                seen_guardrails.add(guardrail_key)
                guardrails.append(guardrail)
        for assessment in trace["assessments"]:
            assessment_key = tuple(sorted((name, str(value)) for name, value in assessment.items()))
            if assessment_key not in seen_assessments:
                seen_assessments.add(assessment_key)
                assessments.append(assessment)

    if not assessments and not intervened:
        return None
    result: GuardrailTraceResult = (
        "BLOCKED" if intervened or "BLOCKED" in results
        else "ANONYMIZED" if "ANONYMIZED" in results
        else "DETECTED"
    )
    return {"result": result, "guardrails": guardrails, "assessments": assessments}
