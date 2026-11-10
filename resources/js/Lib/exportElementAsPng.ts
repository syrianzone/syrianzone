import html2canvas from 'html2canvas-pro';

const COLOR_FALLBACK = 'rgba(148, 163, 184, 0.35)';

/**
 * Render a DOM node to a canvas the way every share image on the site is
 * rendered. Mirrors the technique used by `PrioritiesApp.downloadStoryAsImage`:
 * clone trimming, removal of decorative blur orbs, forcing the Arabic
 * font/letter-spacing, and scrubbing modern CSS colour functions
 * (oklch/oklab/color-mix) that html2canvas cannot parse.
 *
 * Avoid `text-overflow: ellipsis` (Tailwind `truncate`) inside a captured
 * node: html2canvas measures right-to-left text wrongly and clips Arabic
 * names down to their first letter.
 */
async function renderElementToCanvas(el: HTMLElement): Promise<HTMLCanvasElement> {
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      /* ignore */
    }
  }

  return html2canvas(el, {
    scale: 3,
    useCORS: true,
    allowTaint: true,
    backgroundColor: null,
    logging: false,
    onclone: (clonedDoc: Document) => {
      const win = clonedDoc.defaultView || window;
      const clonedTarget = el.id ? (clonedDoc.getElementById(el.id) as HTMLElement | null) : null;

      if (clonedTarget) {
        // Keep only the node being captured to avoid style pollution.
        Array.from(clonedDoc.body.children).forEach((child) => {
          if (!child.contains(clonedTarget) && child !== clonedTarget) child.remove();
        });
        clonedTarget
          .querySelectorAll<HTMLElement>('.compass-card-bg-blur')
          .forEach((node) => node.remove());
      }

      const scrub = (color: string): string =>
        color && (color.includes('oklch') || color.includes('oklab') || color.includes('color-mix'))
          ? COLOR_FALLBACK
          : color;

      const cleanElement = (node: HTMLElement) => {
        try {
          const isRoot = node.tagName === 'HTML' || node.tagName === 'BODY';
          if (isRoot) {
            node.style.setProperty('background', '#0b0f19', 'important');
            node.style.setProperty('background-color', '#0b0f19', 'important');
            node.style.setProperty('background-image', 'none', 'important');
            node.style.setProperty('letter-spacing', 'normal', 'important');
            node.style.setProperty('font-family', 'IBM Plex Sans Arabic, sans-serif', 'important');
            return;
          }

          const style = win.getComputedStyle(node);
          node.style.setProperty('letter-spacing', 'normal', 'important');
          node.style.setProperty('font-family', 'IBM Plex Sans Arabic, sans-serif', 'important');

          if (style.backgroundColor && scrub(style.backgroundColor) !== style.backgroundColor) {
            node.style.setProperty('background-color', scrub(style.backgroundColor), 'important');
          }
          if (style.color && scrub(style.color) !== style.color) {
            node.style.setProperty('color', scrub(style.color), 'important');
          }
          if (style.borderColor && scrub(style.borderColor) !== style.borderColor) {
            node.style.setProperty('border-color', scrub(style.borderColor), 'important');
          }
          if (style.backgroundImage && scrub(style.backgroundImage) !== style.backgroundImage) {
            node.style.setProperty('background-image', 'none', 'important');
          }
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

/** Export a DOM node as PNG for download or native sharing. */
export async function exportElementAsPng(el: HTMLElement, filename: string, action: 'download' | 'share' = 'download'): Promise<void> {
  const canvas = await renderElementToCanvas(el);
  const dataUrl = canvas.toDataURL('image/png');
  if (action === 'share') {
    const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (character) => character.charCodeAt(0));
    const file = new File([bytes], filename, { type: 'image/png' });
    await navigator.share({ files: [file] });
    return;
  }
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
