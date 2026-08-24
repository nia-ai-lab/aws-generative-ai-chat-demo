from dataclasses import dataclass

import jwt
import pytest

import access_control


@dataclass
class FakeContext:
    request_headers: dict[str, str] | None


class FakeTable:
    def __init__(self, enabled: bool | None) -> None:
        self.enabled = enabled

    def get_item(self, **_: object) -> dict[str, object]:
        if self.enabled is None:
            return {}
        return {"Item": {"participantAccessEnabled": self.enabled}}


def authorization_header(groups: list[str]) -> str:
    token = jwt.encode({"cognito:groups": groups}, "test-only-key-with-at-least-32-bytes", algorithm="HS256")
    return f"Bearer {token}"


def test_participant_is_rejected_when_access_is_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(access_control, "_table", FakeTable(False))
    context = FakeContext({"Authorization": authorization_header(["Students"])})

    with pytest.raises(access_control.ParticipantAccessDisabledError):
        access_control.require_participant_access(context)


def test_administrator_is_allowed_when_access_is_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(access_control, "_table", FakeTable(False))
    context = FakeContext({"Authorization": authorization_header(["Admins"])})

    access_control.require_participant_access(context)


def test_missing_setting_keeps_existing_deployments_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(access_control, "_table", FakeTable(None))
    context = FakeContext({"Authorization": authorization_header(["Students"])})

    access_control.require_participant_access(context)
