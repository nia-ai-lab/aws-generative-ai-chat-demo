"""Validated AgentCore invocation payloads."""

from pydantic import BaseModel, ConfigDict, Field


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
