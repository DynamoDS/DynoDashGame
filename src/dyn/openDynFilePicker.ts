import { parseDynFile, type DynNode, type DynWireEdge } from "./types";
import { REG_DYN_EDGES, REG_DYN_FROM_UPLOAD, REG_DYN_NODES } from "../config/registryKeys";

export interface DynPickerCallbacks {
  onSuccess: (nodes: DynNode[], edges: DynWireEdge[]) => void;
  onEmpty: () => void;
  onError: () => void;
  /** Called instead of onError when the chosen file exceeds MAX_DYN_BYTES. */
  onTooBig?: () => void;
}

const MAX_DYN_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Writes dynNodes, dynEdges, and the upload flag into a Phaser registry.
 * Extracted here so MenuScene and WinScene don't duplicate the same three
 * registry.set calls.
 */
export function storeDynInRegistry(
  registry: { set(key: string, value: unknown): void },
  nodes: DynNode[],
  edges: DynWireEdge[],
): void {
  registry.set(REG_DYN_NODES, nodes);
  registry.set(REG_DYN_EDGES, edges);
  registry.set(REG_DYN_FROM_UPLOAD, true);
}

/**
 * Opens a hidden file-input dialog restricted to `.dyn` files, reads the chosen
 * file as text, parses it via `parseDynFile`, and calls the appropriate callback.
 *
 * Used by MenuScene and WinScene to avoid duplicating the same file-picker logic.
 */
export function openDynFilePicker(callbacks: DynPickerCallbacks): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".dyn";
  input.style.cssText = "position:fixed;opacity:0;pointer-events:none;";
  document.body.appendChild(input);

  input.onchange = () => {
    const file = input.files?.[0];
    document.body.removeChild(input);
    if (!file) return;
    if (file.size > MAX_DYN_BYTES) {
      (callbacks.onTooBig ?? callbacks.onError)();
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== "string") {
          callbacks.onError();
          return;
        }
        const json: unknown = JSON.parse(text);
        const { nodes, edges } = parseDynFile(json);
        if (nodes.length === 0) {
          callbacks.onEmpty();
          return;
        }
        callbacks.onSuccess(nodes, edges);
      } catch (e) {
        console.warn("[openDynFilePicker] Failed to parse .dyn file:", e);
        callbacks.onError();
      }
    };
    reader.readAsText(file);
  };

  input.click();
}
