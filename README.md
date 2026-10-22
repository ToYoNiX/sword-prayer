# sword-prayer

Prayer times as anchors for [Sword](https://github.com/ToYoNiX/sword).

Provides `prayer.fajr`, `prayer.dhuhr`, `prayer.asr`, `prayer.maghrib` and
`prayer.isha`, computed with [adhan](https://github.com/batoulapps/adhan-js)
for your location, so tasks can follow them instead of fixed times:

```yaml
---
title: Morning adhkar
duration: 20m
repeat: daily
after: prayer.fajr
before: prayer.fajr + 1h
---
```

Each prayer has two parts:

- **A window**, from its time until the next prayer: Fajr until sunrise, Dhuhr
  until Asr, Asr until Maghrib, Maghrib until Isha, and Isha until the next
  Fajr. `within: prayer.asr` means "sometime during Asr time".
- **A busy part**, from the adhan, for as long as you set. Sword keeps it
  clear, and "after Asr" means after it, once you have prayed.

The times follow the seasons day by day, and the clock changes too.

## Install

```sh
sword plugin add https://github.com/ToYoNiX/sword-prayer
```

Then set your location and the calculation method in `sword.yaml`:

```yaml
location: { latitude: 30.0444, longitude: 31.2357 }
prayer:
  method: egyptian     # required
  madhab: shafi        # for Asr: shafi (default) or hanafi
  busy: 30m            # from each adhan (default 30m); or per prayer: { fajr: 20m, isha: 40m }
```

Methods: `muslim_world_league`, `egyptian`, `karachi`, `umm_al_qura`, `dubai`,
`moonsighting_committee`, `north_america`, `kuwait`, `qatar`, `singapore`,
`tehran`, `turkey`.

## Development

`main.js` is the plugin bundled into one file, adhan included, so Sword loads it
anywhere with nothing to install. After changing `src/`, rebuild and commit it:

```sh
pnpm install
pnpm build      # writes main.js
pnpm test       # also checks that main.js matches the source
```

`@sword/plugin-api` (types only) comes from a checkout of Sword next to this
one (`../sword`).

## License

MIT
