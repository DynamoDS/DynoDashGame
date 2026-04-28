/** Minimal representation of a node extracted from a Dynamo .dyn file. */
export interface DynNode {
  id: string;
  name: string;
  x: number;
  y: number;
}

/**
 * Directed data edge: Dynamo `Connectors[].Start` (output port) → `End` (input port),
 * resolved to the owning node GUIDs (normalized for matching).
 */
export interface DynWireEdge {
  fromNodeId: string;
  toNodeId: string;
}

export interface DynParseResult {
  nodes: DynNode[];
  /** Graph wires; empty if the file has no `Connectors` or ports could not be resolved. */
  edges: DynWireEdge[];
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Dynamo matches NodeViews to Nodes by GUID. The same GUID may appear as 32 hex digits in one
 * place and with hyphens / braces in another; normalize so lookups always hit.
 */
export function normalizeDynNodeId(raw: string): string {
  return raw.trim().replace(/[{}]/g, "").replace(/-/g, "").toLowerCase();
}

/** Coerce JSON number or numeric string to a finite number (Dynamo sometimes emits strings). */
function readDynNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) {
    return v;
  }
  if (typeof v === "string") {
    const n = Number.parseFloat(v.trim());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function getViewObject(o: Record<string, unknown>): Record<string, unknown> | undefined {
  const v = o.View ?? o.view;
  return isRecord(v) ? v : undefined;
}

function getNodeViewsArray(viewRoot: Record<string, unknown>): unknown[] {
  const raw = viewRoot.NodeViews ?? viewRoot.nodeViews;
  return Array.isArray(raw) ? raw : [];
}

/**
 * Dynamo stores canvas positions on `View.NodeViews[]` (see WorkspaceModel.LoadNodes).
 * `Nodes[]` entries usually omit X/Y; without this merge every node stays at (0,0) and the level
 * stacks every slab on top of each other.
 */
function mergeNodeViewPositions(o: Record<string, unknown>, nodes: DynNode[]): void {
  const viewRoot = getViewObject(o);
  if (!viewRoot) {
    return;
  }
  const nodeViews = getNodeViewsArray(viewRoot);
  const viewById = new Map<string, { x: number; y: number; name?: string }>();
  for (const entry of nodeViews) {
    if (!isRecord(entry)) {
      continue;
    }
    const idRaw = String(entry.Id ?? entry.id ?? entry.GUID ?? entry.guid ?? "").trim();
    if (!idRaw) {
      continue;
    }
    const key = normalizeDynNodeId(idRaw);
    const x = readDynNumber(entry.X ?? entry.x);
    const y = readDynNumber(entry.Y ?? entry.y);
    const nameRaw = entry.Name ?? entry.name;
    const name = typeof nameRaw === "string" && nameRaw.trim() ? nameRaw.trim() : undefined;
    viewById.set(key, { x, y, name });
  }
  for (const n of nodes) {
    const pos = viewById.get(normalizeDynNodeId(n.id));
    if (pos !== undefined) {
      n.x = pos.x;
      n.y = pos.y;
      if (pos.name !== undefined) {
        n.name = pos.name;
      }
    }
  }
}

/** Map every input/output port UUID on the graph to its parent node's normalized id. */
function buildPortToNodeMap(o: Record<string, unknown>): Map<string, string> {
  const m = new Map<string, string>();
  const rawNodes = Array.isArray(o.Nodes) ? o.Nodes : Array.isArray(o.nodes) ? o.nodes : [];
  for (const n of rawNodes as unknown[]) {
    if (n === null || typeof n !== "object") continue;
    const node = n as Record<string, unknown>;
    const idRaw = String(
      node.Id ?? node.id ?? node.GUID ?? node.guid ?? node.UUID ?? node.uuid ?? "",
    ).trim();
    if (!idRaw) continue;
    const nid = normalizeDynNodeId(idRaw);

    const registerPorts = (arr: unknown) => {
      if (!Array.isArray(arr)) return;
      for (const p of arr) {
        if (!isRecord(p)) continue;
        const pid = String(p.Id ?? p.id ?? "").trim();
        if (pid) m.set(normalizeDynNodeId(pid), nid);
      }
    };
    registerPorts(node.Inputs);
    registerPorts(node.Outputs);
  }
  return m;
}

/**
 * Parse `Connectors` (Start = output port, End = input port) into node→node edges.
 * Supports fan-out, fan-in, and arbitrary topology (not only a chain).
 */
function parseDynWireEdges(o: Record<string, unknown>): DynWireEdge[] {
  const portToNode = buildPortToNodeMap(o);
  const raw = Array.isArray(o.Connectors)
    ? o.Connectors
    : Array.isArray(o.connectors)
      ? o.connectors
      : [];
  const edges: DynWireEdge[] = [];
  for (const c of raw) {
    if (!isRecord(c)) continue;
    const start = String(c.Start ?? c.start ?? "").trim();
    const end = String(c.End ?? c.end ?? "").trim();
    if (!start || !end) continue;
    const fromN = portToNode.get(normalizeDynNodeId(start));
    const toN = portToNode.get(normalizeDynNodeId(end));
    if (!fromN || !toN || fromN === toN) continue;
    edges.push({ fromNodeId: fromN, toNodeId: toN });
  }
  return edges;
}

/** Parse a raw .dyn JSON object into nodes, canvas positions, and graph wires. */
export function parseDynFile(json: unknown): DynParseResult {
  if (json === null || typeof json !== "object") {
    return { nodes: [], edges: [] };
  }
  const o = json as Record<string, unknown>;
  const rawNodes = Array.isArray(o.Nodes) ? o.Nodes : Array.isArray(o.nodes) ? o.nodes : [];
  const nodes: DynNode[] = [];
  for (const n of rawNodes as unknown[]) {
    if (n === null || typeof n !== "object") continue;
    const node = n as Record<string, unknown>;
    const idRaw = String(
      node.Id ?? node.id ?? node.GUID ?? node.guid ?? node.UUID ?? node.uuid ?? "",
    ).trim();
    if (!idRaw) continue;
    nodes.push({
      id: idRaw,
      name: String(node.Name ?? node.name ?? node.ConcreteType ?? "Node"),
      x: readDynNumber(node.X ?? node.x),
      y: readDynNumber(node.Y ?? node.y),
    });
  }
  mergeNodeViewPositions(o, nodes);
  const edges = parseDynWireEdges(o);
  return { nodes, edges };
}
