/* File attachment UI — paperclip button, file chips, and drag-drop zone for the TaskBar. */

import { useCallback, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useAppStore } from "@/stores/app";
import { useToastStore } from "@/stores/toast";
import { readTextFromFile } from "@/lib/tauri";
import type { FileAttachment as FileAttachmentType } from "@/types/attachment";
import {
  MAX_TEXT_FILE_SIZE,
  IMAGE_EXTENSIONS,
  BINARY_EXTENSIONS,
} from "@/types/attachment";

/** Extract the file extension from a filename, lowercase, with leading dot. */
function getExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex === -1) return "";
  return filename.slice(dotIndex).toLowerCase();
}

/** Infer a MIME type from a file extension. Falls back to "application/octet-stream". */
function inferMimeType(extension: string): string {
  const mimeMap: Record<string, string> = {
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".ts": "text/typescript",
    ".tsx": "text/typescript",
    ".js": "text/javascript",
    ".jsx": "text/javascript",
    ".json": "application/json",
    ".html": "text/html",
    ".css": "text/css",
    ".py": "text/x-python",
    ".rs": "text/x-rust",
    ".toml": "text/x-toml",
    ".yaml": "text/x-yaml",
    ".yml": "text/x-yaml",
    ".xml": "text/xml",
    ".sh": "text/x-shellscript",
    ".sql": "text/x-sql",
    ".csv": "text/csv",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".bmp": "image/bmp",
  };
  return mimeMap[extension] ?? "application/octet-stream";
}

/** Format a byte count as a human-readable size string. */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/** Truncate a filename to maxLen characters, preserving the extension. */
function truncateFilename(name: string, maxLen: number): string {
  if (name.length <= maxLen) return name;
  const ext = getExtension(name);
  const base = name.slice(0, name.length - ext.length);
  const truncatedBase = base.slice(0, maxLen - ext.length - 1);
  return `${truncatedBase}\u2026${ext}`;
}

/**
 * Process a file path: validate, read content (for text files), and add to the store.
 * Shows toast errors for invalid files. Returns true on success.
 */
