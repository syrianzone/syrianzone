import { governorateByAnyName } from '@/Domain/geography/governorates';

export interface HouseRow {
    Name: string;
    BirthYear: string;
    __nameNorm: string;
    __placeNorm: string;
    __sexNorm: string;
    __ageGroup: string;
    __appealStatus: string;
    [key: string]: string;
}

export type Mode = 'voters' | 'candidates' | 'winners' | 'presidential';

// One Google Sheet tab per governorate. The keys are the sheet's own vocabulary
// (house_key in resources/data/governorates.json); the Arabic label is the
// governorate's name, never restated here.
const SHEET_TABS = [
    { key: 'all', sheetId: '1bZKrmEUiFHdeID8pXHkT8XBaZ--oo6g2mGNcVvZMCgc', gid: '125118455' },
    { key: 'qunaitra', sheetId: '1bZKrmEUiFHdeID8pXHkT8XBaZ--oo6g2mGNcVvZMCgc', gid: '522040139' },
    { key: 'idlib', sheetId: '1bZKrmEUiFHdeID8pXHkT8XBaZ--oo6g2mGNcVvZMCgc', gid: '0' },
    { key: 'hama', sheetId: '1bZKrmEUiFHdeID8pXHkT8XBaZ--oo6g2mGNcVvZMCgc', gid: '694979899' },
    { key: 'damascus', sheetId: '1bZKrmEUiFHdeID8pXHkT8XBaZ--oo6g2mGNcVvZMCgc', gid: '1923715976' },
    { key: 'rif-damascus', sheetId: '1bZKrmEUiFHdeID8pXHkT8XBaZ--oo6g2mGNcVvZMCgc', gid: '1677791143' },
    { key: 'daraa', sheetId: '1bZKrmEUiFHdeID8pXHkT8XBaZ--oo6g2mGNcVvZMCgc', gid: '1028853845' },
    { key: 'latakia', sheetId: '1bZKrmEUiFHdeID8pXHkT8XBaZ--oo6g2mGNcVvZMCgc', gid: '638432279' },
    { key: 'tartus', sheetId: '1bZKrmEUiFHdeID8pXHkT8XBaZ--oo6g2mGNcVvZMCgc', gid: '1926010966' },
    { key: 'homs', sheetId: '1bZKrmEUiFHdeID8pXHkT8XBaZ--oo6g2mGNcVvZMCgc', gid: '252895295' },
    { key: 'aleppo', sheetId: '1bZKrmEUiFHdeID8pXHkT8XBaZ--oo6g2mGNcVvZMCgc', gid: '1121899715' },
    { key: 'deir-ez-zor', sheetId: '1bZKrmEUiFHdeID8pXHkT8XBaZ--oo6g2mGNcVvZMCgc', gid: '1166128088' },
    { key: 'raqqa', sheetId: '1bZKrmEUiFHdeID8pXHkT8XBaZ--oo6g2mGNcVvZMCgc', gid: '137630647' },
    { key: 'hasakah', sheetId: '1bZKrmEUiFHdeID8pXHkT8XBaZ--oo6g2mGNcVvZMCgc', gid: '2031427715' },
];

export const PROVINCES = SHEET_TABS.map((tab) => ({
    ...tab,
    label: tab.key === 'all' ? 'الكل' : (governorateByAnyName(tab.key)?.nameAr ?? tab.key),
}));

export const CANDIDATES_SHEET = { sheetId: '1bZKrmEUiFHdeID8pXHkT8XBaZ--oo6g2mGNcVvZMCgc', gid: '109132918' };
export const WINNERS_SHEET = { sheetId: '1bZKrmEUiFHdeID8pXHkT8XBaZ--oo6g2mGNcVvZMCgc', gid: '385944900' };
// الثلث الرئاسي (presidential third): 70 appointed members
export const PRESIDENTIAL_SHEET = { sheetId: '1bZKrmEUiFHdeID8pXHkT8XBaZ--oo6g2mGNcVvZMCgc', gid: '1851445664' };
