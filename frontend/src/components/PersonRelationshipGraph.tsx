import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d";
import useResizeObserver from "use-resize-observer";
import { forceManyBody } from "d3-force-3d";
import { API } from "../config";
import {
  PersonRelationshipGraph as PersonRelationshipGraphData,
} from "../types";

interface PersonRelationshipGraphProps {
  graph: PersonRelationshipGraphData | null;
  depth: number;
  isLoading: boolean;
  onDepthChange: (depth: number) => void;
}

type BaseNode = PersonRelationshipGraphData["nodes"][number];
type GraphNode = BaseNode & {
  id: number;
  displayName: string;
  imageUrl: string | null;
  isRoot: boolean;
  fx?: number;
  fy?: number;
  x?: number;
  y?: number;
};
type GraphLink = PersonRelationshipGraphData["edges"][number] & {
  source: GraphNode;
  target: GraphNode;
};

const DEFAULT_CANVAS = { width: 640, height: 520 };

const PersonRelationshipGraph: React.FC<PersonRelationshipGraphProps> = ({
  graph,
  depth,
  isLoading,
  onDepthChange,
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const graphRef = useRef<ForceGraphMethods>();
  const imageCache = useRef<Record<number, HTMLImageElement>>({});
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  const [spacing, setSpacing] = useState(90);
  const [minWeight, setMinWeight] = useState(1);

  const { ref: containerRef, width, height } = useResizeObserver<HTMLDivElement>();

  const graphData = useMemo(() => {
    if (!graph) {
      return { nodes: [] as GraphNode[], links: [] as GraphLink[] };
    }

    const nodes: GraphNode[] = graph.nodes.map((node) => {
      const imageUrl = node.profile_thumbnail
        ? `${API}/thumbnails/${encodeURIComponent(node.profile_thumbnail)}`
        : null;
      return {
        ...node,
        id: node.id,
        displayName: node.name ?? `Person ${node.id}`,
        imageUrl,
        isRoot: node.id === graph.root_id,
        fx: node.id === graph.root_id ? 0 : undefined,
        fy: node.id === graph.root_id ? 0 : undefined,
      };
    });

    const filteredLinks = graph.edges.filter(
      (edge) => edge.weight >= minWeight,
    );

    const connectedIds = new Set<number>();
    filteredLinks.forEach((edge) => {
      connectedIds.add(Number(edge.source));
      connectedIds.add(Number(edge.target));
    });
    connectedIds.add(graph.root_id);

    const filteredNodes = nodes.filter((node) => connectedIds.has(node.id));

    const nodeMap = new Map<number, GraphNode>();
    filteredNodes.forEach((node) => nodeMap.set(node.id, node));

    const links: GraphLink[] = [];
    for (const edge of filteredLinks) {
      const sourceNode = nodeMap.get(Number(edge.source));
      const targetNode = nodeMap.get(Number(edge.target));
      if (!sourceNode || !targetNode) {
        continue;
      }
      links.push({
        ...edge,
        source: sourceNode,
        target: targetNode,
      });
    }

    return { nodes: filteredNodes, links };
  }, [graph, minWeight]);

  const fullWeightSummary = useMemo(() => {
    if (!graph || graph.edges.length === 0) {
      return { min: 1, max: 1 };
    }
    const weights = graph.edges
      .map((edge) => Number(edge.weight))
      .filter((value) => Number.isFinite(value) && value >= 0);
    if (weights.length === 0) {
      return { min: 1, max: 1 };
    }
    return {
      min: Math.max(1, Math.min(...weights)),
      max: Math.max(1, Math.max(...weights)),
    };
  }, [graph]);

  const { childRadius, rootRadius } = useMemo(() => {
    const nodeCount = Math.max(graphData.nodes.length, 1);
    const base = Math.max(8, 18 - Math.log(nodeCount + 1) * 2);
    const root = Math.min(base * 1.4, base + 6);
    return {
      childRadius: base,
      rootRadius: root,
    };
  }, [graphData.nodes.length]);

  const weightStats = useMemo(() => {
    if (!graphData.links.length) {
      return {
        min: 0,
        max: 1,
        median: 1,
        q1: 1,
        q3: 1,
        logMax: 1,
        normalize: (_weight: number) => 0,
      };
    }
    const weights = graphData.links
      .map((edge) => Number(edge.weight))
      .filter((value) => Number.isFinite(value) && value >= 0)
      .sort((a, b) => a - b);
    const min = weights[0];
    const max = weights[weights.length - 1];
    const median = weights[Math.floor(weights.length / 2)];
    const q1 = weights[Math.floor(weights.length * 0.25)];
    const q3 = weights[Math.floor(weights.length * 0.75)];
    const logMax = Math.max(Math.log10(max + 1), 1);
    const normalize = (weight: number) =>
      Math.max(0, Math.log10(weight + 1) / logMax);
    return { min, max, median, q1, q3, logMax, normalize };
  }, [graphData.links]);

  useEffect(() => {
    setMinWeight((current) => {
      const minAllowed = fullWeightSummary.min;
      const maxAllowed = Math.max(minAllowed, fullWeightSummary.max);
      if (current < minAllowed) {
        return minAllowed;
      }
      if (current > maxAllowed) {
        return maxAllowed;
      }
      return current;
    });
  }, [fullWeightSummary.min, fullWeightSummary.max]);

  const handleDepthChange = (event: SelectChangeEvent<string>) => {
    const nextDepth = Number(event.target.value);
    if (!Number.isNaN(nextDepth)) {
      onDepthChange(nextDepth);
    }
  };

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      navigate(`/person/${node.id}`);
    },
    [navigate],
  );

  const drawNode = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      if (typeof node.x !== "number" || typeof node.y !== "number") {
        return;
      }

      const baseRadius = node.isRoot ? rootRadius : childRadius;
      const scaledRadius = baseRadius;
      ctx.save();

      // outer ring for contrast
      ctx.beginPath();
      ctx.arc(node.x, node.y, scaledRadius + 2, 0, 2 * Math.PI, false);
      ctx.fillStyle = theme.palette.background.default;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(node.x, node.y, scaledRadius, 0, 2 * Math.PI, false);
      ctx.fillStyle = theme.palette.background.paper;
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(node.x, node.y, scaledRadius - 1, 0, 2 * Math.PI, false);
      ctx.clip();

      if (node.imageUrl) {
        let image = imageCache.current[node.id];
        if (!image) {
          image = new Image();
          image.src = node.imageUrl;
          image.onload = () => {
            imageCache.current[node.id] = image;
            const fg = graphRef.current as unknown as { refresh?: () => void };
            fg?.refresh?.();
          };
          image.onerror = () => {
            delete imageCache.current[node.id];
          };
          imageCache.current[node.id] = image;
        }

        if (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
          const squareSize = Math.min(image.naturalWidth, image.naturalHeight);
          const offsetX = (image.naturalWidth - squareSize) / 2;
          const offsetY = (image.naturalHeight - squareSize) / 2;
          ctx.drawImage(
            image,
            offsetX,
            offsetY,
            squareSize,
            squareSize,
            node.x - scaledRadius,
            node.y - scaledRadius,
            scaledRadius * 2,
            scaledRadius * 2,
          );
        } else {
          ctx.fillStyle = theme.palette.grey[500];
          ctx.fill();
        }
      } else {
        ctx.fillStyle = node.isRoot
          ? theme.palette.primary.main
          : theme.palette.grey[500];
        ctx.fillRect(
          node.x - scaledRadius,
          node.y - scaledRadius,
          scaledRadius * 2,
          scaledRadius * 2,
        );
      }

      ctx.restore();

      ctx.lineWidth = node.isRoot ? 3 : 1.8;
      ctx.strokeStyle = node.isRoot
        ? theme.palette.primary.light
        : theme.palette.grey[400];
      ctx.beginPath();
      ctx.arc(node.x, node.y, scaledRadius, 0, 2 * Math.PI, false);
      ctx.stroke();

      const label = node.displayName;
      const fontSize = Math.max(6, 12 / globalScale);
      ctx.font = `${fontSize}px ${theme.typography.fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = theme.palette.text.primary;
      ctx.fillText(label, node.x, node.y + scaledRadius + 4);

      ctx.restore();
    },
    [childRadius, rootRadius, theme]);

  const drawLinkLabel = useCallback(
    (link: GraphLink, ctx: CanvasRenderingContext2D, globalScale: number) => {
      if (!showEdgeLabels) {
        return;
      }
      const source = link.source as GraphNode;
      const target = link.target as GraphNode;
      if (
        typeof source?.x !== "number" ||
        typeof source?.y !== "number" ||
        typeof target?.x !== "number" ||
        typeof target?.y !== "number"
      ) {
        return;
      }
      const midX = (source.x + target.x) / 2;
      const midY = (source.y + target.y) / 2;
      const fontSize = Math.max(5, 10 / globalScale);
      ctx.save();
      ctx.font = `${fontSize}px ${theme.typography.fontFamily}`;
      ctx.fillStyle = theme.palette.text.secondary;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(link.weight), midX, midY);
      ctx.restore();
    },
    [showEdgeLabels, theme.palette.text.secondary, theme.typography.fontFamily],
  );

  const computeLinkWidth = useCallback(
    (link: GraphLink) => {
      const baseWidth = 1.5;
      const { min, max, median } = weightStats;
      if (max <= min) {
        return baseWidth + 1.5;
      }
      if (link.weight <= median) {
        const lowerSpan = Math.max(median - min, 1);
        const ratio = Math.max(0, (link.weight - min) / lowerSpan);
        return baseWidth + ratio * 2.5;
      }
      const upperSpan = Math.max(max - median, 1);
      const ratio = Math.max(0, (link.weight - median) / upperSpan);
      return baseWidth + 2.5 + ratio * 3.5;
    },
    [weightStats.min, weightStats.max, weightStats.median],
  );

  const computeLinkColor = useCallback(
    (link: GraphLink) => {
      const { median, q3 } = weightStats;
      if (link.weight >= q3) {
        return theme.palette.primary.main;
      }
      if (link.weight >= median) {
        return theme.palette.primary.light;
      }
      return theme.palette.grey[600];
    },
    [weightStats.median, weightStats.q3, theme.palette.primary.main, theme.palette.primary.light, theme.palette.grey],
  );

  const computeParticleCount = useCallback(
    (link: GraphLink) =>
      Math.max(0, Math.round(weightStats.normalize(link.weight) * 4)),
    [weightStats],
  );

  const computeParticleSpeed = useCallback(
    (link: GraphLink) => 0.0004 + weightStats.normalize(link.weight) * 0.002,
    [weightStats],
  );

  useEffect(() => {
    if (!graphRef.current || graphData.nodes.length === 0) {
      return;
    }
    const fg = graphRef.current;
    const chargeStrength = -140 - spacing * 2.2;
    fg.d3Force("charge", forceManyBody().strength(chargeStrength));

    const baseDistance = 80 + spacing * 0.9;
    const maxReduction = baseDistance * 0.45;
    const linkForce = fg.d3Force("link");
    if (linkForce && "distance" in linkForce) {
      (linkForce as unknown as { distance: (fn: (link: GraphLink) => number) => void }).distance(
        (link: GraphLink) =>
          baseDistance - weightStats.normalize(link.weight) * maxReduction,
      );
    }
    fg.d3ReheatSimulation();
  }, [graphData, spacing, weightStats]);

  useEffect(() => {
    if (!graphData.nodes.length || !graphRef.current) {
      return;
    }
    if (!width || !height) {
      return;
    }
    const timer = window.setTimeout(() => {
      graphRef.current?.zoomToFit(500, 50);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [graphData, depth, width, height]);

  const handleResetView = () => {
    graphRef.current?.zoomToFit(500, 50);
  };

  const hasGraph = graphData.nodes.length > 0;
  const graphKey = `${graph?.root_id ?? "graph"}-${depth}-${minWeight}`;
  const minWeightSliderMin = fullWeightSummary.min;
  const minWeightSliderMax = Math.max(
    minWeightSliderMin,
    fullWeightSummary.max,
  );

  return (
    <Paper sx={{ p: 2, height: "100%" }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h6">Relationship Graph</Typography>
          <Typography variant="body2" color="text.secondary">
            Nodes represent people; brighter, thicker edges mean more shared media.
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
            control={(
              <Checkbox
                size="small"
                checked={showEdgeLabels}
                onChange={(event) => setShowEdgeLabels(event.target.checked)}
              />
            )}
            label="Show counts"
          />
         {hasGraph ? (
           <Box sx={{ width: 160, px: 1 }}>
             <Typography variant="caption" color="text.secondary">
               Spacing
             </Typography>
              <Slider
                value={spacing}
                onChange={(_event, value) => setSpacing(value as number)}
                min={10}
                max={350}
                size="small"
                aria-label="Graph spacing"
              />
            </Box>
          ) : null}
          {graph ? (
            <Box sx={{ width: 220, px: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Minimum co-appearances: {minWeight}
              </Typography>
              <Slider
                value={minWeight}
                min={minWeightSliderMin}
                max={minWeightSliderMax}
                step={1}
                size="small"
                onChange={(_event, value) => setMinWeight(value as number)}
                valueLabelDisplay="auto"
                aria-label="Minimum co-appearances"
              />
            </Box>
          ) : null}
          {hasGraph ? (
            <Button variant="outlined" size="small" onClick={handleResetView}>
              Reset view
            </Button>
          ) : null}
        </Box>
      </Box>

      <Box
        ref={containerRef}
        sx={{
          position: "relative",
          width: "100%",
          height: { xs: 420, md: 560 },
          borderRadius: 2,
          overflow: "hidden",
          backgroundColor: theme.palette.background.default,
        }}
      >
        {isLoading ? (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2,
              backdropFilter: "blur(1px)",
            }}
          >
            <CircularProgress />
          </Box>
        ) : null}

        {!isLoading && !hasGraph ? (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "text.secondary",
            }}
          >
            <Typography>No relationship data available yet.</Typography>
          </Box>
        ) : null}

        {hasGraph ? (
          <ForceGraph2D
            key={graphKey}
            ref={graphRef}
            graphData={graphData}
            width={width ?? DEFAULT_CANVAS.width}
            height={height ?? DEFAULT_CANVAS.height}
            backgroundColor={theme.palette.background.default}
            enableZoomPanInteraction
            enableNodeDrag
            nodeRelSize={6}
            nodeLabel={(node: GraphNode) => node.displayName}
            onNodeClick={handleNodeClick}
            nodeCanvasObject={drawNode}
            linkCanvasObject={showEdgeLabels ? drawLinkLabel : undefined}
            linkCanvasObjectMode={showEdgeLabels ? () => "after" : undefined}
            linkWidth={computeLinkWidth}
            linkColor={computeLinkColor}
            linkDirectionalParticles={computeParticleCount}
            linkDirectionalParticleWidth={2}
            linkDirectionalParticleSpeed={computeParticleSpeed}
            cooldownTicks={90}
          />
        ) : null}
      </Box>
    </Paper>
  );
};

export default PersonRelationshipGraph;
