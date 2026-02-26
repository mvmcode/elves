/* Funny copy engine — provides humorous messages for empty states, loading, and errors. */

/** Contexts where empty states can appear throughout the app. */
export type EmptyContext =
  | "no-projects"
  | "no-sessions"
  | "no-memory"
  | "no-skills"
  | "no-mcp"
  | "no-templates"
  | "loading-app"
  | "deploying"
  | "analyzing-task"
  | "extracting-memory"
  | "runtime-not-found";

/** Shape of an empty state message with title, subtitle, and emoji. */
export interface EmptyStateMessage {
  readonly title: string;
  readonly subtitle: string;
  readonly emoji: string;
}

/** Loading phases the app can be in. */
export type LoadingPhase =
  | "app-init"
  | "project-load"
  | "session-start"
  | "agent-spawn"
  | "memory-fetch"
  | "memory-extract"
  | "task-analyze";

const EMPTY_STATE_POOLS: Record<EmptyContext, readonly EmptyStateMessage[]> = {
  "no-projects": [
    { title: "The workshop is empty!", subtitle: "Create a project and put these elves to work.", emoji: "🏚️" },
    { title: "No projects yet!", subtitle: "The elves are getting restless without something to build.", emoji: "🧝" },
    { title: "A blank canvas!", subtitle: "Every masterpiece starts with an empty workshop.", emoji: "🎨" },
  ],
  "no-sessions": [
    { title: "No sessions running", subtitle: "Deploy some elves and watch the magic happen.", emoji: "💤" },
    { title: "The workshop floor is quiet", subtitle: "Start a session to hear the hammers ring.", emoji: "🔨" },
    { title: "All clear on the workshop floor", subtitle: "Give the elves a task and they'll get right to it.", emoji: "✨" },
  ],
  "no-memory": [
    { title: "No memories stored yet", subtitle: "Elves learn as they work. Start a session to build knowledge.", emoji: "🧠" },
    { title: "The memory vault is empty", subtitle: "Every project starts with a clean slate.", emoji: "📦" },
    { title: "Nothing remembered yet", subtitle: "The elves haven't had a chance to learn. Let them explore!", emoji: "🗃️" },
  ],
  "no-skills": [
    { title: "No skills configured", subtitle: "Add custom skills to teach your elves new tricks.", emoji: "📜" },
    { title: "The skill library is bare", subtitle: "Skills let elves follow your team's conventions.", emoji: "📚" },
    { title: "No skills yet!", subtitle: "Create reusable instructions your elves can learn.", emoji: "🎓" },
  ],
  "no-mcp": [
    { title: "No MCP servers connected", subtitle: "Connect MCP servers to give elves superpowers.", emoji: "🔌" },
    { title: "The toolbox is empty", subtitle: "Add MCP servers so elves can use external tools.", emoji: "🧰" },
    { title: "No servers configured", subtitle: "MCP servers extend what your elves can do.", emoji: "🌐" },
  ],
  "no-templates": [
    { title: "No templates saved", subtitle: "Save project configurations as reusable templates.", emoji: "📋" },
    { title: "Template library is empty", subtitle: "Create templates to bootstrap new projects faster.", emoji: "🗂️" },
    { title: "No templates yet!", subtitle: "Templates help you spin up new projects in seconds.", emoji: "⚡" },
  ],
  "loading-app": [
    { title: "Warming up the workshop", subtitle: "The elves are stretching and grabbing their tools...", emoji: "🔥" },
    { title: "Lighting the furnace", subtitle: "Almost ready — just polishing the workbenches...", emoji: "🕯️" },
    { title: "Opening the workshop doors", subtitle: "The elves are filing in and finding their stations...", emoji: "🚪" },
  ],
  deploying: [
    { title: "Deploying elves", subtitle: "Assigning pointy hats and distributing hammers...", emoji: "🎩" },
    { title: "Sending in the team", subtitle: "Briefing the elves on the mission parameters...", emoji: "📡" },
    { title: "Workshop deployment in progress", subtitle: "The elves are rushing to their workbenches!", emoji: "🏃" },
  ],
  "analyzing-task": [
    { title: "Analyzing your request", subtitle: "The lead elf is reading the blueprints...", emoji: "🔍" },
    { title: "Breaking down the task", subtitle: "Figuring out how many elves this job needs...", emoji: "📐" },
    { title: "Consulting the plans", subtitle: "The architect elf is sketching the approach...", emoji: "📝" },
  ],
  "extracting-memory": [
    { title: "Learning from this session", subtitle: "The archivist elf is taking notes...", emoji: "📖" },
    { title: "Saving what we learned", subtitle: "Committing knowledge to the workshop library...", emoji: "💾" },
    { title: "Extracting memories", subtitle: "The elves are documenting their discoveries...", emoji: "🗒️" },
  ],
  "runtime-not-found": [
    { title: "Runtime not found!", subtitle: "The elf tried to start their workbench but it's missing.", emoji: "🚫" },
    { title: "Missing tools!", subtitle: "Install Claude Code or Codex CLI to continue.", emoji: "🔧" },
    { title: "Can't find the engine", subtitle: "Check that your runtime is installed and in your PATH.", emoji: "⚠️" },
  ],
};

const LOADING_MESSAGES: Record<LoadingPhase, readonly string[]> = {
  "app-init": [
    "Booting up the workshop...",
    "Dusting off the workbenches...",
    "Polishing the tools...",
  ],
  "project-load": [
    "Loading project files...",
    "Reading the blueprints...",
    "Unpacking the project...",
  ],
  "session-start": [
    "Starting a fresh session...",
    "Setting up the workshop floor...",
    "Preparing the workstations...",
  ],
  "agent-spawn": [
    "Waking up the elves...",
    "Handing out assignments...",
    "The elves are grabbing their tools...",
  ],
  "memory-fetch": [
    "Searching the archives...",
    "Consulting past sessions...",
    "Loading workshop knowledge...",
  ],
  "memory-extract": [
    "The archivist is scribbling notes...",
    "Saving today's lessons...",
    "Filing memories in the vault...",
  ],
  "task-analyze": [
    "Examining the blueprints...",
    "The lead elf is thinking hard...",
    "Counting hammers and nails...",
  ],
};

const ERROR_MESSAGES: readonly string[] = [
  "Oops! An elf tripped over a cable.",
  "Something went sideways in the workshop.",
  "The gears jammed — give it another try.",
  "A mischievous sprite caused trouble.",
  "Workshop malfunction! The elves are investigating.",
  "Unexpected turbulence in the workshop!",
];

/**
 * Returns a random funny empty state message for the given context.
 * Each call may return a different message from the pool.
 */
export function getEmptyState(context: EmptyContext): EmptyStateMessage {
  const pool = EMPTY_STATE_POOLS[context];
  const index = Math.floor(Math.random() * pool.length);
  return pool[index]!;
}

/**
 * Returns a random funny loading message for the given phase.
 */
export function getLoadingMessage(phase: LoadingPhase): string {
  const pool = LOADING_MESSAGES[phase];
  const index = Math.floor(Math.random() * pool.length);
  return pool[index]!;
}

/**
 * Returns a random funny error message, optionally appending the actual error detail.
 * @param error - Optional error detail to append in parentheses
 */
export function getErrorMessage(error?: string): string {
  const index = Math.floor(Math.random() * ERROR_MESSAGES.length);
  const base = ERROR_MESSAGES[index]!;
  return error ? `${base} (${error})` : base;
}
