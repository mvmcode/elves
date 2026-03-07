/* SkillCatalog — flat skill catalog with unified search across curated repos and GitHub. */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useSkillStore } from "@/stores/skills";
import { useSkillActions } from "@/hooks/useSkillActions";
import { searchGithubCatalog } from "@/lib/tauri";
import { Button } from "@/components/shared/Button";
import { Badge } from "@/components/shared/Badge";
import { EmptyState } from "@/components/shared/EmptyState";
import type { CatalogSkillItem, RemoteSkillResult } from "@/types/skill-registry";

/**
 * Flat catalog view — displays all skills from curated repos as a searchable list.
 * Unified search bar filters catalog items instantly and queries GitHub on Enter.
 */
export function SkillCatalog(): React.JSX.Element {
  const catalogItems = useSkillStore((s) => s.catalogItems);
  const isRefreshing = useSkillStore((s) => s.isRefreshingCatalog);
  const catalogSearchQuery = useSkillStore((s) => s.catalogSearchQuery);
  const setCatalogSearchQuery = useSkillStore((s) => s.setCatalogSearchQuery);
  const catalogCategoryFilter = useSkillStore((s) => s.catalogCategoryFilter);
  const setCatalogCategoryFilter = useSkillStore((s) => s.setCatalogCategoryFilter);

  const { handleRefreshCatalog, handleLoadCatalog, handlePreviewSkill, handleInstallSkill } = useSkillActions();

  const [githubResults, setGithubResults] = useState<RemoteSkillResult[]>([]);
  const [isSearchingGithub, setIsSearchingGithub] = useState(false);
  const [installingIds, setInstallingIds] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void handleLoadCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const item of catalogItems) {
      if (item.category) cats.add(item.category);
    }
    return Array.from(cats).sort();
  }, [catalogItems]);

  const filteredItems = useMemo(() => {
    let items = [...catalogItems];
    if (catalogCategoryFilter) {
      items = items.filter((i) => i.category === catalogCategoryFilter);
    }
    if (catalogSearchQuery.trim()) {
      const q = catalogSearchQuery.toLowerCase();
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.description?.toLowerCase().includes(q) ?? false) ||
          (i.category?.toLowerCase().includes(q) ?? false),
      );
    }
    return items;
  }, [catalogItems, catalogSearchQuery, catalogCategoryFilter]);

  const searchGithub = useCallback(async (query: string): Promise<void> => {
    if (!query.trim()) {
      setGithubResults([]);
      return;
    }
    setIsSearchingGithub(true);
    try {
      const results = await searchGithubCatalog(query);
      setGithubResults(results);
    } catch (err) {
      console.error("GitHub search failed:", err);
      setGithubResults([]);
    } finally {
      setIsSearchingGithub(false);
    }
  }, []);

  const handleSearchChange = useCallback(
    (value: string): void => {
      setCatalogSearchQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (value.trim()) {
        debounceRef.current = setTimeout(() => void searchGithub(value), 800);
      } else {
        setGithubResults([]);
      }
    },
    [setCatalogSearchQuery, searchGithub],
  );

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>): void => {
      if (e.key === "Enter") {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        void searchGithub(catalogSearchQuery);
      }
      if (e.key === "Escape") {
        setCatalogSearchQuery("");
        setGithubResults([]);
      }
    },
    [catalogSearchQuery, searchGithub, setCatalogSearchQuery],
  );

  const handleInstall = useCallback(
    async (item: CatalogSkillItem): Promise<void> => {
      setInstallingIds((prev) => new Set(prev).add(item.id));
      try {
        await handleInstallSkill(item.id);
      } finally {
        setInstallingIds((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
      }
    },
    [handleInstallSkill],
  );

  const hasSearch = catalogSearchQuery.trim().length > 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b-token-normal border-border p-4">
        <h2 className="font-display text-xl font-bold text-heading tracking-tight">Skill Catalog</h2>
        <Button
          variant="secondary"
          className="px-3 py-1 text-xs"
          onClick={() => void handleRefreshCatalog()}
          disabled={isRefreshing}
        >
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {/* Unified search bar */}
      <div className="flex items-center gap-3 border-b-token-thin border-border/40 px-4 py-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={catalogSearchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="w-full border-token-thin border-border bg-surface-elevated rounded-token-md px-3 py-2 pr-8 font-body text-sm outline-none focus:focus-ring"
            placeholder="Search skills across catalog and GitHub..."
          />
          {hasSearch && (
            <button
              onClick={() => {
                setCatalogSearchQuery("");
                setGithubResults([]);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 font-body text-sm text-text-light/40 hover:text-text-light"
              title="Clear search"
            >
              x
            </button>
          )}
        </div>
      </div>

      {/* Category chips */}
      {allCategories.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap border-b-token-thin border-border/40 px-4 py-2">
          <button
            onClick={() => setCatalogCategoryFilter(null)}
            className={[
              "px-2 py-1 font-body text-xs font-bold border-[2px] border-border rounded-token-sm transition-all duration-100",
              catalogCategoryFilter === null
                ? "bg-accent text-black"
                : "bg-surface-elevated text-text-light hover:bg-accent-light",
            ].join(" ")}
          >
            All
          </button>
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCatalogCategoryFilter(catalogCategoryFilter === cat ? null : cat)}
              className={[
                "px-2 py-1 font-body text-xs font-bold border-[2px] border-border rounded-token-sm transition-all duration-100",
                catalogCategoryFilter === cat
                  ? "bg-accent text-black"
                  : "bg-surface-elevated text-text-light hover:bg-accent-light",
              ].join(" ")}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4">
        {catalogItems.length === 0 && !hasSearch ? (
          <EmptyState
            message="No skills loaded"
            submessage="Click Refresh to load skills from curated repositories."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {filteredItems.length > 0 && (
              <div>
                {hasSearch && (
                  <p className="mb-2 font-body text-xs font-bold text-text-light/40 uppercase tracking-wide">
                    Catalog ({filteredItems.length})
                  </p>
                )}
                <div className="flex flex-col gap-2">
                  {filteredItems.map((item) => (
                    <CatalogSkillCard
                      key={item.id}
                      item={item}
                      isInstalling={installingIds.has(item.id)}
                      onPreview={() => void handlePreviewSkill(item.sourceRepoName, item.filePath)}
                      onInstall={() => void handleInstall(item)}
                    />
                  ))}
                </div>
              </div>
            )}

            {hasSearch && filteredItems.length === 0 && (
              <p className="font-body text-sm text-text-light/40">No catalog matches for &ldquo;{catalogSearchQuery}&rdquo;</p>
            )}

            {hasSearch && (
              <div>
                <p className="mb-2 font-body text-xs font-bold text-text-light/40 uppercase tracking-wide">
                  From GitHub {isSearchingGithub && "(searching...)"}
                </p>
                {githubResults.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {githubResults.map((result) => (
                      <button
                        key={result.repoUrl}
                        onClick={() => void openUrl(result.repoUrl)}
                        className={[
                          "flex flex-col gap-1 border-[2px] border-border/60 bg-white p-3 text-left",
                          "transition-all duration-100 cursor-pointer",
                          "hover:translate-x-[1px] hover:translate-y-[1px] hover:border-border",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-body text-sm font-bold truncate">{result.name}</p>
                          <div className="flex items-center gap-2 shrink-0">
                            {result.stars > 0 && (
                              <span className="font-mono text-xs text-text-light/50">{result.stars.toLocaleString()} ★</span>
                            )}
                            {result.author && (
                              <span className="font-body text-xs text-info">{result.author}</span>
                            )}
                          </div>
                        </div>
                        {result.description && (
                          <p className="font-body text-xs text-text-light/60 line-clamp-2">{result.description}</p>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  !isSearchingGithub && (
                    <p className="font-body text-xs text-text-light/30">No GitHub results</p>
                  )
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CatalogSkillCard({
  item,
  isInstalling,
  onPreview,
  onInstall,
}: {
  readonly item: CatalogSkillItem;
  readonly isInstalling: boolean;
  readonly onPreview: () => void;
  readonly onInstall: () => void;
}): React.JSX.Element {
  return (
    <div
      className={[
        "flex items-center gap-3 border-[2px] border-border bg-white p-3",
        "transition-all duration-100",
      ].join(" ")}
      style={{ boxShadow: "3px 3px 0px 0px #000" }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-body text-sm font-bold truncate">{item.name}</p>
          {item.category && (
            <Badge variant="default" className="text-[10px] px-1.5 py-0 shrink-0">{item.category}</Badge>
          )}
        </div>
        <p className="mt-0.5 font-body text-xs text-text-light/60 line-clamp-1">
          {item.description ?? "No description"}
        </p>
        <p className="mt-0.5 font-body text-xs text-text-light/30">
          from {item.sourceRepoName}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onPreview}
          className="px-2 py-1 font-body text-xs font-bold border-[2px] border-border rounded-token-sm bg-surface-elevated text-text-light hover:bg-accent-light transition-all duration-100"
        >
          Preview
        </button>
        <Button
          variant="primary"
          className="px-3 py-1 text-xs"
          onClick={onInstall}
          disabled={isInstalling}
        >
          {isInstalling ? "Installing..." : "Install"}
        </Button>
      </div>
    </div>
  );
}
