/* EventProcessor — maps unified ElfEvent stream to workshop sprite actions and animations. */

import type { ElfEvent, ElfEventType } from '../../types/elf';
import type { WorkAnimation } from '../../types/workshop';
import type { WorkshopScene } from './WorkshopScene';
import { WORKBENCHES, DOOR_POS, ST } from './workshop-layout';

/** Tool name to workshop animation mapping table */
const TOOL_ANIMATION_MAP: Record<string, WorkAnimation> = {
  write: 'type',
  edit: 'type',
  create: 'type',
  read: 'read',
  search: 'read',
  glob: 'read',
  grep: 'read',
  view: 'read',
  bash: 'hammer',
  command: 'hammer',
  execute: 'hammer',
  shell: 'hammer',
  test: 'mix',
  lint: 'mix',
  check: 'mix',
  validate: 'mix',
};

/** Maximum characters shown in a speech bubble preview */
const BUBBLE_PREVIEW_MAX_LENGTH = 24;

/** Duration in seconds for standard speech bubbles */
const BUBBLE_DURATION = 3.0;

/** Duration in seconds for alert bubbles (longer, needs attention) */
const ALERT_BUBBLE_DURATION = 5.0;

/** Duration in seconds for progress chant bubbles (persistent, shows activity) */
const CHANT_BUBBLE_DURATION = 4.0;

/** Fun chant messages shown while elves are using specific tool types */
const TOOL_CHANTS: Record<string, readonly string[]> = {
  type: ['tap tap tap...', 'writing code!', 'typing away~', 'clackity clack!', 'scribble scribble'],
  read: ['hmm let me see...', 'reading closely', 'scanning files...', 'studying this...', 'interesting...'],
  hammer: ['bash bash bash!', 'building things!', 'hammering away!', 'executing...', 'compiling!'],
  mix: ['testing testing...', 'mixing potions!', 'checking quality', 'validating...', 'stirring the pot'],
};

/** Generic thinking chants shown during extended reasoning */
const THINKING_CHANTS: readonly string[] = [
  'hmm...',
  'pondering...',
  'let me think...',
  'processing...',
  'aha...',
  'interesting...',
  'considering...',
  'one moment...',
];

/**
 * Maps a tool name string to the appropriate workshop work animation.
 * Falls back to 'type' for unrecognized tools since typing is the most common action.
 */
export function getToolAnimation(toolName: string): WorkAnimation {
  const normalized = toolName.toLowerCase().replace(/[^a-z]/g, '');
  for (const [key, animation] of Object.entries(TOOL_ANIMATION_MAP)) {
    if (normalized.includes(key)) {
      return animation;
    }
  }
  return 'type';
}

/**
 * Extracts a short message preview from an event payload for display in speech bubbles.
 * Looks for common payload fields (message, text, content, description) and truncates.
 */
export function extractMessagePreview(payload: Record<string, unknown>): string {
  const candidates = ['message', 'text', 'content', 'description', 'summary'];
  for (const key of candidates) {
    const value = payload[key];
    if (typeof value === 'string' && value.length > 0) {
      if (value.length <= BUBBLE_PREVIEW_MAX_LENGTH) {
        return value;
      }
      return value.slice(0, BUBBLE_PREVIEW_MAX_LENGTH - 1) + '\u2026';
    }
  }
  return '...';
}

/**
 * Finds the next unassigned workbench in the workshop layout.
 * Returns the workbench id or null if all benches are occupied.
 */
function findFreeWorkbench(_scene: WorkshopScene): number | null {
  for (const bench of WORKBENCHES) {
    if (bench.assignedElfId === null) {
      return bench.id;
    }
  }
  return null;
}

/**
 * Gets the standing position in front of a workbench (one tile below its origin).
 * This is where an elf stands while working at the bench.
 */
function getWorkbenchStandPosition(benchId: number): { x: number; y: number } {
  const bench = WORKBENCHES.find((wb) => wb.id === benchId);
  if (!bench) {
    return { x: DOOR_POS.col * ST + ST, y: (DOOR_POS.row - 1) * ST + ST / 2 };
  }
  return {
    x: bench.x * ST + ST * 1.5,
    y: (bench.y + 2) * ST + ST * 0.5,
  };
}

/**
 * Processes unified ElfEvent objects and translates them into workshop scene
 * sprite actions — spawning elves, triggering animations, emitting particles,
 * adding conveyor items, and showing speech bubbles.
 *
 * Each event type maps to a specific set of visual responses:
 * - spawn: elf enters from door and walks to assigned workbench
 * - thinking: elf reads/ponders with thought bubble
 * - tool_call: elf performs tool-specific animation with sparkles
 * - tool_result: success sparkle burst or error smoke puff
 * - output: new item appears on conveyor belt
 * - chat: speech bubble on the sender elf
 * - task_update: celebrate on completion, error state on failure
 * - permission_request: alert bubble, elf pauses work
 * - file_change: gold conveyor item
 * - error: smoke puff and error state
 */
