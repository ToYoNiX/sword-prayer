import { describe, expect, it } from 'vitest';
import type { Anchor, AnchorContext } from '@sword/plugin-api';
import source from '../src/index.ts';
import type { PrayerSettings } from '../src/index.ts';
// The bundled file Sword loads: it must behave exactly like the source.
// @ts-expect-error main.js has no type declarations
import bundled from '../main.js';

const cairo = { latitude: 30.0444, longitude: 31.2357 };
const settings = (raw: unknown): PrayerSettings => {
  const result = source.settings!(raw);
  if (!result.ok) throw new Error(result.errors.join('; '));
  return result.value;
};
const anchors = (dates: string[], raw: unknown = { method: 'egyptian' }, location = cairo): Anchor[] =>
  source.anchors!({ dates, timeZone: 'Africa/Cairo', location, settings: settings(raw) } as AnchorContext<PrayerSettings>);
const on = (list: Anchor[], id: string, date: string) => list.find((a) => a.id === id && a.date === date)!;
/** A local Cairo time as an instant: +03:00 until Oct 29, 2026, then +02:00. */
const cairoTime = (date: string, time: string) => new Date(`${date}T${time}:00${date <= '2026-10-29' ? '+03:00' : '+02:00'}`).toISOString().replace('.000Z', 'Z');

describe('prayer anchors', () => {
  it('gives the five prayers for each date, at the times adhan computes for Cairo', () => {
    const list = anchors(['2026-10-22']);
    expect(list.map((a) => [a.id, a.start])).toEqual([
      ['prayer.fajr', cairoTime('2026-10-22', '05:34')],
      ['prayer.dhuhr', cairoTime('2026-10-22', '12:41')],
      ['prayer.asr', cairoTime('2026-10-22', '15:51')],
      ['prayer.maghrib', cairoTime('2026-10-22', '18:17')],
      ['prayer.isha', cairoTime('2026-10-22', '19:35')],
    ]);
    expect(list.every((a) => a.date === '2026-10-22' && a.tags?.join() === 'prayer')).toBe(true);
  });

  it("names each prayer, and Dhuhr on a Friday Jumu'ah", () => {
    expect(anchors(['2026-10-22']).map((a) => a.title)).toEqual(['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']);
    expect(on(anchors(['2026-10-23']), 'prayer.dhuhr', '2026-10-23').title).toBe("Jumu'ah");
  });

  it('gives each prayer a window until the next one, Fajr until sunrise and Isha until the next Fajr', () => {
    const list = anchors(['2026-10-22']);
    expect(on(list, 'prayer.fajr', '2026-10-22').end).toBe(cairoTime('2026-10-22', '07:02'));
    expect(on(list, 'prayer.dhuhr', '2026-10-22').end).toBe(cairoTime('2026-10-22', '15:51'));
    expect(on(list, 'prayer.asr', '2026-10-22').end).toBe(cairoTime('2026-10-22', '18:17'));
    expect(on(list, 'prayer.maghrib', '2026-10-22').end).toBe(cairoTime('2026-10-22', '19:35'));
    expect(on(list, 'prayer.isha', '2026-10-22').end).toBe(cairoTime('2026-10-23', '05:35'));
  });

  it('keeps 30 minutes from each adhan busy by default', () => {
    const asr = on(anchors(['2026-10-22']), 'prayer.asr', '2026-10-22');
    expect(asr.busy).toEqual([{ start: cairoTime('2026-10-22', '15:51'), end: cairoTime('2026-10-22', '16:21') }]);
  });

  it('takes one busy time for all, or one per prayer', () => {
    const all = anchors(['2026-10-22'], { method: 'egyptian', busy: '20m' });
    expect(on(all, 'prayer.isha', '2026-10-22').busy?.[0]?.end).toBe(cairoTime('2026-10-22', '19:55'));
    const each = anchors(['2026-10-22'], { method: 'egyptian', busy: { fajr: '45m', maghrib: '15m' } });
    expect(on(each, 'prayer.fajr', '2026-10-22').busy?.[0]?.end).toBe(cairoTime('2026-10-22', '06:19'));
    expect(on(each, 'prayer.maghrib', '2026-10-22').busy?.[0]?.end).toBe(cairoTime('2026-10-22', '18:32'));
    expect(on(each, 'prayer.dhuhr', '2026-10-22').busy?.[0]?.end).toBe(cairoTime('2026-10-22', '13:11'));
  });

  it('never lets the busy part run past the window', () => {
    const fajr = on(anchors(['2026-10-22'], { method: 'egyptian', busy: { fajr: '3h' } }), 'prayer.fajr', '2026-10-22');
    expect(fajr.busy?.[0]?.end).toBe(fajr.end);
  });

  it('follows the clocks when summer time ends: Oct 29 to Oct 30, 2026', () => {
    const list = anchors(['2026-10-29', '2026-10-30']);
    expect(on(list, 'prayer.fajr', '2026-10-29').start).toBe(cairoTime('2026-10-29', '05:39'));
    expect(on(list, 'prayer.fajr', '2026-10-30').start).toBe(cairoTime('2026-10-30', '04:40'));
    expect(on(list, 'prayer.maghrib', '2026-10-30').start).toBe(cairoTime('2026-10-30', '17:10'));
    // In real time Fajr moved by a minute; only the clock jumped an hour.
    expect(Date.parse(on(list, 'prayer.fajr', '2026-10-30').start) - Date.parse(on(list, 'prayer.fajr', '2026-10-29').start)).toBe((24 * 60 + 1) * 60000);
  });

  it('uses the madhab for Asr', () => {
    const hanafi = on(anchors(['2026-10-22'], { method: 'egyptian', madhab: 'hanafi' }), 'prayer.asr', '2026-10-22');
    expect(Date.parse(hanafi.start)).toBeGreaterThan(Date.parse(cairoTime('2026-10-22', '15:51')));
  });

  it('needs a location, and says where to set it', () => {
    expect(() => source.anchors!({ dates: ['2026-10-22'], timeZone: 'Africa/Cairo', location: undefined, settings: settings({ method: 'egyptian' }) })).toThrow(
      'set location in sword.yaml, e.g. location: { latitude: 30.0444, longitude: 31.2357 }',
    );
  });
});

