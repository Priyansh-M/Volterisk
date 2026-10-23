/** Stored as tenths once `policeSettledOn` is `v|day|tickMs|finedWindow`. */

export function unpackPolice(mark: string | null): {
  versioned: boolean;
  day: string | null;
  tickMs: number | null;
  finedWindow: number;
  /** Highest display-point tenths seen in the current 48-hour window. */
  peakTenths: number;
  /** Bit 0: a window closed under High. Bit 1: Critical was reached. */
  flags: number;
} {
  if (!mark?.startsWith("v|")) {
    return {
      versioned: false,
      day: mark && mark.length >= 10 ? mark.slice(0, 10) : null,
      tickMs: null,
      finedWindow: 0,
      peakTenths: 0,
      flags: 0,
    };
  }
  const parts = mark.split("|");
  return {
    versioned: true,
    day: parts[1] || null,
    tickMs: parts[2] ? Number(parts[2]) : null,
    finedWindow: Number(parts[3]) || 0,
    peakTenths: Number(parts[4]) || 0,
    flags: Number(parts[5]) || 0,
  };
}

export function packPolice(day: string, tickMs: number, finedWindow: number, peakTenths = 0, flags = 0): string {
  return `v|${day}|${tickMs}|${finedWindow}|${peakTenths}|${flags}`;
}

export function policePoints(stored: number, mark: string | null): number {
  return unpackPolice(mark).versioned ? Math.round(stored) / 10 : stored;
}
