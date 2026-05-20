import { useState, useEffect, useMemo } from 'react';
import { TOOTH_SIZE_PRESETS, UNIVERSAL_TOOTH_MAP } from './types';
import type { SurfaceStatus } from './types';
import { loadAndPrepareSvg, applySurfaceColors } from './svg-utils';

export interface UniversalToothProps {
  toothNumber: number;
  /** Override the displayed label. Defaults to `toothNumber`. Used to show FDI numbers when the SVG loads Universal numbers. */
  label?: number | string;
  surfacesStatus?: SurfaceStatus[];
  fillColor?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  variant?: 'column' | 'surfacemap';
  showLabel?: boolean;
  interactive?: boolean;
  onClick?: (toothNumber: number) => void;
}

export function UniversalTooth({
  toothNumber,
  label,
  surfacesStatus,
  fillColor,
  size = 'md',
  variant = 'column',
  showLabel = true,
  interactive = true,
  onClick,
}: UniversalToothProps) {
  const [baseSvg, setBaseSvg] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const toothInfo = UNIVERSAL_TOOTH_MAP[toothNumber];
  const dimensions = TOOTH_SIZE_PRESETS[size];

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setHasError(false);

    if (toothNumber < 1 || toothNumber > 32) {
      setHasError(true);
      setIsLoading(false);
      return;
    }

    loadAndPrepareSvg(toothNumber, variant)
      .then(svg => {
        if (!cancelled) {
          setBaseSvg(svg);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasError(true);
          setIsLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [toothNumber, variant]);

  // Re-apply colors whenever base SVG, fillColor, or surfacesStatus changes
  const coloredSvg = useMemo(() => {
    if (!baseSvg) return '';
    return applySurfaceColors(baseSvg, toothNumber, { fillColor, surfacesStatus });
  }, [baseSvg, toothNumber, fillColor, surfacesStatus]);

  const ariaLabel = toothInfo
    ? `${toothInfo.name}, Tooth number ${toothNumber}`
    : `Tooth ${toothNumber}`;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 2,
        position: 'relative',
        width: '100%',
        maxWidth: dimensions.width,
        cursor: interactive ? 'pointer' : 'default',
      }}
      aria-label={ariaLabel}
      role="img"
      tabIndex={interactive ? 0 : -1}
      onClick={() => interactive && onClick?.(toothNumber)}
      onKeyDown={e => { if (interactive && (e.key === 'Enter' || e.key === ' ')) onClick?.(toothNumber); }}
    >
      {isLoading && (
        <div style={{ width: '100%', aspectRatio: '2/3', background: '#e5e7eb', borderRadius: 4 }} />
      )}

      {!isLoading && hasError && (
        <div style={{ width: '100%', aspectRatio: '2/3', background: '#fef2f2', border: '1px dashed #ef4444', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 10, color: '#ef4444' }}>!</span>
        </div>
      )}

      {!isLoading && !hasError && coloredSvg && (
        <div
          className="universal-tooth-svg"
          style={{ width: '100%', height: 'auto', overflow: 'hidden' }}
          // SVG content is from our own controlled static files
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: coloredSvg }}
        />
      )}

      {showLabel && !isLoading && !hasError && (
        <span style={{ fontSize: size === 'sm' || size === 'xs' ? 9 : 11, fontWeight: 500, color: '#374151', textAlign: 'center', lineHeight: 1 }}>
          {label ?? toothNumber}
        </span>
      )}
    </div>
  );
}
