/* BehaviorSequencer — orchestrates multi-step elf choreography: delivery walks, ceremonies, idle timers, and permission resumption. */

import type { DeliveryWalkState, CeremonyState, Vec2 } from '../../types/workshop';
import type { WorkshopScene } from './WorkshopScene';
import type { ElfSprite } from './ElfSprite';
import { COTS_POS, ST, WORKBENCHES } from './workshop-layout';

/** Duration of the scroll pickup animation before walking starts (ms). */
const PICKUP_DURATION_MS = 500;

/** How long the sender's speech bubble stays visible at the receiver (ms). */
const SHOWING_MESSAGE_DURATION_MS = 2000;

/** How long the receiver's celebratory nod lasts (ms). */
const RECEIVER_NOD_DURATION_MS = 1000;

/** How long all elves celebrate before the sparkle burst (ms). */
const CELEBRATE_DURATION_MS = 3000;

/** Duration of the sparkle burst phase before walking to cots (ms). */
const SPARKLE_BURST_DURATION_MS = 1000;

/** Idle time threshold before an elf auto-walks to cots to sleep (ms). */
const IDLE_THRESHOLD_MS = 30000;

/** Sparkle count for ceremony burst. */
const CEREMONY_SPARKLE_COUNT = 15;

/** Duration of the celebratory jump when resuming from permission (ms). */
const RESUME_CELEBRATE_DURATION_MS = 1000;

/**
 * Calculates the standing position in front of a workbench.
 * One tile below the bench origin, centered horizontally.
 */
function getWorkbenchStandPosition(benchId: number): Vec2 {
  const bench = WORKBENCHES.find((wb) => wb.id === benchId);
  if (!bench) {
    return { x: ST * 14, y: ST * 14 };
  }
  return {
    x: bench.x * ST + ST * 1.5,
    y: (bench.y + 2) * ST + ST * 0.5,
  };
}

/**
 * Calculates a sleeping position adjacent to the cots area.
 * Elves are staggered vertically so they don't overlap.
 */
function getCotAdjacentPosition(elfIndex: number): Vec2 {
  return {
    x: (COTS_POS.col - 1) * ST + ST / 2,
    y: (COTS_POS.row + Math.min(elfIndex, 4) * 2) * ST + ST / 2,
  };
}

/**
 * Manages multi-step elf choreography sequences: delivery walks between elves,
 * session-complete ceremonies, permission resumption animations, and idle timers
 * that auto-walk inactive elves to cots.
 *
 * Each update tick advances all active sequences by the elapsed time delta.
 * The sequencer reads elf state to detect when walking phases complete
 * (elf transitions from walking/carrying to idle/delivering).
 */
export class BehaviorSequencer {
  private readonly activeDeliveries: Map<string, DeliveryWalkState> = new Map();
  private activeCeremony: CeremonyState | null = null;
  private readonly idleTimers: Map<string, number> = new Map();

  /**
   * Start an inter-elf chat delivery sequence.
   * The sender picks up a scroll, walks to the receiver, shows the message,
   * the receiver nods, and the sender walks back to their workbench.
   *
   * @param sender - The elf carrying the message
   * @param receiver - The elf receiving the message
   * @param message - Text to display in the sender's speech bubble
   * @param _scene - The workshop scene (unused in start, used during update)
   */
  startDelivery(
    sender: ElfSprite,
    receiver: ElfSprite,
    message: string,
    _scene: WorkshopScene,
  ): void {
    const senderId = sender.getId();
    if (this.activeDeliveries.has(senderId)) return;

    sender.transition('carrying', { carryItem: 'scroll' });

    const delivery: DeliveryWalkState = {
      senderId,
      receiverId: receiver.getId(),
      message,
      phase: 'pickup',
      phaseTimer: 0,
    };
    this.activeDeliveries.set(senderId, delivery);
  }