export class EventProcessor {
  /**
   * Process a single ElfEvent and apply its visual effects to the workshop scene.
   * Delegates to type-specific handlers based on event.type.
   */
  processEvent(event: ElfEvent, scene: WorkshopScene): void {
    const handler = this.getHandler(event.type);
    handler(event, scene);
  }

  /** Returns the handler function for a given event type */
  private getHandler(
    eventType: ElfEventType,
  ): (event: ElfEvent, scene: WorkshopScene) => void {
    switch (eventType) {
      case 'spawn':
        return this.handleSpawn;
      case 'thinking':
        return this.handleThinking;
      case 'tool_call':
        return this.handleToolCall;
      case 'tool_result':
        return this.handleToolResult;
      case 'output':
        return this.handleOutput;
      case 'chat':
        return this.handleChat;
      case 'task_update':
        return this.handleTaskUpdate;
      case 'permission_request':
        return this.handlePermissionRequest;
      case 'file_change':
        return this.handleFileChange;
      case 'error':
        return this.handleError;
      case 'permission_granted':
        return this.handlePermissionGranted;
      case 'session_complete':
        return this.handleSessionComplete;
      default:
        return () => {};
    }
  }

  /**
   * Spawn event: create elf at door position, transition to 'entering',
   * auto-assign next free workbench, then walk to it.
   */
  private handleSpawn = (event: ElfEvent, scene: WorkshopScene): void => {
    const hatColor =
      (event.payload['hatColor'] as string | undefined) ?? '#D04040';
    const accessory =
      (event.payload['accessory'] as string | undefined) ?? 'wrench';

    scene.spawnElf(event.elfId, event.elfName, hatColor, accessory);

    const elf = scene.getElf(event.elfId);
    if (!elf) return;

    const benchId = findFreeWorkbench(scene);
    if (benchId !== null) {
      elf.assignWorkbench(benchId);
      const benchPos = getWorkbenchStandPosition(benchId);
      elf.walkTo(benchPos.x, benchPos.y);
      /* Mark bench as occupied */
      const bench = WORKBENCHES.find((wb) => wb.id === benchId);
      if (bench) {
        bench.assignedElfId = event.elfId;
      }
    }
  };

  /**
   * Thinking event: elf transitions to 'working' with 'read' animation
   * and shows a chant bubble with a fun thinking message.
   * Marks elf as active and stops wandering.
   */
  private handleThinking = (event: ElfEvent, scene: WorkshopScene): void => {
    const elf = scene.getElf(event.elfId);
    if (!elf) return;

    this.activateElf(elf, scene);
    elf.transitionTo('working', 'read');
    const chant = THINKING_CHANTS[Math.floor(Math.random() * THINKING_CHANTS.length)] ?? 'hmm...';
    elf.showBubble(chant, 'thought', CHANT_BUBBLE_DURATION);
  };

  /**
   * Tool call event: elf transitions to 'working' with animation based on tool name.
   * Shows a chant bubble with the tool action. Emits sparkle particles. Marks elf as active.
   */
  private handleToolCall = (event: ElfEvent, scene: WorkshopScene): void => {
    const elf = scene.getElf(event.elfId);
    if (!elf) return;

    this.activateElf(elf, scene);
    const toolName = (event.payload['tool'] as string | undefined) ?? '';
    const animation = getToolAnimation(toolName);
    elf.transitionTo('working', animation);

    /* Pick a fun chant message matching the tool animation type */
    const chants = TOOL_CHANTS[animation] ?? TOOL_CHANTS['type']!;
    const chant = chants[Math.floor(Math.random() * chants.length)] ?? 'working...';
    elf.showBubble(chant, 'speech', CHANT_BUBBLE_DURATION);

    /* Sparkle burst at elf position for visual feedback */
    scene.emitSparkles(elf.getPosition().x, elf.getPosition().y, '#FFD93D', 5);
  };

  /**
   * Tool result event: green sparkle burst on success with cheer, smoke puff on error.
   */
  private handleToolResult = (event: ElfEvent, scene: WorkshopScene): void => {
    const elf = scene.getElf(event.elfId);
    if (!elf) return;

    const isError =
      event.payload['error'] !== undefined ||
      event.payload['status'] === 'error';
    const position = elf.getPosition();

    if (isError) {
      scene.emitSmoke(position.x, position.y, 4);
      const errorChants = ['oops!', 'uh oh!', 'hmm, trouble!', 'not quite...'];
      const chant = errorChants[Math.floor(Math.random() * errorChants.length)] ?? 'oops!';
      elf.showBubble(chant, 'alert', BUBBLE_DURATION);
    } else {
      scene.emitSparkles(position.x, position.y, '#6BCB77', 8);
      const successChants = ['nice!', 'got it!', 'done!', 'perfect!', 'onwards!'];
      const chant = successChants[Math.floor(Math.random() * successChants.length)] ?? 'nice!';
      elf.showBubble(chant, 'speech', 1.5);
    }
  };

