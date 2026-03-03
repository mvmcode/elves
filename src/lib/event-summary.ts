/* Event summary utilities — shared helpers for rendering session events in history and comparison views. */

/** Mapping from event type string to display color (hex). Used for type badges. */
export const EVENT_TYPE_COLOR: Record<string, string> = {
  thinking: "#4D96FF",
  tool_use: "#FF8B3D",
  tool_call: "#FF8B3D",
  tool_result: "#6BCB77",
  output: "#FFD93D",
  result: "#FFD93D",
  error: "#FF6B6B",
  spawn: "#E0C3FC",
  task_update: "#B8E6D0",
};

/**
 * Extracts a human-readable summary from a raw event payload JSON string.
 * Returns a truncated plain-text string suitable for single-line display.
 * Falls back gracefully on parse errors or unknown event types.
 */
export function summarizeEventPayload(eventType: string, payloadStr: string): string {
  try {
    const payload = JSON.parse(payloadStr) as Record<string, unknown>;
    switch (eventType) {
      case "thinking":
        return typeof payload.text === "string" ? payload.text.slice(0, 150) : "Thinking...";
      case "tool_use":
      case "tool_call": {
        const tool = (payload.tool ?? payload.name ?? "unknown") as string;
        return `${tool}(...)`;
      }
      case "tool_result": {
        const output = (payload.output ?? payload.result ?? "") as string;
        return typeof output === "string"
          ? output.slice(0, 150)
          : JSON.stringify(output).slice(0, 150);
      }
      case "output":
      case "result":
        return typeof payload.text === "string"
          ? payload.text.slice(0, 150)
          : typeof payload.result === "string"
            ? (payload.result as string).slice(0, 150)
            : JSON.stringify(payload).slice(0, 150);
      case "error":
        return typeof payload.message === "string"
          ? payload.message
          : JSON.stringify(payload).slice(0, 150);
      default:
        return JSON.stringify(payload).slice(0, 150);
    }
  } catch {
    return payloadStr.slice(0, 150);
  }
}
