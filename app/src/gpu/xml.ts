/** A tiny XML reader for xctrace exports: elements, attributes and text, with id/ref values resolved. */
export type XmlNode = { readonly tag: string; readonly attrs: Readonly<Record<string, string>>; readonly children: XmlNode[]; text: string };

const TOKEN = /<(\/?)([\w:-]+)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>|<\?[^>]*\?>|<!--[\s\S]*?-->|([^<]+)/g;
const ATTR = /([\w:-]+)="([^"]*)"/g;

function decode(text: string): string {
  return text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

export function parseXml(source: string): XmlNode {
  const root: XmlNode = { tag: "#root", attrs: {}, children: [], text: "" };
  const stack: XmlNode[] = [root];
  for (const match of source.matchAll(TOKEN)) {
    const [, closing, tag, attrText, selfClosing, text] = match;
    const top = stack[stack.length - 1];
    if (!top) break;
    if (text !== undefined) {
      top.text += decode(text);
    } else if (tag && closing) {
      stack.pop();
    } else if (tag) {
      const attrs = Object.fromEntries([...(attrText ?? "").matchAll(ATTR)].map((a) => [a[1] ?? "", decode(a[2] ?? "")]));
      const node: XmlNode = { tag, attrs, children: [], text: "" };
      top.children.push(node);
      if (!selfClosing) stack.push(node);
    }
  }
  return root;
}

export function findAll(node: XmlNode, tag: string, found: XmlNode[] = []): XmlNode[] {
  if (node.tag === tag) found.push(node);
  for (const child of node.children) findAll(child, tag, found);
  return found;
}

/** Each row's cells by column mnemonic, with `ref` cells swapped for the element they point to. */
export function tableRows(doc: XmlNode): readonly ReadonlyMap<string, XmlNode>[] {
  const columns = findAll(doc, "mnemonic").map((node) => node.text.trim());
  const byId = new Map<string, XmlNode>();
  const index = (node: XmlNode): void => {
    const id = node.attrs.id;
    if (id) byId.set(id, node);
    node.children.forEach(index);
  };
  index(doc);
  return findAll(doc, "row").map((row) => new Map(row.children.map((cell, ix) => [columns[ix] ?? String(ix), cell.attrs.ref ? (byId.get(cell.attrs.ref) ?? cell) : cell])));
}
