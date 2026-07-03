from __future__ import annotations

import argparse
import json
import random
from typing import Any, AsyncIterator, Literal

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

try:
    import autogen  # type: ignore  # noqa: F401

    AG2_AVAILABLE = True
except Exception:
    AG2_AVAILABLE = False


class CustomHeader(BaseModel):
    header: str
    value: str


class RuntimeModel(BaseModel):
    provider: str
    model: str
    base_url: str = Field(alias="baseUrl")
    api_key: str | None = Field(default=None, alias="apiKey")
    api_type: Literal["openai", "anthropic"] = Field(default="openai", alias="apiType")
    custom_headers: list[CustomHeader] = Field(default_factory=list, alias="customHeaders")

    model_config = {"populate_by_name": True}


class Agent(BaseModel):
    id: str
    name: str
    avatar: str | None = None
    model_id: str | None = Field(default=None, alias="modelId")
    provider: str | None = None
    system_prompt: str = Field(default="", alias="systemPrompt")
    tool_permission: str | None = Field(default=None, alias="toolPermission")
    description: str = ""
    runtime_model: RuntimeModel | None = Field(default=None, alias="runtimeModel")

    model_config = {"populate_by_name": True}


class Team(BaseModel):
    id: str
    name: str
    description: str = ""
    member_ids: list[str] = Field(default_factory=list, alias="memberIds")
    speaker_order: str = Field(default="round_robin", alias="speakerOrder")
    max_rounds: int = Field(default=1, alias="maxRounds")
    summarizer_agent_id: str | None = Field(default=None, alias="summarizerAgentId")
    allow_mentions: bool = Field(default=True, alias="allowMentions")

    model_config = {"populate_by_name": True}


class Mention(BaseModel):
    agent_id: str = Field(alias="agentId")
    label: str

    model_config = {"populate_by_name": True}


class HistoryMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str
    agent_id: str | None = Field(default=None, alias="agentId")

    model_config = {"populate_by_name": True}


class RunRequest(BaseModel):
    thread_id: str = Field(alias="threadId")
    prompt: str
    team: Team
    agents: list[Agent]
    mention: Mention | None = None
    history: list[HistoryMessage] = Field(default_factory=list)
    runtime_model: RuntimeModel | None = Field(default=None, alias="runtimeModel")

    model_config = {"populate_by_name": True}


app = FastAPI(title="Jan Agent Team Runtime", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, Any]:
    return {"ok": True, "runtime": "jan-agent-team", "ag2Available": AG2_AVAILABLE}


