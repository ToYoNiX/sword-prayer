/*
 * Prayer times as anchors for Sword: prayer.fajr, prayer.dhuhr, prayer.asr,
 * prayer.maghrib and prayer.isha, computed with adhan for the vault's
 * location. Each has a window, from its time until the next prayer (Fajr
 * until sunrise, Isha until the next Fajr), and a busy part from the adhan,
 * which Sword keeps clear.
 *
 * Built into main.js with `npm run build`, which bundles adhan in, so Sword
 * loads one file with nothing to install.
 */
import { CalculationMethod, Coordinates, Madhab, PrayerTimes } from 'adhan';
import type { Anchor, Plugin, SettingsResult } from '@sword/plugin-api';

const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
type Prayer = (typeof PRAYERS)[number];

const METHODS = {
  muslim_world_league: CalculationMethod.MuslimWorldLeague,
  egyptian: CalculationMethod.Egyptian,
  karachi: CalculationMethod.Karachi,
  umm_al_qura: CalculationMethod.UmmAlQura,
  dubai: CalculationMethod.Dubai,
  moonsighting_committee: CalculationMethod.MoonsightingCommittee,
  north_america: CalculationMethod.NorthAmerica,
  kuwait: CalculationMethod.Kuwait,
  qatar: CalculationMethod.Qatar,
  singapore: CalculationMethod.Singapore,
  tehran: CalculationMethod.Tehran,
  turkey: CalculationMethod.Turkey,
} as const;

export interface PrayerSettings {
  method: keyof typeof METHODS;
  madhab: 'shafi' | 'hanafi';
  /** Minutes from each adhan that are busy. */
  busy: Record<Prayer, number>;
}

const DEFAULT_BUSY = 30;
const SETTINGS = new Set(['method', 'madhab', 'busy']);

const plugin = {
  id: 'prayer',

  /**
   * prayer:
   *   method: egyptian          # required: one of METHODS
   *   madhab: shafi             # for Asr: shafi (default) or hanafi
   *   busy: 30m                 # from each adhan; or per prayer: { fajr: 20m, isha: 40m }
   */
  settings(raw: unknown): SettingsResult<PrayerSettings> {
    if (raw === undefined || raw === null) return { ok: false, errors: ['needs a method, e.g. "prayer: { method: egyptian }"'] };
    if (typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: ['settings must be a mapping, e.g. "prayer: { method: egyptian }"'] };
    const data = raw as Record<string, unknown>;
    const errors = Object.keys(data)
      .filter((key) => !SETTINGS.has(key))
      .map((key) => `unknown setting "${key}"; use method, madhab and busy`);

    const method = data['method'];
    if (method === undefined) errors.push(`method: missing; use one of ${Object.keys(METHODS).join(', ')}`);
    else if (typeof method !== 'string' || !(method in METHODS)) errors.push(`method: ${JSON.stringify(method)} is not one of ${Object.keys(METHODS).join(', ')}`);

    const madhab = data['madhab'] ?? 'shafi';
    if (madhab !== 'shafi' && madhab !== 'hanafi') errors.push(`madhab: use shafi or hanafi, not ${JSON.stringify(madhab)}`);

    const busy = Object.fromEntries(PRAYERS.map((p) => [p, DEFAULT_BUSY])) as Record<Prayer, number>;
    const rawBusy = data['busy'];
    if (typeof rawBusy === 'string') {
      const minutes = duration(rawBusy);
      if (minutes === null) errors.push(`busy: "${rawBusy}" is not a duration like 30m or 1h`);
      else for (const p of PRAYERS) busy[p] = minutes;
    } else if (typeof rawBusy === 'object' && rawBusy !== null && !Array.isArray(rawBusy)) {
      for (const [prayer, value] of Object.entries(rawBusy)) {
        const minutes = typeof value === 'string' ? duration(value) : null;
        if (!(PRAYERS as readonly string[]).includes(prayer)) errors.push(`busy: "${prayer}" is not a prayer; use ${PRAYERS.join(', ')}`);
        else if (minutes === null) errors.push(`busy.${prayer}: ${JSON.stringify(value)} is not a duration like 30m or 1h`);
        else busy[prayer as Prayer] = minutes;
      }
    } else if (rawBusy !== undefined) {
      errors.push('busy: use a duration like 30m, or one per prayer like { fajr: 20m }');
    }

    if (errors.length > 0) return { ok: false, errors };
    return { ok: true, value: { method: method as PrayerSettings['method'], madhab: madhab as PrayerSettings['madhab'], busy } };
  },

  anchors({ dates, location, settings }): Anchor[] {
    if (location === undefined) throw new Error('set location in sword.yaml, e.g. location: { latitude: 30.0444, longitude: 31.2357 }');
    const coordinates = new Coordinates(location.latitude, location.longitude);
    const params = METHODS[settings.method]();
    params.madhab = settings.madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
    const times = (date: string) => {
      const [year, month, day] = date.split('-').map(Number) as [number, number, number];
      // adhan reads the calendar date from the Date's local fields.
      return new PrayerTimes(coordinates, new Date(year, month - 1, day), params);
    };

    return dates.flatMap((date) => {
      const today = times(date);
      const next = times(nextDate(date));
      const ends: Record<Prayer, Date> = { fajr: today.sunrise, dhuhr: today.asr, asr: today.maghrib, maghrib: today.isha, isha: next.fajr };
      return PRAYERS.map((prayer): Anchor => {
        const start = today[prayer];
        const end = ends[prayer];
        const busyEnd = new Date(Math.min(start.getTime() + settings.busy[prayer] * 60_000, end.getTime()));
        return { id: `prayer.${prayer}`, date, title: title(prayer, date), start: iso(start), end: iso(end), busy: [{ start: iso(start), end: iso(busyEnd) }], tags: ['prayer'] };
      });
    });
  },
} satisfies Plugin<PrayerSettings>;

export default plugin;

const TITLES: Record<Prayer, string> = { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };

/** The name shown in calendars; Dhuhr on a Friday is Jumu'ah. */
function title(prayer: Prayer, date: string): string {
  return prayer === 'dhuhr' && new Date(`${date}T12:00:00Z`).getUTCDay() === 5 ? "Jumu'ah" : TITLES[prayer];
}

/** "30m", "1h", "1h15m" in minutes; null if it isn't a positive duration. */
function duration(text: string): number | null {
  const match = /^\s*(?:(\d+)h)?\s*(?:(\d+)m)?\s*$/.exec(text);
  if (!match || (match[1] === undefined && match[2] === undefined)) return null;
  const minutes = Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0);
  return minutes > 0 ? minutes : null;
}

function nextDate(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function iso(date: Date): string {
  return date.toISOString().replace('.000Z', 'Z');
}
