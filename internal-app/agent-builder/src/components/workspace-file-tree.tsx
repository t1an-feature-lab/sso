"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import {
  ChevronRightIcon,
  DocumentTextIcon,
  FolderIcon,
} from "@heroicons/react/24/outline";
import { apiClient } from "@/lib/api-client";
import type { ProjectFile, WorkspaceEntry } from "@/lib/types";

const ROW_HEIGHT = 28;
const OVERSCAN = 8;

type TreeRow = {
  key: string;
  entry: WorkspaceEntry;
  depth: number;
  expanded: boolean;
  loading: boolean;
};

export function WorkspaceFileTree({
  projectId,
  revision,
  query,
  selectedPath,
  onOpenFile,
}: {
  projectId: string;
  revision: string;
  query: string;
  selectedPath: string;
  onOpenFile: (file: ProjectFile) => void;
}) {
  const [childrenByDir, setChildrenByDir] = useState<
    Record<string, WorkspaceEntry[]>
  >({});
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [loadingDirs, setLoadingDirs] = useState<Set<string>>(() => new Set());
  const [searchEntries, setSearchEntries] = useState<WorkspaceEntry[]>([]);
  const [searchTruncated, setSearchTruncated] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(320);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const requestSeq = useRef(0);

  const loadDir = useCallback(
    async (dir: string) => {
      setLoadingDirs((prev) => new Set(prev).add(dir));
      try {
        const { entries } = await apiClient.listWorkspaceEntries(projectId, dir);
        setChildrenByDir((prev) => ({ ...prev, [dir]: entries }));
        setError("");
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "读取目录失败");
      } finally {
        setLoadingDirs((prev) => {
          const next = new Set(prev);
          next.delete(dir);
          return next;
        });
      }
    },
    [projectId]
  );

  useEffect(() => {
    let cancelled = false;
    setChildrenByDir({});
    setExpanded(new Set());
    setSearchEntries([]);
    setError("");
    void apiClient
      .listWorkspaceEntries(projectId, "")
      .then(({ entries }) => {
        if (cancelled) return;
        setChildrenByDir({ "": entries });
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "读取目录失败");
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, revision]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchEntries([]);
      setSearchTruncated(false);
      setSearching(false);
      return;
    }
    const seq = ++requestSeq.current;
    setSearching(true);
    const timer = window.setTimeout(() => {
      void apiClient
        .searchWorkspaceEntries(projectId, trimmed)
        .then((result) => {
          if (seq !== requestSeq.current) return;
          setSearchEntries(result.entries);
          setSearchTruncated(result.truncated);
          setError("");
        })
        .catch((searchError: unknown) => {
          if (seq !== requestSeq.current) return;
          setError(
            searchError instanceof Error ? searchError.message : "搜索文件失败"
          );
        })
        .finally(() => {
          if (seq === requestSeq.current) setSearching(false);
        });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [projectId, query]);

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    const update = () => setViewportHeight(node.clientHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const rows = useMemo(() => {
    if (query.trim()) {
      return searchEntries.map((entry) => ({
        key: `search:${entry.path}`,
        entry,
        depth: 0,
        expanded: false,
        loading: false,
      }));
    }
    const next: TreeRow[] = [];
    const visit = (dir: string, depth: number) => {
      const children = childrenByDir[dir];
      if (!children) return;
      for (const entry of children) {
        const isExpanded = entry.kind === "directory" && expanded.has(entry.path);
        next.push({
          key: entry.path,
          entry,
          depth,
          expanded: isExpanded,
          loading: loadingDirs.has(entry.path),
        });
        if (isExpanded) visit(entry.path, depth + 1);
      }
    };
    visit("", 0);
    return next;
  }, [childrenByDir, expanded, loadingDirs, query, searchEntries]);

  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN * 2;
  const visibleRows = rows.slice(start, start + visibleCount);

  async function toggleDirectory(entry: WorkspaceEntry) {
    const willExpand = !expanded.has(entry.path);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (willExpand) next.add(entry.path);
      else next.delete(entry.path);
      return next;
    });
    if (willExpand && !childrenByDir[entry.path]) {
      await loadDir(entry.path);
    }
  }

  async function openFile(entry: WorkspaceEntry) {
    try {
      const { file } = await apiClient.readWorkspaceFile(projectId, entry.path);
      onOpenFile(file);
      setError("");
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "读取文件失败");
    }
  }

  return (
    <div className="workspace-file-tree">
      {error ? (
        <Text type="supporting" color="secondary">
          {error}
        </Text>
      ) : null}
      {searching ? (
        <Text type="supporting" color="secondary">
          正在搜索
        </Text>
      ) : null}
      {searchTruncated ? (
        <Text type="supporting" color="secondary">
          只显示前 5000 条匹配
        </Text>
      ) : null}
      <div
        ref={scrollerRef}
        className="workspace-file-tree-scroll"
        data-empty={rows.length === 0 && !searching ? "true" : undefined}
        role="tree"
        aria-label="项目文件"
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        {rows.length === 0 && !searching ? (
          <div className="workspace-file-tree-empty">
            <Text type="supporting" color="secondary">
              {query.trim() ? "没有匹配的文件" : "暂无文件"}
            </Text>
          </div>
        ) : (
          <div
            className="workspace-file-tree-canvas"
            style={{ height: rows.length * ROW_HEIGHT }}
          >
            {visibleRows.map((row, index) => {
              const top = (start + index) * ROW_HEIGHT;
              const selected =
                row.entry.kind === "file" && row.entry.path === selectedPath;
              return (
                <button
                  key={row.key}
                  type="button"
                  role="treeitem"
                  aria-expanded={
                    row.entry.kind === "directory" ? row.expanded : undefined
                  }
                  aria-selected={selected}
                  className="workspace-file-tree-row"
                  data-selected={selected ? "true" : "false"}
                  style={{
                    top,
                    height: ROW_HEIGHT,
                    paddingInlineStart: 8 + row.depth * 16,
                  }}
                  onClick={() => {
                    if (row.entry.kind === "directory") {
                      if (query.trim()) return;
                      void toggleDirectory(row.entry);
                      return;
                    }
                    void openFile(row.entry);
                  }}
                >
                  {row.entry.kind === "directory" ? (
                    <span
                      className="workspace-file-tree-chevron"
                      data-expanded={row.expanded ? "true" : "false"}
                    >
                      <Icon icon={ChevronRightIcon} size="xsm" />
                    </span>
                  ) : (
                    <span className="workspace-file-tree-chevron-spacer" />
                  )}
                  <Icon
                    icon={
                      row.entry.kind === "directory" ? FolderIcon : DocumentTextIcon
                    }
                    size="xsm"
                  />
                  <Text maxLines={1}>
                    {query.trim() ? row.entry.path : row.entry.name}
                    {row.loading ? " …" : ""}
                  </Text>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
