/* Project types — represents a MINIONS project with its configuration and metadata. */

import type { Runtime } from "./minion";

/** A MINIONS project pointing to a local directory */
export interface Project {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly defaultRuntime: Runtime;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly settings: ProjectSettings;
}

/** Per-project configuration overrides */
export interface ProjectSettings {
  readonly maxMinions?: number;
  readonly autoDeploySimple?: boolean;
  readonly memoryEnabled?: boolean;
}
