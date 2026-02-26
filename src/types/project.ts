/* Project types — represents an ELVES project with its configuration and metadata. */

import type { Runtime } from "./elf";

/** An ELVES project pointing to a local directory */
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
  readonly maxElves?: number;
  readonly autoDeploySimple?: boolean;
  readonly memoryEnabled?: boolean;
}
