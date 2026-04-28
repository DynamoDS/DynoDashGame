import { describe, it, expect } from "vitest";
import { parseDynFile, normalizeDynNodeId } from "./types";

describe("normalizeDynNodeId", () => {
  it("lowercases and strips hyphens and braces", () => {
    expect(normalizeDynNodeId("{A1B2-C3D4}")).toBe("a1b2c3d4");
    expect(normalizeDynNodeId("A1B2C3D4")).toBe("a1b2c3d4");
    expect(normalizeDynNodeId("a1b2-c3d4")).toBe("a1b2c3d4");
  });

  it("trims whitespace", () => {
    expect(normalizeDynNodeId("  abc123  ")).toBe("abc123");
  });
});

describe("parseDynFile", () => {
  it("returns empty result for null input", () => {
    expect(parseDynFile(null)).toEqual({ nodes: [], edges: [] });
  });

  it("returns empty result for non-object input", () => {
    expect(parseDynFile("string")).toEqual({ nodes: [], edges: [] });
    expect(parseDynFile(42)).toEqual({ nodes: [], edges: [] });
  });

  it("returns empty result for empty object", () => {
    expect(parseDynFile({})).toEqual({ nodes: [], edges: [] });
  });

  it("parses a minimal node", () => {
    const input = {
      Nodes: [{ Id: "abc123", Name: "TestNode", X: 10, Y: 20 }],
    };
    const { nodes, edges } = parseDynFile(input);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ id: "abc123", name: "TestNode", x: 10, y: 20 });
    expect(edges).toEqual([]);
  });

  it("supports lowercase node keys", () => {
    const input = {
      nodes: [{ id: "node1", name: "Foo" }],
    };
    const { nodes } = parseDynFile(input);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe("node1");
  });

  it("merges View.NodeViews positions into nodes", () => {
    const input = {
      Nodes: [{ Id: "node-1", Name: "A" }],
      View: {
        NodeViews: [{ Id: "node-1", X: 100, Y: 200 }],
      },
    };
    const { nodes } = parseDynFile(input);
    expect(nodes[0]).toMatchObject({ x: 100, y: 200 });
  });

  it("normalizes GUIDs when matching NodeViews (braces, hyphens, case)", () => {
    const input = {
      Nodes: [{ Id: "{AA-BB}", Name: "A" }],
      View: {
        NodeViews: [{ Id: "aabb", X: 55, Y: 66 }],
      },
    };
    const { nodes } = parseDynFile(input);
    expect(nodes[0]).toMatchObject({ x: 55, y: 66 });
  });

  it("parses edges from Connectors via port maps", () => {
    const input = {
      Nodes: [
        { Id: "node-a", Name: "A", Outputs: [{ Id: "port-out" }] },
        { Id: "node-b", Name: "B", Inputs: [{ Id: "port-in" }] },
      ],
      Connectors: [{ Start: "port-out", End: "port-in" }],
    };
    const { edges } = parseDynFile(input);
    expect(edges).toHaveLength(1);
    expect(edges[0].fromNodeId).toBe(normalizeDynNodeId("node-a"));
    expect(edges[0].toNodeId).toBe(normalizeDynNodeId("node-b"));
  });

  it("skips self-loop edges", () => {
    const input = {
      Nodes: [{ Id: "node-a", Name: "A", Outputs: [{ Id: "p1" }], Inputs: [{ Id: "p2" }] }],
      Connectors: [{ Start: "p1", End: "p2" }],
    };
    const { edges } = parseDynFile(input);
    expect(edges).toEqual([]);
  });

  it("handles numeric string coordinates from Dynamo", () => {
    const input = {
      Nodes: [{ Id: "x", Name: "N", X: "12.5", Y: "34.0" }],
    };
    const { nodes } = parseDynFile(input);
    expect(nodes[0].x).toBe(12.5);
    expect(nodes[0].y).toBe(34);
  });

  it("skips nodes without an id", () => {
    const input = {
      Nodes: [{ Name: "NoId", X: 0, Y: 0 }, { Id: "valid", Name: "Valid" }],
    };
    const { nodes } = parseDynFile(input);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe("valid");
  });
});
