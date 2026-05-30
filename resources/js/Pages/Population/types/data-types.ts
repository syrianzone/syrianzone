import { DataType } from '../constants/data-config';

export interface CityData {
    [cityName: string]: number;
}

export interface DataSource {
    source_id: number;
    source_url: string;
    date: string;
    note: string;
    cities: CityData;
    data_type?: DataType;
}

export interface PopulationGroups {
    population: DataSource[];
    idp: DataSource[];
    idp_returnees: DataSource[];
    rainfall: DataSource[];
    environmental?: DataSource[];
}