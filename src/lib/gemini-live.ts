const WS_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

export interface GeminiLiveConfig {
  apiKey: string;
  systemInstruction: string;
  tools: unknown[];
  onAudio: (pcmData: ArrayBuffer) => void;
  onText: (text: string) => void;
  onToolCall: (id: string, name: string, args: unknown) => Promise<unknown>;
  onInterrupted: () => void;
  onReady?: () => void;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export class GeminiLiveClient {
  private config: GeminiLiveConfig;
  private ws: WebSocket | null = null;

  constructor(config: GeminiLiveConfig) {
    this.config = config;
  }

  connect(): void {
    this.ws = new WebSocket(`${WS_URL}?key=${this.config.apiKey}`);
    this.ws.onopen = () => this.sendSetup();
    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        void this.handleMessage(msg);
      } catch (e) {
        console.warn("Gemini Live message parse failed:", e);
      }
    };
    this.ws.onerror = (event) => {
      console.error("Gemini Live WebSocket error:", event);
    };
  }

  sendSetup(): void {
    this.send({
      setup: {
        model: "models/gemini-2.5-flash-live-preview",
        generationConfig: {
          responseModalities: ["AUDIO", "TEXT"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Aoede" },
            },
          },
        },
        systemInstruction: {
          parts: [{ text: this.config.systemInstruction }],
        },
        tools: this.config.tools,
      },
    });
  }

  sendFrame(base64Jpeg: string): void {
    this.send({
      realtimeInput: {
        mediaChunks: [{ mimeType: "image/jpeg", data: base64Jpeg }],
      },
    });
  }

  sendAudio(base64Pcm: string): void {
    this.send({
      realtimeInput: {
        mediaChunks: [{ mimeType: "audio/pcm", data: base64Pcm }],
      },
    });
  }

  sendToolResponse(callId: string, response: unknown): void {
    this.send({
      toolResponse: {
        functionResponses: [{ id: callId, response }],
      },
    });
  }

  async handleMessage(msg: Record<string, unknown>): Promise<void> {
    if (msg.setupComplete) {
      console.log("Gemini Live session ready");
      this.config.onReady?.();
      return;
    }

    const serverContent = msg.serverContent as
      | {
          interrupted?: boolean;
          modelTurn?: {
            parts?: Array<{
              text?: string;
              inlineData?: { mimeType?: string; data?: string };
            }>;
          };
        }
      | undefined;

    if (serverContent?.interrupted) {
      this.config.onInterrupted();
    }

    const parts = serverContent?.modelTurn?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData?.mimeType?.startsWith("audio/") && part.inlineData.data) {
        this.config.onAudio(base64ToArrayBuffer(part.inlineData.data));
      }
      if (part.text) {
        this.config.onText(part.text);
      }
    }

    const toolCall = msg.toolCall as
      | { functionCalls?: Array<{ id: string; name: string; args?: unknown }> }
      | undefined;

    if (toolCall?.functionCalls) {
      for (const call of toolCall.functionCalls) {
        try {
          const returnValue = await this.config.onToolCall(
            call.id,
            call.name,
            call.args ?? {}
          );
          this.sendToolResponse(call.id, {
            result: JSON.stringify(returnValue),
          });
        } catch (e) {
          console.warn("Gemini Live tool call failed:", e);
          this.sendToolResponse(call.id, {
            result: JSON.stringify({ error: String(e) }),
          });
        }
      }
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private send(payload: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }
}
