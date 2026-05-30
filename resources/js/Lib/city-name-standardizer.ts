export const CANONICAL_NAMES: { [key: string]: string } = {
    'SY01': 'دمشق',
    'damascus': 'دمشق',
    'دمشق': 'دمشق',
    
    'SY02': 'حلب',
    'aleppo': 'حلب',
    'حلب': 'حلب',
    
    'SY03': 'ريف دمشق',
    'rif dimashq': 'ريف دمشق',
    'rural damascus': 'ريف دمشق',
    'ريف دمشق': 'ريف دمشق',
    
    'SY04': 'حمص',
    'homs': 'حمص',
    'ḥimş': 'حمص',
    'حمص': 'حمص',
    
    'SY05': 'حماة',
    'hama': 'حماة',
    'hamah': 'حماة',
    'ḩamāh': 'حماة',
    'حماة': 'حماة',
    
    'SY06': 'اللاذقية',
    'lattakia': 'اللاذقية',
    'latakia': 'اللاذقية',
    'اللاذقية': 'اللاذقية',
    
    'SY07': 'إدلب',
    'idlib': 'إدلب',
    'idleb': 'إدلب',
    'إدلب': 'إدلب',
    
    'SY08': 'الحسكة',
    'al hasakah': 'الحسكة',
    'al ḥasakah': 'الحسكة',
    'hasakah': 'الحسكة',
    'الحسكة': 'الحسكة',
    
    'SY09': 'دير الزور',
    'deir ez-zor': 'دير الزور',
    'deir ezzor': 'دير الزور',
    'dayr az zawr': 'دير الزور',
    'دير الزور': 'دير الزور',
    
    'SY10': 'طرطوس',
    'tartus': 'طرطوس',
    'tartous': 'طرطوس',
    'ţarţūs': 'طرطوس',
    'طرطوس': 'طرطوس',
    
    'SY11': 'الرقة',
    'ar raqqah': 'الرقة',
    'raqqa': 'الرقة',
    'الرقة': 'الرقة',
    
    'SY12': 'درعا',
    'daraa': 'درعا',
    'dara': 'درعا',
    'dar\'a': 'درعا',
    'dar`a': 'درعا',
    'درعا': 'درعا',
    
    'SY13': 'السويداء',
    'as suwayda': 'السويداء',
    'as suwayda\'': 'السويداء',
    'as suwayda`': 'السويداء',
    'sweida': 'السويداء',
    'السويداء': 'السويداء',
    
    'SY14': 'القنيطرة',
    'quneitra': 'القنيطرة',
    'al qunaytirah': 'القنيطرة',
    'القنيطرة': 'القنيطرة'
};

export function normalizeForMatching(name: string): string {
    if (!name) return '';
    return name
        .trim()
        .toLowerCase()
        .replace(/['`]/g, '')
        .replace(/ḥ/g, 'h')
        .replace(/ẖ/g, 'h')
        .replace(/ḫ/g, 'h')
        .replace(/ḩ/g, 'h')
        .replace(/ş/g, 's')
        .replace(/ṣ/g, 's')
        .replace(/ţ/g, 't')
        .replace(/ṭ/g, 't')
        .replace(/ā/g, 'a')
        .replace(/ū/g, 'u')
        .replace(/ī/g, 'i')
        .replace(/\s+/g, ' ');
}

export function getCanonicalCityName(cityName: string): string {
    if (!cityName) return cityName;
    
    if (CANONICAL_NAMES[cityName]) {
        return CANONICAL_NAMES[cityName];
    }
    
    const normalized = normalizeForMatching(cityName);
    if (CANONICAL_NAMES[normalized]) {
        return CANONICAL_NAMES[normalized];
    }
    
    return cityName;
}

export function standardizeCityNames(cities: { [key: string]: number }): { [key: string]: number } {
    const standardized: { [key: string]: number } = {};
    
    Object.entries(cities).forEach(([cityName, value]) => {
        const canonical = getCanonicalCityName(cityName);
        
        if (standardized[canonical]) {
            standardized[canonical] += value;
        } else {
            standardized[canonical] = value;
        }
    });
    
    return standardized;
}

export const GOVERNORATE_SORT_ORDER: { [key: string]: number } = {
    'دمشق': 1,
    'حلب': 2,
    'ريف دمشق': 3,
    'حمص': 4,
    'حماة': 5,
    'اللاذقية': 6,
    'إدلب': 7,
    'الحسكة': 8,
    'دير الزور': 9,
    'الرقة': 10,
    'درعا': 11,
    'طرطوس': 12,
    'السويداء': 13,
    'القنيطرة': 14
};

export function sortCitiesByOrder(cities: [string, number][]): [string, number][] {
    return cities.sort((a, b) => {
        const orderA = GOVERNORATE_SORT_ORDER[a[0]] || 999;
        const orderB = GOVERNORATE_SORT_ORDER[b[0]] || 999;
        return orderA - orderB;
    });
}
