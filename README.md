# calendrome-prayer

Prayer times as anchors for [Calendrome](https://github.com/ToYoNiX/calendrome).

Provides `prayer.fajr`, `prayer.dhuhr`, `prayer.asr`, `prayer.maghrib`, and
`prayer.isha` as anchors, so intentions can follow them:

```yaml
---
title: Morning Quran
duration: 20m
repeat: daily
at: prayer.fajr.busy.end + 5m
---
```

Each prayer anchor has a **window** (from its time until the next prayer) and a
**busy** portion (when you actually pray, configurable per prayer, optionally
from iqama times), so the scheduler can keep tasks out of prayer time.

## Install

```sh
calendrome plugin add github.com/ToYoNiX/calendrome-prayer@<version>
```

## Status

Not started. Waiting for `@calendrome/plugin-api`. See the
[Calendrome design doc](https://github.com/ToYoNiX/calendrome/blob/main/docs/design.md),
§8 and §16.

## License

MIT
