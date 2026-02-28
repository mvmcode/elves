/* Session event listener — global subscriber that routes Tauri backend events to the correct floor.
 * Unlike the single-session version, this subscribes once on mount and routes incoming events
 * to floors by matching the event's sessionId to floor state via getFloorBySessionId(). */

import { useEffect, useRef } from "react";
import { useSessionStore } from "@/stores/session";
import { useSettingsStore } from "@/stores/settings";
import { onEvent, extractSessionMemories } from "@/lib/tauri";
import { getStatusMessage } from "@/lib/elf-names";
import type { ElfEventType, ElfStatus } from "@/types/elf";

/** Payload shape for `elf:event` Tauri events emitted by the Rust backend. */
interface ElfEventPayload {
  readonly sessionId: string;
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
  readonly timestamp: number;
}

/** Payload shape for `session:completed` Tauri events emitted when the Claude process exits. */
interface SessionCompletedPayload {
  readonly sessionId: string;
}

/** Payload shape for `session:cancelled` Tauri events emitted when the user stops a task. */
interface SessionCancelledPayload {
  readonly sessionId: string;
}

/** A parsed sub-event extracted from a single Claude stream-json line. */
interface ParsedEvent {
  readonly type: ElfEventType;
  readonly payload: Record<string, unknown>;
}

/**
 * Parse a raw Claude stream-json event into one or more typed ElfEvents.
 *
 * Claude's `--verbose --output-format stream-json` emits structured events:
 * - `assistant` -> message.content[] with text, tool_use, and thinking blocks
 * - `user` -> message.content[] with tool_result blocks
 * - `result` -> final output with cost/token data
 * - `system` -> initialization metadata (skipped)
 *
 * A single `assistant` event may produce multiple parsed events (e.g. text + tool_use).
 */
function parseClaudePayload(
  eventType: string,
  rawPayload: Record<string, unknown>,
): readonly ParsedEvent[] {
  if (eventType === "assistant") {
    const message = rawPayload.message as Record<string, unknown> | undefined;
    if (!message) return [{ type: "output", payload: rawPayload }];

    const contentBlocks = (message.content as Array<Record<string, unknown>>) ?? [];
    const results: ParsedEvent[] = [];

    for (const block of contentBlocks) {
      if (block.type === "tool_use") {
        results.push({
          type: "tool_call",
          payload: { tool: block.name, input: block.input, toolUseId: block.id },
        });
      } else if (block.type === "thinking") {
        const text = String(block.thinking ?? "");
        if (text.trim()) {
          results.push({ type: "thinking", payload: { text } });
        }
      } else if (block.type === "text") {
        const text = String(block.text ?? "");
        if (text.trim()) {
          results.push({ type: "output", payload: { text } });
        }
      }
    }

    return results.length > 0 ? results : [];
  }

  if (eventType === "user") {
    const message = rawPayload.message as Record<string, unknown> | undefined;
    if (!message) return [{ type: "tool_result", payload: rawPayload }];

    const contentBlocks = (message.content as Array<Record<string, unknown>>) ?? [];
    const results: ParsedEvent[] = [];

    for (const block of contentBlocks) {
      if (block.type === "tool_result") {
        const content = String(block.content ?? "").slice(0, 300);
        results.push({
          type: "tool_result",
          payload: { result: content, toolUseId: block.tool_use_id },
        });
      }
    }

    return results.length > 0 ? results : [];
  }

  if (eventType === "result") {
    return [{
      type: "output",
      payload: {
        text: String(rawPayload.result ?? ""),
        isFinal: true,
        cost: rawPayload.cost_usd,
      },
    }];
  }

  /* Skip system init events — they're metadata, not interesting for the feed */
  if (eventType === "system") return [];

  /* Legacy/direct types from older Claude versions or non-JSON lines */
  if (eventType === "tool_use") return [{ type: "tool_call", payload: rawPayload }];
  if (eventType === "tool_result") return [{ type: "tool_result", payload: rawPayload }];
  if (eventType === "thinking") return [{ type: "thinking", payload: rawPayload }];

  /* Default: wrap as output if there's any text content */
  const text = rawPayload.text as string | undefined;
  if (text) return [{ type: "output", payload: { text } }];

  return [{ type: "output", payload: rawPayload }];
}

