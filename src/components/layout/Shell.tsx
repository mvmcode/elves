/* App shell — top-level layout composing sidebar, top bar, task bar, and content area. */

import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { TaskBar } from "./TaskBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { MinionTheater } from "@/components/theater/MinionTheater";
import { ActivityFeed } from "@/components/feed/ActivityFeed";
import { useSessionStore } from "@/stores/session";

/**
 * Root layout shell matching the UI design from product plan Section 7.1.
 * Left sidebar + main area (top bar, task bar, center content, activity feed).
 * Shows MinionTheater and ActivityFeed when a session is active, empty state otherwise.
 */
export function Shell(): React.JSX.Element {
  const activeSession = useSessionStore((state) => state.activeSession);
  const minions = useSessionStore((state) => state.minions);
  const events = useSessionStore((state) => state.events);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface-light">
      <Sidebar />

      <main className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <TaskBar />

        {activeSession ? (
          <div className="flex flex-1 overflow-hidden">
            {/* Center — minion theater grid */}
            <div className="flex-1 overflow-y-auto">
              <MinionTheater minions={minions} events={events} />
            </div>

            {/* Right panel — activity feed */}
            <div className="w-96 shrink-0 border-l-[3px] border-border">
              <ActivityFeed events={events} maxHeight="100%" />
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden">
            <EmptyState
              message="The minions are just sitting around eating bananas."
              submessage="Type a task above and deploy the minions to get started."
            />
          </div>
        )}
      </main>
    </div>
  );
}