  /**
   * Start the session-complete ceremony for all elves.
   * All elves celebrate, then a sparkle burst fires, then they walk to cots
   * and fall asleep.
   *
   * @param elves - All elf sprites participating in the ceremony
   * @param _scene - The workshop scene (unused in start, used during update)
   */
  startCeremony(elves: ElfSprite[], _scene: WorkshopScene): void {
    if (this.activeCeremony !== null) return;

    const elfIds = elves.map((elf) => elf.getId());

    for (const elf of elves) {
      elf.transitionTo('celebrating');
      elf.showBubble('Done!', 'speech', 3.0);
    }

    this.activeCeremony = {
      phase: 'celebrate',
      phaseTimer: 0,
      elfIds,
    };
  }

  /**
   * Resume an elf from permission-waiting state with a celebratory jump.
   * The elf celebrates for 1 second, shows a "Let's go!" bubble,
   * then transitions back to working.
   *
   * @param elf - The elf resuming work
   * @param _scene - The workshop scene (reserved for future sparkle effects)
   */
  resumeFromPermission(elf: ElfSprite, _scene: WorkshopScene): void {
    elf.transitionTo('celebrating');
    elf.showBubble("Let's go!", 'speech', 2.0);

    /* Queue a delayed transition back to working after the celebrate animation */
    elf.queueAction({
      action: 'transition',
      params: { state: 'working', workAnimation: 'type' },
      delay: RESUME_CELEBRATE_DURATION_MS / 16,
    });
  }

  /** Start counting idle time for a specific elf. */
  startIdleTimer(elfId: string): void {
    this.idleTimers.set(elfId, 0);
  }

  /** Reset the idle timer for a specific elf back to zero. */
  resetIdleTimer(elfId: string): void {
    this.idleTimers.set(elfId, 0);
  }

  /** Check if an elf is currently in an active delivery sequence. */
  hasActiveDelivery(elfId: string): boolean {
    return this.activeDeliveries.has(elfId);
  }

  /**
   * Advance all active choreography sequences by the elapsed time delta.
   * Processes delivery walks, ceremony phases, and idle timers.
   *
   * @param dt - Time elapsed since last frame in milliseconds
   * @param scene - The workshop scene for querying elves and emitting particles
   */
  update(dt: number, scene: WorkshopScene): void {
    this.updateDeliveries(dt, scene);
    this.updateCeremony(dt, scene);
    this.updateIdleTimers(dt, scene);
  }

  /**
   * Advance all active delivery walk sequences through their phases:
   * pickup -> walking_to_receiver -> showing_message -> receiver_nod -> walking_back
   */
  private updateDeliveries(dt: number, scene: WorkshopScene): void {
    const completedIds: string[] = [];

    for (const [senderId, delivery] of this.activeDeliveries) {
      const sender = scene.getElf(senderId);
      if (!sender) {
        completedIds.push(senderId);
        continue;
      }

      delivery.phaseTimer += dt;

      switch (delivery.phase) {
        case 'pickup': {
          if (delivery.phaseTimer >= PICKUP_DURATION_MS) {
            const receiver = scene.getElf(delivery.receiverId);
            if (!receiver) {
              completedIds.push(senderId);
              break;
            }
            const receiverPos = receiver.getPosition();
            sender.walkTo(receiverPos.x, receiverPos.y);
            delivery.phase = 'walking_to_receiver';
            delivery.phaseTimer = 0;
          }
          break;
        }

        case 'walking_to_receiver': {
          const senderState = sender.getState();
          if (senderState !== 'carrying' && senderState !== 'walking') {
            sender.transition('idle', { carryItem: null });
            sender.showBubble(delivery.message, 'speech', 2.0);
            delivery.phase = 'showing_message';
            delivery.phaseTimer = 0;
          }
          break;
        }

        case 'showing_message': {
          if (delivery.phaseTimer >= SHOWING_MESSAGE_DURATION_MS) {
            const receiver = scene.getElf(delivery.receiverId);
            if (receiver) {
              receiver.transitionTo('celebrating');
              receiver.showBubble('*nods*', 'speech', 1.0);
            }
            delivery.phase = 'receiver_nod';
            delivery.phaseTimer = 0;
          }
          break;
        }

        case 'receiver_nod': {
          if (delivery.phaseTimer >= RECEIVER_NOD_DURATION_MS) {
            const benchId = sender.getWorkbenchId();
            if (benchId !== null) {
              const benchPos = getWorkbenchStandPosition(benchId);
              sender.walkTo(benchPos.x, benchPos.y);
            }
            const receiver = scene.getElf(delivery.receiverId);
            if (receiver) {
              receiver.transitionTo('working');
            }
            delivery.phase = 'walking_back';
            delivery.phaseTimer = 0;
          }
          break;
        }

        case 'walking_back': {
          if (sender.getState() === 'idle') {
            sender.transitionTo('working');
            completedIds.push(senderId);
          }
          break;
        }
      }
    }

    for (const id of completedIds) {
      this.activeDeliveries.delete(id);
    }
  }

