import { PopulationGroups } from '../types';
import { DATA_TYPES } from '../constants/data-config';

export async function fetchPopulationData(): Promise<PopulationGroups> {
    // Data is now fetched client-side from API
    // Return empty structure to avoid blocking SSR
    return {
        [DATA_TYPES.POPULATION]: [],
        [DATA_TYPES.IDP]: [],
        [DATA_TYPES.IDP_RETURNEES]: [],
        [DATA_TYPES.RAINFALL]: []
    };
}