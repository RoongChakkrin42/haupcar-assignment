import 'leaflet/dist/leaflet.css';
import { LocateFixed } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { Button } from '@/components/ui/button';

type LatLng = { lat: number; lng: number };
const BANGKOK: LatLng = { lat: 13.7563, lng: 100.5018 };
const round = (n: number) => Math.round(n * 1e6) / 1e6;

function ClickToPlace({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: round(e.latlng.lat), lng: round(e.latlng.lng) }) });
  return null;
}

function FlyTo({ point }: { point: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (point) map.flyTo(point, Math.max(map.getZoom(), 15), { duration: 0.6 });
  }, [map, point]);
  return null;
}

/** Tap the map to set the pickup point. CircleMarker avoids Leaflet's image-based default icon. */
export function MapPicker({
  value,
  onChange,
}: {
  value: LatLng | null;
  onChange: (p: LatLng) => void;
}) {
  const [locating, setLocating] = useState(false);
  // Leaflet paints SVG with literal colours, so read the design token instead of repeating it.
  const [pinColor] = useState(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--primary').trim(),
  );
  const [geoError, setGeoError] = useState<string | null>(null);

  const locateMe = () => {
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onChange({ lat: round(pos.coords.latitude), lng: round(pos.coords.longitude) });
      },
      () => {
        setLocating(false);
        setGeoError('ใช้ตำแหน่งปัจจุบันไม่ได้ แตะบนแผนที่เพื่อปักหมุดแทน');
      },
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="h-72 overflow-hidden rounded-lg border">
        <MapContainer center={value ?? BANGKOK} zoom={value ? 15 : 11} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickToPlace onPick={onChange} />
          <FlyTo point={value} />
          {value && (
            <CircleMarker
              center={value}
              radius={10}
              pathOptions={{ color: pinColor, fillColor: pinColor, fillOpacity: 0.85, weight: 3 }}
            />
          )}
        </MapContainer>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Button type="button" variant="outline" size="sm" onClick={locateMe} disabled={locating}>
          <LocateFixed /> {locating ? 'กำลังหาตำแหน่ง…' : 'ใช้ตำแหน่งปัจจุบัน'}
        </Button>
        <span className="text-muted-foreground">
          {value ? `${value.lat}, ${value.lng}` : 'แตะบนแผนที่เพื่อปักหมุดจุดรับรถ'}
        </span>
      </div>
      {geoError && <p className="text-sm text-destructive">{geoError}</p>}
    </div>
  );
}
