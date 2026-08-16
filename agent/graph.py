"""LangGraph chat graph backed by AgentCore short-term memory."""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

from langchain_aws import ChatBedrockConverse
from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.runtime import Runtime
from langgraph_checkpoint_aws import AgentCoreMemorySaver

from prompts import compose_system_prompt
from schemas import ChatInvocation

REGION = os.getenv("AWS_REGION", "ap-northeast-1")
MEMORY_ID = os.getenv("MEMORY_ID", "")
GUARDRAIL_ID = os.getenv("GUARDRAIL_ID", "")
GUARDRAIL_VERSION = os.getenv("GUARDRAIL_VERSION", "DRAFT")


@lru_cache(maxsize=8)
def model_for(model_id: str) -> ChatBedrockConverse:
    guardrails: dict[str, Any] | None = None
    if GUARDRAIL_ID:
        guardrails = {
            "guardrailIdentifier": GUARDRAIL_ID,
            "guardrailVersion": GUARDRAIL_VERSION,
            "trace": "enabled",
        }
    return ChatBedrockConverse(
        model=model_id,
        region_name=REGION,
        temperature=0.3,
        max_tokens=1_024,
        max_retries=2,
        timeout=70,
        guardrails=guardrails,
    )


@dataclass(frozen=True)
class ChatContext:
    model_id: str
    admin_system_prompt: str
    user_system_prompt: str


async def call_model(
    state: MessagesState,
    runtime: Runtime[ChatContext],
) -> dict[str, list[AIMessage]]:
    context = runtime.context
    system_prompt = compose_system_prompt(
        context.admin_system_prompt,
        context.user_system_prompt,
    )
    response = await model_for(context.model_id).ainvoke([SystemMessage(system_prompt), *state["messages"]])
    return {"messages": [response]}


def build_graph() -> Any:
    builder = StateGraph(MessagesState, context_schema=ChatContext)
    builder.add_node("model", call_model)
    builder.add_edge(START, "model")
    builder.add_edge("model", END)
    checkpointer = (
        AgentCoreMemorySaver(MEMORY_ID, region_name=REGION)
        if MEMORY_ID
        else InMemorySaver()
    )
    return builder.compile(checkpointer=checkpointer)


GRAPH = build_graph()


def text_from_chunk(chunk: AIMessageChunk) -> str:
    if isinstance(chunk.content, str):
        return chunk.content
    parts: list[str] = []
    for item in chunk.content:
        if isinstance(item, str):
            parts.append(item)
        elif isinstance(item, dict) and item.get("type") == "text":
            parts.append(str(item.get("text", "")))
    return "".join(parts)


async def stream_chat(invocation: ChatInvocation) -> AsyncIterator[dict[str, Any]]:
    config: RunnableConfig = {
        "configurable": {
            "actor_id": invocation.actorId,
            "thread_id": invocation.conversationSessionId,
        }
    }
    context = ChatContext(
        model_id=invocation.modelId,
        admin_system_prompt=invocation.adminSystemPrompt,
        user_system_prompt=invocation.userSystemPrompt,
    )
    final_metadata: dict[str, Any] = {}
    async for chunk, _metadata in GRAPH.astream(
        {"messages": [HumanMessage(invocation.message)]},
        config=config,
        context=context,
        stream_mode="messages",
    ):
        if not isinstance(chunk, AIMessageChunk):
            continue
        text = text_from_chunk(chunk)
        if text:
            yield {"type": "delta", "text": text}
        if chunk.usage_metadata:
            final_metadata = {
                "inputTokens": chunk.usage_metadata.get("input_tokens"),
                "outputTokens": chunk.usage_metadata.get("output_tokens"),
            }
    yield {"type": "done", "finishReason": "end_turn", "usage": final_metadata}