@app.post("/v1/agent-team/runs")
async def run_agent_team(request: RunRequest) -> StreamingResponse:
    return StreamingResponse(
        stream_run(request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def stream_run(request: RunRequest) -> AsyncIterator[str]:
    try:
        async for event in orchestrate_team(request):
            yield sse(event)
        yield "data: [DONE]\n\n"
    except Exception as exc:
        yield sse({"type": "error", "message": safe_error(exc)})
        yield "data: [DONE]\n\n"


async def orchestrate_team(request: RunRequest) -> AsyncIterator[dict[str, Any]]:
    agents_by_id = {agent.id: agent for agent in request.agents}
    members = [agents_by_id[agent_id] for agent_id in request.team.member_ids if agent_id in agents_by_id]
    if not members:
        members = request.agents
    if not members:
        yield {"type": "error", "message": "Agent team 没有可用成员。"}
        return

    if request.mention:
        agent = agents_by_id.get(request.mention.agent_id)
        if not agent:
            yield {"type": "error", "message": "点名的 Agent 不存在。"}
            return
        async for chunk in stream_agent_answer(agent, request, []):
            yield {"type": "agent_message", "agentId": agent.id, "content": chunk}
        yield {"type": "agent_message", "agentId": agent.id, "content": "", "done": True}
        return

    summarizer = agents_by_id.get(request.team.summarizer_agent_id or "")
    speakers = [agent for agent in members if agent.id != (summarizer.id if summarizer else None)]
    if not speakers:
        speakers = members

    transcript: list[tuple[str, str]] = []
    max_rounds = max(1, min(request.team.max_rounds or 1, 20))
    for _ in range(max_rounds):
        for agent in ordered_speakers(speakers, request.team.speaker_order):
            chunks: list[str] = []
            async for chunk in stream_agent_answer(agent, request, transcript):
                chunks.append(chunk)
                yield {"type": "agent_message", "agentId": agent.id, "content": chunk}
            transcript.append((agent.name, "".join(chunks).strip()))
            yield {"type": "agent_message", "agentId": agent.id, "content": "", "done": True}

    if summarizer:
        chunks = []
        async for chunk in stream_summary(summarizer, request, transcript):
            chunks.append(chunk)
            yield {"type": "summary", "agentId": summarizer.id, "content": chunk}
        yield {"type": "summary", "agentId": summarizer.id, "content": "", "done": True}


def ordered_speakers(agents: list[Agent], speaker_order: str) -> list[Agent]:
    if speaker_order == "random":
        shuffled = agents[:]
        random.shuffle(shuffled)
        return shuffled
    return agents


async def stream_agent_answer(
    agent: Agent,
    request: RunRequest,
    transcript: list[tuple[str, str]],
) -> AsyncIterator[str]:
    model = resolve_runtime_model(agent, request)
    messages = build_agent_messages(agent, request, transcript)
    async for chunk in stream_model(model, messages):
        yield chunk


async def stream_summary(
    agent: Agent,
    request: RunRequest,
    transcript: list[tuple[str, str]],
) -> AsyncIterator[str]:
    model = resolve_runtime_model(agent, request)
    transcript_text = format_transcript(transcript) or "暂无团队发言。"
    messages = history_messages(request.history)
    system = agent.system_prompt or "你是总结员。请给出最终结论、各 Agent 观点、执行过程和下一步建议。"
    messages.insert(0, {"role": "system", "content": system})
    messages.append(
        {
            "role": "user",
            "content": (
                f"用户问题：\n{request.prompt}\n\n"
                f"团队讨论记录：\n{transcript_text}\n\n"
                "请用简体中文输出最终结论、各 Agent 观点、执行过程和下一步建议。"
            ),
        }
    )
    async for chunk in stream_model(model, messages):
        yield chunk


def resolve_runtime_model(agent: Agent, request: RunRequest) -> RuntimeModel:
    model = agent.runtime_model or request.runtime_model
    if not model:
        raise ValueError("缺少云模型配置，请先在 Jan 里选择并配置一个可用的云端模型。")
    if not model.base_url:
        raise ValueError("缺少 API Base URL，请检查 Jan 的模型服务商配置。")
    if not model.model:
        raise ValueError("缺少模型名称，请检查 Jan 的模型选择。")
    return model


def build_agent_messages(
    agent: Agent,
    request: RunRequest,
    transcript: list[tuple[str, str]],
) -> list[dict[str, str]]:
    system = agent.system_prompt or f"你是 {agent.name}。{agent.description}".strip()
    if request.team.description:
        system = f"{system}\n\n团队背景：{request.team.description}"
    if agent.description:
        system = f"{system}\n\n你的职责：{agent.description}"

    messages = history_messages(request.history)
    messages.insert(0, {"role": "system", "content": system})
    transcript_text = format_transcript(transcript)
    prompt = f"用户问题：\n{request.prompt}"
    if transcript_text:
        prompt += f"\n\n目前团队讨论记录：\n{transcript_text}\n\n请基于你的角色继续发言，避免重复前面观点。"
    messages.append({"role": "user", "content": prompt})
    return messages


def history_messages(history: list[HistoryMessage]) -> list[dict[str, str]]:
    recent = history[-20:]
    return [{"role": item.role, "content": item.content} for item in recent if item.content.strip()]


def format_transcript(transcript: list[tuple[str, str]]) -> str:
    return "\n\n".join(f"{name}：\n{content}" for name, content in transcript if content)


async def stream_model(model: RuntimeModel, messages: list[dict[str, str]]) -> AsyncIterator[str]:
    if model.api_type == "anthropic":
        async for chunk in stream_anthropic(model, messages):
            yield chunk
        return
    async for chunk in stream_openai_compatible(model, messages):
        yield chunk


async def stream_openai_compatible(
    model: RuntimeModel,
    messages: list[dict[str, str]],
) -> AsyncIterator[str]:
    url = chat_completions_url(model.base_url)
    headers = request_headers(model, bearer=True)
    payload = {"model": model.model, "messages": messages, "stream": True}
    emitted = False
    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=30.0)) as client:
        async with client.stream("POST", url, headers=headers, json=payload) as response:
            if response.status_code >= 400:
                raise RuntimeError(await response_error(response))
            async for line in response.aiter_lines():
                data = sse_data(line)
                if not data:
                    continue
                if data == "[DONE]":
                    break
                try:
                    parsed = json.loads(data)
                except json.JSONDecodeError:
                    continue
                chunk = (
                    parsed.get("choices", [{}])[0]
                    .get("delta", {})
                    .get("content")
                    or parsed.get("choices", [{}])[0]
                    .get("message", {})
                    .get("content")
                )
                if chunk:
                    emitted = True
                    yield str(chunk)
    if not emitted:
        async for chunk in complete_openai_compatible(model, messages):
            yield chunk


