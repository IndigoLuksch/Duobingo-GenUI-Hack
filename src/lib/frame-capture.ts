export function startFrameCapture(
  canvas: HTMLCanvasElement,
  onFrame: (base64: string) => void,
  intervalMs: number = 1000
): () => void {
  const id = setInterval(() => {
    try {
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      const base64 = dataUrl.split(",")[1];
      if (base64) onFrame(base64);
    } catch (e) {
      console.warn("Frame capture failed:", e);
    }
  }, intervalMs);
  return () => clearInterval(id);
}
