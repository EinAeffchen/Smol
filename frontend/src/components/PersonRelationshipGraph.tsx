import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { alpha } from "@mui/material/styles";
import { Renderer as SVGRenderer } from "@antv/g-svg";
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  Slider,
  Typography,
  useTheme,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { Graph as G6Graph, GraphData, IG6GraphEvent } from "@antv/g6";
import type { BaseEdgeStyleProps, BaseNodeStyleProps } from "@antv/g6";
import useResizeObserver from "use-resize-observer";
import { API } from "../config";
import { PersonRelationshipGraph as PersonRelationshipGraphData } from "../types";
import { Renderer as SVGRenderer } from '@antv/g-svg';
interface PersonRelationshipGraphProps {
  graph: PersonRelationshipGraphData | null;
  depth: number;
  isLoading: boolean;
  onDepthChange: (depth: number) => void;
}

interface WeightSummary {
  min: number;
  max: number;
}

type GraphNode = {
  id: string;
  depth: number;
  totalWeight: number;
  bridgeScore: number;
  cluster?: string;
  clusterColor?: string;
  image?: string | null;
  isRoot: boolean;
  size: number;
  x?: number;
  y?: number;
  style: Partial<BaseNodeStyleProps>;
  data: {
    personId: string;
    name: string;
    depth: number;
    totalWeight: number;
    hasImage: boolean;
  };
};

type GraphEdge = {
  id: string;
  source: string;
  target: string;
  weight: number;
  normalizedWeight: number;
  visualWidth: number;
  intensity: number;
  formattedLabel: string;
  label?: string;
  style: Partial<BaseEdgeStyleProps>;
  data: {
    weight: number;
    normalizedWeight: number;
    formattedLabel: string;
    isInterCluster: boolean;
  };
};

interface ClusterSummary {
  id: string;
  color: string;
  nodeIds: string[];
  totalWeight: number;
  hasRoot: boolean;
  bridgeCount: number;
}

interface ClusteredGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: ClusterSummary[];
}

const CLUSTER_COLORS = [
  "#5B8FF9",
  "#61DDAA",
  "#65789B",
  "#F6BD16",
  "#7262FD",
  "#78D3F8",
  "#9661BC",
  "#F6903D",
  "#008685",
  "#F08BB4",
];

const MIN_SPACING = 90;
const MAX_SPACING = 260;

const normalizeWeight = (weight: number, summary: WeightSummary) => {
  if (summary.max === summary.min) {
    return 1;
  }
  return (weight - summary.min) / (summary.max - summary.min);
};

