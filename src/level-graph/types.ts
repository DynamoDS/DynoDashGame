/**
 * Directed port graph (Dynamo-style): nodes expose inputs/outputs; wires connect
 * one output port to one input port. Use for level logic, spawn chains, triggers, etc.
 */

export type NodeId = string;
export type PortId = string;
export type WireId = string;

/** Connection point on a node. */
export interface GraphPort {
  id: PortId;
  /** Optional semantic tag for editors or runtime (e.g. "flow", "ref", "bool"). */
  kind?: string;
}

/** Endpoint of a wire: node + port. */
export interface GraphEndpoint {
  nodeId: NodeId;
  portId: PortId;
}

export interface GraphNode {
  id: NodeId;
  /** Domain type: "spawn", "platform", "coin", "enemy", "goal", … */
  type: string;
  /** Editor / blueprint layout (graph space, not necessarily world pixels). */
  x?: number;
  y?: number;
  /** Node-specific parameters; keep JSON-serializable for level files. */
  props?: Record<string, unknown>;
  /**
   * Explicit ports. If omitted, {@link effectiveInputs} / {@link effectiveOutputs}
   * assume a single `in` and `out` port for simple linear graphs.
   */
  inputs?: GraphPort[];
  outputs?: GraphPort[];
}

export interface GraphWire {
  id: WireId;
  from: GraphEndpoint;
  to: GraphEndpoint;
}

/**
 * Serializable snapshot of a level as a graph (nodes + wires).
 * Load from JSON, validate, then interpret `type` + `props` in game code.
 */
export interface LevelGraph {
  version: number;
  nodes: GraphNode[];
  wires: GraphWire[];
}

export interface GraphValidationIssue {
  code: string;
  message: string;
  wireId?: WireId;
  nodeId?: NodeId;
}
