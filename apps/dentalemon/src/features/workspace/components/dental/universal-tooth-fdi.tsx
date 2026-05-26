/**
 * UniversalToothFdi — FDI-to-Universal adapter wrapper
 *
 * The main app uses FDI tooth numbers (11–48).
 * UniversalTooth expects Universal numbers (1–32).
 * This wrapper converts at the callsite so consumers don't need to convert manually.
 */

import React from 'react';
import { UniversalTooth } from './universal-tooth';
import type { UniversalToothProps } from './universal-tooth';
import { fdiToUniversal, fdiPrimaryToUniversal } from '../dental-chart.helpers';

export interface UniversalToothFdiProps extends Omit<UniversalToothProps, 'toothNumber' | 'size'> {
  fdiToothNumber: number;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export function UniversalToothFdi({ fdiToothNumber, ...props }: UniversalToothFdiProps) {
  const isPrimary = fdiToothNumber >= 51 && fdiToothNumber <= 85;
  const universalNumber = isPrimary ? fdiPrimaryToUniversal(fdiToothNumber) : fdiToUniversal(fdiToothNumber);
  return <UniversalTooth toothNumber={universalNumber} label={fdiToothNumber} {...props} />;
}
