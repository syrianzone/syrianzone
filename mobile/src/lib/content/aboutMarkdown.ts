export type AboutInlineToken =
  | { type: 'bold'; children: readonly AboutInlineToken[] }
  | { type: 'link'; children: readonly AboutInlineToken[]; href: string }
  | { type: 'text'; value: string };

export type AboutBlockToken =
  | { type: 'h1'; children: readonly AboutInlineToken[] }
  | { type: 'h2'; children: readonly AboutInlineToken[] }
  | {
      type: 'list';
      items: readonly (readonly AboutInlineToken[])[];
    }
  | { type: 'paragraph'; children: readonly AboutInlineToken[] };

function pushText(tokens: AboutInlineToken[], value: string): void {
  if (!value) {
    return;
  }

  const previous = tokens.at(-1);
  if (previous?.type === 'text') {
    previous.value += value;
  } else {
    tokens.push({ type: 'text', value });
  }
}

export function parseAboutInline(source: string): readonly AboutInlineToken[] {
  const tokens: AboutInlineToken[] = [];
  let cursor = 0;

  while (cursor < source.length) {
    if (source.startsWith('**', cursor)) {
      const end = source.indexOf('**', cursor + 2);
      if (end !== -1) {
        tokens.push({
          type: 'bold',
          children: parseAboutInline(source.slice(cursor + 2, end)),
        });
        cursor = end + 2;
        continue;
      }
    }

    if (source[cursor] === '[') {
      const labelEnd = source.indexOf('](', cursor + 1);
      if (labelEnd !== -1) {
        const hrefEnd = source.indexOf(')', labelEnd + 2);
        if (hrefEnd !== -1) {
          tokens.push({
            type: 'link',
            children: parseAboutInline(source.slice(cursor + 1, labelEnd)),
            href: source.slice(labelEnd + 2, hrefEnd),
          });
          cursor = hrefEnd + 1;
          continue;
        }
      }
    }

    const nextBold = source.indexOf('**', cursor + 1);
    const nextLink = source.indexOf('[', cursor + 1);
    const nextMarker = [nextBold, nextLink]
      .filter((index) => index !== -1)
      .reduce((nearest, index) => Math.min(nearest, index), source.length);
    pushText(tokens, source.slice(cursor, nextMarker));
    cursor = nextMarker;
  }

  return tokens;
}

function isListLine(line: string): boolean {
  return line.startsWith('- ') || line.startsWith('* ');
}

export function parseAboutMarkdown(source: string): readonly AboutBlockToken[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: AboutBlockToken[] = [];
  let cursor = 0;

  while (cursor < lines.length) {
    const line = lines[cursor] ?? '';
    if (line.trim() === '') {
      cursor += 1;
      continue;
    }

    if (line.startsWith('# ')) {
      blocks.push({
        type: 'h1',
        children: parseAboutInline(line.slice(2)),
      });
      cursor += 1;
      continue;
    }

    if (line.startsWith('## ')) {
      blocks.push({
        type: 'h2',
        children: parseAboutInline(line.slice(3)),
      });
      cursor += 1;
      continue;
    }

    if (isListLine(line)) {
      const items: AboutInlineToken[][] = [];
      while (cursor < lines.length) {
        const itemLine = lines[cursor] ?? '';
        if (itemLine.trim() === '') {
          break;
        }
        if (isListLine(itemLine)) {
          items.push([...parseAboutInline(itemLine.slice(2))]);
        } else {
          const current = items.at(-1);
          if (!current) {
            break;
          }
          pushText(current, '\n');
          current.push(...parseAboutInline(itemLine));
        }
        cursor += 1;
      }
      blocks.push({ type: 'list', items });
      continue;
    }

    const paragraphLines = [line];
    cursor += 1;
    while (cursor < lines.length) {
      const next = lines[cursor] ?? '';
      if (
        next.trim() === '' ||
        next.startsWith('# ') ||
        next.startsWith('## ') ||
        isListLine(next)
      ) {
        break;
      }
      paragraphLines.push(next);
      cursor += 1;
    }
    blocks.push({
      type: 'paragraph',
      children: parseAboutInline(paragraphLines.join('\n')),
    });
  }

  return blocks;
}
