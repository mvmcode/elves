/* First-run onboarding wizard — guides new users through runtime check, project creation, and launch. */

import { useState, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useAppStore } from "@/stores/app";
import { useProjectStore } from "@/stores/project";
import { detectRuntimes, createProject } from "@/lib/tauri";
import { Button } from "@/components/shared/Button";
import { Input } from "@/components/shared/Input";
import type { RuntimeInfo } from "@/types/runtime";

type WizardStep = "runtime-check" | "create-project" | "ready";

/**
 * Multi-step onboarding wizard shown on first launch when no projects exist.
 * Steps: 1) Runtime check, 2) Create first project, 3) Ready to go.
 * Neo-brutalist styled with thick borders, hard shadows, bold typography.
 */
export function FirstRunWizard(): React.JSX.Element {
  const [step, setStep] = useState<WizardStep>("runtime-check");
  const runtimes = useAppStore((s) => s.runtimes);
  const setRuntimes = useAppStore((s) => s.setRuntimes);
  const setRuntimeHealthy = useAppStore((s) => s.setRuntimeHealthy);
  const setIsFirstRun = useAppStore((s) => s.setIsFirstRun);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-surface-light p-8">
      <div className="w-full max-w-lg border-token-normal border-border bg-surface-elevated p-8 shadow-brutal-lg">
        {/* Step indicator */}
        <div className="mb-6 flex items-center gap-2">
          {(["runtime-check", "create-project", "ready"] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={[
                  "flex h-7 w-7 items-center justify-center border-token-thin border-border font-mono text-xs font-black",
                  step === s ? "bg-accent text-accent-contrast" : s === "ready" && step === "create-project" ? "bg-surface-elevated text-text-muted" : i < ["runtime-check", "create-project", "ready"].indexOf(step) ? "bg-success text-white" : "bg-surface-elevated text-text-muted",
                ].join(" ")}
              >
                {i + 1}
              </div>
              {i < 2 && (
                <div className="h-[2px] w-6 bg-border/40" />
              )}
            </div>
          ))}
        </div>

        {step === "runtime-check" && (
          <RuntimeCheckStep
            runtimes={runtimes}
            onRescan={async () => {
              const detected = await detectRuntimes();
              setRuntimes(detected);
              setRuntimeHealthy(!!(detected.claudeCode || detected.codex));
            }}
            onNext={() => setStep("create-project")}
          />
        )}

        {step === "create-project" && (
          <CreateProjectStep
            onBack={() => setStep("runtime-check")}
            onCreated={() => setStep("ready")}
          />
        )}

        {step === "ready" && (
          <ReadyStep onFinish={() => setIsFirstRun(false)} />
        )}
      </div>
    </div>
  );
}

/* ── Step 1: Runtime Check ─────────────────────────────────── */

