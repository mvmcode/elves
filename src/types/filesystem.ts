/* Filesystem types — file entries and git status for the file explorer. */

/** A single file or directory entry from the Rust backend. */
export interface FileEntry {
  readonly name: string;
  readonly path: string;
  readonly isDir: boolean;
  readonly isSymlink: boolean;
  readonly size: number | null;
  readonly extension: string | null;
}

/** Git status codes from `git status --porcelain=v1`. */
export type GitStatusCode = string;
