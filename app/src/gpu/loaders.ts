import { isRecord, stringField } from "../lib/guards";
import { rea } from "../engine/rea";

/** Where an Objective-C string literal's text pointer sits inside its CFString record. */
const CFSTRING_TEXT_OFFSET = 0x10n;
const MAX_HOPS = 6;

export type Loader = { readonly name: string; readonly address: string };

function addresses(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.startsWith("0x")) : [];
}

async function containing(executable: string, address: string): Promise<Loader | null> {
  const result = await rea.tool(executable, "resolve_containing_procedure", { address });
  const procedure = isRecord(result) && result.found === true ? result.procedure : null;
  const name = stringField(procedure, "name");
  const start = stringField(procedure, "address");
  const thunk = isRecord(procedure) && isRecord(procedure.classification) && procedure.classification.thunk === true;
  return name && start && !thunk ? { name, address: start } : null;
}

async function referrers(executable: string, address: string): Promise<readonly string[]> {
  return addresses(await rea.tool(executable, "xrefs", { address }));
}

/**
 * The functions in an app's executable that use a shader by name: the string's referrers,
 * stepping through the CFString record that Objective-C literals go through.
 */
export async function findLoaders(executable: string, shader: string): Promise<readonly Loader[]> {
  const hits = await rea.tool(executable, "search_strings", { pattern: shader });
  const strings = Array.isArray(hits) ? hits.flatMap((hit) => (stringField(hit, "value") === shader ? (stringField(hit, "address") ?? []) : [])) : [];
  const found = new Map<string, Loader>();
  for (const text of strings) {
    for (const ref of (await referrers(executable, text)).slice(0, MAX_HOPS)) {
      const direct = await containing(executable, ref);
      const record = `0x${(BigInt(ref) - CFSTRING_TEXT_OFFSET).toString(16)}`;
      const sites = direct ? [] : await referrers(executable, record);
      const loaders = direct ? [direct] : await Promise.all(sites.slice(0, MAX_HOPS).map((site) => containing(executable, site)));
      for (const loader of loaders) if (loader) found.set(loader.address, loader);
    }
  }
  return [...found.values()];
}
