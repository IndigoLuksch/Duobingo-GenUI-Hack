import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env.local");
try {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
} catch {
  // .env.local optional if GEMINI_API_KEY is already in the environment
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY ?? "";
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set (check .env.local or your shell env)");
    process.exit(1);
  }

  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
      apiKey,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Reply with exactly: API key works." }] }],
      }),
    }
  );

  const body = await res.json();

  console.log("status:", res.status);

  if (!res.ok) {
    console.error("error:", JSON.stringify(body, null, 2));
    process.exit(1);
  }

  const text =
    body.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? "")
      .join("") ?? "(no text in response)";

  console.log("response:", text);
}

main();