function RuntimeCheckStep({
  runtimes,
  onRescan,
  onNext,
}: {
  readonly runtimes: RuntimeInfo | null;
  readonly onRescan: () => Promise<void>;
  readonly onNext: () => void;
}): React.JSX.Element {
  const [isScanning, setIsScanning] = useState(false);
  const hasClaude = !!runtimes?.claudeCode;
  const hasCodex = !!runtimes?.codex;
  const hasAny = hasClaude || hasCodex;

  const handleRescan = useCallback(async (): Promise<void> => {
    setIsScanning(true);
    try {
      await onRescan();
    } finally {
      setIsScanning(false);
    }
  }, [onRescan]);

  return (
    <>
      <h1 className="mb-2 font-display text-2xl text-heading tracking-tight">
        Welcome to ELVES
      </h1>
      <p className="mb-6 font-body text-sm text-text-muted">
        Let's check that your AI runtimes are available. You need at least one installed.
      </p>

      {/* Runtime indicators */}
      <div className="mb-6 flex flex-col gap-3">
        <RuntimeIndicator
          name="Claude Code CLI"
          version={runtimes?.claudeCode?.version ?? null}
          available={hasClaude}
          installHint="npm install -g @anthropic-ai/claude-code"
        />
        <RuntimeIndicator
          name="Codex CLI"
          version={runtimes?.codex?.version ?? null}
          available={hasCodex}
          installHint="npm install -g @openai/codex"
        />
      </div>

      {!hasAny && (
        <div className="mb-4 border-token-thin border-border bg-warning/10 px-4 py-3 font-body text-xs text-warning">
          No runtimes detected. Install at least one CLI to deploy tasks.
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button
          variant="secondary"
          onClick={() => void handleRescan()}
          disabled={isScanning}
        >
          {isScanning ? "Scanning..." : "Re-scan"}
        </Button>
        <Button variant="primary" onClick={onNext}>
          {hasAny ? "Next" : "Continue anyway"}
        </Button>
      </div>
    </>
  );
}

/** Single runtime status row with available/unavailable indicator. */
function RuntimeIndicator({
  name,
  version,
  available,
  installHint,
}: {
  readonly name: string;
  readonly version: string | null;
  readonly available: boolean;
  readonly installHint: string;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 border-token-thin border-border bg-surface-light px-4 py-3">
      {/* Status dot */}
      <span
        className={[
          "inline-block h-3 w-3 shrink-0 border-[2px] border-border",
          available ? "bg-success" : "bg-error",
        ].join(" ")}
      />
      <div className="min-w-0 flex-1">
        <span className="font-display text-sm text-label">
          {name}
        </span>
        {available && version && (
          <span className="ml-2 font-mono text-xs text-text-muted">v{version}</span>
        )}
        {!available && (
          <p className="mt-1 font-mono text-[11px] text-text-muted">
            {installHint}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Step 2: Create First Project ──────────────────────────── */

function CreateProjectStep({
  onBack,
  onCreated,
}: {
  readonly onBack: () => void;
  readonly onCreated: () => void;
}): React.JSX.Element {
  const addProject = useProjectStore((s) => s.addProject);
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleBrowse = useCallback(async (): Promise<void> => {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (selected) {
        setPath(selected as string);
        /* Auto-fill name from folder name if empty */
        if (!name) {
          const parts = (selected as string).split("/");
          const folderName = parts[parts.length - 1] ?? "";
          if (folderName) setName(folderName);
        }
      }
    } catch {
      /* User cancelled */
    }
  }, [name]);

  const handleCreate = useCallback(async (): Promise<void> => {
    setError(null);
    const trimmedName = name.trim();
    const trimmedPath = path.trim();
    if (!trimmedName) { setError("Project name is required."); return; }
    if (!trimmedPath) { setError("Project path is required."); return; }

    setIsCreating(true);
    try {
      const project = await createProject(trimmedName, trimmedPath);
      addProject(project);
      onCreated();
    } catch (createError: unknown) {
      setError(createError instanceof Error ? createError.message : String(createError));
    } finally {
      setIsCreating(false);
    }
  }, [name, path, addProject, onCreated]);

  return (
    <>
      <h1 className="mb-2 font-display text-2xl text-heading tracking-tight">
        Create Your First Project
      </h1>
      <p className="mb-6 font-body text-sm text-text-muted">
        Point ELVES at a code directory. This is where your AI team will work.
      </p>

      <div className="mb-4">
        <label htmlFor="wizard-name" className="mb-1 block font-body text-sm text-label">
          Name
        </label>
        <Input
          id="wizard-name"
          placeholder="My Awesome Project"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>

      <div className="mb-4">
        <label htmlFor="wizard-path" className="mb-1 block font-body text-sm text-label">
          Path
        </label>
        <div className="flex gap-2">
          <Input
            id="wizard-path"
            placeholder="/Users/you/projects/my-app"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            className="flex-1"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => void handleBrowse()}
            className="shrink-0"
          >
            Browse
          </Button>
        </div>
      </div>

      {error && (
        <p className="mb-4 border-token-thin border-border bg-error/10 px-3 py-2 font-body text-sm font-bold text-error">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button
          variant="primary"
          onClick={() => void handleCreate()}
          disabled={isCreating}
        >
          {isCreating ? "Creating..." : "Create Project"}
        </Button>
      </div>
    </>
  );
}

/* ── Step 3: Ready ─────────────────────────────────────────── */

function ReadyStep({
  onFinish,
}: {
  readonly onFinish: () => void;
}): React.JSX.Element {
  const activeProject = useProjectStore((s) => {
    const id = s.activeProjectId;
    return id ? s.projects.find((p) => p.id === id) : undefined;
  });

  return (
    <>
      <div className="mb-4 flex h-14 w-14 items-center justify-center border-token-normal border-border bg-success/10">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-success">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h1 className="mb-2 font-display text-2xl text-heading tracking-tight">
        You're All Set
      </h1>
      <p className="mb-2 font-body text-sm text-text-muted">
        Project <span className="font-bold text-text-light">{activeProject?.name ?? "your project"}</span> is ready.
      </p>
      <p className="mb-6 font-body text-sm text-text-muted">
        Type a task in the bar and hit Summon to deploy your AI team.
      </p>
      <Button variant="primary" onClick={onFinish}>
        Get Started
      </Button>
    </>
  );
}