async function processAndAttachFile(filePath: string): Promise<boolean> {
  const addAttachedFile = useAppStore.getState().addAttachedFile;
  const addToast = useToastStore.getState().addToast;

  const name = filePath.split("/").pop() ?? filePath;
  const extension = getExtension(name);
  const mimeType = inferMimeType(extension);

  /* Reject known binary formats */
  if (BINARY_EXTENSIONS.includes(extension)) {
    addToast({
      message: `Cannot attach binary file: ${name}`,
      variant: "error",
      duration: 4000,
    });
    return false;
  }

  const isImage = IMAGE_EXTENSIONS.includes(extension);

  let content: string | null = null;
  let size = 0;

  if (isImage) {
    /* Images: store path only, no content read. Estimate size as 0 since we don't read. */
    size = 0;
  } else {
    /* Text file: read content and validate size */
    try {
      content = await readTextFromFile(filePath);
      size = new TextEncoder().encode(content).length;

      if (size > MAX_TEXT_FILE_SIZE) {
        addToast({
          message: `File too large: ${name} (${formatFileSize(size)}, max ${formatFileSize(MAX_TEXT_FILE_SIZE)})`,
          variant: "error",
          duration: 4000,
        });
        return false;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      addToast({
        message: `Failed to read file: ${name} — ${errorMessage}`,
        variant: "error",
        duration: 4000,
      });
      return false;
    }
  }

  const attachment: FileAttachmentType = {
    path: filePath,
    name,
    size,
    content,
    mimeType,
  };

  const validationError = addAttachedFile(attachment);
  if (validationError !== null) {
    addToast({
      message: validationError,
      variant: "warning",
      duration: 3000,
    });
    return false;
  }

  return true;
}

/**
 * Paperclip button that opens the native file picker.
 * Rendered inline in the TaskBar input row.
 */
export function AttachButton(): React.JSX.Element {
  const handleClick = useCallback(async (): Promise<void> => {
    const selected = await open({
      multiple: true,
      title: "Attach files to prompt",
    });

    if (selected === null) return;

    const paths = Array.isArray(selected) ? selected : [selected];
    for (const filePath of paths) {
      if (typeof filePath === "string") {
        await processAndAttachFile(filePath);
      }
    }
  }, []);

  return (
    <button
      onClick={() => void handleClick()}
      className="shrink-0 cursor-pointer border-[2px] border-border bg-surface-elevated p-1.5 font-display text-sm transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:bg-accent/20"
      title="Attach files (drag & drop also supported)"
      data-testid="attach-button"
    >
      {/* Paperclip icon (Unicode) */}
      {"\uD83D\uDCCE"}
    </button>
  );
}

/**
 * Renders attached file chips below the TaskBar input.
 * Each chip shows truncated filename, size, and a remove button.
 */
export function AttachedFileChips(): React.JSX.Element | null {
  const attachedFiles = useAppStore((s) => s.attachedFiles);
  const removeAttachedFile = useAppStore((s) => s.removeAttachedFile);

  if (attachedFiles.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5" data-testid="attached-files">
      {attachedFiles.map((file) => (
        <div
          key={file.path}
          className="flex items-center gap-1.5 border-[2px] border-border bg-surface-elevated px-2 py-0.5 shadow-[2px_2px_0px_0px_#000] transition-all duration-100"
          data-testid="attached-file-chip"
        >
          {/* File type indicator */}
          <span className="text-[10px]">
            {file.content === null ? "\uD83D\uDDBC" : "\uD83D\uDCC4"}
          </span>

          {/* Filename, truncated */}
          <span className="max-w-[140px] truncate font-mono text-[11px] font-bold leading-tight">
            {truncateFilename(file.name, 20)}
          </span>

          {/* File size */}
          {file.size > 0 && (
            <span className="font-mono text-[9px] text-text-light/50">
              {formatFileSize(file.size)}
            </span>
          )}

          {/* Remove button */}
          <button
            onClick={() => removeAttachedFile(file.path)}
            className="cursor-pointer text-[10px] font-bold text-text-light/40 transition-colors duration-75 hover:text-error"
            title={`Remove ${file.name}`}
            data-testid="remove-attachment"
          >
            {"\u2715"}
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * Handle drag-and-drop file events on the TaskBar container.
 * Returns event handlers to spread on the container element.
 */
export function useFileDragDrop(): {
  isDragOver: boolean;
  dragHandlers: {
    onDragOver: (event: React.DragEvent) => void;
    onDragEnter: (event: React.DragEvent) => void;
    onDragLeave: (event: React.DragEvent) => void;
    onDrop: (event: React.DragEvent) => void;
  };
} {
  const [isDragOver, setIsDragOver] = useState(false);

  const onDragOver = useCallback((event: React.DragEvent): void => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const onDragEnter = useCallback((event: React.DragEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback((event: React.DragEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    /* Only hide overlay when leaving the container, not entering a child */
    const relatedTarget = event.relatedTarget as Node | null;
    const currentTarget = event.currentTarget as Node;
    if (relatedTarget === null || !currentTarget.contains(relatedTarget)) {
      setIsDragOver(false);
    }
  }, []);

  const onDrop = useCallback((event: React.DragEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);

    const files = event.dataTransfer.files;
    if (files.length === 0) return;

    /* Tauri drag-drop provides file paths via dataTransfer */
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file !== undefined) {
        /* In Tauri, File objects from drag-drop have a `path` property */
        const filePath = (file as File & { path?: string }).path;
        if (filePath) {
          void processAndAttachFile(filePath);
        }
      }
    }
  }, []);

  return {
    isDragOver,
    dragHandlers: { onDragOver, onDragEnter, onDragLeave, onDrop },
  };
}

/**
 * Build the augmented prompt text with attached file contents.
 * Text files are wrapped in <attached_file> tags. Images are referenced by path.
 */
export function buildAugmentedPrompt(
  taskText: string,
  attachedFiles: readonly FileAttachmentType[],
): string {
  if (attachedFiles.length === 0) return taskText;

  const fileBlocks = attachedFiles.map((file) => {
    if (file.content !== null) {
      return `<attached_file name="${file.name}">\n${file.content}\n</attached_file>`;
    }
    return `<attached_file name="${file.name}" type="image" path="${file.path}" />`;
  });

  return `${fileBlocks.join("\n\n")}\n\n${taskText}`;
}
