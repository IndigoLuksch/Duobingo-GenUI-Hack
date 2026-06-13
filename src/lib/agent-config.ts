/** Resolve the lesson agent CopilotKit endpoint (local dev or production). */
export function getLessonAgentUrl(): string {
  if (process.env.LESSON_AGENT_URL) {
    return process.env.LESSON_AGENT_URL;
  }

  const host = process.env.LESSON_AGENT_HOST;
  if (host) {
    const base = host.startsWith("http") ? host : `https://${host}`;
    return `${base.replace(/\/$/, "")}/copilotkit`;
  }

  return "http://localhost:8000/copilotkit";
}

/** Base URL for health checks (no /copilotkit suffix). */
export function getLessonAgentBaseUrl(): string {
  return getLessonAgentUrl().replace(/\/copilotkit\/?$/, "");
}
