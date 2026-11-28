import html2canvas from 'html2canvas-pro';

const COLOR_FALLBACK = 'rgba(148, 163, 184, 0.35)';
const DEFAULT_FONT = '"IBM Plex Sans Arabic", sans-serif';
const DEFAULT_BACKGROUND = '#F7F6F1';

/** Shorthands before their longhands: `background` would otherwise reset a colour set before it. */
const SHORTHANDS = ['background', 'border', 'font', 'margin', 'padding'];

/** Declarations applied `!important` to a cloned node before the capture. */
export type PngDeclarations = Record<string, string>;

export interface ElementPngOptions {
  /** Device pixel ratio for the capture; 3 keeps text crisp on phones. */
  scale?: number;
  backgroundColor?: string | null;
  /** Selectors removed from the clone first (decorative blur orbs, controls). */
  removeSelectors?: readonly string[];
  /** Extra declarations forced on `<html>`/`<body>` of the clone. */
  rootStyle?: Readonly<PngDeclarations>;
  /**
   * The page's own colour policy for a node whose computed colours html2canvas
   * cannot parse. Returning null (or omitting it) uses the default scrub.
   */
  colorPolicy?: (node: HTMLElement, computed: CSSStyleDeclaration) => PngDeclarations | null;
}

function isTransparentColor(value: string | null | undefined): boolean {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return normalized === 'transparent' || normalized === 'rgba(0, 0, 0, 0)' || normalized === 'rgba(0,0,0,0)';
}

/**
 * Render a DOM node to a canvas the way every share image on the site is
 * rendered: clone trimming, stripping `[data-share-exclude]` and decorative
 * blur orbs, preserving Beiruti display and monospace fonts while resetting
 * letter-spacing so Arabic ligatures stay intact, and scrubbing modern CSS
 * colour functions (oklch/oklab/color-mix) that html2canvas cannot parse.
 *
 * Avoid `text-overflow: ellipsis` (Tailwind `truncate`) inside a captured
 * node: html2canvas measures right-to-left text wrongly and clips Arabic
 * names down to their first letter.
 */
