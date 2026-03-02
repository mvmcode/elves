/* Session event listener — global subscriber that routes Tauri backend events to the correct floor.
 * Unlike the single-session version, this subscribes once on mount and routes incoming events
 * to floors by matching the event's sessionId to floor state via getFloorBySessionId().
 *
 * Uses a disposed flag to prevent React 18 StrictMode double-subscription race conditions:
 * StrictMode unmounts/remounts synchronously, but Tauri event subscriptions resolve async.
 * Without the disposed guard, the first mount's subscriptions leak because cleanup runs
 * before promises resolve, leaving two active listeners. */

import { useEffect, useRef } from "react";
import { useSessionStore } from "@/stores/session";
import { useSettingsStore } from "@/stores/settings";
import { useToastStore } from "@/stores/toast";
import { onEvent, extractSessionMemories } from "@/lib/tauri";
import { generateElf, getStatusMessage } from "@/lib/elf-names";
import { playSound } from "@/lib/sounds";
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
  readonly needsInput?: boolean;
  readonly lastResult?: string;
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
    /* The result text duplicates the final assistant text block already emitted above.
     * Only emit a task_update with cost metadata to avoid duplicate output in the card view. */
    const cost = rawPayload.cost_usd as number | undefined;
    return [{
      type: "task_update",
      payload: {
        status: "completed",
        isFinal: true,
        cost: cost ?? 0,
        message: "Session finished",
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
 * Subscribe to a Tauri event with StrictMode-safe cleanup.
 *
 * Returns a cleanup function that:
 * 1. Sets a `disposed` flag immediately (synchronous — runs during React cleanup)
 * 2. When the async subscription resolves, unsubscribes immediately if already disposed
 *
 * This prevents the classic StrictMode double-subscription race where cleanup runs
 * before async `.then()` callbacks populate the cleanup array.
 */
function subscribeSafe<T>(
  eventName: string,
  handler: (data: T) => void,
): () => void {
  let disposed = false;
  let unsub: (() => void) | null = null;

  onEvent<T>(eventName, (data) => {
    if (!disposed) handler(data);
  })
    .then((unsubFn) => {
      if (disposed) {
        /* Effect was already cleaned up before this subscription resolved — tear down immediately */
        unsubFn();
      } else {
        unsub = unsubFn;
      }
    })
    .catch((error: unknown) => {
      console.error(`Failed to subscribe to ${eventName}:`, error);
    });

  return () => {
    disposed = true;
    if (unsub) unsub();
  };
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
    cleanups.push(
      subscribeSafe<ElfEventPayload>("elf:event", (data) => {
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

          /* Detect Agent tool calls — create a new elf for each spawned sub-agent.
           * The lead elf (elves[0]) is already the leader; new agents get their own elf. */
          if (entry.type === "tool_call" && entry.payload.tool === "Agent") {
            const usedNames = floor.elves.map((e) => e.name);
            const personality = generateElf(usedNames);
            const agentDesc = String(entry.payload.input && typeof entry.payload.input === "object"
              ? (entry.payload.input as Record<string, unknown>).description ?? ""
              : "");
            const agentType = String(entry.payload.input && typeof entry.payload.input === "object"
              ? (entry.payload.input as Record<string, unknown>).subagent_type ?? "Agent"
              : "Agent");
            const roleName = agentType === "Agent" ? "Worker" : agentType;
            const elfId = `elf-agent-${data.sessionId}-${data.timestamp}-${Math.random().toString(36).slice(2, 6)}`;

            store.addElfToFloor(floorId, {
              id: elfId,
              sessionId: data.sessionId,
              name: personality.name,
              role: roleName,
              avatar: personality.avatar,
              color: personality.color,
              quirk: personality.quirk,
              runtime: targetElf.runtime,
              status: "spawning",
              spawnedAt: Date.now(),
              finishedAt: null,
              parentElfId: targetElf.id,
              toolsUsed: [],
            });

            store.addEventToFloor(floorId, {
              id: `event-agent-spawn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              timestamp: Date.now(),
              elfId,
              elfName: personality.name,
              runtime: targetElf.runtime,
              type: "spawn",
              payload: { role: roleName, description: agentDesc },
              funnyStatus: getStatusMessage(personality.name, "spawning"),
            });

            playSound("spawn");

            /* Transition to working after brief delay */
            setTimeout(() => {
              const currentStore = useSessionStore.getState();
              const currentFloor = currentStore.floors[floorId];
              if (currentFloor?.elves.some((e) => e.id === elfId)) {
                currentStore.updateElfStatusOnFloor(floorId, elfId, "working");
              }
            }, 1500);
          }
        }

        /* Update elf status based on raw event type */
        const newStatus = eventTypeToElfStatus(data.eventType);
        if (newStatus && targetElf.status !== newStatus) {
          store.updateElfStatusOnFloor(floorId, targetElf.id, newStatus);
        }
      }),
    );

    /* Listen for Claude Code's internal session ID (used for terminal resume) */
    interface ClaudeIdPayload {
      readonly sessionId: string;
      readonly claudeSessionId: string;
    }
    cleanups.push(
      subscribeSafe<ClaudeIdPayload>("session:claude_id", (data) => {
        const store = useSessionStore.getState();
        const floorId = store.getFloorBySessionId(data.sessionId);
        if (!floorId) return;
        store.setClaudeSessionIdOnFloor(floorId, data.claudeSessionId);
      }),
    );

    /* Listen for interactive mode transition (print process killed, PTY takes over) */
    interface SessionInteractivePayload {
      readonly sessionId: string;
    }
    cleanups.push(
      subscribeSafe<SessionInteractivePayload>("session:interactive", (data) => {
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
      }),
    );

    /* Listen for session completion (Claude process exited successfully) */
    cleanups.push(
      subscribeSafe<SessionCompletedPayload>("session:completed", (data) => {
        const store = useSessionStore.getState();
        const floorId = store.getFloorBySessionId(data.sessionId);
        if (!floorId) return;

        const floor = store.floors[floorId];
        if (!floor) return;

        /* If in interactive mode, the print process was killed intentionally — ignore */
        if (floor.isInteractiveMode) return;

        /* Guard against duplicate completion events (StrictMode or event replay) */
        if (floor.session?.status === "completed") return;

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

        /* Set needsInput flag if Claude asked a question — BEFORE ending session
         * so the flag is available when the UI checks for the FollowUpCard. */
        if (data.needsInput) {
          store.setNeedsInputOnFloor(floorId, true, data.lastResult ?? null);
        }

        /* Extract memories if auto-learn is enabled */
        const autoLearn = useSettingsStore.getState().autoLearn;
        if (autoLearn) {
          extractSessionMemories(data.sessionId).catch((error: unknown) => {
            console.error("Failed to extract session memories:", error);
          });
        }

        store.endSessionOnFloor(floorId, "completed");

        /* Toast for cross-floor events — only when this session is on a non-active floor */
        if (store.activeFloorId !== floorId) {
          const floorLabel = floor.label || "another floor";
          if (data.needsInput) {
            useToastStore.getState().addToast({
              message: `Claude is asking a question on "${floorLabel}"`,
              variant: "warning",
              duration: 8000,
              action: {
                label: "GO TO FLOOR",
                onClick: () => useSessionStore.getState().switchFloor(floorId),
              },
            });
          } else {
            useToastStore.getState().addToast({
              message: `Session completed on "${floorLabel}"`,
              variant: "success",
              duration: 5000,
              action: {
                label: "VIEW",
                onClick: () => useSessionStore.getState().switchFloor(floorId),
              },
            });
          }
        }
      }),
    );

    /* Listen for session continuation (follow-up message sent, new process spawned) */
    interface SessionContinuedPayload {
      readonly sessionId: string;
    }
    cleanups.push(
      subscribeSafe<SessionContinuedPayload>("session:continued", (data) => {
        const store = useSessionStore.getState();
        const floorId = store.getFloorBySessionId(data.sessionId);
        if (!floorId) return;

        store.reactivateSessionOnFloor(floorId);

        const floor = store.floors[floorId];
        const leadElf = floor?.elves[0];
        if (leadElf) {
          store.updateElfStatusOnFloor(floorId, leadElf.id, "working");
        }
      }),
    );

    /* Listen for session cancellation (user stopped the task) */
    cleanups.push(
      subscribeSafe<SessionCancelledPayload>("session:cancelled", (data) => {
        const store = useSessionStore.getState();
        const floorId = store.getFloorBySessionId(data.sessionId);
        if (!floorId) return;

        store.updateAllElfStatusOnFloor(floorId, "done");
        store.endSessionOnFloor(floorId, "cancelled");

        /* Toast for cross-floor cancellation */
        if (store.activeFloorId !== floorId) {
          const floor = store.floors[floorId];
          const floorLabel = floor?.label || "another floor";
          useToastStore.getState().addToast({
            message: `Session cancelled on "${floorLabel}"`,
            variant: "info",
            duration: 4000,
          });
        }
      }),
    );

    return () => {
      mounted.current = false;
      cleanups.forEach((cleanup) => cleanup());
    };
  }, []);
}
