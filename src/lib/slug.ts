/* Workspace slug generator — creates short, human-readable identifiers from task descriptions. */

/** Common stop words to strip when generating a workspace slug. */
const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "shall",
  "should", "may", "might", "must", "can", "could", "to", "of", "in",
  "for", "on", "with", "at", "by", "from", "as", "into", "through",
  "during", "before", "after", "above", "below", "and", "but", "or",
  "nor", "not", "so", "yet", "both", "either", "neither", "each",
  "every", "all", "any", "few", "more", "most", "other", "some", "such",
  "no", "only", "own", "same", "than", "too", "very", "just", "because",
  "it", "its", "this", "that", "these", "those", "i", "me", "my", "we",
  "our", "you", "your", "he", "him", "his", "she", "her", "they", "them",
]);

/**
 * Generate a workspace slug from a task description.
 *
 * Takes the first 3-4 meaningful words (skipping stop words), lowercases,
 * strips non-alphanumeric characters, joins with hyphens, and appends a
 * 4-character random suffix. Max 40 characters total.
 *
 * @example generateWorkspaceSlug("Fix the login button styling") → "fix-login-button-a3f2"
 */
export function generateWorkspaceSlug(task: string): string {
  const words = task
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 0 && !STOP_WORDS.has(word));

  const meaningful = words.slice(0, 4);

  if (meaningful.length === 0) {
    meaningful.push("task");
  }

  const suffix = Math.random().toString(36).slice(2, 6);
  const slug = `${meaningful.join("-")}-${suffix}`;

  return slug.slice(0, 40);
}
