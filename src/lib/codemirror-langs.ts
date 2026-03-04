/* CodeMirror language extension mapper — resolves file extensions to syntax highlighting. */

import type { Extension } from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { rust } from "@codemirror/lang-rust";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { css } from "@codemirror/lang-css";
import { python } from "@codemirror/lang-python";
import { html } from "@codemirror/lang-html";

/** Map of file extensions to CodeMirror language extension factories. */
const EXTENSION_MAP: Record<string, () => Extension> = {
  ts: () => javascript({ typescript: true, jsx: false }),
  tsx: () => javascript({ typescript: true, jsx: true }),
  js: () => javascript({ jsx: false }),
  jsx: () => javascript({ jsx: true }),
  mjs: () => javascript({ jsx: false }),
  cjs: () => javascript({ jsx: false }),
  rs: () => rust(),
  json: () => json(),
  jsonc: () => json(),
  md: () => markdown(),
  mdx: () => markdown(),
  css: () => css(),
  py: () => python(),
  html: () => html(),
  htm: () => html(),
};

/** Returns CodeMirror language extensions for a given file path.
 *  Returns an empty array for unrecognized file types (plain text). */
export function getLanguageExtension(filePath: string): Extension[] {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const factory = EXTENSION_MAP[ext];
  return factory ? [factory()] : [];
}
