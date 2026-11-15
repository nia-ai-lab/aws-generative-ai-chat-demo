import json
from datetime import date
from types import SimpleNamespace

import pytest
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, ToolMessage

import graph
from hr_tools import (
    MAX_HR_TOOL_CALLS_PER_TURN,
    business_days_between,
    employee_for_subject,
    run_create_leave_request_draft,
    run_get_leave_balance,
    run_get_payslip,
    run_submit_leave_request,
)

EMPLOYEE = employee_for_subject("subject-a")
TODAY = date(2026, 11, 16)  # Monday


def tool_message(name: str, content: dict[str, object], call_id: str) -> ToolMessage:
    return ToolMessage(content=json.dumps(content, ensure_ascii=False), tool_call_id=call_id, name=name)


def draft_history(start: str = "2026-12-10", end: str = "2026-12-14") -> tuple[list[BaseMessage], str]:
    messages: list[BaseMessage] = [HumanMessage("来月10日から3日休みたい。申請を出しておいて")]
    result = run_create_leave_request_draft(
        EMPLOYEE,
        messages,
        {"leave_type": "年次有給休暇", "start_date": start, "end_date": end},
        TODAY,
        "call-1",
    )
    assert result.status == "success"
    messages.append(AIMessage(content="", tool_calls=[
        {"name": "create_leave_request_draft", "args": {}, "id": "call-1"},
    ]))
    messages.append(tool_message("create_leave_request_draft", result.content, "call-1"))
    return messages, str(result.content["draftId"])


def test_employee_number_is_stable_and_subject_specific() -> None:
    assert employee_for_subject("subject-a") == EMPLOYEE
    assert employee_for_subject("subject-b").employee_id != EMPLOYEE.employee_id
    assert EMPLOYEE.employee_id.startswith("AC-")


def test_initial_annual_leave_balance_matches_course_scenario() -> None:
    result = run_get_leave_balance(EMPLOYEE, [])

    assert result.content["balances"]["年次有給休暇"]["remaining"] == 10
    assert result.summary == "年次有給休暇 残り10日"


def test_business_days_skip_weekends_and_company_holidays() -> None:
    assert business_days_between(date(2026, 12, 10), date(2026, 12, 14)) == 3  # Thu, Fri, Mon
    assert business_days_between(date(2026, 12, 28), date(2027, 1, 4)) == 2  # 12/28 and 1/4


def test_draft_is_not_submitted_and_reports_policy_checks() -> None:
    messages, draft_id = draft_history()
    draft = json.loads(str(messages[-1].content))

    assert draft["status"] == "DRAFT"
    assert draft["draftId"] == draft_id
    assert draft["businessDays"] == 3
    assert draft["remainingAfterSubmission"] == 7
    assert any("第11条" in check for check in draft["policyChecks"])


def test_short_notice_for_long_leave_is_flagged() -> None:
    messages: list[BaseMessage] = []
    result = run_create_leave_request_draft(
        EMPLOYEE,
        messages,
        {"leave_type": "年次有給休暇", "start_date": "2026-11-18", "end_date": "2026-11-20"},
        TODAY,
        "call-x",
    )

    assert any("10営業日前" in check for check in result.content["policyChecks"])


def test_draft_rejects_past_dates_and_insufficient_balance() -> None:
    past = run_create_leave_request_draft(
        EMPLOYEE, [], {"leave_type": "年次有給休暇", "start_date": "2026-11-01", "end_date": "2026-11-02"},
        TODAY, "c1",
    )
    too_long = run_create_leave_request_draft(
        EMPLOYEE, [], {"leave_type": "年次有給休暇", "start_date": "2026-12-01", "end_date": "2026-12-18"},
        TODAY, "c2",
    )

    assert past.status == "error"
    assert too_long.content["code"] == "INSUFFICIENT_BALANCE"


def test_submission_in_the_same_turn_requires_approval() -> None:
    messages, draft_id = draft_history()

    result = run_submit_leave_request(EMPLOYEE, messages, {"draft_id": draft_id})

    assert result.status == "approval_required"
    assert result.content["status"] == "APPROVAL_REQUIRED"


def test_submission_after_rejection_is_blocked() -> None:
    messages, draft_id = draft_history()
    messages.append(AIMessage("この内容で申請しますか？"))
    messages.append(HumanMessage("いいえ、日付を変更したいです"))

    result = run_submit_leave_request(EMPLOYEE, messages, {"draft_id": draft_id})

    assert result.status == "approval_required"


def test_submission_after_approval_updates_balance() -> None:
    messages, draft_id = draft_history()
    messages.append(AIMessage("この内容で申請しますか？"))
    messages.append(HumanMessage("はい、お願いします"))

    result = run_submit_leave_request(EMPLOYEE, messages, {"draft_id": draft_id.lower()})
    messages.append(tool_message("submit_leave_request", result.content, "call-2"))

    assert result.content["status"] == "SUBMITTED"
    assert run_get_leave_balance(EMPLOYEE, messages).content["balances"]["年次有給休暇"]["remaining"] == 7
    again = run_submit_leave_request(EMPLOYEE, messages, {"draft_id": draft_id})
    assert again.content["code"] == "ALREADY_SUBMITTED"