const rgbToHex = (r: number, g: number, b: number) => {
  const toHex = (value: number) => {
    const clamped = Math.max(0, Math.min(255, Math.round(value)));
    return clamped.toString(16).padStart(2, "0");
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const hexToRgb = (hex: string) => {
  const sanitized = hex.replace("#", "");
  if (sanitized.length !== 6) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: parseInt(sanitized.slice(0, 2), 16),
    g: parseInt(sanitized.slice(2, 4), 16),
    b: parseInt(sanitized.slice(4, 6), 16),
  };
};

const interpolateHexColor = (from: string, to: string, amount: number) => {
  const clamped = Math.max(0, Math.min(1, amount));
  const start = hexToRgb(from);
  const end = hexToRgb(to);
  const r = start.r + (end.r - start.r) * clamped;
  const g = start.g + (end.g - start.g) * clamped;
  const b = start.b + (end.b - start.b) * clamped;
  return rgbToHex(r, g, b);
};

const clampSliderValue = (value: number | number[]) =>
  Array.isArray(value) ? value[0] : value;

const sharedNeighborCount = (
  nodeIdA: string,
  nodeIdB: string,
  adjacencySets: Map<string, Set<string>>,
  depthLookup: Map<string, number>
) => {
  const neighborsA = adjacencySets.get(nodeIdA);
  const neighborsB = adjacencySets.get(nodeIdB);
  if (
    !neighborsA ||
    !neighborsB ||
    neighborsA.size === 0 ||
    neighborsB.size === 0
  ) {
    return 0;
  }
  const smaller = neighborsA.size < neighborsB.size ? neighborsA : neighborsB;
  const larger = smaller === neighborsA ? neighborsB : neighborsA;
  let count = 0;
  smaller.forEach((neighbor) => {
    if (larger.has(neighbor) && (depthLookup.get(neighbor) ?? 1) > 0) {
      count += 1;
    }
  });
  return count;
};

const applyClustering = (
  data: GraphData,
  palette: string[]
): ClusteredGraph => {
  const nodes: GraphNode[] = ((data.nodes ?? []) as GraphNode[]).map(
    (node) => ({
      ...node,
      style: { ...(node.style ?? {}) },
    })
  );
  const edges: GraphEdge[] = ((data.edges ?? []) as GraphEdge[]).map(
    (edge) => ({
      ...edge,
      style: { ...(edge.style ?? {}) },
    })
  );

  if (!nodes.length) {
    return { nodes, edges, clusters: [] };
  }

  const nodeLookup = new Map<string, GraphNode>();
  const depthLookup = new Map<string, number>();
  nodes.forEach((node) => {
    nodeLookup.set(node.id, node);
    depthLookup.set(node.id, node.depth ?? 1);
  });

  const adjacency = new Map<string, Map<string, number>>();
  const adjacencySets = new Map<string, Set<string>>();
  nodes.forEach((node) => {
    adjacency.set(node.id, new Map());
    adjacencySets.set(node.id, new Set());
  });

  edges.forEach((edge) => {
    const weight = edge.weight ?? 1;
    adjacency.get(edge.source)?.set(edge.target, weight);
    adjacency.get(edge.target)?.set(edge.source, weight);
    adjacencySets.get(edge.source)?.add(edge.target);
    adjacencySets.get(edge.target)?.add(edge.source);
  });

  const labels = new Map<string, string>();
  nodes.forEach((node) => {
    labels.set(node.id, node.id);
  });

  const rootIds = nodes
    .filter((node) => node.depth === 0)
    .map((node) => node.id);
  const rootSet = new Set(rootIds);

  const iterations = Math.max(
    4,
    Math.min(12, Math.ceil(Math.sqrt(nodes.length)))
  );
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const clusterCounts = new Map<string, number>();
    labels.forEach((label) => {
      clusterCounts.set(label, (clusterCounts.get(label) ?? 0) + 1);
    });

    let changed = false;
    nodes.forEach((node) => {
      const neighbors = adjacency.get(node.id);
      if (!neighbors || !neighbors.size) {
        return;
      }

      const currentLabel = labels.get(node.id) ?? node.id;
      let bestLabel = currentLabel;
      let bestScore = -Infinity;

      neighbors.forEach((weight, neighborId) => {
        const neighborLabel = labels.get(neighborId) ?? neighborId;
        const neighborNode = nodeLookup.get(neighborId);
        if (!neighborNode) {
          return;
        }

        let influence = weight;
        if (rootSet.has(node.id) || rootSet.has(neighborId)) {
          influence *= 0.18;
        }

        const neighborDegree = Math.max(
          1,
          adjacencySets.get(neighborId)?.size ?? 1
        );
        const degreeDamping = 1 / Math.log2(neighborDegree + 1.5);

        const shared = sharedNeighborCount(
          node.id,
          neighborId,
          adjacencySets,
          depthLookup
        );
        const similarityBoost = 1 + shared * 0.55;

        const compositeScore = influence * similarityBoost * degreeDamping;
        const neighborClusterSize = clusterCounts.get(neighborLabel) ?? 1;
        const bestClusterSize = clusterCounts.get(bestLabel) ?? 1;

        if (
          compositeScore > bestScore ||
          (Math.abs(compositeScore - bestScore) < 1e-6 &&
            neighborClusterSize > bestClusterSize) ||
          (Math.abs(compositeScore - bestScore) < 1e-6 &&
            neighborClusterSize === bestClusterSize &&
            neighborLabel < bestLabel)
        ) {
          bestScore = compositeScore;
          bestLabel = neighborLabel;
        }
      });

      if (bestLabel !== currentLabel) {
        labels.set(node.id, bestLabel);
        changed = true;
      }
    });

    if (!changed) {
      break;
    }
  }

  const labelToCluster = new Map<string, { id: string; color: string }>();
  const labelCounts = new Map<string, number>();
  labels.forEach((label) => {
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  });

  const sortedLabels = Array.from(labelCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label]) => label);

  sortedLabels.forEach((label, index) => {
    const clusterId = `cluster-${index}`;
    labelToCluster.set(label, {
      id: clusterId,
      color: CLUSTER_COLORS[index % CLUSTER_COLORS.length],
    });
  });

  const clusterSummaries = new Map<string, ClusterSummary>();
  nodes.forEach((node) => {
    const label = labels.get(node.id);
    const cluster = label ? labelToCluster.get(label) : undefined;
    if (cluster) {
      node.cluster = cluster.id;
      node.clusterColor = cluster.color;
    }

    const summary = clusterSummaries.get(cluster?.id ?? node.id) ?? {
      id: cluster?.id ?? node.id,
      color: cluster?.color ?? alpha("#5B8FF9", 0.9),
      nodeIds: [],
      totalWeight: 0,
      hasRoot: false,
      bridgeCount: 0,
    };

    summary.nodeIds.push(node.id);
    summary.totalWeight += node.totalWeight ?? 0;
    summary.hasRoot = summary.hasRoot || node.depth === 0;
    clusterSummaries.set(summary.id, summary);
  });

  const bridgingMap = new Map<string, Set<string>>();
  nodes.forEach((node) => {
    bridgingMap.set(node.id, new Set());
  });

  edges.forEach((edge) => {
    const sourceNode = nodeLookup.get(edge.source);
    const targetNode = nodeLookup.get(edge.target);
    if (!sourceNode || !targetNode) {
      return;
    }
    const isInterCluster = sourceNode.cluster !== targetNode.cluster;
    edge.data = {
      ...edge.data,
      isInterCluster,
    };

    if (isInterCluster) {
      bridgingMap.get(edge.source)?.add(targetNode.cluster ?? "");
      bridgingMap.get(edge.target)?.add(sourceNode.cluster ?? "");
      const sourceSummary = sourceNode.cluster
        ? clusterSummaries.get(sourceNode.cluster)
        : undefined;
      const targetSummary = targetNode.cluster
        ? clusterSummaries.get(targetNode.cluster)
        : undefined;
      if (sourceSummary) {
        sourceSummary.bridgeCount += 1;
      }
      if (targetSummary) {
        targetSummary.bridgeCount += 1;
      }
      edge.style = {
        ...edge.style,
        lineDash: [6, 6],
        opacity: Math.min(edge.intensity, 0.35),
      };
    } else {
      edge.style = {
        ...edge.style,
        lineDash: undefined,
      };
    }
  });

  nodes.forEach((node) => {
    node.bridgeScore = bridgingMap.get(node.id)?.size ?? 0;
  });

  const clusters = Array.from(clusterSummaries.values()).sort((a, b) => {
    if (a.hasRoot && !b.hasRoot) return -1;
    if (!a.hasRoot && b.hasRoot) return 1;
    return b.totalWeight - a.totalWeight;
  });

  return { nodes, edges, clusters };
};