async function renderElementToCanvas(el: HTMLElement, options: ElementPngOptions = {}): Promise<HTMLCanvasElement> {
  const {
    scale = 3,
    backgroundColor = null,
    removeSelectors = ['.compass-card-bg-blur'],
    rootStyle,
    colorPolicy,
  } = options;

  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      /* ignore */
    }
  }

  return html2canvas(el, {
    scale,
    useCORS: true,
    allowTaint: true,
    backgroundColor,
    logging: false,
    onclone: (clonedDoc: Document) => {
      const win = clonedDoc.defaultView || window;
      const clonedTarget = el.id ? (clonedDoc.getElementById(el.id) as HTMLElement | null) : null;

      const selectorsToStrip = Array.from(new Set(['[data-share-exclude]', ...removeSelectors]));

      if (clonedTarget) {
        // Keep only the node being captured to avoid style pollution.
        Array.from(clonedDoc.body.children).forEach((child) => {
          if (!child.contains(clonedTarget) && child !== clonedTarget) child.remove();
        });
        selectorsToStrip.forEach((selector) => {
          clonedTarget.querySelectorAll<HTMLElement>(selector).forEach((node) => node.remove());
        });
      } else {
        selectorsToStrip.forEach((selector) => {
          clonedDoc.querySelectorAll<HTMLElement>(selector).forEach((node) => node.remove());
        });
      }

      const scrub = (color: string): string =>
        color && (color.includes('oklch') || color.includes('oklab') || color.includes('color-mix'))
          ? COLOR_FALLBACK
          : color;

      let resolvedRootBg = backgroundColor ?? '';
      if (isTransparentColor(resolvedRootBg) && clonedTarget) {
        try {
          const targetBg = scrub(win.getComputedStyle(clonedTarget).backgroundColor);
          if (!isTransparentColor(targetBg)) resolvedRootBg = targetBg;
        } catch {
          /* ignore */
        }
      }
      if (isTransparentColor(resolvedRootBg)) {
        resolvedRootBg = DEFAULT_BACKGROUND;
      }

      const defaultDeclarations = (_node: HTMLElement, style: CSSStyleDeclaration): PngDeclarations => {
        const declarations: PngDeclarations = {};
        if (style.backgroundColor && scrub(style.backgroundColor) !== style.backgroundColor) {
          declarations['background-color'] = scrub(style.backgroundColor);
        }
        if (style.color && scrub(style.color) !== style.color) {
          declarations.color = scrub(style.color);
        }
        if (style.borderColor && scrub(style.borderColor) !== style.borderColor) {
          declarations['border-color'] = scrub(style.borderColor);
        }
        if (style.backgroundImage && scrub(style.backgroundImage) !== style.backgroundImage) {
          declarations['background-image'] = 'none';
        }
        return declarations;
      };

      const applyDeclarations = (node: HTMLElement, declarations: PngDeclarations) => {
        const entries = Object.entries(declarations);
        const shorthandFirst = (a: [string, string], b: [string, string]) =>
          Number(SHORTHANDS.includes(b[0])) - Number(SHORTHANDS.includes(a[0]));
        for (const [property, value] of entries.sort(shorthandFirst)) {
          node.style.setProperty(property, value, 'important');
        }
      };

      const cleanElement = (node: HTMLElement) => {
        try {
          const isRoot = node.tagName === 'HTML' || node.tagName === 'BODY';
          if (isRoot) {
            node.style.setProperty('background', resolvedRootBg, 'important');
            node.style.setProperty('background-color', resolvedRootBg, 'important');
            node.style.setProperty('background-image', 'none', 'important');
            node.style.setProperty('letter-spacing', 'normal', 'important');
            node.style.setProperty('font-family', DEFAULT_FONT, 'important');
            for (const [property, value] of Object.entries(rootStyle ?? {})) {
              node.style.setProperty(property, value, 'important');
            }
            return;
          }

          const style = win.getComputedStyle(node);
          // Preserve Beiruti (display) and monospace fonts; only reset letter-spacing so Arabic glyphs join properly.
          node.style.setProperty('letter-spacing', 'normal', 'important');

          applyDeclarations(node, colorPolicy?.(node, style) ?? defaultDeclarations(node, style));
        } catch {
          /* ignore */
        }
      };

      cleanElement(clonedDoc.documentElement);
      if (clonedDoc.body) cleanElement(clonedDoc.body);
      clonedDoc.querySelectorAll('*').forEach((node) => cleanElement(node as HTMLElement));
    },
  });
}

export async function renderElementAsPngFile(
  el: HTMLElement,
  filename: string,
  options?: ElementPngOptions,
): Promise<File> {
  const canvas = await renderElementToCanvas(el, options);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('PNG encoding failed'))), 'image/png');
  });
  return new File([blob], filename, { type: 'image/png' });
}

export function canCopyImage(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.clipboard?.write === 'function' &&
    typeof ClipboardItem !== 'undefined'
  );
}

export async function copyElementAsPng(
  source: HTMLElement | File,
  options?: ElementPngOptions,
): Promise<boolean> {
  if (!canCopyImage()) return false;
  let blob: Blob;
  if (source instanceof File) {
    blob = source.type === 'image/png' ? source : new Blob([await source.arrayBuffer()], { type: 'image/png' });
  } else {
    const canvas = await renderElementToCanvas(source, options);
    blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('PNG encoding failed'))), 'image/png');
    });
  }
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  return true;
}

export async function exportElementAsPng(
  source: HTMLElement | File,
  filename: string,
  options?: ElementPngOptions,
): Promise<void> {
  const link = document.createElement('a');
  let objectUrl: string | undefined;
  try {
    if (source instanceof File) {
      objectUrl = URL.createObjectURL(source);
      link.href = objectUrl;
    } else {
      const canvas = await renderElementToCanvas(source, options);
      link.href = canvas.toDataURL('image/png');
    }
    link.download = filename;
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    if (objectUrl) {
      const url = objectUrl;
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }
  }
}
