# airplanes.live API → AircraftState Field Mapping

Endpoint: `GET https://api.airplanes.live/v2/point/{lat}/{lon}/{radius}`
Rate limit: 1 request/second (no auth required)

## Current AircraftState (models.py)

All fields use snake_case in Python, camelCase in JSON (via `alias_generator=to_camel`).
Units are SI: metres for altitude, m/s for speed and vertical rate.

## Direct Mappings (existing fields)

| Python field | JSON alias | Type | airplanes.live field | Conversion |
|---|---|---|---|---|
| `icao24` | `icao24` | `str` | `hex` | Direct |
| `callsign` | `callsign` | `str \| None` | `flight` | `.strip()`, empty → `None` |
| `origin_country` | `originCountry` | `str` | ❌ not available | Derive from `r` prefix or `"Unknown"` |
| `latitude` | `latitude` | `float` | `lat` | Direct |
| `longitude` | `longitude` | `float` | `lon` | Direct |
| `baro_altitude` | `baroAltitude` | `float \| None` | `alt_baro` | `feet × 0.3048` → metres. ⚠️ Can be string `"ground"` |
| `geo_altitude` | `geoAltitude` | `float \| None` | `alt_geom` | `feet × 0.3048` → metres |
| `velocity` | `velocity` | `float \| None` | `gs` | `knots × 0.514444` → m/s |
| `true_track` | `trueTrack` | `float \| None` | `track` | Direct (degrees) |
| `vertical_rate` | `verticalRate` | `float \| None` | `baro_rate` | `ft/min ÷ 196.85` → m/s |
| `on_ground` | `onGround` | `bool` | `alt_baro == "ground"` | String check |
| `squawk` | `squawk` | `str \| None` | `squawk` | Direct |
| `last_contact` | `lastContact` | `int` | `seen` | `int(time.time() - seen)` (relative → epoch) |
| `position_source` | `positionSource` | `str` | `type` | Map (see below) |
| `category` | `category` | `str` | `category` | Map (see below) |
| `is_approaching_lhr` | `isApproachingLhr` | `bool` | — | Computed (existing heuristic, unchanged) |

### Position source mapping (`type` → `position_source`)

| airplanes.live `type` | Our `position_source` |
|---|---|
| `adsb_icao` | `ADS-B` |
| `adsb_icao_nt` | `ADS-B` |
| `adsr_icao` | `ADS-B` |
| `mlat` | `MLAT` |
| `tisb_icao` | `TIS-B` |
| `adsc` | `ADS-C` |
| `mode_s` | `Mode S` |
| `other` | `Other` |
| anything else | `Unknown` |

### Category mapping (`category` → `category`)

| airplanes.live `category` | Our `category` |
|---|---|
| `A0` | `Unknown` |
| `A1` | `Light` |
| `A2` | `Small` |
| `A3` | `Large` |
| `A4` | `High Vortex Large` |
| `A5` | `Heavy` |
| `A6` | `High Performance` |
| `A7` | `Rotorcraft` |
| `B0`–`B7` | `Glider`, `Lighter-than-air`, `Skydiver`, `Ultralight`, `UAV`, etc. |
| `C0`–`C7` | Surface vehicles / obstacles |
| missing | `Unknown` |

## New Fields (not in current model — additions)

These are available from airplanes.live and would enrich the inspector/UI:

| Proposed Python field | JSON alias | Type | airplanes.live field | Description |
|---|---|---|---|---|
| `registration` | `registration` | `str \| None` | `r` | Tail number, e.g. `G-EUUD`, `N417DX` |
| `aircraft_type` | `aircraftType` | `str \| None` | `t` | ICAO type code, e.g. `A320`, `B789` |
| `aircraft_desc` | `aircraftDesc` | `str \| None` | `desc` | Full name, e.g. `BOEING 787-9 Dreamliner` |
| `emergency` | `emergency` | `str \| None` | `emergency` | `none`, `general`, `lifeguard`, `minfuel`, `nordo`, `unlawful`, `downed` |
| `is_military` | `isMilitary` | `bool` | `dbFlags & 1` | Military aircraft flag |
| `ground_speed_kts` | `groundSpeedKts` | `float \| None` | `gs` | Native knots (no conversion, for display) |
| `baro_rate_fpm` | `baroRateFpm` | `int \| None` | `baro_rate` | Native ft/min (no conversion, for display) |
| `mach` | `mach` | `float \| None` | `mach` | Mach number |
| `indicated_airspeed_kts` | `indicatedAirspeedKts` | `float \| None` | `ias` | IAS in knots |

## Fields to Ignore

| Field | Reason |
|---|---|
| `nic`, `rc`, `nac_p`, `nac_v`, `sil`, `sil_type`, `gva`, `sda` | ADS-B integrity metadata |
| `nic_baro`, `version` | Transponder version info |
| `rssi` | Signal strength (receiver-side) |
| `messages` | Message count (receiver-side) |
| `mlat`, `tisb` | Lists of MLAT/TIS-B derived fields |
| `alert`, `spi` | Transponder status bits |
| `roll`, `track_rate`, `mag_heading` | Redundant with `track` / `true_heading` |
| `oat`, `tat` | Temperature (inaccurate below mach 0.5) |
| `nav_qnh`, `nav_altitude_mcp`, `nav_altitude_fms`, `nav_heading` | FMS/autopilot targets |
| `nav_modes` | Engaged autopilot modes (nice-to-have, low priority) |
| `wd`, `ws` | Derived wind (nice-to-have, low priority) |
| `seen_pos` | Position age in seconds (we use `seen` instead) |
| `dst`, `dir` | Distance/direction from receiver (not from our reference point) |
| `lastPosition` | Stale fallback position |
| `rr_lat`, `rr_lon` | Rough estimated position |

## Conversion Constants

```python
FEET_TO_METRES = 0.3048
KNOTS_TO_MS = 0.514444
FPM_TO_MS = 0.00508  # ft/min → m/s (1/196.85)
```

## Gotchas

1. **`alt_baro` can be the string `"ground"`** — must check before converting to float
2. **`seen` is relative** (seconds ago), not a Unix epoch — compute `int(time.time() - seen)`
3. **Fields are omitted when unavailable** — every field except `hex` can be missing
4. **`flight` is padded to 8 chars** — needs `.strip()`, can be all spaces or `@@@@@@@@`
5. **50nm radius returns many more aircraft** than OpenSky's bounding box (~30nm) — consider 25nm
6. **No `origin_country`** — either make field optional, use `"Unknown"`, or derive from registration prefix
7. **`emergency: "none"` is a string**, not missing — map to `None` for our model

## KPIs Impact

| KPI field | Change needed |
|---|---|
| `api_credits_remaining` | Return `None` (no credit system) — KpiStrip already hides when `null` |
| `api_health` | Keep `"live"` / `"stale"` / `"offline"` — same logic |
| `avg_altitude_ft` | Currently converts metres → feet in `cache.py`. If we store metres, no change. |
| All counters | No change — they use `AircraftState` fields which are unit-converted at parse time |
