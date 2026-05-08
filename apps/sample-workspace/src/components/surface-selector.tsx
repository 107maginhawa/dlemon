import { UNIVERSAL_TOOTH_MAP } from './dental/types';
import type { SurfaceStatus } from './dental/types';
import { UniversalTooth } from './dental/universal-tooth';

interface SurfaceSelectorProps {
  toothNumber: number;
  selectedSurfaces: string[];
  onToggle: (surface: string) => void;
  highlightColor?: string;
}

export function SurfaceSelector({
  toothNumber,
  selectedSurfaces,
  onToggle,
  highlightColor = '#FFE97D',
}: SurfaceSelectorProps) {
  const toothInfo = UNIVERSAL_TOOTH_MAP[toothNumber];
  if (!toothInfo) return null;

  const surfaces = toothInfo.surfaces.filter(s => !s.startsWith('cervical'));

  const surfacesStatus: SurfaceStatus[] = selectedSurfaces
    .filter(s => surfaces.includes(s))
    .map(s => ({
      surface: s,
      colorCoding: highlightColor,
      statusDesc: 'selected',
      surfaceName: s,
    }));

  function handleSvgClick(event: React.MouseEvent<HTMLDivElement>) {
    const el = (event.target as Element).closest(`[id^="tooth-${toothNumber}_"]`)
    if (!el) return
    for (const surface of surfaces) {
      if (el.id.startsWith(`tooth-${toothNumber}_${surface}`)) {
        onToggle(surface)
        return
      }
    }
  }

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return (
    <div
      style={{ background: '#fafaf9', border: '1px solid #e5e5e5', borderRadius: 10, padding: 16, display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}
    >
      <div
        onClick={handleSvgClick}
        style={{ cursor: 'pointer', userSelect: 'none' }}
        title="Click a surface to toggle"
      >
        <UniversalTooth
          toothNumber={toothNumber}
          variant="surfacemap"
          size="lg"
          surfacesStatus={surfacesStatus.length > 0 ? surfacesStatus : undefined}
          interactive={false}
          showLabel={false}
        />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
        {surfaces.map(surface => {
          const isSelected = selectedSurfaces.includes(surface);
          return (
            <button
              key={surface}
              type="button"
              onClick={() => onToggle(surface)}
              style={{
                padding: '3px 10px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: isSelected ? 600 : 400,
                border: `1.5px solid ${isSelected ? '#999' : '#e5e5e5'}`,
                background: isSelected ? highlightColor : '#fff',
                color: '#111',
                cursor: 'pointer',
                transition: 'all 0.1s',
              }}
            >
              {capitalize(surface)}
            </button>
          );
        })}
      </div>

      {selectedSurfaces.length === 0 && (
        <p style={{ fontSize: 12, color: '#a3a3a3', margin: 0 }}>Click surfaces to select</p>
      )}
    </div>
  );
}
