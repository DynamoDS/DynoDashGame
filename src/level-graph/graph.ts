import type {
  GraphEndpoint,
  GraphNode,
  GraphPort,
  GraphValidationIssue,
  GraphWire,
  LevelGraph,
  NodeId,
  WireId,
} from "./types";

const DEFAULT_IN: GraphPort = { id: "in" };
const DEFAULT_OUT: GraphPort = { id: "out" };

export function effectiveInputs(node: GraphNode): GraphPort[] {
  if (node.inputs !== undefined && node.inputs.length > 0) {
    return node.inputs;
  }
  return [DEFAULT_IN];
}

export function effectiveOutputs(node: GraphNode): GraphPort[] {
  if (node.outputs !== undefined && node.outputs.length > 0) {
    return node.outputs;
  }
  return [DEFAULT_OUT];
}

function portIds(ports: GraphPort[]): Set<string> {
  return new Set(ports.map((p) => p.id));
}

function hasPort(node: GraphNode, end: GraphEndpoint, direction: "in" | "out"): boolean {
  const ports = direction === "in" ? effectiveInputs(node) : effectiveOutputs(node);
  return portIds(ports).has(end.portId);
}

/** Incoming wires keyed by `${nodeId}:${portId}` (at most one per port if validated). */
export function wiresByTarget(graph: LevelGraph): Map<string, GraphWire> {
  const map = new Map<string, GraphWire>();
  for (const w of graph.wires) {
    const key = `${w.to.nodeId}:${w.to.portId}`;
    map.set(key, w);
  }
  return map;
}

export function wiresInto(graph: LevelGraph, nodeId: NodeId): GraphWire[] {
  return graph.wires.filter((w) => w.to.nodeId === nodeId);
}

export function wiresOutOf(graph: LevelGraph, nodeId: NodeId): GraphWire[] {
  return graph.wires.filter((w) => w.from.nodeId === nodeId);
}

/**
 * Nodes reachable from `roots` following wire direction (from → to).
 */
export function reachableFrom(graph: LevelGraph, roots: NodeId[]): Set<NodeId> {
  const nodes = nodeMap(graph);
  const seen = new Set<NodeId>();
  const stack = [...roots];
  while (stack.length > 0) {
    const id = stack.pop();
    if (id === undefined || seen.has(id)) {
      continue;
    }
    if (!nodes.has(id)) {
      continue;
    }
    seen.add(id);
    for (const w of wiresOutOf(graph, id)) {
      if (!seen.has(w.to.nodeId)) {
        stack.push(w.to.nodeId);
      }
    }
  }
  return seen;
}

export function nodeMap(graph: LevelGraph): Map<NodeId, GraphNode> {
  const m = new Map<NodeId, GraphNode>();
  for (const n of graph.nodes) {
    m.set(n.id, n);
  }
  return m;
}

/**
 * Validate structure: unique node ids, wires reference existing nodes and ports.
 * If `singleConsumerInputs` is true, each input port accepts at most one wire (Dynamo-style).
 */
export function validateLevelGraph(
  graph: LevelGraph,
  options: { singleConsumerInputs?: boolean } = {},
): GraphValidationIssue[] {
  const issues: GraphValidationIssue[] = [];
  const { singleConsumerInputs = true } = options;
  const ids = new Set<NodeId>();
  for (const n of graph.nodes) {
    if (ids.has(n.id)) {
      issues.push({
        code: "DUPLICATE_NODE_ID",
        message: `Duplicate node id: ${n.id}`,
        nodeId: n.id,
      });
    }
    ids.add(n.id);
  }

  const nodes = nodeMap(graph);
  const consumerCount = new Map<string, number>();

  for (const w of graph.wires) {
    const fromNode = nodes.get(w.from.nodeId);
    if (fromNode === undefined) {
      issues.push({
        code: "WIRE_FROM_UNKNOWN_NODE",
        message: `Wire ${w.id}: from node "${w.from.nodeId}" does not exist`,
        wireId: w.id,
        nodeId: w.from.nodeId,
      });
    } else if (!hasPort(fromNode, w.from, "out")) {
      issues.push({
        code: "WIRE_FROM_BAD_PORT",
        message: `Wire ${w.id}: node "${w.from.nodeId}" has no output port "${w.from.portId}"`,
        wireId: w.id,
        nodeId: w.from.nodeId,
      });
    }

    const toNode = nodes.get(w.to.nodeId);
    if (toNode === undefined) {
      issues.push({
        code: "WIRE_TO_UNKNOWN_NODE",
        message: `Wire ${w.id}: to node "${w.to.nodeId}" does not exist`,
        wireId: w.id,
        nodeId: w.to.nodeId,
      });
    } else if (!hasPort(toNode, w.to, "in")) {
      issues.push({
        code: "WIRE_TO_BAD_PORT",
        message: `Wire ${w.id}: node "${w.to.nodeId}" has no input port "${w.to.portId}"`,
        wireId: w.id,
        nodeId: w.to.nodeId,
      });
    }

    if (singleConsumerInputs && toNode !== undefined) {
      const key = `${w.to.nodeId}:${w.to.portId}`;
      consumerCount.set(key, (consumerCount.get(key) ?? 0) + 1);
    }
  }

  if (singleConsumerInputs) {
    for (const [key, count] of consumerCount) {
      if (count > 1) {
        issues.push({
          code: "MULTIPLE_WIRES_TO_INPUT",
          message: `Input port ${key} has ${count} incoming wires (max 1)`,
        });
      }
    }
  }

  return issues;
}

/** Parse JSON into {@link LevelGraph}; throws if shape is invalid. */
export function parseLevelGraph(json: unknown): LevelGraph {
  if (json === null || typeof json !== "object") {
    throw new TypeError("Level graph must be a JSON object");
  }
  const o = json as Record<string, unknown>;
  if (typeof o.version !== "number" || !Number.isFinite(o.version)) {
    throw new TypeError("Level graph must have numeric version");
  }
  if (!Array.isArray(o.nodes) || !Array.isArray(o.wires)) {
    throw new TypeError("Level graph must have nodes[] and wires[]");
  }
  for (const n of o.nodes as unknown[]) {
    if (n === null || typeof n !== "object" || typeof (n as Record<string, unknown>).id !== "string") {
      throw new TypeError("Each node must have a string id");
    }
  }
  for (const w of o.wires as unknown[]) {
    const wire = w as Record<string, unknown>;
    if (
      wire === null || typeof wire !== "object" ||
      typeof wire.id !== "string" ||
      wire.from === null || typeof wire.from !== "object" ||
      wire.to === null || typeof wire.to !== "object"
    ) {
      throw new TypeError("Each wire must have a string id, a from object, and a to object");
    }
  }
  // Shape has been validated above; double cast is intentional.
  return o as unknown as LevelGraph;
}

let idCounter = 0;

/** Stable-enough wire id for authoring tools (not cryptographically unique). */
export function nextWireId(): WireId {
  idCounter += 1;
  return `wire_${idCounter}`;
}
