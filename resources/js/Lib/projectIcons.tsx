import React from 'react';
import iconData from '../../../resources/data/project-icons.json';

/**
 * The drawings behind every project icon, rendered from
 * `resources/data/project-icons.json` so the React app and the Blade/Filament
 * panel cannot drift: `<ProjectIcon name=… />` here, `<x-project-icon>` there.
 *
 * Each entry is either the SVG's `viewBox` plus its `body` markup, or an
 * `alias` of another key (the capability groups are named after the capability
 * module, which is not always the navigation module's id).
 *
 * The body keeps the utility classes each shape was drawn with; Tailwind only
 * scans code files, so the same tokens are listed once in
 * `Components/Icons/ProjectIcons.tsx` and `projectIcons.test.ts` fails if one
 * side goes missing. The Blade component resolves the tokens to SVG attributes
 * instead, because the Filament panel does not scan the app's stylesheet.
 */
export interface ProjectIconProps {
    className?: string;
}

type RawDrawing = { viewBox?: string; body?: string; alias?: string };
type Drawing = { viewBox: string; body: string };

const RAW: Record<string, RawDrawing> = {};
for (const [key, value] of Object.entries(iconData.icons)) {
    RAW[key] = value;
}

export type ProjectIconKey = keyof typeof iconData.icons;

export const PROJECT_ICON_KEYS = Object.keys(iconData.icons).filter(
    (key): key is ProjectIconKey => key in iconData.icons,
);

function resolveDrawing(key: string): Drawing | null {
    const entry = RAW[key];
    if (!entry) return null;
    if (entry.alias) return resolveDrawing(entry.alias);
    if (!entry.viewBox || !entry.body) return null;

    return { viewBox: entry.viewBox, body: entry.body };
}

/**
 * One icon, drawn from the shared data file. Renders nothing for an unknown
 * key, which is the contract both sides keep.
 */
export function ProjectIcon({ name, className = 'w-7 h-7' }: ProjectIconProps & { name: string }) {
    const drawing = resolveDrawing(name);
    if (!drawing) return null;

    return (
        <svg
            viewBox={drawing.viewBox}
            className={className}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            dangerouslySetInnerHTML={{ __html: drawing.body }}
        />
    );
}

/** A component for one drawing, for importers that take the icon as a prop. */
export function projectIcon(name: ProjectIconKey): React.ComponentType<ProjectIconProps> {
    return function Icon({ className = 'w-7 h-7' }: ProjectIconProps) {
        return <ProjectIcon name={name} className={className} />;
    };
}
