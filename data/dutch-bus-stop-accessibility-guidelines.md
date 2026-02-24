# Dutch Accessibility Guidelines for Bus Stops

## Governing Standards

The primary standard is the **CROW Richtlijn Toegankelijkheid** (CROW Accessibility Guideline), originally published as CROW-publicatie 337. CROW is the Dutch national knowledge platform for infrastructure, traffic, transport, and public space. The guideline covers walking routes, bus stops, parking spaces, and travel/route information.

Individual provinces and municipalities adopt these into local regulations. The **Centraal Halte Bestand (CHB)**, managed by DOVA, uses processing rules derived from the CROW guideline to classify each of the 54,000+ bus/tram stops in the Netherlands as physically accessible, visually accessible, both, or neither.

---

## Physical Accessibility (Fysieke Toegankelijkheid)

### Platform/Kerb Height (Perronhoogte)
- **Required: 18 cm (180 mm)** measured from road surface to top of platform edge
- This is a hard requirement for uniformity across the Netherlands
- At this height, low-floor buses can deploy ramps effectively for wheelchair users
- Optimal for boarding without the bus needing to kneel: 30-32 cm, but 18 cm is the national standard compromise
- Maximum transition height in straight section: 12 cm

### Platform Width (Haltebreedte)
- **Minimum: 1.50 m** measured from the edge of the platform kerb
- At bottlenecks: minimum 1.00 m (incidental narrowing to 0.90 m permitted)
- Optimal: 3.20 m (with shelter set back 0.90 m from edge)
- Wheelchair turning/passing space: 1.50 m
- Clear passage at all points: 0.90 m minimum (excluding kerb width)

### Platform Length
- Single 12 m bus: minimum 12 m at full 18 cm height
- Articulated 18 m bus: minimum 18 m
- Two 12 m buses: minimum 25 m

### Access Surface
- Level, flat surface with minimal height differences from surrounding terrain
- Barrier-free accessible route of minimum 1.20 m wide connecting the stop to the surrounding pedestrian network

### Bay Dimensions (Haltekom)
- Minimum width: 2.80 m between road kerb and platform edge
- Entry angle: minimum 1:8
- Exit angle: minimum 1:10 (1:5 allowed in reconstructions at speeds ≤ 50 km/h)
- Straight section lengths:
  - Single 12 m bus: 22 m
  - Single 18 m bus: 28 m
  - Two 12 m buses: 35 m

---

## Visual Accessibility (Visuele Toegankelijkheid)

### Guidance Lines (Geleidelijnen)
- **Width: 0.60 m** ribbed-profile tiles running the full length of the platform
- Preferably in contrasting colour to surrounding surface
- Must connect the stop to surrounding pedestrian routes and nearby transit facilities
- Reflectance factor difference between guidance line and surface: **≥ 0.3**

### Boarding Position Marking (Instapmarkering)
- **Dimensions: 0.90 m × 0.60 m** nubbed-profile (noppen) tiles
- Placed at the boarding door location (front door)
- Interrupts the guidance line, approximately 0.60 m from where the 18 cm platform height begins
- Preferably in contrasting colour/material

### Platform Edge Marking (Blokmarkering)
- Single row of block marking along the platform edge
- Must conform to national guidelines for visibility

### Connection to Surroundings
- Visual connection to nearby walking routes and crossing points
- Poles and information infrastructure aligned with ribbed and attention markings

---

## Facilities (Not Strict Accessibility Requirements, but Related)

The CHB also tracks facilities that affect usability for people with disabilities:

| Facility | Notes |
|----------|-------|
| Shelter (abri) | Min. 1.40 m × 0.90 m × 2.30 m height; wheelchair space required |
| Seating | Seat height 0.45-0.50 m |
| Timetable information | Required for accessible stops |
| Lighting (illuminated stop) | Enhances visibility and safety |
| Passenger information display | Dynamic real-time departure info |

---

## How the CHB Classifies Accessibility

