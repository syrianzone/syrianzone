/** Read central-directory names only, sufficient for bounded generated native verification archives. */
export function zipEntryPaths(bytes: Uint8Array): string[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset--) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      end = offset;
      break;
    }
  }
  if (end < 0) throw new Error('ZIP end record missing');
  const count = view.getUint16(end + 10, true),
    paths: string[] = [];
  let offset = view.getUint32(end + 16, true);
  for (let index = 0; index < count; index++) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50)
      throw new Error('ZIP directory invalid');
    const length = view.getUint16(offset + 28, true),
      extra = view.getUint16(offset + 30, true),
      comment = view.getUint16(offset + 32, true);
    if (offset + 46 + length + extra + comment > end) throw new Error('ZIP entry out of bounds');
    const encoded = Array.from(
      bytes.subarray(offset + 46, offset + 46 + length),
      (byte) => `%${byte.toString(16).padStart(2, '0')}`,
    ).join('');
    paths.push(decodeURIComponent(encoded));
    offset += 46 + length + extra + comment;
  }
  return paths;
}
