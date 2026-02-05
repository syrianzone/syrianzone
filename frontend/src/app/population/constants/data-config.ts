export const DATA_TYPES = {
    POPULATION: 'population',
    IDP: 'idp',
    IDP_RETURNEES: 'idp_returnees',
    RAINFALL: 'rainfall',
    ENVIRONMENTAL: 'environmental'
} as const;

export type DataType = typeof DATA_TYPES[keyof typeof DATA_TYPES];

export const DATA_TYPE_CONFIG = {
    [DATA_TYPES.POPULATION]: {
        label: 'عدد السكان',
        labelAr: 'السكان',
        // Vibrant Blues
        colors: { none: '#1e293b', low: '#3b82f6', medium: '#6366f1', high: '#8b5cf6' },
        thresholds: [100000, 500000, 1000000],
        legend: [
            { label: 'لا توجد بيانات', color: '#1e293b' },
            { label: 'أقل من ١٠٠ ألف', color: '#3b82f6' },
            { label: '١٠٠ ألف – ٥٠٠ ألف', color: '#6366f1' },
            { label: 'أكثر من مليون', color: '#8b5cf6' }
        ]
    },
    [DATA_TYPES.IDP]: {
        label: 'النازحين داخلياً',
        labelAr: 'النازحين',
        // Bright Oranges/Reds
        colors: { none: '#1e293b', low: '#f97316', medium: '#ea580c', high: '#ef4444' },
        thresholds: [100000, 500000, 1000000],
        legend: [
            { label: 'لا توجد بيانات', color: '#1e293b' },
            { label: 'أقل من ١٠٠ ألف', color: '#f97316' },
            { label: '١٠٠ ألف – ٥٠٠ ألف', color: '#ea580c' },
            { label: 'أكثر من ٥٠٠ ألف', color: '#ef4444' }
        ]
    },
    [DATA_TYPES.IDP_RETURNEES]: {
        label: 'العائدون من النزوح',
        labelAr: 'العائدون',
        // Neon Greens
        colors: { none: '#1e293b', low: '#22c55e', medium: '#16a34a', high: '#4ade80' },
        thresholds: [50000, 100000, 200000],
        legend: [
            { label: 'لا توجد بيانات', color: '#1e293b' },
            { label: 'أقل من ٥٠ ألف', color: '#22c55e' },
            { label: '٥٠ ألف – ١٠٠ ألف', color: '#16a34a' },
            { label: 'أكثر من ١٠٠ ألف', color: '#4ade80' }
        ]
    },
    [DATA_TYPES.RAINFALL]: {
        label: 'معدل الهطول المطري',
        labelAr: 'الأمطار',
        // Electric Cyans
        colors: { none: '#1e293b', low: '#22d3ee', medium: '#0ea5e9', high: '#0284c7' },
        thresholds: [100, 300, 500],
        legend: [
            { label: 'لا توجد بيانات', color: '#1e293b' },
            { label: 'أقل من 100 مم', color: '#22d3ee' },
            { label: '100 - 500 مم', color: '#0ea5e9' },
            { label: 'أكثر من 500 مم', color: '#0284c7' }
        ]
    },

    [DATA_TYPES.ENVIRONMENTAL]: {
        label: 'البيئة والمناخ',
        labelAr: 'الحرارة والمناخ',
        // Temperature Gradient
        colors: { none: '#1e293b', low: '#3b82f6', medium: '#22c55e', high: '#ef4444' },
        thresholds: [10, 20, 30], 
        legend: [
            { label: 'بارد (< 10°)', color: '#3b82f6' },
            { label: 'معتدل (10°-25°)', color: '#22c55e' },
            { label: 'دافئ (25°-30°)', color: '#eab308' },
            { label: 'حار (> 30°)', color: '#ef4444' },
            { label: 'لا توجد بيانات', color: '#1e293b' }
        ]
    }
};