/* New project creation dialog — collects name and path, calls Tauri backend to create. */

import { useState, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Dialog } from "@/components/shared/Dialog";
import { Input } from "@/components/shared/Input";
import { Button } from "@/components/shared/Button";
import { createProject } from "@/lib/tauri";
import { useProjectStore } from "@/stores/project";

interface NewProjectDialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

/**
 * Modal form for creating a new ELVES project.
 * Collects a project name and filesystem path (via native folder picker),
 * then calls the Tauri `create_project` command and adds the result to the store.
 */
export function NewProjectDialog({
  isOpen,
  onClose,
}: NewProjectDialogProps): React.JSX.Element {
  const addProject = useProjectStore((state) => state.addProject);
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const resetForm = useCallback((): void => {
    setName("");
    setPath("");
    setError(null);
    setIsCreating(false);
  }, []);

  const handleClose = useCallback((): void => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleBrowse = useCallback(async (): Promise<void> => {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (selected) {
        setPath(selected as string);
      }
    } catch {
      /* User cancelled or dialog error — silently ignore */
    }
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent): Promise<void> => {
      event.preventDefault();
      setError(null);

      const trimmedName = name.trim();
      const trimmedPath = path.trim();

      if (!trimmedName) {
        setError("Project name is required.");
        return;
      }
      if (!trimmedPath) {
        setError("Project path is required.");
        return;
      }

      setIsCreating(true);
      try {
        const project = await createProject(trimmedName, trimmedPath);
        addProject(project);
        handleClose();
      } catch (createError: unknown) {
        const message =
          createError instanceof Error
            ? createError.message
            : String(createError);
        setError(message);
      } finally {
        setIsCreating(false);
      }
    },
    [name, path, addProject, handleClose],
  );

  return (
    <Dialog isOpen={isOpen} onClose={handleClose} title="New Project">
      <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
        <div>
          <label
            htmlFor="project-name"
            className="mb-1 block font-body text-sm text-label"
          >
            Name
          </label>
          <Input
            id="project-name"
            placeholder="My Awesome Project"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </div>

        <div>
          <label
            htmlFor="project-path"
            className="mb-1 block font-body text-sm text-label"
          >
            Path
          </label>
          <div className="flex gap-2">
            <Input
              id="project-path"
              placeholder="/Users/you/projects/my-app"
              value={path}
              onChange={(event) => setPath(event.target.value)}
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
          <p className="border-token-thin border-border bg-error/10 px-3 py-2 font-body text-sm font-bold text-error">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isCreating}>
            {isCreating ? "Creating..." : "Create"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
