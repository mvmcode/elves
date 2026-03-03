/* File attachment types — attached files included with task prompts. */

/** A file attached to a task prompt before deployment. */
export interface FileAttachment {
  /** Absolute filesystem path to the attached file. */
  readonly path: string;
  /** Display name (basename) of the file. */
  readonly name: string;
  /** File size in bytes. */
  readonly size: number;
  /** Text content of the file, or null for binary/image files (path-only injection). */
  readonly content: string | null;
  /** MIME type string (e.g. "text/plain", "image/png"). */
  readonly mimeType: string;
}

/** Maximum number of files that can be attached to a single prompt. */
export const MAX_ATTACHED_FILES = 5;

/** Maximum size in bytes for a single text file attachment (100KB). */
export const MAX_TEXT_FILE_SIZE = 100 * 1024;

/** Maximum total size in bytes across all attachments (500KB). */
export const MAX_TOTAL_ATTACHMENT_SIZE = 500 * 1024;

/** File extensions treated as images (stored path-only, no content read). */
export const IMAGE_EXTENSIONS: readonly string[] = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".ico",
  ".bmp",
];

/** File extensions known to be binary (rejected with toast). */
export const BINARY_EXTENSIONS: readonly string[] = [
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bin",
  ".zip",
  ".tar",
  ".gz",
  ".7z",
  ".rar",
  ".pdf",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".mp3",
  ".mp4",
  ".mov",
  ".avi",
  ".mkv",
  ".wav",
  ".flac",
  ".o",
  ".a",
  ".class",
  ".pyc",
];
