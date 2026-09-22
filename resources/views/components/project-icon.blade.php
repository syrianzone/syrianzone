@props(['name' => null])

@php
    // Ported from resources/js/Components/Icons/ProjectIcons.tsx so the
    // Filament admin can group permission checkboxes with the same project
    // icons the homepage uses. Colors are inline (not Tailwind arbitrary
    // classes) because the Filament panel CSS does not scan the React app.
    $icons = [
        'syofficial' => <<<'SVG'
            <path d="M16 3L5 7v9c0 7.2 4.7 13.9 11 16 6.3-2.1 11-8.8 11-16V7L16 3z" fill="#3B82F6" fill-opacity="0.15" stroke="#2563EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M11 16l3.5 3.5L21 11" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="21" cy="11" r="2" fill="rgb(var(--primary-500, 37 99 235))"/>
        SVG,
        'govapps' => <<<'SVG'
            <rect x="8" y="3" width="16" height="26" rx="3" fill="#475569" fill-opacity="0.15" stroke="#475569" stroke-width="2"/>
            <path d="M14 6h4" stroke="#64748B" stroke-width="2" stroke-linecap="round"/>
            <rect x="11" y="10" width="4" height="4" rx="1" fill="#3DDC84"/>
            <rect x="17" y="10" width="4" height="4" rx="1" fill="#3B82F6"/>
            <rect x="11" y="16" width="4" height="4" rx="1" fill="#F59E0B"/>
            <rect x="17" y="16" width="4" height="4" rx="1" fill="rgb(var(--primary-500, 217 119 6))"/>
            <circle cx="16" cy="24" r="1.5" fill="#64748B"/>
        SVG,
        'transit' => <<<'SVG'
            <rect x="6" y="5" width="20" height="19" rx="4" fill="#EAB308" fill-opacity="0.2" stroke="#CA8A04" stroke-width="2"/>
            <path d="M6 13h20" stroke="#2563EB" stroke-width="2"/>
            <circle cx="10" cy="18" r="2" fill="#2563EB"/>
            <circle cx="22" cy="18" r="2" fill="#2563EB"/>
            <path d="M9 24v4M23 24v4" stroke="#64748B" stroke-width="2.5" stroke-linecap="round"/>
            <circle cx="16" cy="9" r="1.5" fill="rgb(var(--primary-500, 37 99 235))"/>
        SVG,
        'places' => <<<'SVG'
            <path d="M16 3C10.5 3 6 7.5 6 13c0 7.5 10 16 10 16s10-8.5 10-16c0-5.5-4.5-10-10-10z" fill="#EF4444" fill-opacity="0.2" stroke="#DC2626" stroke-width="2" stroke-linejoin="round"/>
            <circle cx="16" cy="13" r="3.5" fill="rgb(var(--primary-500, 37 99 235))" stroke="#FFFFFF" stroke-width="1.5"/>
        SVG,
        'phonebook' => <<<'SVG'
            <rect x="6" y="4" width="20" height="24" rx="3" fill="#F59E0B" fill-opacity="0.15" stroke="#D97706" stroke-width="2"/>
            <path d="M6 9h20" stroke="#059669" stroke-width="2"/>
            <circle cx="16" cy="16" r="3.5" fill="#10B981" fill-opacity="0.25" stroke="#059669" stroke-width="2"/>
            <path d="M11 24c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="#64748B" stroke-width="2" stroke-linecap="round"/>
            <path d="M2 8v3M2 15v3M2 22v3" stroke="rgb(var(--primary-500, 37 99 235))" stroke-width="2.5" stroke-linecap="round"/>
        SVG,
        'polls' => <<<'SVG'
            <rect x="4" y="5" width="24" height="6" rx="2" fill="#F59E0B" opacity="0.9"/>
            <rect x="4" y="13" width="24" height="6" rx="2" fill="#3B82F6" opacity="0.85"/>
            <rect x="4" y="21" width="24" height="6" rx="2" fill="#10B981" opacity="0.85"/>
            <path d="M8 8h6M8 16h10M8 24h14" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
            <circle cx="25" cy="8" r="1.5" fill="rgb(var(--primary-500, 37 99 235))"/>
        SVG,
    ];
@endphp

@if (isset($icons[$name]))
    <svg
        viewBox="0 0 32 32"
        width="20"
        height="20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        {{ $attributes }}
    >
        {!! $icons[$name] !!}
    </svg>
@endif
