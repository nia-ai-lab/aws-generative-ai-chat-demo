"""AgentCore Runtime entrypoint."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from typing import Any

from bedrock_agentcore import BedrockAgentCoreApp
from pydantic import ValidationError

from graph import stream_chat
from schemas import ChatInvocation

app = BedrockAgentCoreApp()
logger = logging.getLogger(__name__)


@app.entrypoint
async def invoke(payload: dict[str, Any]) -> AsyncIterator[dict[str, Any]]:
    try:
        invocation = ChatInvocation.model_validate(payload)
    except ValidationError:
        logger.warning("Rejected invalid invocation payload")
        yield {"type": "error", "code": "VALIDATION_ERROR", "message": "Invalid request."}
        return

    logger.info(
        "Agent invocation started requestId=%s modelKey=%s conversationSessionId=%s runtimeSessionId=%s",
        invocation.requestId,
        invocation.modelKey,
        invocation.conversationSessionId,
        invocation.runtimeSessionId,
    )
    try:
        async for event in stream_chat(invocation):
            yield event
    except Exception as error:
        logger.exception("Agent invocation failed errorType=%s", type(error).__name__)
        yield {"type": "error", "code": "AGENT_UNAVAILABLE", "message": "Agent unavailable."}


if __name__ == "__main__":
    app.run()