  /**
   * Output event: add a blue item to the conveyor belt representing produced output.
   */
  private handleOutput = (event: ElfEvent, scene: WorkshopScene): void => {
    const label = extractMessagePreview(event.payload);
    scene.addConveyorItem('#4D96FF', label);
  };

  /**
   * Chat event: show speech bubble on the sender elf with message excerpt.
   * If a targetElfId is present in the payload, shows a thought bubble on the target
   * to indicate an incoming message (delivery walk will be triggered by BehaviorSequencer).
   */
  private handleChat = (event: ElfEvent, scene: WorkshopScene): void => {
    const elf = scene.getElf(event.elfId);
    if (!elf) return;

    const preview = extractMessagePreview(event.payload);
    elf.showBubble(preview, 'speech', BUBBLE_DURATION);

    const targetElfId = event.payload['targetElfId'] as string | undefined;
    if (targetElfId) {
      const targetElf = scene.getElf(targetElfId);
      if (targetElf) {
        /* Delivery walk will be triggered by BehaviorSequencer when wired by integrator */
        targetElf.showBubble('...', 'thought', 1.5);
      }
    }
  };

  /**
   * Task update event: check payload status.
   * "complete" triggers celebration animation and adds a cookie to the jar.
   * "error" triggers error state on the elf.
   */
  private handleTaskUpdate = (event: ElfEvent, scene: WorkshopScene): void => {
    const elf = scene.getElf(event.elfId);
    if (!elf) return;

    const status = event.payload['status'] as string | undefined;

    if (status === 'complete' || status === 'completed' || status === 'done') {
      elf.transitionTo('celebrating');
      elf.showBubble('Done!', 'speech', BUBBLE_DURATION);
      const position = elf.getPosition();
      scene.emitSparkles(position.x, position.y, '#FFD93D', 12);
      scene.addConveyorItem('#6BCB77', 'cookie');
    } else if (status === 'error' || status === 'failed') {
      elf.transitionTo('error');
      const position = elf.getPosition();
      scene.emitSmoke(position.x, position.y, 6);
    }
  };

  /**
   * Permission request event: elf transitions to 'permission' state and shows alert bubble.
   */
  private handlePermissionRequest = (
    event: ElfEvent,
    scene: WorkshopScene,
  ): void => {
    const elf = scene.getElf(event.elfId);
    if (!elf) return;

    elf.transitionTo('permission');
    const preview = extractMessagePreview(event.payload);
    elf.showBubble(preview, 'alert', ALERT_BUBBLE_DURATION);
  };

  /**
   * File change event: add a gold-colored item to the conveyor belt.
   */
  private handleFileChange = (event: ElfEvent, scene: WorkshopScene): void => {
    const filePath = (event.payload['path'] as string | undefined) ?? '';
    const fileName = filePath.split('/').pop() ?? 'file';
    scene.addConveyorItem('#FFD93D', fileName);
  };

  /**
   * Error event: smoke puff at elf position, transition to error state.
   */
  private handleError = (event: ElfEvent, scene: WorkshopScene): void => {
    const elf = scene.getElf(event.elfId);
    if (!elf) return;

    elf.transitionTo('error');
    const position = elf.getPosition();
    scene.emitSmoke(position.x, position.y, 6);
    const preview = extractMessagePreview(event.payload);
    elf.showBubble(preview, 'alert', ALERT_BUBBLE_DURATION);
  };

  /**
   * Permission granted: elf resumes work with a celebratory jump.
   * Transitions to celebrating briefly, then back to working.
   * When BehaviorSequencer is wired, this will delegate to resumeFromPermission().
   */
  private handlePermissionGranted = (event: ElfEvent, scene: WorkshopScene): void => {
    const elf = scene.getElf(event.elfId);
    if (!elf) return;

    elf.transitionTo('celebrating');
    elf.showBubble("Let's go!", 'speech', 2.0);
    /* BehaviorSequencer.resumeFromPermission() will handle the full sequence when wired */
  };

  /**
   * Session complete: all elves celebrate with sparkle bursts.
   * Deactivates all elves and starts wander behavior after celebration.
   */
  private handleSessionComplete = (_event: ElfEvent, scene: WorkshopScene): void => {
    const elves = scene.getAllElves();
    for (const elf of elves) {
      elf.isActive = false;
      elf.transitionTo('celebrating');
      elf.showBubble('Done!', 'speech', 3.0);
      const pos = elf.getPosition();
      scene.emitSparkles(pos.x, pos.y, '#FFD93D', 15);

      /* Start wander behavior after celebration finishes */
      scene.getBehaviorSequencer().startWander(elf.getId());
    }
  };

  /**
   * Mark an elf as active and stop its wander behavior.
   * Called when the elf starts receiving work events.
   */
  private activateElf(elf: import('./ElfSprite').ElfSprite, scene: WorkshopScene): void {
    if (!elf.isActive) {
      elf.isActive = true;
      scene.getBehaviorSequencer().stopWander(elf.getId(), scene);
    }
  }
}
