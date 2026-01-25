export type TiptapNode = {
  type?: string;
  attrs?: Record<string, unknown> | null;
  text?: string;
  content?: TiptapNode[];
};

export type ImageNodeAttrs = {
  src?: string;
  filePath?: string;
  alt?: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asNode(value: unknown): TiptapNode | null {
  if (!isObject(value)) return null;
  return value as TiptapNode;
}

/**
 * Extracts plain text from a TipTap JSON document (for server-side validation).
 * This is intentionally conservative: it only considers `text` nodes and `hardBreak`.
 */
export function extractPlainTextFromTiptap(doc: unknown): string {
  const root = asNode(doc);
  if (!root) return '';

  let out = '';

  const walk = (node: TiptapNode) => {
    if (node.type === 'text' && typeof node.text === 'string') {
      out += node.text;
    }
    if (node.type === 'hardBreak') {
      out += '\n';
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) walk(child);
    }
  };

  walk(root);
  return out;
}

export function findFirstImageAttrs(doc: unknown): ImageNodeAttrs | null {
  const root = asNode(doc);
  if (!root) return null;

  let found: ImageNodeAttrs | null = null;

  const walk = (node: TiptapNode) => {
    if (found) return;
    if (node.type === 'image' && isObject(node.attrs)) {
      const src = typeof node.attrs.src === 'string' ? node.attrs.src : undefined;
      const filePath =
        typeof node.attrs.filePath === 'string' ? node.attrs.filePath : undefined;
      const alt = typeof node.attrs.alt === 'string' ? node.attrs.alt : undefined;
      found = { src, filePath, alt };
      return;
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) walk(child);
    }
  };

  walk(root);
  return found;
}

export function collectImageFilePaths(doc: unknown): Set<string> {
  const root = asNode(doc);
  const filePaths = new Set<string>();
  if (!root) return filePaths;

  const walk = (node: TiptapNode) => {
    if (node.type === 'image' && isObject(node.attrs)) {
      const fp = node.attrs.filePath;
      if (typeof fp === 'string' && fp.trim()) {
        filePaths.add(fp);
      }
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) walk(child);
    }
  };

  walk(root);
  return filePaths;
}

