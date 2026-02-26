/* App shell — top-level layout composing sidebar, top bar, task bar, and content area. */

import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { TaskBar } from "./TaskBar";
import { EmptyState } from "@/components/shared/EmptyState";

/**
 * Root layout shell matching the UI design from product plan Section 7.1.
 * Left sidebar + main area (top bar, task bar, center content, activity feed).
 */
export function Shell(): React.JSX.Element {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface-light">
      <Sidebar />

      <main className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <TaskBar />

        {/* Center content — empty state until a session is active */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <EmptyState
            message="The minions are just sitting around eating bananas."
            submessage="Type a task above and deploy the minions to get started."
          />
        </div>
      </main>
    </div>
  );
}