  /**
   * Advance the active ceremony through its phases:
   * celebrate -> sparkle_burst -> walk_to_cots -> sleep
   */
  private updateCeremony(dt: number, scene: WorkshopScene): void {
    if (!this.activeCeremony) return;
    const ceremony = this.activeCeremony;
    ceremony.phaseTimer += dt;

    switch (ceremony.phase) {
      case 'celebrate': {
        if (ceremony.phaseTimer >= CELEBRATE_DURATION_MS) {
          for (const elfId of ceremony.elfIds) {
            const elf = scene.getElf(elfId);
            if (elf) {
              const pos = elf.getPosition();
              scene.emitSparkles(pos.x, pos.y, '#FFD93D', CEREMONY_SPARKLE_COUNT);
            }
          }
          ceremony.phase = 'sparkle_burst';
          ceremony.phaseTimer = 0;
        }
        break;
      }

      case 'sparkle_burst': {
        if (ceremony.phaseTimer >= SPARKLE_BURST_DURATION_MS) {
          let index = 0;
          for (const elfId of ceremony.elfIds) {
            const elf = scene.getElf(elfId);
            if (elf) {
              const cotPos = getCotAdjacentPosition(index);
              elf.walkTo(cotPos.x, cotPos.y);
              index++;
            }
          }
          ceremony.phase = 'walk_to_cots';
          ceremony.phaseTimer = 0;
        }
        break;
      }

      case 'walk_to_cots': {
        const allArrived = ceremony.elfIds.every((elfId) => {
          const elf = scene.getElf(elfId);
          return !elf || elf.getState() === 'idle';
        });
        if (allArrived) {
          for (const elfId of ceremony.elfIds) {
            const elf = scene.getElf(elfId);
            if (elf) {
              elf.transitionTo('sleeping');
            }
          }
          ceremony.phase = 'sleep';
          ceremony.phaseTimer = 0;
        }
        break;
      }

      case 'sleep': {
        this.activeCeremony = null;
        break;
      }
    }
  }

  /**
   * Check idle timers and auto-walk inactive elves to cots after the threshold.
   * Only triggers for elves in 'idle' state that are not in a delivery sequence.
   */
  private updateIdleTimers(dt: number, scene: WorkshopScene): void {
    for (const [elfId, elapsed] of this.idleTimers) {
      const elf = scene.getElf(elfId);
      if (!elf) {
        this.idleTimers.delete(elfId);
        continue;
      }

      if (elf.getState() !== 'idle' || this.hasActiveDelivery(elfId)) {
        this.idleTimers.set(elfId, 0);
        continue;
      }

      const newElapsed = elapsed + dt;
      this.idleTimers.set(elfId, newElapsed);

      if (newElapsed >= IDLE_THRESHOLD_MS) {
        const cotPos = getCotAdjacentPosition(0);
        elf.walkTo(cotPos.x, cotPos.y);
        elf.queueAction({
          action: 'transition',
          params: { state: 'sleeping' },
          delay: 0,
        });
        this.idleTimers.delete(elfId);
      }
    }
  }
}
