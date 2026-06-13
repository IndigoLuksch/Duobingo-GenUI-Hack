import os
from pathlib import Path

from dotenv import load_dotenv

# Load project .env.local (Next.js reads this; Python does not unless we load it).
load_dotenv(Path(__file__).resolve().parents[2] / ".env.local")

# Prefer GEMINI_API_KEY before any Google ADK imports read the environment.
if os.getenv("GEMINI_API_KEY"):
    os.environ["GOOGLE_API_KEY"] = os.environ["GEMINI_API_KEY"]

import json

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.types import ASGIApp, Receive, Scope, Send

from ag_ui_adk import ADKAgent, add_adk_fastapi_endpoint

from lesson_director import lesson_director


class PatchMissingStateMiddleware:
    """Inject a default ``state`` field when the CopilotKit runtime omits it.

    @ag-ui/client 0.0.57 (bundled with CopilotKit 1.x) does not always send
    ``state`` in the AG-UI run payload, but ag-ui-protocol >=0.1 requires it.
    """

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http" or scope.get("method") != "POST":
            return await self.app(scope, receive, send)

        path = scope.get("path", "")
        if not path.rstrip("/").endswith("/copilotkit"):
            return await self.app(scope, receive, send)

        chunks: list[bytes] = []
        body_patched = False

        async def patched_receive():
            nonlocal body_patched
            if body_patched:
                return await receive()
            msg = await receive()
            if msg["type"] == "http.request":
                chunks.append(msg.get("body", b""))
                if not msg.get("more_body", False):
                    body_patched = True
                    raw = b"".join(chunks)
                    try:
                        data = json.loads(raw)
                        if isinstance(data, dict) and "state" not in data:
                            data["state"] = {}
                            raw = json.dumps(data).encode()
                    except (json.JSONDecodeError, TypeError):
                        pass
                    return {"type": "http.request", "body": raw, "more_body": False}
            return msg

        await self.app(scope, patched_receive, send)

adk_lesson_director = ADKAgent(
    adk_agent=lesson_director,
    app_name="loci_lingua",
    user_id="demo",
    session_timeout_seconds=3600,
    use_in_memory_services=True,
)

app = FastAPI(title="Loci Lingua Lesson Director")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(PatchMissingStateMiddleware)

add_adk_fastapi_endpoint(app, adk_lesson_director, path="/copilotkit")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
