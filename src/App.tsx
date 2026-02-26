/* Root application component — initializes the app and renders the shell layout. */

import { Shell } from "@/components/layout/Shell";
import { useAppStore } from "@/stores/app";
import { useInitialize } from "@/hooks/useInitialize";

export function App(): React.JSX.Element {
  useInitialize();
  const isLoading = useAppStore((s) => s.isLoading);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-surface-light">
        <p className="font-display text-3xl font-black text-text-light/60">
          Waking up the elves...
        </p>
      </div>
    );
  }

  return <Shell />;
}
