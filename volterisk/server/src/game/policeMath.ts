/** Stored as tenths once `policeSettledOn` is `v|day|tickMs|finedWindow`. */

export function unpackPolice(mark: string | null): {
  versioned: boolean;
  day: string | null;
  tickMs: number | null;
  finedWindow: number;
} {
  if (!mark?.startsWith("v|")) {
    return { versioned: false, day: mark && mark.length >= 10 ? mark.slice(0, 10) : null, tickMs: null, finedWindow: 0 };
  }
  const parts = mark.split("|");
  return {
    versioned: true,
    day: parts[1] || null,
    tickMs: parts[2] ? Number(parts[2]) : null,
    finedWindow: Number(parts[3]) || 0,
  };
}

export function packPolice(day: string, tickMs: number, finedWindow: number): string {
  return `v|${day}|${tickMs}|${finedWindow}`;
}

export function policePoints(stored: number, mark: string | null): number {
  return unpackPolice(mark).versioned ? Math.round(stored) / 10 : stored;
}
