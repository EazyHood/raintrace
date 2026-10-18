# Data sources and reuse

The bundled files are original NASA POWER JSON responses, acquired once per location on 2026-10-18 UTC. They contain public corrected precipitation (`PRECTOTCORR`, mm/day), 1991–2025, Local Solar Time. Both response headers identify MERRA2. Coordinates are requested points; the data represent a coarse grid, not a weather station.

- Santa Marta: [santa-marta.json](santa-marta.json) — [exact request](https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR&community=AG&longitude=-74.199&latitude=11.2408&start=19910101&end=20251231&format=JSON&time-standard=LST); retrieved 2026-10-18T03:36:41.493Z; SHA-256 `df2a7df7700346e69993b9d166a2d89f0627021b366b234ddd01b9f3459a9e53`.
- Bogotá: [bogota.json](bogota.json) — [exact request](https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR&community=AG&longitude=-74.0721&latitude=4.711&start=19910101&end=20251231&format=JSON&time-standard=LST); retrieved 2026-10-18T03:36:42.387Z; SHA-256 `627146fe97c8fb5c15292c8ff221f10aeaaa5e07a6a1ddc6560a44def466f946`.

## Rights and attribution

NASA POWER data are publicly available without fees. The NASA Earthdata [POWER statement](https://forum.earthdata.nasa.gov/viewtopic.php?t=82) describes them as public domain. [NASA's science-data license guidance](https://science.data.nasa.gov/about/license) explains its default CC0 policy and source-specific exceptions. The POWER [open-data registry entry](https://github.com/awslabs/open-data-registry/blob/main/datasets/nasa-power.yaml) records no use/access/download restrictions. We retain attribution and response metadata; the MIT code license does not relicense source data. No NASA or IEEE endorsement is claimed.

Attribution: Data obtained from the NASA Langley Research Center POWER Project, supported by NASA's Earth Science / Applied Science program.

## Reproduce the download

Open the exact requests above, or run `node acquire-data.mjs`. The script keeps existing snapshots and their retrieval dates. To acquire a later revision, use a new explicitly versioned copy and update the catalog after review; do not silently replace the evidence for an existing claim. NASA may revise its historical archive. A new response can legitimately have a different fingerprint.

We inspected `D:/IA/datasets` before acquisition; no existing POWER snapshot was present. These two small files are specific to Raintrace and remain in its project root. No third-party fonts, images, trackers, runtime services or paid APIs are loaded.

## Scientific documentation

- [Daily API and LST](https://power.larc.nasa.gov/docs/services/api/temporal/daily/).
- [Data sources and native spatial resolution](https://power.larc.nasa.gov/docs/methodology/data/sources/).
- [Updates and reproducibility concerns](https://power.larc.nasa.gov/docs/services/).

MERRA-2 meteorology uses approximately 0.5° latitude × 0.625° longitude grid cells. The archive may change through corrections. Raintrace freezes source bytes, includes the exact query and limits claims to a specified baseline comparison. These safeguards preserve reproducibility; they do not establish station-level accuracy.
