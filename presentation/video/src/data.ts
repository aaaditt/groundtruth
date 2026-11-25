// Every number and curve in the clips comes from these files, written by
// src/presentation_data.py from the real data. Nothing here is typed in by hand.
import cityDay from "../public/data/city_day.json";
import spectrum from "../public/data/spectrum.json";
import bands from "../public/data/bands.json";
import forest from "../public/data/forest.json";
import folds from "../public/data/folds.json";
import results from "../public/data/results.json";
import mistakes from "../public/data/mistakes.json";
import applied from "../public/data/applied.json";
import lockdown from "../public/data/lockdown.json";
import stations from "../public/data/stations.json";

export { cityDay, spectrum, bands, forest, folds, results, mistakes, applied, lockdown, stations };

export const pct = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`;

export type Day = {
  date: string;
  samples: number[][]; // [minutes after local midnight, shaking as x typical]
  hourly_log10: number[];
  shape: number[];
  level_raw: number;
};

export const DAYS = cityDay.days as unknown as Record<"wednesday" | "sunday" | "christmas", Day>;

// One shared vertical scale for the three Brussels days, so they compare honestly.
const all = Object.values(DAYS).flatMap((d) => d.samples.map((s) => Math.log10(s[1])));
export const DAY_LOG_MIN = Math.min(...all);
export const DAY_LOG_MAX = Math.max(...all);

// Brussels' real hourly rhythm on the Wednesday, scaled 0..1: drives how busy the
// illustrated street is at each hour (the illustration follows the real data).
const hl = DAYS.wednesday.hourly_log10;
const lo = Math.min(...hl);
const hi = Math.max(...hl);
export const BUSY = hl.map((v) => (v - lo) / (hi - lo));

export const busyAt = (minute: number) => {
  const h = (minute / 60) % 24;
  const a = Math.floor(h);
  const b = (a + 1) % 24;
  const f = h - a;
  return BUSY[a] * (1 - f) + BUSY[b] * f;
};

// The real 15-minute reading nearest a time of day (x typical level).
export const shakeAt = (day: Day, minute: number) => {
  let best = day.samples[0];
  for (const s of day.samples) if (Math.abs(s[0] - minute) < Math.abs(best[0] - minute)) best = s;
  return best[1];
};

// The same 0..1 "how busy" scale for any of the three Brussels days, on the Wednesday's
// range, so a quiet day really drives a quieter street (Christmas, Sunday).
export const busyOn = (which: "wednesday" | "sunday" | "christmas", minute: number) => {
  const v = DAYS[which].hourly_log10;
  const h = (((minute / 60) % 24) + 24) % 24;
  const a = Math.floor(h);
  const f = h - a;
  const x = v[a] * (1 - f) + v[(a + 1) % 24] * f;
  return Math.max(0, Math.min(1, (x - lo) / (hi - lo)));
};
