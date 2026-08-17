"""Validated AgentCore invocation payloads."""

from pydantic import BaseModel, ConfigDict, Field, model_validator


class GenerationConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    temperature: float = Field(ge=0, le=1)
    topP: float | None = Field(default=None, ge=0, le=1)
    maxOutputTokens: int = Field(ge=1, le=4_096)


class ChatInvocation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    requestId: str = Field(min_length=36, max_length=36)
    actorId: str = Field(pattern=r"^[a-f0-9]{64}$")
    conversationSessionId: str = Field(min_length=36, max_length=36)
    runtimeSessionId: str = Field(pattern=r"^[a-f0-9]{64}$")
    modelId: str = Field(min_length=3, max_length=256)
    modelKey: str = Field(min_length=1, max_length=64)
    message: str = Field(min_length=1, max_length=8_000)
    adminSystemPrompt: str = Field(max_length=8_000)
    userSystemPrompt: str = Field(max_length=4_000)
    generationConfig: GenerationConfig
    guardrailId: str = Field(default="", max_length=64)
    guardrailVersion: str = Field(default="", max_length=16)
    webSearchEnabled: bool = False
    ragEnabled: bool = False

    @model_validator(mode="after")
    def validate_guardrail_pair(self) -> "ChatInvocation":
        if bool(self.guardrailId) != bool(self.guardrailVersion):
            raise ValueError("guardrailId and guardrailVersion must be supplied together")
        return self
