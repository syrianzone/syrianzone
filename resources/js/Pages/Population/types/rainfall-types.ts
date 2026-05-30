export interface RainfallYear {
    year: number;
    rainfall: number;
    rainfall_avg: number;
}

export interface RainfallData {
    [pcode: string]: RainfallYear[];
}