export type ClassInput =
  | ClassInput[]
  | Readonly<Record<string, boolean | null | undefined>>
  | boolean
  | null
  | number
  | string
  | undefined;

function collectClassNames(input: ClassInput, output: string[]): void {
  if (!input) {
    return;
  }
  if (typeof input === 'string' || typeof input === 'number') {
    output.push(String(input));
  } else if (Array.isArray(input)) {
    input.forEach((item) => collectClassNames(item, output));
  } else if (typeof input === 'object') {
    Object.entries(input).forEach(([name, enabled]) => {
      if (enabled) {
        output.push(name);
      }
    });
  }
}

export function cn(...inputs: ClassInput[]): string {
  const names: string[] = [];
  inputs.forEach((input) => collectClassNames(input, names));
  return names.join(' ');
}

/*
PORT STATUS
  source:     resources/js/Lib/utils.ts (6 lines)
  confidence: high
  todos:      0
  notes:      The compatibility helper preserves conditional class composition for shared non-view logic.
*/
