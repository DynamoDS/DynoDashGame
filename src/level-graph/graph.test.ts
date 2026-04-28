import { describe, it, expect } from "vitest";
import {
  parseLevelGraph,
  reachableFrom,
  validateLevelGraph,
  wiresInto,
  wiresOutOf,
} from "./graph";
import type { LevelGraph } from "./types";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeGraph(
  nodes: { id: string }[],
  wires: { id: string; fromNode: string; fromPort?: string; toNode: string; toPort?: string }[],
): LevelGraph {
  return {
    version: 1,
    nodes: nodes.map(n => ({ id: n.id, type: "platform", props: {} })),
    wires: wires.map(w => ({
      id: w.id,
      from: { nodeId: w.fromNode, portId: w.fromPort ?? "out" },
      to: { nodeId: w.toNode, portId: w.toPort ?? "in" },
    })),
  };
}

// ── parseLevelGraph ────────────────────────────────────────────────────────────

describe("parseLevelGraph", () => {
  it("throws for null input", () => {
    expect(() => parseLevelGraph(null)).toThrow("JSON object");
  });

  it("throws for non-object input", () => {
    expect(() => parseLevelGraph("string")).toThrow("JSON object");
    expect(() => parseLevelGraph(42)).toThrow("JSON object");
  });

  it("throws when version is missing", () => {
    expect(() => parseLevelGraph({ nodes: [], wires: [] })).toThrow("version");
  });

  it("throws when version is non-numeric", () => {
    expect(() => parseLevelGraph({ version: "1", nodes: [], wires: [] })).toThrow("version");
  });

  it("throws when nodes is missing", () => {
    expect(() => parseLevelGraph({ version: 1, wires: [] })).toThrow("nodes[]");
  });

  it("throws when a node is missing id", () => {
    expect(() => parseLevelGraph({ version: 1, nodes: [{ label: "x" }], wires: [] })).toThrow("string id");
  });

  it("throws when a wire is missing id", () => {
    expect(() =>
      parseLevelGraph({
        version: 1,
        nodes: [{ id: "a" }],
        wires: [{ from: { nodeId: "a", portId: "out" }, to: { nodeId: "a", portId: "in" } }],
      }),
    ).toThrow("string id");
  });

  it("throws when a wire is missing from", () => {
    expect(() =>
      parseLevelGraph({
        version: 1,
        nodes: [{ id: "a" }],
        wires: [{ id: "w1", to: { nodeId: "a", portId: "in" } }],
      }),
    ).toThrow("from object");
  });

  it("parses a valid minimal graph", () => {
    const graph = parseLevelGraph({ version: 1, nodes: [{ id: "a" }], wires: [] });
    expect(graph).toBeDefined();
  });
});

// ── reachableFrom ──────────────────────────────────────────────────────────────

describe("reachableFrom", () => {
  it("returns only the root when there are no wires", () => {
    const g = makeGraph([{ id: "a" }, { id: "b" }], []);
    expect(reachableFrom(g, ["a"])).toEqual(new Set(["a"]));
  });

  it("follows a simple chain", () => {
    const g = makeGraph(
      [{ id: "a" }, { id: "b" }, { id: "c" }],
      [
        { id: "w1", fromNode: "a", toNode: "b" },
        { id: "w2", fromNode: "b", toNode: "c" },
      ],
    );
    expect(reachableFrom(g, ["a"])).toEqual(new Set(["a", "b", "c"]));
  });

  it("does not traverse backwards", () => {
    const g = makeGraph(
      [{ id: "a" }, { id: "b" }],
      [{ id: "w1", fromNode: "a", toNode: "b" }],
    );
    expect(reachableFrom(g, ["b"])).toEqual(new Set(["b"]));
  });

  it("handles fan-out", () => {
    const g = makeGraph(
      [{ id: "a" }, { id: "b" }, { id: "c" }],
      [
        { id: "w1", fromNode: "a", toNode: "b" },
        { id: "w2", fromNode: "a", toNode: "c" },
      ],
    );
    expect(reachableFrom(g, ["a"])).toEqual(new Set(["a", "b", "c"]));
  });

  it("handles cycles without infinite loop", () => {
    const g = makeGraph(
      [{ id: "a" }, { id: "b" }],
      [
        { id: "w1", fromNode: "a", toNode: "b" },
        { id: "w2", fromNode: "b", toNode: "a" },
      ],
    );
    expect(reachableFrom(g, ["a"])).toEqual(new Set(["a", "b"]));
  });

  it("returns empty set for empty roots", () => {
    const g = makeGraph([{ id: "a" }], []);
    expect(reachableFrom(g, [])).toEqual(new Set());
  });
});

