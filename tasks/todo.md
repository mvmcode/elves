# Split Pane Layout — Files + Workspace Side-by-Side

## Steps
- [x] 1. UI Store: Add `splitPaneMode` ("split"|"files-only"|"workspace-only") and `splitPaneRatio` state
- [x] 2. Create `SplitPaneLayout.tsx` — resizable split with drag divider, collapse buttons, display:none preservation
- [x] 3. Shell.tsx: Replace `<FileExplorerView />` with `<SplitPaneLayout />` when `activeView === "files"`
- [x] 4. Add split-pane mode toggle in the layout (toolbar above panels)
- [x] 5. Verify build compiles, no TypeScript errors
- [x] 6. Code review — fixed: memory leak on unmount, wider divider hit target, ARIA attributes, stable callbacks, consistent store access

## Notes
- Use `SplitPaneMode` union type, not multiple booleans
- `display: none` for collapsed panels (preserve xterm buffers)
- Min widths: 250px left, 300px right
- Drag pattern: inline mousedown/mousemove/mouseup (matches BottomTerminalPanel)
- Neo-brutalist divider: 3px borders, #FFD93D on hover/drag
