import { MapCanvas } from '@/Components/map/MapCanvas';
import { FlyTo } from '@/Components/map/FlyTo';
import { CrossingsLayer } from './CrossingsLayer';
import { DEFAULT_CENTER, DEFAULT_ZOOM } from '../_lib/crossings';

export function CrossingsMap(props: {
    data: GeoJSON.FeatureCollection;
    selectedId: number | null;
    focus: { lng: number; lat: number; zoom: number; key: number } | null;
    onSelect: (n: number) => void;
    onHover: (n: number | null) => void;
    className?: string;
}) {
    return (
        <MapCanvas center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} className={props.className}>
            <CrossingsLayer
                data={props.data}
                selectedId={props.selectedId}
                onSelect={props.onSelect}
                onHover={props.onHover}
            />
            {props.focus && (
                <FlyTo lng={props.focus.lng} lat={props.focus.lat} zoom={props.focus.zoom} trigger={props.focus.key} />
            )}
        </MapCanvas>
    );
}
