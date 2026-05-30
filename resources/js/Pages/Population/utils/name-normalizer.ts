export function normalizeCityName(name: string): string {
    if (!name) return '';
    return name.trim().replace(/['`]/g, '').replace(/Ḥ/g, 'H').toLowerCase();
}