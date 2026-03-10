/* McpCatalog — curated MCP server catalog with instant filtering and npm search fallback. */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useMcpStore } from "@/stores/mcp";
import { useMcpActions } from "@/hooks/useMcpActions";
import { Button } from "@/components/shared/Button";
import { Badge } from "@/components/shared/Badge";
import { EmptyState } from "@/components/shared/EmptyState";
import type { McpCatalogItem } from "@/types/mcp";
import type { McpSearchResult } from "@/types/search";

/**
 * Catalog view for MCP servers — pre-loaded curated list with instant local filtering,
 * category chips, and debounced npm search as a remote fallback.
 */
export function McpCatalog(): React.JSX.Element {
  const catalogItems = useMcpStore((s) => s.catalogItems);
  const catalogSearchQuery = useMcpStore((s) => s.catalogSearchQuery);
  const setCatalogSearchQuery = useMcpStore((s) => s.setCatalogSearchQuery);
  const catalogCategoryFilter = useMcpStore((s) => s.catalogCategoryFilter);
  const setCatalogCategoryFilter = useMcpStore((s) => s.setCatalogCategoryFilter);
  const servers = useMcpStore((s) => s.servers);

  const { handleLoadCatalog, handleSearch, handleInstallFromSearch } = useMcpActions();

  const searchResults = useMcpStore((s) => s.searchResults);
  const isSearching = useMcpStore((s) => s.isSearching);

  const [installingIds, setInstallingIds] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Load catalog on mount. */
  useEffect(() => {
    void handleLoadCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Derive installed server names for dedup. */
  const installedNames = useMemo(() => {
    const names = new Set<string>();
    for (const server of servers) {
      names.add(server.name.toLowerCase());
    }
    return names;
  }, [servers]);

  /** Extract unique categories from catalog items. */
  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const item of catalogItems) {
      if (item.category) cats.add(item.category);
    }
    return Array.from(cats).sort();
  }, [catalogItems]);

  /** Instant local filter on catalog items by name/description/category. */
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
          i.description.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q),
      );
    }
    return items;
  }, [catalogItems, catalogSearchQuery, catalogCategoryFilter]);

  /** Debounced npm search — fires 800ms after typing stops. */
  const handleSearchChange = useCallback(
    (value: string): void => {
      setCatalogSearchQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (value.trim()) {
        debounceRef.current = setTimeout(() => void handleSearch(value), 800);
      }
    },
    [setCatalogSearchQuery, handleSearch],
  );

  const handleSearchKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>): void => {
      if (event.key === "Enter") {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        void handleSearch(catalogSearchQuery);
      }
      if (event.key === "Escape") {
        setCatalogSearchQuery("");
      }
    },
    [catalogSearchQuery, handleSearch, setCatalogSearchQuery],
  );

  /** Install a catalog item by constructing a McpSearchResult and calling the existing handler. */
  const handleInstallCatalogItem = useCallback(
    async (item: McpCatalogItem): Promise<void> => {
      setInstallingIds((prev) => new Set(prev).add(item.id));
      try {
        const searchResult: McpSearchResult = {
          name: item.name,
          description: item.description,
          command: item.command,
          args: item.args,
          sourceUrl: item.sourceUrl,
          author: null,
          downloads: null,
        };
        await handleInstallFromSearch(searchResult);
      } finally {
        setInstallingIds((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
      }
    },
    [handleInstallFromSearch],
  );

  /** Install a npm search result. */
  const handleInstallNpmResult = useCallback(
    async (result: McpSearchResult): Promise<void> => {
      const key = result.name;
      setInstallingIds((prev) => new Set(prev).add(key));
      try {
        await handleInstallFromSearch(result);
      } finally {
        setInstallingIds((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [handleInstallFromSearch],
  );

  const isItemInstalled = useCallback(
    (name: string): boolean => installedNames.has(name.toLowerCase()),
    [installedNames],
  );

  const hasSearch = catalogSearchQuery.trim().length > 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden" data-testid="mcp-catalog">
      {/* Search bar */}
      <div className="flex items-center gap-3 border-b-token-thin border-border/40 px-4 py-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={catalogSearchQuery}
            onChange={(event) => handleSearchChange(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="w-full border-token-thin border-border bg-surface-elevated rounded-token-md px-3 py-2 pr-8 font-body text-sm outline-none focus:focus-ring"
            placeholder="Search MCP servers across catalog and npm..."
            data-testid="mcp-catalog-search"
          />
          {hasSearch && (
            <button
              onClick={() => setCatalogSearchQuery("")}
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
        <div
          className="flex items-center gap-1 flex-wrap border-b-token-thin border-border/40 px-4 py-2"
          data-testid="mcp-catalog-categories"
        >
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
              data-testid="mcp-catalog-category-chip"
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
            message="No catalog items loaded"
            submessage="The catalog could not be loaded. Try reloading the app."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {/* Catalog results */}
            {filteredItems.length > 0 && (
              <div>
                <p className="mb-2 font-body text-xs font-bold text-text-light/40 uppercase tracking-wide">
                  Catalog ({filteredItems.length})
                </p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {filteredItems.map((item) => {
                    const installed = isItemInstalled(item.name);
                    return (
                      <div
                        key={item.id}
                        className={[
                          "flex flex-col border-[2px] border-border bg-white p-3",
                          "transition-all duration-100",
                          installed ? "opacity-60" : "",
                        ].join(" ")}
                        style={{ boxShadow: "3px 3px 0px 0px #000" }}
                        data-testid="mcp-catalog-item"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-body text-sm font-bold truncate">{item.name}</p>
                          <Badge variant="default" className="text-[10px] px-1.5 py-0 shrink-0">
                            {item.category}
                          </Badge>
                        </div>
                        <p className="mb-2 font-body text-xs text-text-light/60 line-clamp-2">
                          {item.description}
                        </p>
                        {item.envKeys.length > 0 && (
                          <div className="mb-2 flex flex-wrap gap-1">
                            {item.envKeys.map((key) => (
                              <span
                                key={key}
                                className="font-mono text-[10px] text-text-light/40 bg-surface-muted px-1.5 py-0.5 border border-border/40 rounded-token-sm"
                              >
                                {key}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="mt-auto flex items-center gap-2">
                          {item.sourceUrl && (
                            <a
                              href={item.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-body text-[10px] text-info hover:underline truncate"
                            >
                              Source
                            </a>
                          )}
                          <Button
                            variant={installed ? "secondary" : "primary"}
                            className="ml-auto px-3 py-1 text-xs"
                            onClick={() => void handleInstallCatalogItem(item)}
                            disabled={installed || installingIds.has(item.id)}
                            data-testid="mcp-catalog-install"
                          >
                            {installingIds.has(item.id) ? "Installing..." : installed ? "Installed" : "Install"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {hasSearch && filteredItems.length === 0 && (
              <p className="font-body text-sm text-text-light/40">
                No catalog matches for &ldquo;{catalogSearchQuery}&rdquo;
              </p>
            )}

            {/* npm search results */}
            {hasSearch && (
              <div>
                <p className="mb-2 font-body text-xs font-bold text-text-light/40 uppercase tracking-wide">
                  From npm {isSearching && "(searching...)"}
                </p>
                {searchResults.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {searchResults.map((result) => {
                      const installed = isItemInstalled(result.name);
                      return (
                        <div
                          key={`${result.name}-${result.command}`}
                          className={[
                            "flex flex-col border-[2px] border-border/60 bg-white p-3",
                            "transition-all duration-100",
                            installed ? "opacity-60" : "",
                          ].join(" ")}
                          style={{ boxShadow: "2px 2px 0px 0px rgba(0,0,0,0.3)" }}
                          data-testid="mcp-npm-result"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-body text-sm font-bold truncate">{result.name}</p>
                            {result.author && (
                              <span className="font-body text-xs text-info shrink-0">{result.author}</span>
                            )}
                          </div>
                          <p className="mb-2 font-body text-xs text-text-light/60 line-clamp-2">
                            {result.description}
                          </p>
                          <Button
                            variant={installed ? "secondary" : "primary"}
                            className="mt-auto w-full text-xs"
                            onClick={() => void handleInstallNpmResult(result)}
                            disabled={installed || installingIds.has(result.name)}
                          >
                            {installingIds.has(result.name) ? "Installing..." : installed ? "Installed" : "Install"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  !isSearching && (
                    <p className="font-body text-xs text-text-light/30">No npm results</p>
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