async def complete_openai_compatible(
    model: RuntimeModel,
    messages: list[dict[str, str]],
) -> AsyncIterator[str]:
    url = chat_completions_url(model.base_url)
    headers = request_headers(model, bearer=True)
    payload = {"model": model.model, "messages": messages, "stream": False}
    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=30.0)) as client:
        response = await client.post(url, headers=headers, json=payload)
        if response.status_code >= 400:
            raise RuntimeError(await response_error(response))
        parsed = response.json()
        content = parsed.get("choices", [{}])[0].get("message", {}).get("content")
        if content:
            yield str(content)


async def stream_anthropic(
    model: RuntimeModel,
    messages: list[dict[str, str]],
) -> AsyncIterator[str]:
    url = anthropic_messages_url(model.base_url)
    system = "\n\n".join(item["content"] for item in messages if item["role"] == "system")
    body_messages = [item for item in messages if item["role"] != "system"]
    headers = request_headers(model, bearer=False)
    headers.setdefault("anthropic-version", "2023-06-01")
    payload: dict[str, Any] = {
        "model": model.model,
        "messages": body_messages,
        "max_tokens": 4096,
        "stream": True,
    }
    if system:
        payload["system"] = system

    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=30.0)) as client:
        async with client.stream("POST", url, headers=headers, json=payload) as response:
            if response.status_code >= 400:
                raise RuntimeError(await response_error(response))
            async for line in response.aiter_lines():
                data = sse_data(line)
                if not data:
                    continue
                try:
                    parsed = json.loads(data)
                except json.JSONDecodeError:
                    continue
                delta = parsed.get("delta", {})
                text = delta.get("text")
                if text:
                    yield str(text)


def request_headers(model: RuntimeModel, bearer: bool) -> dict[str, str]:
    headers = {"content-type": "application/json"}
    if model.api_key:
        if bearer:
            headers["authorization"] = f"Bearer {model.api_key}"
        else:
            headers["x-api-key"] = model.api_key
    for item in model.custom_headers:
        if item.header and item.value:
            headers[item.header] = item.value
    return headers


def chat_completions_url(base_url: str) -> str:
    base = base_url.rstrip("/")
    if base.endswith("/chat/completions"):
        return base
    return f"{base}/chat/completions"


def anthropic_messages_url(base_url: str) -> str:
    base = base_url.rstrip("/")
    if base.endswith("/messages"):
        return base
    return f"{base}/messages"


def sse_data(line: str) -> str | None:
    line = line.strip()
    if not line:
        return None
    if line.startswith("data:"):
        return line[5:].strip()
    return line


async def response_error(response: httpx.Response) -> str:
    body = await response.aread()
    detail = body.decode("utf-8", errors="ignore")[:500]
    return f"模型服务请求失败：HTTP {response.status_code} {detail}"


def sse(event: dict[str, Any]) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


def safe_error(exc: Exception) -> str:
    message = str(exc) or exc.__class__.__name__
    return message.replace("\n", " ").strip()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8765, type=int)
    args = parser.parse_args()

    import uvicorn

    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