The Centraal Halte Bestand uses processing rules (last updated 2021) derived from the CROW guideline to determine two independent flags per quay:

### `quaydisabledaccessible` (Physically accessible)
Key criteria evaluated:
- Platform/kerb height ≥ 18 cm
- Platform width ≥ 1.50 m
- Boarding position width sufficient
- Access route to stop exists
- Adequate bay length

### `quayvisuallyaccessible` (Visually accessible)
Key criteria evaluated:
- Full-length guidance lines (geleidelijnen) present
- Boarding marking (instapmarkering) present
- Tactile ground surface indicators present
- Guideline connection to surrounding routes

A stop is shown in the halteviewer with a colour code based on the combination:
- **Both physically and visually accessible** — fully accessible
- **Only physically accessible** — partially accessible
- **Only visually accessible** — partially accessible
- **Neither** — not accessible

---

## Comparing the Two Noordersingel Stops

Applying these criteria to the original question (NL:Q:21400410 vs NL:Q:21400420):

| Criterion | Requirement | 21400410 (Accessible) | 21400420 (Not Accessible) |
|-----------|-------------|----------------------|--------------------------|
| Kerb height | ≥ 18 cm | **19 cm** | 6 cm |
| Platform width (boarding) | ≥ 1.50 m | **1.50 m** | 1.23 m |
| Narrowest passage | ≥ 0.90 m | **1.50 m** | 0.90 m (borderline) |
| Bay length | ≥ 12 m | **24.09 m** | 15.0 m |
| Lifted part length | ≥ 12 m | **12.0 m** | 10.0 m |
| Marked kerb | Required | **Yes** | No |
| Access route to stop | Required | **Yes** | No |
| Full-length guideline | Required | **Yes** | No |
| Guideline connection | Required | **Yes** | No |
| Tactile ground indicator | Required | **Yes** | No |
| Ground surface indicator | Required | **Yes** | No |

The non-accessible stop fails on virtually every criterion — most critically the 6 cm kerb (vs required 18 cm) and complete absence of tactile guidance.

---

## Responsibility: Who Is Responsible for Bus Stop Accessibility?

### The wegbeheerder (road manager) is legally responsible

Bus stops are part of the public road infrastructure. The **wegbeheerder** — usually the **gemeente** (municipality) for municipal roads, or the **provincie** for provincial roads — owns the physical infrastructure and is legally responsible for construction, maintenance, and accessibility upgrades.

### Division of roles

| Party | Role |
|-------|------|
| **Gemeente/Provincie** (as wegbeheerder) | Owns the physical infrastructure; responsible for construction, maintenance, and accessibility upgrades |
| **Provincie/Vervoerregio** (as OV-autoriteit / concessieverlener) | Grants the transport concession, sets functional requirements for stops, and co-finances accessibility upgrades (up to 95% of eligible costs in some regions) |
| **Vervoerder** (transport operator, e.g. Arriva, Connexxion, Qbuzz) | Uses the stops and provides operational input, but is **not** responsible for the physical infrastructure |
| **DOVA** | Coordinates nationally between OV-autoriteiten, maintains the CHB data, monitors accessibility progress |
| **CROW** | Sets the technical standards (Richtlijn Toegankelijkheid) |

### Financing

The principle is **"de veroorzaker betaalt"** (the initiator pays):

- If a road reconstruction triggers the upgrade, the **wegbeheerder** pays
- If the OV-autoriteit requests the upgrade for transit reasons, they **subsidize** it
- In practice, costs are often shared (e.g. 50/50 between vervoerregio and gemeente, or up to 95% subsidy from the province)

