"use client";

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { PopulationGroups, DATA_TYPES, DATA_TYPE_CONFIG, RainfallData, DataSource } from './types';
import {
    Layers, Info, Filter, X, BarChart3, CheckSquare, Square, ExternalLink,
    CloudRain, RefreshCw, ThermometerSun, Wind, Droplets, Gauge,
    Activity, AlertTriangle, TrendingDown, TrendingUp, Calendar, Cloud, Navigation,
    History, Users, Heart, MapPin, Clock, Compass, Thermometer, Leaf
} from 'lucide-react';
import { sortCitiesByOrder, getCanonicalCityName } from '@/lib/city-name-standardizer';

type DataType = typeof DATA_TYPES[keyof typeof DATA_TYPES];

const MapClient = dynamic(() => import('./components/map/MapClient'), {
    ssr: false,
    loading: () => <div className="h-full w-full flex items-center justify-center bg-card text-muted-foreground">جاري تحميل الخريطة...</div>
});

const ARABIC_TO_ENGLISH_CITY_MAP: { [key: string]: string } = {
    'دمشق': 'Damascus', 'حلب': 'Aleppo', 'ريف دمشق': 'Rif Dimashq', 'حمص': 'Homs',
    'حماة': 'Hama', 'اللاذقية': 'Latakia', 'إدلب': 'Idlib', 'الحسكة': 'Al-Hasakah',
    'دير الزور': 'Deir ez-Zor', 'طرطوس': 'Tartus', 'الرقة': 'Raqqa', 'درعا': 'Daraa',
    'السويداء': 'As-Suwayda', 'القنيطرة': 'Quneitra'
};

// Helper functions for UI
const getWeatherIcon = (description: string) => {
    if (!description) return <ThermometerSun size={24} />;
    const desc = description.toLowerCase();
    if (desc.includes('rain') || desc.includes('drizzle')) return <CloudRain size={24} />;
    if (desc.includes('cloud') || desc.includes('overcast')) return <Cloud size={24} />;
    if (desc.includes('clear') || desc.includes('sun') || desc.includes('main')) return <ThermometerSun size={24} />;
    if (desc.includes('snow')) return <ThermometerSun size={24} />; // Fallback or add snow icon
    return <ThermometerSun size={24} />;
};

const getWindDirection = (degrees: number) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return directions[Math.round(degrees / 45) % 8];
};

