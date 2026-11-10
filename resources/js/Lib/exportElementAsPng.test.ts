import { afterEach, describe, expect, it, vi } from 'vitest';
import html2canvas from 'html2canvas-pro';
import { exportElementAsPng } from './exportElementAsPng';

vi.mock('html2canvas-pro', () => ({ default: vi.fn() }));

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('PNG export destinations', () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const dataUrl = `data:image/png;base64,${btoa(String.fromCharCode(...bytes))}`;
    const setup = () => {
        vi.mocked(html2canvas).mockResolvedValue({ toDataURL: () => dataUrl } as unknown as HTMLCanvasElement);
        const link = { click: vi.fn(), href: '', download: '' };
        vi.stubGlobal('document', { createElement: () => link, body: { appendChild: vi.fn(), removeChild: vi.fn() } });
        const share = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('navigator', { share });
        return { link, share };
    };

    it('preserves the default download and existing PNG data', async () => {
        const { link, share } = setup();
        await exportElementAsPng({} as HTMLElement, 'promise-8.png');
        expect(link.href).toBe(dataUrl);
        expect(link.download).toBe('promise-8.png');
        expect(link.click).toHaveBeenCalledOnce();
        expect(share).not.toHaveBeenCalled();
    });

    it('shares the exact exported bytes as a PNG file without a download', async () => {
        const { link, share } = setup();
        await exportElementAsPng({} as HTMLElement, 'promise-8.png', 'share');
        const file: File = share.mock.calls[0][0].files[0];
        expect(file.name).toBe('promise-8.png');
        expect(file.type).toBe('image/png');
        expect(new Uint8Array(await file.arrayBuffer())).toEqual(bytes);
        expect(link.click).not.toHaveBeenCalled();
        expect(html2canvas).toHaveBeenCalledOnce();
    });
});