Several provinces run active subsidy programs for bus stop accessibility:
- Provincie Zuid-Holland: [Kwaliteit OV en bushaltes](https://www.zuid-holland.nl/online-regelen/subsidies/subsidies/paragrafen-subsidie/kwaliteit-ov-bushaltes-2-3-1-srm/)
- Provincie Gelderland: [Bereikbare bushaltes](https://www.gelderland.nl/subsidies/bereikbare-bushaltes)
- Vervoerregio Amsterdam: [Meer toegankelijke haltes](https://www.vervoerregio.nl/artikel/20241128-meer-toegankelijke-haltes-in-de-vervoerregio)

### Why many stops are still not accessible

The split responsibility is a key factor. The gemeente must initiate and execute the physical work (and often co-fund it), but may lack budget or prioritize other road projects. The OV-autoriteit can offer subsidies and set requirements, but cannot force a municipality to act on a specific timeline. The **Bestuursakkoord Toegankelijkheid OV 2022-2032** (Administrative Agreement on PT Accessibility) between national government, decentral authorities, transport operators, and ProRail aims to accelerate progress, but compliance remains voluntary at the municipal level.

---

## Sources and References

- [CROW Kennisbank — Toegankelijkheid bushaltes](https://kennisbank.crow.nl/public/gastgebruiker/WOBU/Wegontwerp_voor_openbaar_vervoer/Toegankelijkheid_/110106) — Primary CROW guidelines with platform dimensions and specifications
- [CROW Richtlijn Toegankelijkheid (via Kennisnetwerk)](https://www.kennisnetwerktoegankelijkheid.nl/documenten/4-richtlijn-toegankelijkheid) — Overview of CROW publication 337
- [CROW Leidraad Toegankelijkheid](https://www.kennisnetwerktoegankelijkheid.nl/documenten/459-leidraad-toegankelijkheid) — Updated integrated accessibility guideline
- [Provincie Zuid-Holland — Handboek Wegen: Bushaltes](https://worldofminds.com/projects/pzh/handboekwegen/Bushaltes.html) — Provincial road handbook with exact measurements for bays, platforms, and tactile markings
- [Nadere regels Toegankelijke bushaltes — Provincie Flevoland](https://lokaleregelgeving.overheid.nl/CVDR746681/1) — Provincial regulations listing the exact physical and visual accessibility requirements
- [DOVA — Toegankelijkheid](https://dova.nu/themas/toegankelijkheid) — DOVA's accessibility theme page; references the Bestuursakkoord Toegankelijkheid OV 2022-2032
- [DOVA — Halteviewer Centraal Halte Bestand](https://dova.nu/applicaties/halteviewer-centraal-halte-bestand) — Description of the CHB and how accessibility is assessed
- [Centraal Halte Bestand — OV in Nederland Wiki](https://wiki.ovinnederland.nl/wiki/Centraal_Halte_Bestand) — Community documentation of the CHB data model
- [CROW — Integrale toegankelijkheidsrichtlijnen](https://www.crow.nl/actueel/integrale-toegankelijkheidsrichtlijnen-voor-openba/) — Announcement of the integrated accessibility guidelines
- [BISON Fysieke haltestructuur en toegankelijkheid](https://reisinformatiegroep.nl/ndovloket/Data/DownloadDocumentation/8) — BISON technical documentation for the CHB data model (IFOPT-based)
- [Afsprakenkader bus- en tramhaltes Vervoerregio Amsterdam](https://lokaleregelgeving.overheid.nl/CVDR467726/1) — Framework agreement detailing roles and responsibilities between vervoerregio, wegbeheerders, and transport operators
- [Provincie Zuid-Holland — Subsidie Kwaliteit OV en bushaltes](https://www.zuid-holland.nl/online-regelen/subsidies/subsidies/paragrafen-subsidie/kwaliteit-ov-bushaltes-2-3-1-srm/) — Provincial subsidy program for bus stop quality and accessibility
- [Provincie Gelderland — Bereikbare bushaltes](https://www.gelderland.nl/subsidies/bereikbare-bushaltes) — Provincial subsidy program for accessible bus stops
- [Vervoerregio Amsterdam — Meer toegankelijke haltes](https://www.vervoerregio.nl/artikel/20241128-meer-toegankelijke-haltes-in-de-vervoerregio) — Progress report on accessible stops in the Amsterdam transport region