const applyClusterLayout = (
  clustered: ClusteredGraph,
  spacing: number
): GraphData => {
  const nodes = clustered.nodes.map((node) => ({
    ...node,
    style: { ...(node.style ?? {}) },
  }));
  const nodeLookup = new Map<string, GraphNode>();
  nodes.forEach((node) => {
    nodeLookup.set(node.id, node);
  });

  const edges = clustered.edges.map((edge) => ({
    ...edge,
    style: { ...(edge.style ?? {}) },
  }));

  const clusters = clustered.clusters.map((cluster) => ({
    ...cluster,
    nodeIds: [...cluster.nodeIds],
  }));

  const rootCluster = clusters.find((cluster) => cluster.hasRoot) ?? null;
  const nonRootClusters = clusters.filter((cluster) => !cluster.hasRoot);

  const baseRadius =
    spacing * 2.8
    + (rootCluster ? Math.sqrt(rootCluster.totalWeight + 1) * spacing * 0.18 : 0);
  const ringSpacing = spacing * 3.4;
  const clustersPerRing = Math.max(
    4,
    Math.ceil(Math.sqrt(nonRootClusters.length))
  );

  const clusterCenters = new Map<string, { x: number; y: number }>();

  if (rootCluster) {
    clusterCenters.set(rootCluster.id, { x: 0, y: 0 });
  }

  let clusterIndex = 0;
  let ring = 0;
  while (clusterIndex < nonRootClusters.length) {
    const remaining = nonRootClusters.length - clusterIndex;
    const ringCount = Math.min(clustersPerRing + ring, remaining);
    const radius = baseRadius + ring * ringSpacing;
    for (let i = 0; i < ringCount; i += 1) {
      const cluster = nonRootClusters[clusterIndex];
      const offset = ring % 2 === 0 ? 0 : Math.PI / ringCount;
      const angle = (2 * Math.PI * i) / ringCount + offset;
      clusterCenters.set(cluster.id, {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      });
      clusterIndex += 1;
    }
    ring += 1;
  }

  clusters.forEach((cluster) => {
    const center = clusterCenters.get(cluster.id) ?? { x: 0, y: 0 };
    const nodeIds = cluster.nodeIds
      .map((id) => nodeLookup.get(id))
      .filter(Boolean) as GraphNode[];
    if (!nodeIds.length) {
      return;
    }

    const orderedNodes = nodeIds
      .slice()
      .sort(
        (a, b) =>
          (b.bridgeScore ?? 0) - (a.bridgeScore ?? 0) ||
          (b.totalWeight ?? 0) - (a.totalWeight ?? 0) ||
          a.id.localeCompare(b.id)
      );

    const rootNodeIndex = orderedNodes.findIndex((node) => node.depth === 0);
    if (rootNodeIndex >= 0) {
      const [rootNode] = orderedNodes.splice(rootNodeIndex, 1);
      rootNode.x = center.x;
      rootNode.y = center.y;
      orderedNodes.unshift(rootNode);
    }

    const ringInnerSpacing = spacing * 1.15;
    const firstRingRadius =
      spacing * 1.45 + Math.sqrt(cluster.totalWeight + 1) * spacing * 0.08;

    let assigned = 0;
    let ringIndex = 0;
    while (assigned < orderedNodes.length) {
      const ringRadius = firstRingRadius + ringIndex * ringInnerSpacing;
      const circumference = 2 * Math.PI * ringRadius;
      const maxNodesThisRing = Math.max(
        6,
        Math.floor(circumference / Math.max(50, spacing + 30))
      );
      const nodesThisRing = Math.min(
        maxNodesThisRing,
        orderedNodes.length - assigned
      );
      const angleOffset = ringIndex % 2 === 0 ? 0 : Math.PI / nodesThisRing;

      for (let i = 0; i < nodesThisRing; i += 1) {
        const node = orderedNodes[assigned];
        const angle = (2 * Math.PI * i) / nodesThisRing + angleOffset;
        node.x = center.x + Math.cos(angle) * ringRadius;
        node.y = center.y + Math.sin(angle) * ringRadius;
        assigned += 1;
      }

      ringIndex += 1;
    }
  });

  const positionedNodes = nodes.map((node) => ({
    ...node,
    style: {
      ...(node.style ?? {}),
      x: node.x,
      y: node.y,
    },
  }));

  return { nodes: positionedNodes, edges };
};

