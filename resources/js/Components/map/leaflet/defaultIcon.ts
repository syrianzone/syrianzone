import L from 'leaflet';

let applied = false;

/**
 * Leaflet's default marker icon resolves its image URLs from the package path,
 * which the bundler does not copy. Point the default icon at the CDN copy once,
 * before any marker is created. Every Leaflet map in the app calls this.
 */
export function ensureLeafletDefaultIcon(): void {
  if (applied) return;
  applied = true;
  delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
}
