export interface HouseRow {
    Name: string;
    BirthYear: string;
    // Normalized fields
    __nameNorm: string;
    __placeNorm: string;
    __sexNorm: string;
    __ageGroup: string;
    __appealStatus: string;
    // Original fields (using index signature for flexibility)
    [key: string]: string;
}

export type Mode = 'voters' | 'candidates' | 'winners';

export const PROVINCES = [
    { key: 'all', label: 'الكل', sheetId: '1bZKrmEUiFHdeID8pXHkT8XBaZ--oo6g2mGNcVvZMCgc', gid: '125118455' },
    { key: 'qunaitra', label: 'القنيطرة', sheetId: '1bZKrmEUiFHdeID8pXHkT8XBaZ--oo6g2mGNcVvZMCgc', gid: '522040139' },
    { key: 'idlib', label: 'إدلب', sheetId: '1bZKrmEUiFHdeID8pXHkT8XBaZ--oo6g2mGNcVvZMCgc', gid: '0' },
    { key: 'hama', label: 'حماة', sheetId: '1bZKrmEUiFHdeID8pXHkT8XBaZ--oo6g2mGNcVvZMCgc', gid: '694979899' },
    { key: 'damascus', label: 'دمشق', sheetId: '1bZKrmEUiFHdeID8pXHkT8XBaZ--oo6g2mGNcVvZMCgc', gid: '1923715976' },
    { key: 'rif-damascus', label: 'ريف دمشق', sheetId: '1bZKrmEUiFHdeID8pXHkT8XBaZ--oo6g2mGNcVvZMCgc', gid: '1677791143' },
    { key: 'daraa', label: 'درعا', sheetId: '1bZKrmEUiFHdeID8pXHkT8XBaZ--oo6g2mGNcVvZMCgc', gid: '1028853845' },
    { key: 'latakia', label: 'اللاذقية', sheetId: '1bZKrmEUiFHdeID8pXHkT8XBaZ--oo6g2mGNcVvZMCgc', gid: '638432279' },
    { key: 'tartus', label: 'طرطوس', sheetId: '1bZKrmEUiFHdeID8pXHkT8XBaZ--oo6g2mGNcVvZMCgc', gid: '1926010966' },
    { key: 'homs', label: 'حمص', sheetId: '1bZKrmEUiFHdeID8pXHkT8XBaZ--oo6g2mGNcVvZMCgc', gid: '252895295' },
    { key: 'aleppo', label: 'حلب', sheetId: '1bZKrmEUiFHdeID8pXHkT8XBaZ--oo6g2mGNcVvZMCgc', gid: '1121899715' },
    { key: 'deir-ez-zor', label: 'دير الزور', sheetId: '1bZKrmEUiFHdeID8pXHkT8XBaZ--oo6g2mGNcVvZMCgc', gid: '1166128088' },
    { key: 'raqqa', label: 'الرقة', sheetId: '1bZKrmEUiFHdeID8pXHkT8XBaZ--oo6g2mGNcVvZMCgc', gid: '137630647' },
    { key: 'hasakah', label: 'الحسكة', sheetId: '1bZKrmEUiFHdeID8pXHkT8XBaZ--oo6g2mGNcVvZMCgc', gid: '2031427715' },
];

export const CANDIDATES_SHEET = { sheetId: '1bZKrmEUiFHdeID8pXHkT8XBaZ--oo6g2mGNcVvZMCgc', gid: '109132918' };
export const WINNERS_SHEET = { sheetId: '1bZKrmEUiFHdeID8pXHkT8XBaZ--oo6g2mGNcVvZMCgc', gid: '385944900' };