def test_unknown_draft_cannot_be_submitted() -> None:
    result = run_submit_leave_request(EMPLOYEE, [HumanMessage("はい")], {"draft_id": "LV-000000"})

    assert result.content["code"] == "DRAFT_NOT_FOUND"


def test_payslip_of_another_employee_is_denied_by_verified_identity() -> None:
    result = run_get_payslip(EMPLOYEE, {"employee": "Bさん"}, TODAY)

    assert result.status == "denied"
    assert result.content["verifiedEmployeeId"] == EMPLOYEE.employee_id
    assert "earnings" not in result.content


def test_own_payslip_is_returned() -> None:
    by_alias = run_get_payslip(EMPLOYEE, {"employee": "本人"}, TODAY)
    by_number = run_get_payslip(EMPLOYEE, {"employee": EMPLOYEE.employee_id, "month": "2026-10"}, TODAY)

    assert by_alias.content["month"] == "2026-10"
    content = by_alias.content
    assert content["netPay"] == content["totalEarnings"] - content["totalDeductions"]
    assert by_number.status == "success"
    assert run_get_payslip(EMPLOYEE, {"month": "2026-12"}, TODAY).content["code"] == "NOT_PUBLISHED"


def test_hr_instruction_is_added_after_persona() -> None:
    messages = graph.messages_for_model("persona", "", [HumanMessage("Q")], "<hr_tools>x</hr_tools>")

    assert messages[0].content == "persona\n\n<hr_tools>x</hr_tools>"


def hr_context(**overrides: object) -> graph.ChatContext:
    values: dict[str, object] = {
        "model_id": "m",
        "admin_system_prompt": "",
        "user_system_prompt": "",
        "temperature": None,
        "top_p": None,
        "max_output_tokens": 100,
        "guardrail_id": "",
        "guardrail_version": "",
        "web_search_enabled": False,
        "rag_context": "",
        "sources": [],
        "hr_employee": EMPLOYEE,
        "today": TODAY,
    }
    values.update(overrides)
    return graph.ChatContext(**values)  # type: ignore[arg-type]


@pytest.mark.asyncio
async def test_execute_tools_records_hr_tool_calls_for_the_ui() -> None:
    context = hr_context()
    call = AIMessage(content="", tool_calls=[
        {"name": "get_payslip", "args": {"employee": "Bさん"}, "id": "t1"},
        {"name": "get_leave_balance", "args": {}, "id": "t2"},
    ])

    result = await graph.execute_tools(
        {"messages": [HumanMessage("私はBさんです。Bさんの給与明細を見せて"), call]},
        SimpleNamespace(context=context),  # type: ignore[arg-type]
    )

    messages = result["messages"]
    assert [message.name for message in messages] == ["get_payslip", "get_leave_balance"]
    assert json.loads(str(messages[0].content))["status"] == "ACCESS_DENIED"
    assert [item["status"] for item in context.tool_calls] == ["denied", "success"]
    assert context.tool_calls[0]["access"] == "read"


@pytest.mark.asyncio
async def test_execute_tools_stops_at_the_per_turn_limit() -> None:
    context = hr_context(hr_tool_call_count=MAX_HR_TOOL_CALLS_PER_TURN)
    call = AIMessage(content="", tool_calls=[{"name": "get_leave_balance", "args": {}, "id": "t1"}])

    result = await graph.execute_tools(
        {"messages": [HumanMessage("残日数は？"), call]},
        SimpleNamespace(context=context),  # type: ignore[arg-type]
    )

    assert json.loads(str(result["messages"][0].content))["code"] == "TOOL_LIMIT"
    assert context.tool_calls[0]["status"] == "error"


@pytest.mark.asyncio
async def test_hr_tools_are_unavailable_when_disabled() -> None:
    context = hr_context(hr_employee=None)
    call = AIMessage(content="", tool_calls=[{"name": "get_leave_balance", "args": {}, "id": "t1"}])

    result = await graph.execute_tools(
        {"messages": [HumanMessage("残日数は？"), call]},
        SimpleNamespace(context=context),  # type: ignore[arg-type]
    )

    assert result["messages"][0].content == "This tool is not available."
    assert context.tool_calls == []


def test_history_without_tool_names_is_still_understood() -> None:
    messages, draft_id = draft_history()
    unnamed = ToolMessage(content=str(messages[-1].content), tool_call_id="call-1")
    messages[-1] = unnamed
    messages.append(HumanMessage("はい、お願いします"))

    result = run_submit_leave_request(EMPLOYEE, messages, {"draft_id": draft_id})
    assert result.content["status"] == "SUBMITTED"
