const WS_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

const MODEL = "models/gemini-2.5-flash-native-audio-preview-12-2025";

async function main() {
  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set");
    process.exit(1);
  }

  const ws = new WebSocket(`${WS_URL}?key=${apiKey}`);

  ws.addEventListener("open", () => {
    console.log("open");
    ws.send(
      JSON.stringify({
        setup: {
          model: MODEL,
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: "Aoede" },
              },
            },
          },
          systemInstruction: {
            parts: [{ text: "You are a helpful assistant." }],
          },
        },
      })
    );
    console.log("setup sent");
  });

  ws.addEventListener("message", (event) => {
    console.log("message:", String(event.data).slice(0, 500));
  });

  ws.addEventListener("error", () => console.log("error"));
  ws.addEventListener("close", (e) =>
    console.log("close", e.code, e.reason?.slice(0, 200))
  );

  await new Promise((r) => setTimeout(r, 15_000));
  ws.close();
}

main();
