/* TaskGraph — visual DAG of task dependencies using lightweight SVG rendering. */

import { useMemo, useCallback } from "react";
import type { TaskNode, TaskNodeStatus } from "@/types/session";

interface TaskGraphProps {
  readonly nodes: readonly TaskNode[];
  readonly onNodeClick?: (nodeId: string) => void;
}

/** Maps task node status to a fill color for the node rectangle. */
const STATUS_FILL: Record<TaskNodeStatus, string> = {
  pending: "#E5E7EB",
  active: "#FFD93D",
  done: "#6BCB77",
  error: "#FF6B6B",
};

/** Maps task node status to a text color for readability on each fill. */
const STATUS_TEXT: Record<TaskNodeStatus, string> = {
  pending: "#000000",
  active: "#000000",
  done: "#000000",
  error: "#FFFFFF",
};

/** Layout constants for the graph renderer. */
const NODE_WIDTH = 140;
const NODE_HEIGHT = 44;
const COLUMN_GAP = 60;
const ROW_GAP = 20;
const PADDING = 24;
const ARROW_SIZE = 6;

/** A positioned node with calculated x,y coordinates for rendering. */
interface PositionedNode {
  readonly node: TaskNode;
  readonly x: number;
  readonly y: number;
  readonly column: number;
  readonly row: number;
}

/**
 * Computes a left-to-right topological layout for the task DAG.
 * Nodes with no dependencies appear on the left (column 0).
 * Each downstream node is placed in the next column after its latest dependency.
 * Parallel nodes within a column are stacked vertically.
 */
function layoutNodes(nodes: readonly TaskNode[]): readonly PositionedNode[] {
  if (nodes.length === 0) return [];

  /* Build adjacency: for each node, find its max dependency column */
  const nodeMap = new Map<string, TaskNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  /* Compute column for each node using topological depth */
  const columnMap = new Map<string, number>();

  function getColumn(nodeId: string): number {
    const cached = columnMap.get(nodeId);
    if (cached !== undefined) return cached;

    const node = nodeMap.get(nodeId);
    if (!node || node.dependsOn.length === 0) {
      columnMap.set(nodeId, 0);
      return 0;
    }

    let maxDepColumn = 0;
    for (const depId of node.dependsOn) {
      maxDepColumn = Math.max(maxDepColumn, getColumn(depId) + 1);
    }
    columnMap.set(nodeId, maxDepColumn);
    return maxDepColumn;
  }

  /* Calculate column for every node */
  for (const node of nodes) {
    getColumn(node.id);
  }

  /* Group nodes by column to determine row positions */
  const columnGroups = new Map<number, TaskNode[]>();
  for (const node of nodes) {
    const col = columnMap.get(node.id) ?? 0;
    const group = columnGroups.get(col);
    if (group) {
      group.push(node);
    } else {
      columnGroups.set(col, [node]);
    }
  }

  /* Assign positions */
  const positioned: PositionedNode[] = [];
  for (const [col, group] of columnGroups.entries()) {
    group.forEach((node, row) => {
      positioned.push({
        node,
        column: col,
        row,
        x: PADDING + col * (NODE_WIDTH + COLUMN_GAP),
        y: PADDING + row * (NODE_HEIGHT + ROW_GAP),
      });
    });
  }

  return positioned;
}

/**
 * Visual DAG renderer for task dependencies.
 * Uses simple SVG elements: rounded rectangles for nodes, lines with arrowheads for edges.
 * Nodes are colored by status: gray (pending), yellow (active), green (done), red (error).
 * Clicking a node fires the onNodeClick callback with the node's ID.
 */
export function TaskGraph({
  nodes,
  onNodeClick,
}: TaskGraphProps): React.JSX.Element {
  const positioned = useMemo(() => layoutNodes(nodes), [nodes]);

  /** Lookup map from node id to positioned node for edge drawing. */
  const positionMap = useMemo(() => {
    const map = new Map<string, PositionedNode>();
    for (const pn of positioned) {
      map.set(pn.node.id, pn);
    }
    return map;
  }, [positioned]);

  /** Compute SVG viewBox dimensions from positioned nodes. */
  const viewBox = useMemo(() => {
    if (positioned.length === 0) return { width: 200, height: 100 };
    let maxX = 0;
    let maxY = 0;
    for (const pn of positioned) {
      maxX = Math.max(maxX, pn.x + NODE_WIDTH);
      maxY = Math.max(maxY, pn.y + NODE_HEIGHT);
    }
    return { width: maxX + PADDING, height: maxY + PADDING };
  }, [positioned]);

  /** Collect all edges from dependency relationships. */
  const edges = useMemo(() => {
    const result: { fromId: string; toId: string }[] = [];
    for (const pn of positioned) {
      for (const depId of pn.node.dependsOn) {
        result.push({ fromId: depId, toId: pn.node.id });
      }
    }
    return result;
  }, [positioned]);

  const handleNodeClick = useCallback(
    (nodeId: string): void => {
      onNodeClick?.(nodeId);
    },
    [onNodeClick],
  );

  if (nodes.length === 0) {
    return (
      <div className="py-4 text-center font-body text-sm text-gray-400" data-testid="task-graph-empty">
        No tasks in graph
      </div>
    );
  }

  return (
    <div className="overflow-x-auto" data-testid="task-graph">
      <svg
        width={viewBox.width}
        height={viewBox.height}
        viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
        className="block"
        data-testid="task-graph-svg"
      >
        {/* Arrowhead marker definition */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth={ARROW_SIZE}
            markerHeight={ARROW_SIZE}
            refX={ARROW_SIZE}
            refY={ARROW_SIZE / 2}
            orient="auto"
          >
            <polygon
              points={`0 0, ${ARROW_SIZE} ${ARROW_SIZE / 2}, 0 ${ARROW_SIZE}`}
              fill="#000"
            />
          </marker>
        </defs>

        {/* Edges — lines with arrowheads */}
        {edges.map(({ fromId, toId }) => {
          const from = positionMap.get(fromId);
          const to = positionMap.get(toId);
          if (!from || !to) return null;

          const x1 = from.x + NODE_WIDTH;
          const y1 = from.y + NODE_HEIGHT / 2;
          const x2 = to.x;
          const y2 = to.y + NODE_HEIGHT / 2;

          return (
            <line
              key={`${fromId}-${toId}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#000"
              strokeWidth={2}
              markerEnd="url(#arrowhead)"
              data-testid="task-graph-edge"
            />
          );
        })}

        {/* Nodes — rounded rectangles with labels */}
        {positioned.map((pn) => (
          <g
            key={pn.node.id}
            onClick={() => handleNodeClick(pn.node.id)}
            style={{ cursor: onNodeClick ? "pointer" : "default" }}
            data-testid="task-graph-node"
          >
            <rect
              x={pn.x}
              y={pn.y}
              width={NODE_WIDTH}
              height={NODE_HEIGHT}
              rx={8}
              ry={8}
              fill={STATUS_FILL[pn.node.status]}
              stroke="#000"
              strokeWidth={2}
            />
            <text
              x={pn.x + NODE_WIDTH / 2}
              y={pn.y + NODE_HEIGHT / 2 + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={STATUS_TEXT[pn.node.status]}
              fontSize={12}
              fontWeight={700}
              fontFamily="Inter, system-ui, sans-serif"
            >
              {pn.node.label.length > 16
                ? pn.node.label.slice(0, 14) + "..."
                : pn.node.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