/** Maps raw Claude event types to elf statuses for real-time card updates. */
function eventTypeToElfStatus(eventType: string): ElfStatus | null {
  switch (eventType) {
    case "assistant":
      return "working";
    case "user":
      return "working";
    case "thinking":
      return "thinking";
    case "tool_use":
    case "tool_result":
      return "working";
    case "output":
    case "result":
      return "working";
    default:
      return null;
  }
}

/**
 * Global event subscriber that routes Tauri backend events to the correct floor.
 *
 * Subscribes once on mount (always active) and for each incoming event:
 * 1. Extracts sessionId from the event payload
 * 2. Looks up the target floor via getFloorBySessionId()
 * 3. Calls floor-scoped store actions (addEventToFloor, endSessionOnFloor, etc.)
 * 4. If the target floor IS the active floor, snapshot sync auto-updates the UI
 *
 * This means events for non-focused running floors accumulate correctly in their
 * floor's state. When the user switches to that floor, events are already there.
 */
export function useSessionEvents(): void {
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const cleanups: Array<() => void> = [];

    /* Listen for individual agent events (stdout lines from Claude) */
    const elfEventPromise = onEvent<ElfEventPayload>("elf:event", (data) => {
      const store = useSessionStore.getState();
      const floorId = store.getFloorBySessionId(data.sessionId);
      if (!floorId) return;

      const floor = store.floors[floorId];
      if (!floor) return;

      /* Determine the elf to attribute this event to */
      const targetElf = floor.elves[0];
      if (!targetElf) return;

      /* Parse the raw Claude event into one or more typed ElfEvents */
      const parsed = parseClaudePayload(data.eventType, data.payload);
      for (const entry of parsed) {
        store.addEventToFloor(floorId, {
          id: `event-${entry.type}-${data.timestamp}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: data.timestamp * 1000,
          elfId: targetElf.id,
          elfName: targetElf.name,
          runtime: targetElf.runtime,
          type: entry.type,
          payload: entry.payload,
          funnyStatus: getStatusMessage(targetElf.name, targetElf.status),
        });
      }

      /* Update elf status based on raw event type */
      const newStatus = eventTypeToElfStatus(data.eventType);
      if (newStatus && targetElf.status !== newStatus) {
        store.updateElfStatusOnFloor(floorId, targetElf.id, newStatus);
      }
    });

    elfEventPromise
      .then((unsub) => cleanups.push(unsub))
      .catch((error: unknown) => console.error("Failed to subscribe to elf:event:", error));

    /* Listen for Claude Code's internal session ID (used for terminal resume) */
    interface ClaudeIdPayload {
      readonly sessionId: string;
      readonly claudeSessionId: string;
    }
    const claudeIdPromise = onEvent<ClaudeIdPayload>("session:claude_id", (data) => {
      const store = useSessionStore.getState();
      const floorId = store.getFloorBySessionId(data.sessionId);
      if (!floorId) return;
      store.setClaudeSessionIdOnFloor(floorId, data.claudeSessionId);
    });

    claudeIdPromise
      .then((unsub) => cleanups.push(unsub))
      .catch((error: unknown) => console.error("Failed to subscribe to session:claude_id:", error));

    /* Listen for interactive mode transition (print process killed, PTY takes over) */
    interface SessionInteractivePayload {
      readonly sessionId: string;
    }
    const interactivePromise = onEvent<SessionInteractivePayload>("session:interactive", (data) => {
      const store = useSessionStore.getState();
      const floorId = store.getFloorBySessionId(data.sessionId);
      if (!floorId) return;

      const floor = store.floors[floorId];
      if (!floor) return;

      store.setInteractiveModeOnFloor(floorId, true);

      const runtime = floor.session?.runtime ?? "claude-code";
      store.addEventToFloor(floorId, {
        id: `event-interactive-${Date.now()}`,
        timestamp: Date.now(),
        elfId: "system",
        elfName: "System",
        runtime,
        type: "task_update",
        payload: { message: "Switched to interactive terminal mode" },
      });

      /* Update lead elf status */
      const leadElf = floor.elves[0];
      if (leadElf) {
        store.updateElfStatusOnFloor(floorId, leadElf.id, "working");
      }
    });

    interactivePromise
      .then((unsub) => cleanups.push(unsub))
      .catch((error: unknown) => console.error("Failed to subscribe to session:interactive:", error));

    /* Listen for session completion (Claude process exited successfully) */
    const sessionCompletePromise = onEvent<SessionCompletedPayload>("session:completed", (data) => {
      const store = useSessionStore.getState();
      const floorId = store.getFloorBySessionId(data.sessionId);
      if (!floorId) return;

      const floor = store.floors[floorId];
      if (!floor) return;

      /* If in interactive mode, the print process was killed intentionally — ignore */
      if (floor.isInteractiveMode) return;

      /* Transition all elves to "done" */
      store.updateAllElfStatusOnFloor(floorId, "done");

      /* Add celebration event */
      const runtime = floor.session?.runtime ?? "claude-code";
      const leadElf = floor.elves[0];
      const leadName = leadElf?.name ?? "The Elves";

      store.addEventToFloor(floorId, {
        id: `event-complete-${Date.now()}`,
        timestamp: Date.now(),
        elfId: "system",
        elfName: "System",
        runtime,
        type: "task_update",
        payload: { status: "completed", message: `ALL DONE! ${leadName}: "The elves have spoken."` },
        funnyStatus: `${leadName} declares victory!`,
      });

      /* Extract memories if auto-learn is enabled */
      const autoLearn = useSettingsStore.getState().autoLearn;
      if (autoLearn) {
        extractSessionMemories(data.sessionId).catch((error: unknown) => {
          console.error("Failed to extract session memories:", error);
        });
      }

      store.endSessionOnFloor(floorId, "completed");
    });

    sessionCompletePromise
      .then((unsub) => cleanups.push(unsub))
      .catch((error: unknown) => console.error("Failed to subscribe to session:completed:", error));

    /* Listen for session continuation (follow-up message sent, new process spawned) */
    interface SessionContinuedPayload {
      readonly sessionId: string;
    }
    const sessionContinuedPromise = onEvent<SessionContinuedPayload>("session:continued", (data) => {
      const store = useSessionStore.getState();
      const floorId = store.getFloorBySessionId(data.sessionId);
      if (!floorId) return;

      store.reactivateSessionOnFloor(floorId);

      const floor = store.floors[floorId];
      const leadElf = floor?.elves[0];
      if (leadElf) {
        store.updateElfStatusOnFloor(floorId, leadElf.id, "working");
      }
    });

    sessionContinuedPromise
      .then((unsub) => cleanups.push(unsub))
      .catch((error: unknown) => console.error("Failed to subscribe to session:continued:", error));

    /* Listen for session cancellation (user stopped the task) */
    const sessionCancelledPromise = onEvent<SessionCancelledPayload>("session:cancelled", (data) => {
      const store = useSessionStore.getState();
      const floorId = store.getFloorBySessionId(data.sessionId);
      if (!floorId) return;

      store.updateAllElfStatusOnFloor(floorId, "done");
      store.endSessionOnFloor(floorId, "cancelled");

      /* Clear floor session after a brief delay so the user sees the cancellation */
      setTimeout(() => {
        useSessionStore.getState().clearFloorSession(floorId);
      }, 3000);
    });

    sessionCancelledPromise
      .then((unsub) => cleanups.push(unsub))
      .catch((error: unknown) => console.error("Failed to subscribe to session:cancelled:", error));

    return () => {
      mounted.current = false;
      cleanups.forEach((unsub) => unsub());
    };
  }, []);
}
