/* SkillPreviewModal — overlay modal showing raw content preview of a catalog skill file. */

import { useSkillStore } from "@/stores/skills";
import { MarkdownLite } from "@/lib/markdown-lite";
import { Button } from "@/components/shared/Button";

/**
 * Full-screen overlay that displays the raw content of a catalog skill.
 * Rendered when previewContent is non-null in the skill store.
 */
export function SkillPreviewModal(): React.JSX.Element {
  const previewContent = useSkillStore((s) => s.previewContent);
  const setPreviewContent = useSkillStore((s) => s.setPreviewContent);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={() => setPreviewContent(null)}
    >
      <div
        className="relative mx-4 flex max-h-[80vh] w-full max-w-2xl flex-col border-[3px] border-border bg-white"
        style={{ boxShadow: "8px 8px 0px 0px #000" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b-token-normal border-border p-4">
          <h3 className="font-display text-lg font-bold text-heading">Skill Preview</h3>
          <Button variant="secondary" className="px-3 py-1 text-xs" onClick={() => setPreviewContent(null)}>
            Close
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {previewContent ? (
            <MarkdownLite text={previewContent} />
          ) : (
            <p className="font-body text-sm text-text-light/40">No content to preview.</p>
          )}
        </div>
      </div>
    </div>
  );
}
