type TiptapNode = { type?: string; text?: string; content?: TiptapNode[] };

export function tiptapToPlaintext(doc: unknown): string {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return "";
  const node = doc as TiptapNode;
  if (typeof node.text === "string") return node.text;
  if (!Array.isArray(node.content)) return "";
  // Separate paragraphs with newlines; inline nodes join without separator.
  const sep = node.type === "doc" ? "\n" : "";
  return node.content.map(tiptapToPlaintext).filter(Boolean).join(sep);
}
