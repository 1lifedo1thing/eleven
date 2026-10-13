import type { LoadedBy, ModelInfo, Recording, ShaderLibrary } from "./types";

/**
 * Where the GPU views read from; each method mirrors one REA tool call. Implementors resolve
 * with empty lists when the target has nothing of that kind and reject only on real failures.
 */
export interface GpuSource {
  readonly live: boolean;
  executable(): Promise<string>;
  listLibraries(): Promise<readonly ShaderLibrary[]>;
  functionIr(library: string, name: string): Promise<string>;
  /** The CPU code that loads this shader by name, or null when nothing does. */
  loadedBy(library: string, name: string): Promise<LoadedBy | null>;
  listModels(): Promise<readonly ModelInfo[]>;
  listRecordings(): Promise<readonly Recording[]>;
  /** Runs the app once under Metal System Trace. Callers ask the user first, because it runs the app. */
  record(): Promise<void>;
}
