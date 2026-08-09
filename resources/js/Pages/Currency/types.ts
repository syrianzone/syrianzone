export interface ExchangeRate {
    rate: number;
    date: string;
}

export interface ExchangeRatesResponse {
    base: 'SYP';
    rates: Record<string, ExchangeRate>;
    source: string;
}
