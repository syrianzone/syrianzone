import { getCanonicalCityName } from '@/lib/city-name-standardizer';

export function generateRainChartHtml(name: string, data: any[]) {
    const displayName = getCanonicalCityName(name);
    const sorted = [...data].sort((a, b) => a.year - b.year);
    const maxVal = Math.max(...sorted.map(d => d.rainfall));

    const barsHtml = sorted.map(d => {
        const height = maxVal > 0 ? (d.rainfall / maxVal) * 40 : 0;
        const isCurrentYear = d.year === 2025;
        const barColor = isCurrentYear ? '#38bdf8' : '#64748b';

        return `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                <div style="
                    height: ${Math.max(height, 4)}px; 
                    width: 6px; 
                    background-color: ${barColor}; 
                    border-radius: 1px;
                " title="${d.year}: ${d.rainfall}mm"></div>
                <div style="font-size: 8px; color: #94a3b8; transform: rotate(-45deg); margin-top: 2px;">${d.year.toString().slice(2)}</div>
            </div>
        `;
    }).join('');

    const latest = sorted[sorted.length - 1];

    return `
        <div class="text-right" style="font-family: 'IBM Plex Sans Arabic', sans-serif; min-width: 130px;">
            <div class="font-bold text-base mb-1 text-slate-100">${displayName}</div>
            <div class="flex justify-between items-end mb-2 mt-2">
                <div>
                    <div class="text-[10px] text-slate-400">آخر هطول</div>
                    <div class="font-mono text-sm text-cyan-400 font-bold" style="direction: ltr">${latest.rainfall} <span class="text-[9px]">mm</span></div>
                </div>
                <div style="display: flex; align-items: flex-end; gap: 3px; height: 50px; padding-bottom: 5px; margin-right: 10px;">
                    ${barsHtml}
                </div>
            </div>
        </div>
    `;
}

export function generatePopulationTooltipHtml(name: string, value: number, label: string) {
    const displayName = getCanonicalCityName(name);
    const valueStr = value ? value.toLocaleString('en-US') : 'لا توجد بيانات';

    return `
        <div class="text-right" style="font-family: 'IBM Plex Sans Arabic', sans-serif;">
            <div class="font-bold text-base mb-1">${displayName}</div>
            <div class="text-sm">${label}: ${valueStr}</div>
        </div>
    `;
}

export function generateEnvironmentalTooltipHtml(name: string, data: any) {
    const displayName = getCanonicalCityName(name);
    const temp = data.current_conditions?.temperature_celsius || 0;
    const feelsLike = data.current_conditions?.feels_like_celsius || temp;
    const humidity = data.current_conditions?.humidity_percent || 0;
    const windSpeed = data.current_conditions?.wind_speed_kmh || 0;
    const weatherDesc = data.current_conditions?.weather_description || '';
    const aqi = data.air_quality?.estimated_aqi || 0;
    const droughtRisk = data.drought_risk?.drought_risk || 'N/A';

    // Weather icon based on description
    let weatherIcon = '☀️';
    const desc = (weatherDesc || '').toLowerCase();
    if (desc.includes('rain') || desc.includes('drizzle')) weatherIcon = '🌧️';
    else if (desc.includes('overcast') || desc.includes('cloudy')) weatherIcon = '☁️';
    else if (desc.includes('partly') || desc.includes('mainly clear')) weatherIcon = '⛅';
    else if (desc.includes('snow')) weatherIcon = '❄️';
    else if (desc.includes('fog') || desc.includes('mist')) weatherIcon = '🌫️';
    else if (desc.includes('thunder') || desc.includes('storm')) weatherIcon = '⚡';

    // Temperature color
    let tempColor = '#22d3ee'; // cyan
    if (temp <= 5) tempColor = '#3b82f6';
    else if (temp <= 10) tempColor = '#06b6d4';
    else if (temp <= 15) tempColor = '#14b8a6';
    else if (temp <= 20) tempColor = '#22c55e';
    else if (temp <= 25) tempColor = '#eab308';
    else if (temp <= 30) tempColor = '#f97316';
    else tempColor = '#ef4444';

    // AQI color
    let aqiColor = '#22c55e';
    let aqiBg = 'rgba(34, 197, 94, 0.2)';
    if (aqi > 100) { aqiColor = '#ef4444'; aqiBg = 'rgba(239, 68, 68, 0.2)'; }
    else if (aqi > 50) { aqiColor = '#eab308'; aqiBg = 'rgba(234, 179, 8, 0.2)'; }

    // Drought color
    let droughtColor = '#22c55e';
    if (droughtRisk === 'Very High') droughtColor = '#ef4444';
    else if (droughtRisk === 'High') droughtColor = '#f97316';
    else if (droughtRisk === 'Moderate') droughtColor = '#eab308';

    return `
        <div style="font-family: 'IBM Plex Sans Arabic', system-ui, sans-serif; min-width: 180px; direction: rtl;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <div style="font-size: 28px; line-height: 1;">${weatherIcon}</div>
                <div style="flex: 1;">
                    <div style="font-weight: 700; font-size: 14px; color: #f8fafc;">${displayName}</div>
                    <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">${weatherDesc}</div>
                </div>
            </div>
            
            <div style="display: flex; align-items: baseline; gap: 6px; margin-bottom: 8px;">
                <span style="font-size: 32px; font-weight: 700; color: ${tempColor}; font-family: monospace;">${temp}°</span>
                <span style="font-size: 11px; color: #64748b;">المحسوسة ${feelsLike}°</span>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                <div style="background: rgba(59, 130, 246, 0.15); padding: 6px 8px; border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.2);">
                    <div style="font-size: 9px; color: #94a3b8; margin-bottom: 2px;">💧 الرطوبة</div>
                    <div style="font-size: 13px; font-weight: 600; color: #60a5fa; font-family: monospace;">${humidity}%</div>
                </div>
                <div style="background: rgba(148, 163, 184, 0.15); padding: 6px 8px; border-radius: 6px; border: 1px solid rgba(148, 163, 184, 0.2);">
                    <div style="font-size: 9px; color: #94a3b8; margin-bottom: 2px;">💨 الرياح</div>
                    <div style="font-size: 13px; font-weight: 600; color: #cbd5e1; font-family: monospace;">${windSpeed} <span style="font-size: 9px;">كم/س</span></div>
                </div>
                <div style="background: ${aqiBg}; padding: 6px 8px; border-radius: 6px; border: 1px solid ${aqiColor}30;">
                    <div style="font-size: 9px; color: #94a3b8; margin-bottom: 2px;">🌬️ جودة الهواء</div>
                    <div style="font-size: 13px; font-weight: 600; color: ${aqiColor}; font-family: monospace;">${aqi} AQI</div>
                </div>
                <div style="background: rgba(251, 146, 60, 0.15); padding: 6px 8px; border-radius: 6px; border: 1px solid rgba(251, 146, 60, 0.2);">
                    <div style="font-size: 9px; color: #94a3b8; margin-bottom: 2px;">🏜️ الجفاف</div>
                    <div style="font-size: 11px; font-weight: 600; color: ${droughtColor};">${droughtRisk}</div>
                </div>
            </div>
            
            <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.05); text-align: center;">
                <span style="font-size: 9px; color: #64748b;">انقر للتفاصيل الكاملة</span>
            </div>
        </div>
    `;
}