/* Template types — saved task plans for reuse. */

import type { TaskPlan } from "./session";

/** A saved task template with a pre-configured plan. */
export interface Template {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly plan: TaskPlan;
  readonly builtIn: boolean;
  readonly createdAt: number;
}

/** Parameters for saving a plan as a template. */
export interface NewTemplate {
  readonly name: string;
  readonly description?: string;
  readonly plan: TaskPlan;
}