// ── wiresInto / wiresOutOf ─────────────────────────────────────────────────────

describe("wiresInto / wiresOutOf", () => {
  const g = makeGraph(
    [{ id: "a" }, { id: "b" }, { id: "c" }],
    [
      { id: "w1", fromNode: "a", toNode: "b" },
      { id: "w2", fromNode: "a", toNode: "c" },
    ],
  );

  it("wiresOutOf returns all wires leaving a node", () => {
    expect(wiresOutOf(g, "a").map(w => w.id)).toEqual(["w1", "w2"]);
  });

  it("wiresOutOf returns empty for a sink node", () => {
    expect(wiresOutOf(g, "b")).toEqual([]);
  });

  it("wiresInto returns the wire entering a node", () => {
    expect(wiresInto(g, "b").map(w => w.id)).toEqual(["w1"]);
  });

  it("wiresInto returns empty for a source node", () => {
    expect(wiresInto(g, "a")).toEqual([]);
  });
});

// ── validateLevelGraph ─────────────────────────────────────────────────────────

describe("validateLevelGraph", () => {
  it("returns no issues for a valid graph", () => {
    const g = makeGraph(
      [{ id: "a" }, { id: "b" }],
      [{ id: "w1", fromNode: "a", toNode: "b" }],
    );
    expect(validateLevelGraph(g)).toEqual([]);
  });

  it("flags duplicate node ids", () => {
    const g = makeGraph([{ id: "a" }, { id: "a" }], []);
    const issues = validateLevelGraph(g);
    expect(issues.some(i => i.code === "DUPLICATE_NODE_ID")).toBe(true);
  });

  it("flags a wire referencing a non-existent from-node", () => {
    const g = makeGraph(
      [{ id: "a" }],
      [{ id: "w1", fromNode: "missing", toNode: "a" }],
    );
    const issues = validateLevelGraph(g);
    expect(issues.some(i => i.code === "WIRE_FROM_UNKNOWN_NODE")).toBe(true);
  });

  it("flags a wire referencing a non-existent to-node", () => {
    const g = makeGraph(
      [{ id: "a" }],
      [{ id: "w1", fromNode: "a", toNode: "missing" }],
    );
    const issues = validateLevelGraph(g);
    expect(issues.some(i => i.code === "WIRE_TO_UNKNOWN_NODE")).toBe(true);
  });

  it("flags multiple wires into the same input port (singleConsumerInputs)", () => {
    const g = makeGraph(
      [{ id: "a" }, { id: "b" }, { id: "c" }],
      [
        { id: "w1", fromNode: "a", toNode: "c", toPort: "in" },
        { id: "w2", fromNode: "b", toNode: "c", toPort: "in" },
      ],
    );
    const issues = validateLevelGraph(g, { singleConsumerInputs: true });
    expect(issues.some(i => i.code === "MULTIPLE_WIRES_TO_INPUT")).toBe(true);
  });

  it("allows multiple wires to same port when singleConsumerInputs is false", () => {
    const g = makeGraph(
      [{ id: "a" }, { id: "b" }, { id: "c" }],
      [
        { id: "w1", fromNode: "a", toNode: "c", toPort: "in" },
        { id: "w2", fromNode: "b", toNode: "c", toPort: "in" },
      ],
    );
    const issues = validateLevelGraph(g, { singleConsumerInputs: false });
    expect(issues.every(i => i.code !== "MULTIPLE_WIRES_TO_INPUT")).toBe(true);
  });
});
