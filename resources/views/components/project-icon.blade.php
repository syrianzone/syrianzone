@props(['name' => null])

@php
    // The drawings live in resources/data/project-icons.json — the same file
    // Components/Icons/ProjectIcons.tsx renders for the app — so a section or a
    // capability group cannot end up with an icon on one side of the wire only.
    //
    // That file keeps the Tailwind classes the icons were drawn with. The
    // Filament panel does not scan the app's stylesheet, so they are resolved
    // to SVG attributes here, in the light colourway.
    $icons = \App\Support\Facts::projectIcons()['icons'];

    $resolve = static function (string $key) use ($icons): ?array {
        for ($hop = 0; $hop < 5; $hop++) {
            $entry = $icons[$key] ?? null;
            if (! is_array($entry)) {
                return null;
            }
            if (! isset($entry['alias'])) {
                return $entry;
            }
            $key = (string) $entry['alias'];
        }

        return null;
    };

    $paint = static function (string $body): string {
        $resolved = preg_replace_callback('/\sclass="([^"]*)"/', static function (array $match): string {
            $attributes = [];
            foreach (preg_split('/\s+/', trim($match[1])) ?: [] as $token) {
                // A `dark:` token is the dark colourway; the panel draws light.
                if (! preg_match('/^(fill|stroke)-\[(#[0-9a-fA-F]{3,8})\](?:\/(\d{1,3}))?$/', $token, $parts)) {
                    continue;
                }
                $attributes[$parts[1]] = $parts[2];
                if (isset($parts[3]) && $parts[3] !== '') {
                    $attributes[$parts[1].'-opacity'] = rtrim(rtrim(number_format(((int) $parts[3]) / 100, 2, '.', ''), '0'), '.');
                }
            }

            $out = '';
            foreach ($attributes as $attribute => $value) {
                $out .= sprintf(' %s="%s"', $attribute, $value);
            }

            return $out;
        }, $body);

        return str_replace('hsl(var(--primary))', 'rgb(var(--primary-500, 37 99 235))', (string) $resolved);
    };

    $icon = $name !== null ? $resolve((string) $name) : null;
    $body = is_array($icon) ? $paint((string) ($icon['body'] ?? '')) : null;
@endphp

@if ($body !== null)
    <svg
        viewBox="{{ $icon['viewBox'] }}"
        width="20"
        height="20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        {{ $attributes }}
    >
        {!! $body !!}
    </svg>
@endif