const PersonRelationshipGraph: React.FC<PersonRelationshipGraphProps> = ({
  graph,
  depth,
  isLoading,
  onDepthChange,
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const g6GraphRef = useRef<G6Graph | null>(null);
  const {
    ref: resizeRef,
    width = 960,
    height = 560,
  } = useResizeObserver<HTMLDivElement>();

  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  const [spacing, setSpacing] = useState(140);
  const [minWeight, setMinWeight] = useState(1);

  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      if (typeof resizeRef === "function") {
        resizeRef(node);
      } else if (resizeRef && "current" in resizeRef) {
        resizeRef.current = node;
      }
    },
    [resizeRef]
  );

  const weightSummary: WeightSummary = useMemo(() => {
    if (!graph || !graph.edges.length) {
      return { min: 1, max: 1 };
    }
    const weights = graph.edges
      .map((edge) => Math.max(1, Number(edge.weight) || 0))
      .filter((value) => Number.isFinite(value));
    const min = Math.max(1, Math.min(...weights));
    const max = Math.max(min, Math.max(...weights));
    return { min, max };
  }, [graph]);

  useEffect(() => {
    setMinWeight((current) => {
      const { min, max } = weightSummary;
      if (current < min) return min;
      if (current > max) return max;
      return current;
    });
  }, [weightSummary]);

  const processedData: GraphData | undefined = useMemo(() => {
    if (!graph) {
      return undefined;
    }

    const nodeWeightMap = new Map<string, number>();
    const filteredEdgesRaw = graph.edges.filter(
      (edge) => (edge.weight ?? 0) >= minWeight
    );

    filteredEdgesRaw.forEach((edge) => {
      const weight = Math.max(1, Number(edge.weight) || 0);
      const source = String(edge.source);
      const target = String(edge.target);
      nodeWeightMap.set(source, (nodeWeightMap.get(source) ?? 0) + weight);
      nodeWeightMap.set(target, (nodeWeightMap.get(target) ?? 0) + weight);
    });

    const rootId = String(graph.root_id ?? graph.nodes[0]?.id ?? "");

    const fallbackFill = alpha("#151B2C", 0.9);
    const labelColor =
      theme.palette.mode === "dark"
        ? theme.palette.grey[100]
        : theme.palette.grey[900];

    const nodes: GraphNode[] = graph.nodes.map((node) => {
      const id = String(node.id);
      const totalWeight = nodeWeightMap.get(id) ?? 0;
      const image = node.profile_thumbnail
        ? `${API}/thumbnails/${encodeURIComponent(node.profile_thumbnail)}`
        : null;
      const baseSize = 32;
      const sizeBoost = Math.min(28, Math.sqrt(totalWeight || 1) * 4.2);
      const size = baseSize + sizeBoost + (node.depth === 0 ? 12 : 0);
      const personName = node.name ?? `Person ${node.id}`;
      const weightText = totalWeight ? `${totalWeight} shared` : "";
      const labelText = weightText
        ? `${personName}\n${weightText}`
        : personName;
      const isRoot = id === rootId;

      const style: Partial<BaseNodeStyleProps> = {
        size,
        fill: fallbackFill,
        stroke: isRoot ? "#ffffff" : alpha("#6C9EFF", 0.8),
        lineWidth: isRoot ? 3.6 : 1.8,
        shadowColor: alpha("#0D1321", 0.5),
        shadowBlur: 6,
        labelText,
        labelFontSize: weightText ? 11 : 11,
        labelFontWeight: node.depth === 0 ? 700 : 500,
        labelFill: labelColor,
        labelPlacement: "bottom",
        labelLineHeight: weightText ? 14 : 13,
        labelOffsetY: weightText ? 6 : 4,
        icon: Boolean(image),
        iconSrc: image ?? undefined,
        iconOpacity: image ? 1 : 0,
        iconWidth: size - 6,
        iconHeight: size - 6,
      };

      if (!image) {
        style.icon = false;
      } else {
        style.iconRadius = (size - 6) / 2;
      }

      return {
        ...node,
        id,
        depth: node.depth,
        totalWeight,
        bridgeScore: 0,
        cluster: undefined,
        clusterColor: undefined,
        image,
        isRoot,
        size,
        style,
        data: {
          personId: id,
          name: personName,
          depth: node.depth,
          totalWeight,
          hasImage: Boolean(image),
        },
      };
    });

    const strongColor = theme.palette.primary.main;
    const weakColor = theme.palette.grey[500];

    const edges: GraphEdge[] = filteredEdgesRaw.map((edge, index) => {
      const weight = Math.max(1, Number(edge.weight) || 0);
      const normalizedWeight = normalizeWeight(weight, weightSummary);
      const visualWidth = 1.1 + Math.log2(weight + 1) * 2.6;
      const intensity = 0.2 + normalizedWeight * 0.7;
      const color = interpolateHexColor(
        weakColor,
        strongColor,
        normalizedWeight
      );
      const formattedLabel = `${weight} co-appearance${
        weight === 1 ? "" : "s"
      }`;

      return {
        ...edge,
        id: `edge-${index}`,
        source: String(edge.source),
        target: String(edge.target),
        weight,
        normalizedWeight,
        visualWidth,
        intensity,
        formattedLabel,
        label: showEdgeLabels ? formattedLabel : "",
        style: {
          stroke: color,
          lineWidth: visualWidth,
          opacity: intensity,
          lineAppendWidth: Math.max(10, visualWidth + 8),
        },
        data: {
          weight,
          normalizedWeight,
          formattedLabel,
          isInterCluster: false,
        },
      };
    });

    return { nodes, edges };
  }, [
    graph,
    minWeight,
    showEdgeLabels,
    theme.palette.grey,
    theme.palette.primary,
    weightSummary,
  ]);

  const clusteredGraph: ClusteredGraph | undefined = useMemo(() => {
    if (!processedData) {
      return undefined;
    }
    return applyClustering(processedData, CLUSTER_COLORS);
  }, [processedData]);

  const layoutData: GraphData | undefined = useMemo(() => {
    if (!clusteredGraph) {
      return undefined;
    }
    return applyClusterLayout(clusteredGraph, spacing);
  }, [clusteredGraph, spacing]);

  useEffect(() => {
    if (!containerRef.current || g6GraphRef.current) {
      return;
    }

    const graphInstance = new G6Graph({
      container: containerRef.current,
      renderer: () => new SVGRenderer(),
      width,
      height,
      pixelRatio: Math.min(2, window.devicePixelRatio * 1.1),
      behaviors: ["drag-element", "drag-canvas", "zoom-canvas", "scroll-canvas"],
      layout: {type: "force"},
      edge: {
        type: "quadratic",
        style: {
          stroke: alpha("#6C7A99", 0.4),
          lineWidth: 1.4,
          opacity: 0.4,
          lineAppendWidth: 8,
        },
        label: {
          style: {
            fill: "#E8ECF3",
            fontSize: 10,
            fontWeight: 500,
            opacity: 0.9,
            background: {
              fill: alpha("#0D1321", 0.7),
              padding: [2, 4, 2, 4],
              radius: 4,
            },
          },
        },
        state: {
          highlight: {
            style: {
              opacity: 0.95,
              lineWidth: 4,
            },
          },
          inactive: {
            style: {
              opacity: 0.08,
            },
          },
        },
      },
      node: {
        type: "circle",
        state: {
          highlight: {
            style: {
              shadowBlur: 18,
              shadowColor: alpha(theme.palette.primary.main, 0.7),
              opacity: 1,
            },
          },
          inactive: {
            style: {
              opacity: 0.35,
            },
          },
        },
      },
    });

    const clearStates = () => {
      graphInstance.getNodes().forEach((node) => {
        graphInstance.clearItemStates(node);
      });
      graphInstance.getEdges().forEach((edge) => {
        graphInstance.clearItemStates(edge);
      });
    };

    graphInstance.on("node:click", (evt: IG6GraphEvent) => {
      const model = evt.item?.getModel() as GraphNode | undefined;
      if (model) {
        navigate(`/person/${model.id}`);
      }
    });

    graphInstance.on("node:mouseenter", (evt) => {
      const nodeItem = evt.item;
      if (!nodeItem) return;
      clearStates();
      graphInstance.setItemState(nodeItem, "highlight", true);
      const nodeId = (nodeItem.getModel() as GraphNode).id;
      graphInstance.getEdges().forEach((edge) => {
        const model = edge.getModel() as GraphEdge;
        if (model.source === nodeId || model.target === nodeId) {
          graphInstance.setItemState(edge, "highlight", true);
          const otherId = model.source === nodeId ? model.target : model.source;
          const neighborNode = graphInstance.findById(otherId);
          if (neighborNode) {
            graphInstance.setItemState(neighborNode, "highlight", true);
          }
        } else {
          graphInstance.setItemState(edge, "inactive", true);
        }
      });
      graphInstance.getNodes().forEach((node) => {
        if (node !== nodeItem && !node.hasState("highlight")) {
          graphInstance.setItemState(node, "inactive", true);
        }
      });
    });

    graphInstance.on("node:mouseleave", () => {
      clearStates();
    });

    graphInstance.on("edge:mouseenter", (evt) => {
      const edgeItem = evt.item;
      if (!edgeItem) return;
      clearStates();
      graphInstance.setItemState(edgeItem, "highlight", true);
      const model = edgeItem.getModel() as GraphEdge;
      const sourceNode = graphInstance.findById(model.source);
      const targetNode = graphInstance.findById(model.target);
      if (sourceNode) graphInstance.setItemState(sourceNode, "highlight", true);
      if (targetNode) graphInstance.setItemState(targetNode, "highlight", true);
      graphInstance.getEdges().forEach((edge) => {
        if (edge !== edgeItem) {
          graphInstance.setItemState(edge, "inactive", true);
        }
      });
      graphInstance.getNodes().forEach((node) => {
        if (
          node !== sourceNode &&
          node !== targetNode &&
          !node.hasState("highlight")
        ) {
          graphInstance.setItemState(node, "inactive", true);
        }
      });
    });

    graphInstance.on("edge:mouseleave", () => {
      clearStates();
    });

    g6GraphRef.current = graphInstance;

    return () => {
      graphInstance.destroy();
      g6GraphRef.current = null;
    };
  }, [height, navigate, theme.palette.primary.main, width]);

  useEffect(() => {
    const graphInstance = g6GraphRef.current;
    if (!graphInstance || !layoutData) {
      return;
    }

    graphInstance.setData(layoutData);
    graphInstance.render();

    graphInstance.fitView(48);
  }, [layoutData]);

  useEffect(() => {
    const graphInstance = g6GraphRef.current;
    if (!graphInstance) return;
    graphInstance.setSize(width, height);
    graphInstance.fitView(48);
  }, [width, height]);

  const handleDepthChange = (event: SelectChangeEvent<string>) => {
    const nextDepth = Number(event.target.value);
    if (!Number.isNaN(nextDepth)) {
      onDepthChange(nextDepth);
    }
  };

  const handleResetView = () => {
    const graphInstance = g6GraphRef.current;
    if (!graphInstance) return;
    graphInstance.fitView(48);
    graphInstance
      .getNodes()
      .forEach((node) => graphInstance.clearItemStates(node));
    graphInstance
      .getEdges()
      .forEach((edge) => graphInstance.clearItemStates(edge));
  };

  const hasGraph = Boolean(
    layoutData &&
      layoutData.nodes &&
      layoutData.nodes.length > 0 &&
      layoutData.edges &&
      layoutData.edges.length > 0
  );

  return (
    <Paper
      sx={{ p: 2, height: "100%", display: "flex", flexDirection: "column" }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Box>
          <Typography variant="h6">Relationship Graph</Typography>
          <Typography variant="body2" color="text.secondary">
            Stronger shared-photo bonds render thicker, brighter edges. Hover to
            spotlight friendship bridges.
          </Typography>
        </Box>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="relationship-depth-label">Generations</InputLabel>
            <Select
              labelId="relationship-depth-label"
              label="Generations"
              value={depth.toString()}
              onChange={handleDepthChange}
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <MenuItem key={value} value={value.toString()}>
                  {value}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={showEdgeLabels}
                onChange={(event) => setShowEdgeLabels(event.target.checked)}
              />
            }
            label="Show edge weights"
          />
          <Box sx={{ width: 220 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mb: 0.5 }}
            >
              Layout spacing: {spacing}px
            </Typography>
            <Slider
              size="small"
              min={MIN_SPACING}
              max={MAX_SPACING}
              step={10}
              value={spacing}
              valueLabelDisplay="auto"
              onChange={(_, value) => setSpacing(clampSliderValue(value))}
            />
          </Box>
          <Box sx={{ width: 240 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mb: 0.5 }}
            >
              Minimum shared photos: {minWeight}
            </Typography>
            <Slider
              size="small"
              min={weightSummary.min}
              max={weightSummary.max}
              step={1}
              value={minWeight}
              disabled={weightSummary.min === weightSummary.max}
              valueLabelDisplay="auto"
              onChange={(_, value) => setMinWeight(clampSliderValue(value))}
            />
          </Box>
          <Button variant="outlined" size="small" onClick={handleResetView}>
            Reset view
          </Button>
        </Box>
      </Box>

      <Box sx={{ position: "relative", flexGrow: 1, minHeight: 440 }}>
        {isLoading && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2,
              backdropFilter: "blur(2px)",
              backgroundColor: alpha(theme.palette.background.paper, 0.4),
            }}
          >
            <CircularProgress size={32} />
          </Box>
        )}
        {!isLoading && !hasGraph ? (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              gap: 1,
              color: "text.secondary",
              px: 2,
            }}
          >
            <Typography variant="subtitle1">
              No relationships to display
            </Typography>
            <Typography variant="body2">
              Try selecting a shallower depth or lowering the minimum shared
              photo threshold.
            </Typography>
          </Box>
        ) : (
          <Box
            ref={setContainerRef}
            sx={{
              width: "100%",
              height: "100%",
              borderRadius: 1,
              backgroundColor: alpha("#0D1321", 0.7),
            }}
          />
        )}
      </Box>
    </Paper>
  );
};

export default PersonRelationshipGraph;
