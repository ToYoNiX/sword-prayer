# sword-prayer

Prayer times as anchors for [Sword](https://github.com/ToYoNiX/sword).

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
sword plugin add github.com/ToYoNiX/sword-prayer@<version>
```

## Status

Not started. Waiting for `@sword/plugin-api`. See the
[Sword design doc](https://github.com/ToYoNiX/sword/blob/main/docs/design.md),
§8 and §16.

## License

MIT