export default function PopulationClient() {
    const [geoJsonData, setGeoJsonData] = useState<any>(null);
    const [currentDataType, setCurrentDataType] = useState<DataType>(DATA_TYPES.POPULATION);
    const [currentSourceId, setCurrentSourceId] = useState<number | null>(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);

    // Comparison tool state
    const [selectedProvinces, setSelectedProvinces] = useState<string[]>([]);

    // Detail States
    const [selectedRainfallProvince, setSelectedRainfallProvince] = useState<{ name: string, data: any[] } | null>(null);
    const [selectedEnvProvince, setSelectedEnvProvince] = useState<{ name: string, data: any } | null>(null);

    // Data fetching state
    const [rainfallData, setRainfallData] = useState<RainfallData>({});
    const [environmentalData, setEnvironmentalData] = useState<any>(null);

    const [livePopulationData, setLivePopulationData] = useState<PopulationGroups>({
        population: [],
        idp: [],
        idp_returnees: [],
        rainfall: [],
        environmental: []
    });
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch('/assets/population/syr_admin1.geojson')
            .then(res => res.json())
            .then(data => setGeoJsonData(data))
            .catch(err => console.error('Failed to load GeoJSON', err));
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoading(true);
                setError(null);

                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

                const masterResponse = await fetch(`${apiUrl}/population/master`);
                if (!masterResponse.ok) throw new Error('Failed to fetch master data');
                const masterData = await masterResponse.json();

                setLivePopulationData(masterData.groups);
                setRainfallData(masterData.rainfall_data);

                const envResponse = await fetch(`${apiUrl}/population/env-report`);
                if (!envResponse.ok) throw new Error('Failed to fetch environmental data');
                const envData = await envResponse.json();
                setEnvironmentalData(envData);

            } catch (err) {
                console.error('Failed to fetch population data:', err);
                setError('Failed to load population atlas data. Please try again later.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    useEffect(() => {
        if (currentDataType === DATA_TYPES.RAINFALL) {
            setCurrentSourceId(999);
        } else if (currentDataType === DATA_TYPES.ENVIRONMENTAL) {
            const sources = livePopulationData[currentDataType];
            if (sources && sources.length > 0) {
                setCurrentSourceId(sources[0].source_id);
            } else {
                setCurrentSourceId(null);
            }
        } else {
            const sources = livePopulationData[currentDataType];
            if (sources && sources.length > 0) {
                setCurrentSourceId(sources[0].source_id);
            } else {
                setCurrentSourceId(null);
            }
        }
    }, [currentDataType, livePopulationData]);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 768) setIsPanelOpen(true);
        };
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const currentSource = useMemo(() => {
        if (currentDataType === DATA_TYPES.RAINFALL) return null;
        const sources = livePopulationData[currentDataType];
        if (!sources || sources.length === 0) return null;
        return sources.find(s => s.source_id === currentSourceId);
    }, [livePopulationData, currentDataType, currentSourceId]);

    const populationData = currentSource ? currentSource.cities : null;
    const config = DATA_TYPE_CONFIG[currentDataType as keyof typeof DATA_TYPE_CONFIG];

    const dynamicThresholds = useMemo(() => {
        if (currentDataType === DATA_TYPES.RAINFALL || currentDataType === DATA_TYPES.ENVIRONMENTAL) return config.thresholds;
        if (!populationData) return config.thresholds;

        const values = Object.values(populationData).filter(v => v > 0);
        if (values.length === 0) return config.thresholds;

        const max = Math.max(...values);
        return [Math.floor(max * 0.1), Math.floor(max * 0.4), Math.floor(max * 0.7)];
    }, [populationData, config.thresholds, currentDataType]);

    const toggleProvinceSelection = (province: string) => {
        setSelectedProvinces(prev => {
            if (prev.includes(province)) return prev.filter(p => p !== province);
            if (prev.length < 2) return [...prev, province];
            return [prev[1], province];
        });
    };

    const getProvinceStats = (provinceName: string) => {
        const stats: any = {};
        Object.values(DATA_TYPES).forEach(type => {
            if (type === DATA_TYPES.RAINFALL || type === DATA_TYPES.ENVIRONMENTAL) return;

            let source;
            if (type === currentDataType && currentSource) {
                source = currentSource;
            } else {
                source = livePopulationData[type]?.[0];
            }
            if (source) {
                stats[type] = source.cities[provinceName] ?? 0;
            } else {
                stats[type] = 0;
            }
        });
        return stats;
    };

    const comparisonData = useMemo(() => {
        if (selectedProvinces.length !== 2) return null;
        return {
            p1: { name: selectedProvinces[0], stats: getProvinceStats(selectedProvinces[0]) },
            p2: { name: selectedProvinces[1], stats: getProvinceStats(selectedProvinces[1]) }
        };
    }, [selectedProvinces, livePopulationData, currentDataType, currentSource]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] bg-background text-foreground gap-6">
                <RefreshCw className="animate-spin text-primary" size={64} />
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2">جاري تحميل بيانات الأطلس</h2>
                    <p className="text-muted-foreground">قد يستغرق هذا بضع ثوان...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] bg-background text-foreground gap-6 px-4">
                <div className="text-center max-w-md">
                    <div className="text-red-500 mb-4">
                        <Info size={64} />
                    </div>
                    <h2 className="text-2xl font-bold mb-2 text-foreground">خطأ في تحميل البيانات</h2>
                    <p className="text-muted-foreground mb-6">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 rounded-lg font-medium transition-colors"
                    >
                        <RefreshCw size={20} />
                        إعادة المحاولة
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden relative bg-background text-foreground" dir="rtl">

            {/* Comparison Pop-up */}
            {comparisonData && currentDataType !== DATA_TYPES.RAINFALL && currentDataType !== DATA_TYPES.ENVIRONMENTAL && (
                <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-[1000] w-[90%] max-w-2xl bg-card border-2 border-primary rounded-xl shadow-2xl animate-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-center p-4 border-b border-border">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <BarChart3 className="text-primary" size={20} />
                            مقارنة المحافظات
                        </h3>
                        <button onClick={() => setSelectedProvinces([])} className="p-1 hover:bg-muted rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-3 gap-4 mb-8">
                            <div className="text-center font-bold text-lg text-primary truncate">{comparisonData.p1.name}</div>
                            <div className="text-center text-muted-foreground text-sm self-center">مقابل</div>
                            <div className="text-center font-bold text-lg text-primary truncate">{comparisonData.p2.name}</div>
                        </div>

                        <div className="space-y-8">
                            {Object.values(DATA_TYPES).filter(t => t !== DATA_TYPES.RAINFALL && t !== DATA_TYPES.ENVIRONMENTAL).map(type => {
                                const v1 = comparisonData.p1.stats[type];
                                const v2 = comparisonData.p2.stats[type];
                                const max = Math.max(v1, v2, 1);
                                const label = DATA_TYPE_CONFIG[type as keyof typeof DATA_TYPE_CONFIG].labelAr;

                                return (
                                    <div key={type} className="space-y-2">
                                        <div className="flex justify-between text-xs font-medium mb-1 px-1">
                                            <span>{v1.toLocaleString()}</span>
                                            <span className="text-muted-foreground">{label}</span>
                                            <span>{v2.toLocaleString()}</span>
                                        </div>
                                        <div className="flex h-4 w-full gap-1 bg-muted rounded-full overflow-hidden">
                                            <div className="flex justify-end w-1/2">
                                                <div
                                                    className="h-full bg-primary transition-all duration-500 rounded-r-full"
                                                    style={{ width: `${(v1 / max) * 100}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-start w-1/2">
                                                <div
                                                    className="h-full bg-primary/60 transition-all duration-500 rounded-l-full"
                                                    style={{ width: `${(v2 / max) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Header Overlay */}
            <div className="absolute top-4 right-4 z-[400] pointer-events-none">
                <div className="bg-card/90 backdrop-blur p-4 rounded-lg shadow-lg border border-border pointer-events-auto max-w-sm">
                    <h1 className="text-xl font-bold text-foreground mb-1">أطلس سوريا</h1>
                    <p className="text-sm text-muted-foreground">
                        {currentDataType === DATA_TYPES.RAINFALL
                            ? 'عرض بيانات الهطولات المطرية السنوية (2021-2025)'
                            : currentDataType === DATA_TYPES.ENVIRONMENTAL
                                ? 'بيانات المناخ وجودة الهواء المباشرة'
                                : 'خريطة تفاعلية للبيانات السكانية والإنسانية'}
                    </p>
                </div>
            </div>

            {/* Map Area */}
            <div className="flex-grow relative z-0">
                <MapClient
                    geoJsonData={geoJsonData}
                    populationData={populationData}
                    rainfallData={rainfallData}
                    environmentalData={environmentalData}
                    currentDataType={currentDataType}
                    currentSourceId={currentSourceId}
                    customThresholds={dynamicThresholds}
                    onFeatureClick={(feature) => {
                        const name = feature.properties.province_name || feature.properties.ADM2_AR || feature.properties.ADM1_AR || feature.properties.Name;
                        const nameAr = getCanonicalCityName(name);

                        // --- HANDLE RAINFALL CLICK ---
                        if (currentDataType === DATA_TYPES.RAINFALL) {
                            const props = feature.properties;
                            const codeKeys = ['ADM1_PCODE', 'ADM2_PCODE', 'admin1Pcode', 'admin2Pcode', 'code', 'id', 'PCODE'];
                            let rData = null;

                            for (const key of codeKeys) {
                                if (props[key] && rainfallData[props[key]]) {
                                    rData = rainfallData[props[key]];
                                    break;
                                }
                            }

                            if (!rData) {
                                const nameKeys = ['province_name', 'ADM1_EN', 'ADM1_AR', 'name', 'Name', 'NAME', 'admin1Name_en'];
                                for (const key of nameKeys) {
                                    if (props[key]) {
                                        const normalized = props[key].trim().replace(/['`]/g, '').replace(/Ḥ/g, 'H').toLowerCase();
                                        const PROVINCE_TO_PCODE: { [key: string]: string } = {
                                            'damascus': 'SY01', 'aleppo': 'SY02', 'rural damascus': 'SY03', 'rif dimashq': 'SY03',
                                            'homs': 'SY04', 'hama': 'SY05', 'lattakia': 'SY06', 'latakia': 'SY06',
                                            'idlib': 'SY07', 'idleb': 'SY07', 'al hasakah': 'SY08', 'hasakah': 'SY08',
                                            'deir ez-zor': 'SY09', 'deir ezzor': 'SY09', 'tartous': 'SY10', 'tartus': 'SY10',
                                            'ar raqqah': 'SY11', 'raqqa': 'SY11', 'daraa': 'SY12', 'dar\'a': 'SY12',
                                            'as suwayda': 'SY13', 'as suwayda\'': 'SY13', 'sweida': 'SY13',
                                            'quneitra': 'SY14', 'al qunaytirah': 'SY14',
                                            'دمشق': 'SY01', 'حلب': 'SY02', 'ريف دمشق': 'SY03', 'حمص': 'SY04', 'حماة': 'SY05',
                                            'اللاذقية': 'SY06', 'إدلب': 'SY07', 'الحسكة': 'SY08', 'دير الزور': 'SY09',
                                            'طرطوس': 'SY10', 'الرقة': 'SY11', 'درعا': 'SY12', 'السويداء': 'SY13', 'القنيطرة': 'SY14'
                                        };
                                        const mappedCode = PROVINCE_TO_PCODE[normalized];
                                        if (mappedCode && rainfallData[mappedCode]) {
                                            rData = rainfallData[mappedCode];
                                            break;
                                        }
                                    }
                                }
                            }

                            if (rData) {
                                setSelectedRainfallProvince({ name: nameAr, data: rData });
                                if (window.innerWidth < 768) setIsPanelOpen(true);
                            }
                        }

                        // --- HANDLE ENVIRONMENTAL CLICK ---
                        else if (currentDataType === DATA_TYPES.ENVIRONMENTAL) {
                            if (environmentalData && environmentalData.cities) {
                                const englishName = ARABIC_TO_ENGLISH_CITY_MAP[nameAr] || nameAr;
                                const data = environmentalData.cities[nameAr] || environmentalData.cities[englishName] || environmentalData.cities[name];

                                if (data) {
                                    setSelectedEnvProvince({ name: nameAr, data: data });
                                    setIsPanelOpen(true);
                                }
                            }
                        }
                    }}
                />

                {/* Legend Overlay */}
                <div className="absolute bottom-6 right-6 z-[400] bg-card/90 backdrop-blur p-3 rounded-lg shadow-lg border border-border text-sm min-w-[150px]">
                    <h4 className="font-bold mb-2 text-foreground flex items-center gap-2">
                        {currentDataType === DATA_TYPES.RAINFALL && <CloudRain size={16} className="text-primary" />}
                        {currentDataType === DATA_TYPES.ENVIRONMENTAL && <ThermometerSun size={16} className="text-primary" />}
                        {config.labelAr}
                    </h4>
                    <div className="space-y-1.5">
                        {config.legend.map((item: { label: string; color: string }, idx: number) => (
                            <div key={idx} className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></span>
                                <span className="text-muted-foreground text-xs">{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Side Panel */}
            <div className={`absolute top-0 left-0 bottom-0 z-[500] w-80 bg-card border-r border-border shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${isPanelOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <button onClick={() => setIsPanelOpen(!isPanelOpen)} className="absolute -right-12 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-card text-primary rounded-r-lg shadow-md flex items-center justify-center hover:bg-accent border-y border-r border-border">
                    <Filter size={20} />
                </button>

                <div className="p-4 border-b border-border bg-card">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-foreground flex items-center gap-2"><Layers size={18} /> البيانات</h2>
                    </div>

                    <div className="grid grid-cols-2 gap-2 p-1">
                        {Object.values(DATA_TYPES).map(type => (
                            <button
                                key={type}
                                onClick={() => {
                                    setCurrentDataType(type);
                                    if (type === DATA_TYPES.RAINFALL) {
                                        setSelectedProvinces([]);
                                    } else {
                                        setSelectedRainfallProvince(null);
                                        setSelectedEnvProvince(null);
                                    }
                                }}
                                className={`py-2 px-3 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-2 border
                                    ${currentDataType === type
                                        ? 'bg-primary/10 text-primary border-primary/20 shadow-sm'
                                        : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground'}`}
                            >
                                {type === DATA_TYPES.RAINFALL && <CloudRain size={14} />}
                                {type === DATA_TYPES.ENVIRONMENTAL && <ThermometerSun size={14} />}
                                {DATA_TYPE_CONFIG[type as keyof typeof DATA_TYPE_CONFIG].labelAr}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-card">

                    {/* OPTION 1: RAINFALL DETAILS */}
                    {currentDataType === DATA_TYPES.RAINFALL ? (
                        <div className="flex flex-col h-full">
                            {selectedRainfallProvince ? (
                                <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="text-xl font-bold text-foreground">{selectedRainfallProvince.name}</h3>
                                            <p className="text-xs text-muted-foreground mt-1">تفاصيل الهطولات المطرية السنوية</p>
                                        </div>
                                        <button onClick={() => setSelectedRainfallProvince(null)} className="p-1 hover:bg-muted rounded-md transition-colors text-muted-foreground"><X size={18} /></button>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3">
                                        {[...selectedRainfallProvince.data].sort((a, b) => b.year - a.year).map((item, idx) => (
                                            <div key={idx} className="bg-muted/40 p-3 rounded-lg border border-border/50 flex justify-between items-center group hover:bg-muted/60 transition-colors">
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-muted-foreground">السنة</span>
                                                    <span className="font-bold text-lg">{item.year}</span>
                                                </div>
                                                <div className="flex gap-6">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[10px] text-muted-foreground">الهطول (ملم)</span>
                                                        <span className="font-mono font-bold text-cyan-500">{item.rainfall.toFixed(1)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center text-center h-full text-muted-foreground py-10 px-4">
                                    <CloudRain className="opacity-50 mb-4" size={48} />
                                    <h3 className="font-bold text-foreground mb-2">خريطة الأمطار</h3>
                                    <p className="text-sm leading-relaxed mb-6">اختر محافظة من الخريطة لعرض إحصائيات الأمطار التاريخية والمتوسط السنوي.</p>
                                </div>
                            )}
                        </div>
                    ) : currentDataType === DATA_TYPES.ENVIRONMENTAL ? (
                        /* OPTION 2: ENVIRONMENTAL PANEL CONTENT */
                        <div className="flex flex-col h-full">
                            {selectedEnvProvince ? (
                                <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
                                    {/* Enhanced Header with Weather Icon */}
                                    <div className="relative overflow-hidden rounded-xl p-4 bg-gradient-to-br from-sky-500/20 via-cyan-500/10 to-emerald-500/20 border border-sky-500/20">
                                        <div className="absolute top-2 left-2 opacity-20">
                                            {getWeatherIcon(selectedEnvProvince.data.current_conditions.weather_description)}
                                        </div>
                                        <div className="flex justify-between items-start relative z-10">
                                            <div>
                                                <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                                                    {getWeatherIcon(selectedEnvProvince.data.current_conditions.weather_description)}
                                                    {selectedEnvProvince.name}
                                                </h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <MapPin size={12} className="text-muted-foreground" />
                                                    <span className="text-xs text-muted-foreground">
                                                        {selectedEnvProvince.data.coordinates.latitude.toFixed(2)}°N, {selectedEnvProvince.data.coordinates.longitude.toFixed(2)}°E
                                                    </span>
                                                </div>
                                                {selectedEnvProvince.data.population && (
                                                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                                        <span>السكان: </span>
                                                        <span className="font-semibold text-foreground">{selectedEnvProvince.data.population.toLocaleString()}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => setSelectedEnvProvince(null)}
                                                className="p-1.5 hover:bg-muted/50 rounded-lg transition-colors text-muted-foreground backdrop-blur-sm"
                                            >
                                                <X size={18} />
                                            </button>
                                        </div>
                                        <div className="mt-3 text-center">
                                            <span className="text-4xl font-bold bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
                                                {selectedEnvProvince.data.current_conditions.temperature_celsius}°C
                                            </span>
                                            <p className="text-xs text-muted-foreground mt-1">
                                               المحسوسة {selectedEnvProvince.data.current_conditions.feels_like_celsius}°C
                                            </p>
                                            <p className="text-sm text-foreground/80 mt-1">
                                                {selectedEnvProvince.data.current_conditions.weather_description}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Tomorrow's Forecast Card */}
                                    <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-lg p-3 border border-indigo-500/20">
                                        <h4 className="text-sm font-bold mb-2 flex items-center gap-2 text-foreground">
                                            <Calendar size={14} className="text-indigo-400" />
                                            توقعات الغد
                                        </h4>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="text-center">
                                                    <TrendingUp size={14} className="mx-auto text-red-400 mb-1" />
                                                    <span className="text-lg font-bold text-red-400">
                                                        {selectedEnvProvince.data.daily_forecast_summary.tomorrow_max_temp_c}°
                                                    </span>
                                                    <p className="text-[10px] text-muted-foreground">القصوى</p>
                                                </div>
                                                <div className="h-8 w-px bg-border/50"></div>
                                                <div className="text-center">
                                                    <TrendingDown size={14} className="mx-auto text-blue-400 mb-1" />
                                                    <span className="text-lg font-bold text-blue-400">
                                                        {selectedEnvProvince.data.daily_forecast_summary.tomorrow_min_temp_c}°
                                                    </span>
                                                    <p className="text-[10px] text-muted-foreground">الدنيا</p>
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <CloudRain size={16} className="mx-auto text-cyan-400 mb-1" />
                                                <span className="text-sm font-bold text-cyan-400">
                                                    {selectedEnvProvince.data.daily_forecast_summary.tomorrow_precipitation_mm} ملم
                                                </span>
                                                <p className="text-[10px] text-muted-foreground">الهطول المتوقع</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Enhanced Current Conditions */}
                                    <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
                                        <h4 className="text-sm font-bold mb-3 flex items-center gap-2 text-foreground">
                                            <Thermometer size={16} className="text-orange-500" />
                                           الحالة الجوية
                                        </h4>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="bg-card/80 backdrop-blur-sm p-2.5 rounded-lg border border-border/30 hover:border-orange-500/30 transition-colors group">
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                                    <Thermometer size={12} className="group-hover:text-orange-400 transition-colors" /> درجة الحرارة
                                                </div>
                                                <span className="text-lg font-bold">{selectedEnvProvince.data.current_conditions.temperature_celsius}°C</span>
                                                <p className="text-[10px] text-muted-foreground">المحسوسة: {selectedEnvProvince.data.current_conditions.feels_like_celsius}°</p>
                                            </div>
                                            <div className="bg-card/80 backdrop-blur-sm p-2.5 rounded-lg border border-border/30 hover:border-blue-500/30 transition-colors group">
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                                    <Droplets size={12} className="group-hover:text-blue-400 transition-colors" /> الرطوبة
                                                </div>
                                                <span className="text-lg font-bold">{selectedEnvProvince.data.current_conditions.humidity_percent}%</span>
                                                <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
                                                    <div className="h-full bg-gradient-to-r from-blue-400 to-cyan-400 transition-all duration-500" style={{ width: `${selectedEnvProvince.data.current_conditions.humidity_percent}%` }}></div>
                                                </div>
                                            </div>
                                            <div className="bg-card/80 backdrop-blur-sm p-2.5 rounded-lg border border-border/30 hover:border-slate-500/30 transition-colors group">
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                                    <Wind size={12} className="group-hover:text-slate-400 transition-colors" /> الرياح
                                                </div>
                                                <span className="text-lg font-bold">{selectedEnvProvince.data.current_conditions.wind_speed_kmh}</span>
                                                <span className="text-xs text-muted-foreground mr-1">كم/س</span>
                                                <div className="flex items-center gap-1 mt-1">
                                                    <Compass size={10} className="text-slate-400" style={{ transform: `rotate(${selectedEnvProvince.data.current_conditions.wind_direction_degrees}deg)` }} />
                                                    <span className="text-[10px] text-muted-foreground">{getWindDirection(selectedEnvProvince.data.current_conditions.wind_direction_degrees)}</span>
                                                </div>
                                            </div>
                                            <div className="bg-card/80 backdrop-blur-sm p-2.5 rounded-lg border border-border/30 hover:border-purple-500/30 transition-colors group">
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                                    <Gauge size={12} className="group-hover:text-purple-400 transition-colors" /> الضغط الجوي
                                                </div>
                                                <span className="text-lg font-bold">{selectedEnvProvince.data.current_conditions.pressure_msl_hpa.toFixed(0)}</span>
                                                <span className="text-[10px] text-muted-foreground mr-1">hPa</span>
                                            </div>
                                            <div className="bg-card/80 backdrop-blur-sm p-2.5 rounded-lg border border-border/30 hover:border-sky-500/30 transition-colors group">
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                                    <Cloud size={12} className="group-hover:text-sky-400 transition-colors" /> الغطاء السحابي
                                                </div>
                                                <span className="text-lg font-bold">{selectedEnvProvince.data.current_conditions.cloud_cover_percent}%</span>
                                                <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
                                                    <div className="h-full bg-gradient-to-r from-slate-400 to-slate-600 transition-all duration-500" style={{ width: `${selectedEnvProvince.data.current_conditions.cloud_cover_percent}%` }}></div>
                                                </div>
                                            </div>
                                            <div className="bg-card/80 backdrop-blur-sm p-2.5 rounded-lg border border-border/30 hover:border-cyan-500/30 transition-colors group">
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                                    <CloudRain size={12} className="group-hover:text-cyan-400 transition-colors" /> الهطول الحالي
                                                </div>
                                                <span className="text-lg font-bold">{selectedEnvProvince.data.current_conditions.precipitation_mm}</span>
                                                <span className="text-[10px] text-muted-foreground mr-1">ملم</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Air Quality */}
                                    <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
                                        <h4 className="text-sm font-bold mb-3 flex items-center gap-2 text-foreground">
                                            <Activity size={16} className="text-green-500" />
                                            جودة الهواء
                                        </h4>
                                        <div className="flex items-center gap-4 mb-3">
                                            <div className={`relative w-16 h-16 rounded-full flex items-center justify-center ${selectedEnvProvince.data.air_quality.estimated_aqi <= 50
                                                ? 'bg-gradient-to-br from-green-400/20 to-emerald-500/20 border-2 border-green-500/50'
                                                : selectedEnvProvince.data.air_quality.estimated_aqi <= 100
                                                    ? 'bg-gradient-to-br from-yellow-400/20 to-amber-500/20 border-2 border-yellow-500/50'
                                                    : 'bg-gradient-to-br from-red-400/20 to-orange-500/20 border-2 border-red-500/50'
                                                }`}>
                                                <span className={`text-2xl font-bold ${selectedEnvProvince.data.air_quality.estimated_aqi <= 50
                                                    ? 'text-green-500'
                                                    : selectedEnvProvince.data.air_quality.estimated_aqi <= 100
                                                        ? 'text-yellow-500'
                                                        : 'text-red-500'
                                                    }`}>
                                                    {selectedEnvProvince.data.air_quality.estimated_aqi}
                                                </span>
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-foreground">{selectedEnvProvince.data.air_quality.category}</p>
                                                <p className="text-[10px] text-muted-foreground mt-0.5">مؤشر جودة الهواء (AQI)</p>
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground bg-primary/5 p-2 rounded-lg border border-primary/10">
                                            {selectedEnvProvince.data.air_quality.health_recommendation}
                                        </p>
                                    </div>

                                    {/* Drought Risk */}
                                    {selectedEnvProvince.data.drought_risk && Object.keys(selectedEnvProvince.data.drought_risk).length > 0 && (
                                        <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
                                            <h4 className="text-sm font-bold mb-3 flex items-center gap-2 text-foreground">
                                                <AlertTriangle size={16} className="text-amber-500" />
                                                مخاطر الجفاف
                                            </h4>
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className={`px-3 py-1.5 rounded-full text-sm font-bold ${selectedEnvProvince.data.drought_risk?.drought_risk === 'Very High'
                                                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                                    : selectedEnvProvince.data.drought_risk?.drought_risk === 'High'
                                                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                                                        : selectedEnvProvince.data.drought_risk?.drought_risk === 'Moderate'
                                                            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                                            : 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                    }`}>
                                                    {selectedEnvProvince.data.drought_risk?.drought_risk || 'غير متوفر'}
                                                </div>
                                                <span className="text-xs text-muted-foreground">{selectedEnvProvince.data.drought_risk?.classification || ''}</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="bg-card/50 p-2 rounded-lg">
                                                    <span className="text-[10px] text-muted-foreground block">الهطول السنوي</span>
                                                    <span className="text-sm font-bold text-cyan-400">{selectedEnvProvince.data.drought_risk?.annual_precipitation_mm?.toFixed(1) || 0} ملم</span>
                                                </div>
                                                <div className="bg-card/50 p-2 rounded-lg">
                                                    <span className="text-[10px] text-muted-foreground block">أشهر الجفاف</span>
                                                    <span className="text-sm font-bold text-amber-400">{selectedEnvProvince.data.drought_risk?.dry_season_months?.length || 0} أشهر</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Climate Trends */}
                                    {selectedEnvProvince.data.climate_trends && Object.keys(selectedEnvProvince.data.climate_trends).length > 0 && (
                                        <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
                                            <h4 className="text-sm font-bold mb-3 flex items-center gap-2 text-foreground">
                                                <TrendingDown size={16} className="text-blue-500" />
                                                اتجاهات المناخ
                                            </h4>
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center bg-card/50 p-2 rounded-lg">
                                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <Thermometer size={12} /> انحراف الحرارة
                                                    </span>
                                                    <span className={`text-xs font-bold flex items-center gap-1 ${selectedEnvProvince.data.climate_trends.temperature_trend_celsius < 0 ? 'text-blue-400' : 'text-red-400'
                                                        }`}>
                                                        {selectedEnvProvince.data.climate_trends.temperature_trend_celsius < 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                                                        {selectedEnvProvince.data.climate_trends.temperature_trend_celsius}°C
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center bg-card/50 p-2 rounded-lg">
                                                    <span className="text-xs text-muted-foreground">معدل التغير السنوي</span>
                                                    <span className="text-xs font-medium">{selectedEnvProvince.data.climate_trends.temperature_change_rate_per_year}°C/سنة</span>
                                                </div>
                                                <div className="flex justify-between items-center bg-card/50 p-2 rounded-lg">
                                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <CloudRain size={12} /> تغير الهطول
                                                    </span>
                                                    <span className={`text-xs font-bold flex items-center gap-1 ${selectedEnvProvince.data.climate_trends.rainfall_trend_mm < 0 ? 'text-amber-400' : 'text-cyan-400'
                                                        }`}>
                                                        {selectedEnvProvince.data.climate_trends.rainfall_trend_mm < 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                                                        {selectedEnvProvince.data.climate_trends.rainfall_trend_mm} ملم
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center bg-card/50 p-2 rounded-lg">
                                                    <span className="text-xs text-muted-foreground">متوسط الهطول السنوي</span>
                                                    <span className="text-xs font-medium">{selectedEnvProvince.data.climate_trends.average_annual_rainfall_mm} ملم</span>
                                                </div>
                                                <div className="flex justify-between items-center bg-card/50 p-2 rounded-lg">
                                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <Gauge size={12} /> متوسط الضغط السطحي
                                                    </span>
                                                    <span className="text-xs font-medium">{selectedEnvProvince.data.climate_trends.avg_surface_pressure_hpa?.toFixed(1)} hPa</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Historical Summary */}
                                    {selectedEnvProvince.data.historical_summary && Object.keys(selectedEnvProvince.data.historical_summary).length > 0 && (
                                        <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
                                            <h4 className="text-sm font-bold mb-2 flex items-center gap-2 text-foreground">
                                                <Calendar size={16} className="text-purple-500" />
                                                الملخص التاريخي
                                            </h4>
                                            <p className="text-[10px] text-muted-foreground mb-3 flex items-center gap-1">
                                                <span>الفترة:</span>
                                                <span className="font-medium text-foreground">
                                                    {selectedEnvProvince.data.historical_summary.period_start} إلى {selectedEnvProvince.data.historical_summary.period_end}
                                                </span>
                                            </p>
                                            <div className="space-y-2">
                                                <div className="bg-card/50 p-2 rounded-lg">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-xs text-muted-foreground">نطاق الحرارة</span>
                                                        <span className="text-xs font-medium">
                                                            <span className="text-blue-400">{selectedEnvProvince.data.historical_summary.avg_min_temp_c}°</span>
                                                            <span className="text-muted-foreground mx-1">—</span>
                                                            <span className="text-red-400">{selectedEnvProvince.data.historical_summary.avg_max_temp_c}°</span>
                                                        </span>
                                                    </div>
                                                    <div className="h-2 bg-gradient-to-r from-blue-500 via-yellow-500 to-red-500 rounded-full"></div>
                                                </div>
                                                <div className="flex justify-between items-center bg-card/50 p-2 rounded-lg">
                                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <CloudRain size={12} /> إجمالي الهطول
                                                    </span>
                                                    <span className="text-xs font-bold text-cyan-400">{selectedEnvProvince.data.historical_summary.total_precipitation_mm} ملم</span>
                                                </div>
                                                <div className="flex justify-between items-center bg-card/50 p-2 rounded-lg">
                                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <Wind size={12} /> أعلى سرعة رياح
                                                    </span>
                                                    <span className="text-xs font-medium">{selectedEnvProvince.data.historical_summary.max_wind_speed_kmh} كم/س</span>
                                                </div>
                                                <div className="flex justify-between items-center bg-card/50 p-2 rounded-lg">
                                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <Gauge size={12} /> متوسط الضغط السطحي
                                                    </span>
                                                    <span className="text-xs font-medium">{selectedEnvProvince.data.historical_summary.avg_surface_pressure_hpa?.toFixed(1)} hPa</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Data Sources */}
                                    <div className="bg-gradient-to-r from-primary/5 to-primary/10 p-3 rounded-lg border border-primary/20">
                                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">مصادر البيانات</span>
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {environmentalData.metadata.data_sources.map((source: any, idx: number) => (
                                                <span key={idx} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                                    {source}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* Country-Level Summary when no province selected */
                                <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
                                    <div className="text-center py-4">
                                        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
                                            <Leaf size={32} className="text-emerald-500" />
                                        </div>
                                        <h3 className="font-bold text-lg text-foreground mb-1">البيانات البيئية لسوريا</h3>
                                        <p className="text-xs text-muted-foreground">
                                            اختر محافظة من الخريطة لعرض التفاصيل
                                        </p>
                                    </div>

                                    {/* Key Findings */}
                                    <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-lg p-3 border border-amber-500/20">
                                        <h4 className="text-sm font-bold mb-2 flex items-center gap-2 text-foreground">
                                            <AlertTriangle size={16} className="text-amber-500" />
                                            النتائج الرئيسية
                                        </h4>
                                        <ul className="space-y-2">
                                            {environmentalData.summary.key_findings.map((finding: any, idx: number) => (
                                                <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                                                    <span className="text-amber-400 mt-0.5">•</span>
                                                    {finding}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Climate Challenges */}
                                    <div className="bg-gradient-to-r from-red-500/10 to-rose-500/10 rounded-lg p-3 border border-red-500/20">
                                        <h4 className="text-sm font-bold mb-2 flex items-center gap-2 text-foreground">
                                            <Thermometer size={16} className="text-red-400" />
                                            التحديات المناخية
                                        </h4>
                                        <ul className="space-y-1.5">
                                            {environmentalData.country_level.climate_context.main_climate_challenges.map((challenge: any, idx: number) => (
                                                <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                                                    <span className="text-red-400 mt-0.5">•</span>
                                                    {challenge}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Key Water Basins */}
                                    <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-lg p-3 border border-cyan-500/20">
                                        <h4 className="text-sm font-bold mb-2 flex items-center gap-2 text-foreground">
                                            <Droplets size={16} className="text-cyan-400" />
                                            الأحواض المائية الرئيسية
                                        </h4>
                                        <div className="flex flex-wrap gap-1.5">
                                            {environmentalData.country_level.climate_context.key_water_basins.map((basin: any, idx: number) => (
                                                <span key={idx} className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-1 rounded-full border border-cyan-500/20">
                                                    {basin}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Recommendations */}
                                    <div className="bg-gradient-to-r from-emerald-500/10 to-green-500/10 rounded-lg p-3 border border-emerald-500/20">
                                        <h4 className="text-sm font-bold mb-2 flex items-center gap-2 text-foreground">
                                            <Leaf size={16} className="text-emerald-400" />
                                            التوصيات
                                        </h4>
                                        <ul className="space-y-1.5">
                                            {environmentalData.summary.recommendations.map((rec: any, idx: number) => (
                                                <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                                                    <span className="text-emerald-400 mt-0.5">✓</span>
                                                    {rec}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Climate Classification */}
                                    <div className="bg-muted/30 rounded-lg p-3 border border-border/50 text-center">
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">التصنيف المناخي</span>
                                        <p className="text-sm font-bold text-foreground mt-1">
                                            {environmentalData.country_level.climate_context.classification}
                                        </p>
                                    </div>

                                    {/* Data Info */}
                                    <div className="bg-primary/5 p-3 rounded-lg border border-primary/10">
                                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                                            <span>المدن المحللة</span>
                                            <span className="font-bold text-primary">{environmentalData.summary.total_cities_analyzed}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {environmentalData.metadata.data_sources.map((source: any, idx: number) => (
                                                <span key={idx} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                                    {source}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* OPTION 3: POPULATION LIST (Existing) */
                        livePopulationData[currentDataType]?.map((source: DataSource) => {
                            const isExpanded = currentSourceId === source.source_id;

                            return (
                                <div key={source.source_id} className={`rounded-lg border transition-all duration-200 ${isExpanded ? 'border-primary bg-card shadow-md' : 'border-border bg-card/50 hover:bg-muted/50'}`}>
                                    <div
                                        className="p-3 flex flex-col gap-3 cursor-pointer select-none"
                                        onClick={() => setCurrentSourceId(source.source_id)}
                                    >
                                        <div className="flex flex-col gap-0.5">
                                            <span className="font-bold text-sm">
                                                {source.note || DATA_TYPE_CONFIG[currentDataType as keyof typeof DATA_TYPE_CONFIG].labelAr}
                                            </span>
                                            {source.date && (
                                                <span className="text-xs text-muted-foreground">{source.date}</span>
                                            )}
                                        </div>
                                    </div>
                                    {isExpanded && (
                                        <div className="px-3 pb-3 pt-0 animate-in slide-in-from-top-2 duration-200">
                                            <div className="mb-2 flex justify-between items-center px-1">
                                                <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">قائمة المحافظات</h3>
                                                {selectedProvinces.length > 0 && (
                                                    <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                                                        تم اختيار {selectedProvinces.length}/2
                                                    </span>
                                                )}
                                            </div>

                                            <div className="overflow-hidden rounded-md border border-border/50">
                                                <table className="w-full text-xs text-right">
                                                    <thead className="bg-muted/50 text-muted-foreground">
                                                        <tr>
                                                            <th className="py-2 px-2 text-center w-8"></th>
                                                            <th className="py-2 px-2 font-medium">المحافظة</th>
                                                            <th className="py-2 px-2 text-left font-medium">العدد</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-border/50 bg-card">
                                                        {sortCitiesByOrder(Object.entries(source.cities)).map(([city, pop]) => {
                                                            const isSelected = selectedProvinces.includes(city);
                                                            return (
                                                                <tr
                                                                    key={city}
                                                                    className={`hover:bg-muted/50 transition-colors cursor-pointer ${isSelected ? 'bg-primary/5' : ''}`}
                                                                    onClick={() => toggleProvinceSelection(city)}
                                                                >
                                                                    <td className="py-1.5 px-2 text-center">
                                                                        <div className="flex justify-center">
                                                                            {isSelected ?
                                                                                <CheckSquare size={14} className="text-primary fill-primary/10" /> :
                                                                                <Square size={14} className="text-muted-foreground" />
                                                                            }
                                                                        </div>
                                                                    </td>
                                                                    <td className="py-1.5 px-2 font-medium">{city}</td>
                                                                    <td className="py-1.5 px-2 text-left font-mono text-muted-foreground">
                                                                        {pop.toLocaleString('en-US')}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {currentDataType !== DATA_TYPES.RAINFALL && currentDataType !== DATA_TYPES.ENVIRONMENTAL && (
                    <div className="p-4 bg-muted border-t border-border text-xs text-muted-foreground">
                        <p className="flex items-center gap-1 mb-1">
                            <Info size={14} /> اختر محافظتين للمقارنة بينهما
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}