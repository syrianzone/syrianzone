import { afterEach, describe, expect, it, vi } from 'vitest';
import html2canvas from 'html2canvas-pro';
import { exportElementAsPng, renderElementAsPngFile } from './exportElementAsPng';

vi.mock('html2canvas-pro', () => ({ default: vi.fn() }));

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.clearAllMocks(); });

describe('PNG export destinations', () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const dataUrl = `data:image/png;base64,${btoa(String.fromCharCode(...bytes))}`;
    const setup = () => {
        vi.mocked(html2canvas).mockResolvedValue({
            toDataURL: () => dataUrl,
            toBlob: (callback: BlobCallback) => callback(new Blob([bytes], { type: 'image/png' })),
        } as unknown as HTMLCanvasElement);
        const link = { click: vi.fn(), remove: vi.fn(), href: '', download: '' };
        vi.stubGlobal('document', { createElement: () => link, body: { appendChild: vi.fn() } });
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
        expect(link.remove).toHaveBeenCalledOnce();
        expect(share).not.toHaveBeenCalled();
    });

    it('downloads a prepared file without rendering and releases its temporary URL after the click', async () => {
        vi.useFakeTimers();
        const { link, share } = setup();
        const file = new File([bytes], 'promise-8.png', { type: 'image/png' });
        const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:prepared-png');
        const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

        await exportElementAsPng(file, file.name);

        expect(create).toHaveBeenCalledWith(file);
        expect(link.href).toBe('blob:prepared-png');
        expect(link.download).toBe(file.name);
        expect(link.click).toHaveBeenCalledOnce();
        expect(link.remove).toHaveBeenCalledOnce();
        expect(html2canvas).not.toHaveBeenCalled();
        expect(share).not.toHaveBeenCalled();
        expect(revoke).not.toHaveBeenCalled();
        vi.runAllTimers();
        expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:prepared-png');
    });

    it('cleans up the link and temporary URL when starting a download fails', async () => {
        vi.useFakeTimers();
        const { link } = setup();
        const file = new File([bytes], 'promise-8.png', { type: 'image/png' });
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:failed-download');
        const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        link.click.mockImplementation(() => { throw new Error('Download blocked'); });

        await expect(exportElementAsPng(file, file.name)).rejects.toThrow('Download blocked');

        expect(link.remove).toHaveBeenCalledOnce();
        vi.runAllTimers();
        expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:failed-download');
        expect(html2canvas).not.toHaveBeenCalled();
    });

    it('prepares the exact PNG bytes without opening sharing or a download', async () => {
        const { link, share } = setup();
        const file = await renderElementAsPngFile({} as HTMLElement, 'promise-8.png');
        expect(file.name).toBe('promise-8.png');
        expect(file.type).toBe('image/png');
        expect(new Uint8Array(await file.arrayBuffer())).toEqual(bytes);
        expect(link.click).not.toHaveBeenCalled();
        expect(share).not.toHaveBeenCalled();
        expect(html2canvas).toHaveBeenCalledOnce();
    });

    it('rejects an encoding failure instead of returning an empty file', async () => {
        setup();
        vi.mocked(html2canvas).mockResolvedValue({ toBlob: (callback: BlobCallback) => callback(null) } as unknown as HTMLCanvasElement);
        await expect(renderElementAsPngFile({} as HTMLElement, 'promise-8.png')).rejects.toThrow('PNG encoding failed');
    });
});
