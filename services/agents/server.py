import os
from pathlib import Path

from dotenv import load_dotenv

# Load project .env.local (Next.js reads this; Python does not unless we load it).
load_dotenv(Path(__file__).resolve().parents[2] / ".env.local")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# TODO: VERIFY FROM HACKATHON TEMPLATE
from ag_ui_adk import ADKAgent, add_adk_fastapi_endpoint

from lesson_director import lesson_director

if os.getenv("GEMINI_API_KEY") and not os.getenv("GOOGLE_API_KEY"):
    os.environ["GOOGLE_API_KEY"] = os.environ["GEMINI_API_KEY"]

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

add_adk_fastapi_endpoint(app, adk_lesson_director, path="/copilotkit")