describe('settings', () => {
  it('reads the method, madhab and busy time', () => {
    expect(source.settings!({ method: 'umm_al_qura', madhab: 'hanafi', busy: '25m' })).toEqual({
      ok: true,
      value: { method: 'umm_al_qura', madhab: 'hanafi', busy: { fajr: 25, dhuhr: 25, asr: 25, maghrib: 25, isha: 25 } },
    });
  });

  it.each<[string, unknown, string]>([
    ['no settings at all', undefined, 'needs a method'],
    ['no method', { busy: '30m' }, 'method: missing'],
    ['an unknown method', { method: 'egypt' }, 'method: "egypt" is not one of'],
    ['an unknown madhab', { method: 'egyptian', madhab: 'maliki' }, 'madhab: use shafi or hanafi'],
    ['a busy time that is not a duration', { method: 'egyptian', busy: 'half an hour' }, 'busy: "half an hour" is not a duration'],
    ['a busy time of zero', { method: 'egyptian', busy: '0m' }, 'busy'],
    ['busy for an unknown prayer', { method: 'egyptian', busy: { duha: '10m' } }, 'busy: "duha" is not a prayer'],
    ['an unknown setting', { method: 'egyptian', iqama: true }, 'unknown setting "iqama"'],
    ['settings that are a list', ['egyptian'], 'settings must be a mapping'],
  ])('rejects %s', (_, raw, message) => {
    const result = source.settings!(raw);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.join('\n')).toContain(message);
  });
});

describe('main.js', () => {
  it('is the current build of the source', () => {
    const context = { dates: ['2026-10-22', '2026-10-30'], timeZone: 'Africa/Cairo', location: cairo, settings: settings({ method: 'egyptian', busy: { fajr: '40m' } }) };
    expect(bundled.id).toBe('prayer');
    expect(bundled.anchors(context)).toEqual(source.anchors!(context));
    expect(bundled.settings({ method: 'karachi' })).toEqual(source.settings!({ method: 'karachi' }));
  });
});
