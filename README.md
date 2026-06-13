# Duobingo

A language learning app that drops you into AI-generated 3D worlds and lets you practice with a real-time voice tutor — built on Google Gemini, CopilotKit, and Gaussian splatting.

Live instance: https://duobingo-genui-hack.onrender.com/

<!-- screenshot: main menu / lesson path -->

---

## How it works

**1. Choose a lesson**
Pick a topic (café, kitchen, etc.) from the path map. Before the lesson starts, you choose the real place you want to navigate to by searching for one that matches — your actual favourite café, for example. Only after you choose it do we generate the 3D world from that place.

<!-- screenshot: lesson selection + memory place search modal -->

**2. Do the lesson**
An AI agent (Google ADK + CopilotKit) plans a personalised 8-exercise session based on your word history. Exercises include multiple choice, word bank, listening, and speaking.

<!-- screenshot: exercise screen -->

**3. Enter the world**
After the lesson, a portal transition drops you into a Gaussian splat 3D scene — either the generic world for that topic, or your personal memory place if you chose one. Navigate with WASD + mouse.

<!-- screenshot: 3D world / Gaussian splat scene -->

**4. Practice with a voice tutor**
Gemini Live watches the scene in real time through frame capture and talks to you. It surfaces vocabulary cards, runs a scavenger hunt for words you missed, and updates your spaced-repetition scores as you go.

<!-- screenshot: Gemini Live voice tutor + word card overlay -->

---

## Tech stack

| Layer | Tools |
|---|---|
| Framework | Next.js 15 (App Router) |
| AI lesson planner | Google ADK agent + CopilotKit / AG-UI (Python FastAPI) |
| Voice tutor | Gemini Live (WebSocket, multimodal) |
| 3D rendering | Three.js + Spark.js (Gaussian splatting) |
| Memory places | Google Places API · Gemini Vision (photo ranking) · Marble API (pano + world gen) |
| Example sentences | LinkUp AI (live web-sourced) |
| Progress / SRS | Redis + custom spaced-repetition logic |
| State | Zustand |
| Animation | Framer Motion |

---

## Getting started

### Prerequisites

- Node.js 20+
- Python 3.11+
- Redis (or use the included Docker Compose)
- API keys: `GEMINI_API_KEY`, `GOOGLE_PLACES_API_KEY`, `LINKUP_API_KEY`, `MARBLE_API_KEY`

### Install

```bash
# Frontend
npm install

# Python agent
cd services/agents
pip install -r requirements.txt
```

### Run

```bash
# Start Redis
docker compose up -d

# Seed learner data
npm run seed

# Start the lesson agent (port 8000)
cd services/agents && python server.py

# Start the Next.js app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project structure

```
src/
  app/
    page.tsx              # Home — lesson path map
    lesson/[unitId]/      # AI-planned exercises
    world/[worldId]/      # Generic 3D world + Gemini Live
    memory/[placeId]/     # Personalised memory place world
    api/                  # Route handlers (CopilotKit, Gemini, Places, Redis…)
  components/
    PathMap.tsx           # Lesson selection UI
    MemoryPlaceSearch.tsx # Real-place search modal
    SplatScene.tsx        # Gaussian splat viewer
    GeminiLiveController  # Voice tutor client
    exercises/            # MultipleChoice, WordBank, Listening, SpeakIt
  lib/
    srs.ts                # Spaced repetition logic
    gemini-live.ts        # Gemini Live WebSocket client
services/agents/
  lesson_director.py      # Google ADK lesson planning agent
data/courses/fr.json      # French course content
```

---

## License

MIT
