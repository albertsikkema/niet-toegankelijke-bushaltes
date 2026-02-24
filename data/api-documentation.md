# DOVA Halteviewer API Documentation

**Base URL:** `https://halteviewer.ov-data.nl/halteviewer/`
**Version:** 2.10.2
**Protocol:** [Sherpa](https://www.ueber.net/who/mjl/sherpa/) (version 0) — JSON-RPC over HTTP
**Environment:** prod

## Protocol

All API calls use **HTTP POST** with JSON body:

```json
POST https://halteviewer.ov-data.nl/halteviewer/{functionName}
Content-Type: application/json

{"params": [arg1, arg2, ...]}
```

Responses always have the structure:
```json
{
  "result": <data or null>,
  "error": <error object or null>
}
```

Error object: `{"code": "sherpaBadRequest"|"sherpaServerError", "message": "..."}`

### Self-documentation

The API is self-documenting via the Sherpa `_docs` endpoint:
```
POST /halteviewer/_docs
{"params": []}
```
Returns full function signatures, type definitions, and descriptions.

---

## Endpoints (22 functions)

### 1. `status`
```
boolean status()
```
Returns `true` if the API is healthy.

---

### 2. `getStationsCentroid`
```
Stopplace[] getStationsCentroid()
```
Returns all ~405 Dutch railway stations with centroid coordinates (EPSG:3857), accessibility fields, and basic metadata. Lightweight — no quay details or geometry polygons.

**Response fields:** stopplacecode, uiccode, publicname, town, street, centroid, prorail_codering, wheelchairaccess, stepfreeaccess, escalatorfreeaccess, liftfreeaccess, audiblesignsavailable, visualsignsavailable, tactileguidanceavailable, rampfreeaccess, levelaccessintovehicle, placecode, stopplacetype, stopplacestatus, stopplaceownercode, quays (empty array in this endpoint)

---

### 3. `getStopplace`
```
Stopplace getStopplace(String stopplacecode)
```
Returns a single station with full detail including quay list. Quays include: quaycode, geom, compassdirection, quaystatus, transportmode, stopsidecode, town, quayname, shelter.

**Example:** `{"params": ["NL:S:asd"]}` → Amsterdam Centraal with 31 quays

---

### 4. `getStopplaceWithStationTopology`
```
Stopplace getStopplaceWithStationTopology(String stopplacecode)
```
Same as `getStopplace` but includes the station's full geometry polygon (`geom`), RD coordinates (`geom28992`), and WGS84 coordinates (`geom4326`). Also includes `rd_x`, `rd_y`.

---

### 5. `searchStopplace`
```
Stopplace[] searchStopplace(String search)
```
Search stations by code, name, or town. Returns matching stopplaces with full quay data.

**Example:** `{"params": ["Amsterdam"]}` → 927 results (includes bus/tram stops)
**Example:** `{"params": ["NL:S:asd"]}` → 4 results (Amsterdam area rail stations)

---

### 6. `getStopplaces`
```
Stopplace[] getStopplaces(double[] extent)
```
Returns all stopplaces within a bounding box. Extent is `[minX, minY, maxX, maxY]` in EPSG:3857.

**Example:** `{"params": [[540000, 6865000, 550000, 6875000]]}` → 287 Amsterdam area stops

---

### 7. `getPlaces`
```
Place[] getPlaces(double[] extent)
```
Returns administrative place areas within a bounding box (EPSG:3857).

**Response fields:** daowcode, placecode, publicname, town, stopplaces, validfrom, geom (polygon), centroid (WGS84)

---

### 8. `getQuays`
```
Quay[] getQuays()
```
Returns **all** 54,111 quays (bus stops, tram stops, rail platforms) in the Netherlands. Large response (~50MB+).

**Response fields:** concession_id, quaycode, stopplace, quaytype, quayname, geom, town, street, concessionprovidercode, municipalitycode, quaydisabledaccessible, mutationdate, quay_id, quayvisuallyaccessible, compassdirection, transportmode, quaystatus, liftedbicyclepath, greenstop, remarks, quayownercode, to_inspect, stopsidecode, stopdatamanager, concessioncode, shelter

---

### 9. `getSimpleQuays`
```
QuaySimple[] getSimpleQuays()
```
Simplified version of `getQuays` with fewer fields. Same 54,111 quays.

**Response fields:** geom, quaycode, compassdirection, quaystatus, quaytype, transportmode, stopsidecode, to_inspect, quayvisuallyaccessible, quaydisabledaccessible, town, quayname, shelter, notice_text

---

### 10. `getQuay`
```
QuayDetails getQuay(String quaycode)
```
Full detail for a single quay including general info, facilities, accessibility, and passenger stop assignments.

**Response structure:**
- `quaycode`: string
- `source`: CHBSource (file_name, file_date) or null
- `general`: QuayGeneralDetails (town, street, quayname, geom, stopsidecode, transportmode, quaytype, concessionprovidercode, stopdatamanager, geomWgs84, ...)
- `facilities`: QuayFacilityDetails (shelter, illuminatedstop, seatavailable, passengerinformationdisplay, bicycleparking, bins, ovccico, ...)
- `accessibility`: QuayAccessibilityDetails (quayshapetype, baylength, kerbheight, boardingpositionwidth, lift, guidelines, ramp, ...)
- `psa`: PSAUserStopCode[]

**Example:** `{"params": ["NL:Q:72900580"]}` → Bus stop in Bergen op Zoom

---

### 11. `getQuaysForAuthority`
```
QuayMapView[] getQuaysForAuthority(String providercode)
```
Returns quays for a given concession provider code. Lightweight map view.

**Response fields:** geom, quayvisuallyaccessible, quaydisabledaccessible, code

**Known provider codes:** `"NL"` (1,244 quays), `"PNB"` (6,431 quays), etc.

---

### 12. `getStopdatamanagerNameFromQuay`
```
StopdatamanagerWrapper getStopdatamanagerNameFromQuay(String quaycode)
```
Returns the data manager and quay owner for a quay.

**Response:** `{"stopdatamanager": "ProRail", "quayowner": "Amsterdam"}`

---

### 13. `getSummary`
```
QuaySummary getSummary()
```
Returns summary counts of quays and per-authority breakdowns. (Note: may throw NullPointerException on some data configurations.)

---

### 14. `getDescriptions`
```
Object getDescriptions()
```
Returns human-readable descriptions for all equipment with useful descriptions. Keyed by equipment foreign_code.

**Example response:**
```json
{
  "GN-LIF-007": "Lift wordt in april 2026 in gebruik genomen",
  "LLZM-LIF-002": "Lift is vanwege storing naar verwachting tot 2 maart 2026 buiten gebruik",
  ...
}
```

---

### 15. `getTopoQuaysForStopplace`
```
TopoQuay[] getTopoQuaysForStopplace(String stopplacecode)
```
Returns topological quay layout for a station — platforms grouped into logical units with geometry polygons.

**Response fields:** geom (polygon), level, parent_quay_topo_quay_id, quaycode, quayname, quaytype, stopplacecode, stopsidecode, topo_code, topo_quay_id, quays, railplatforms, sectors, children, accessibility fields, auto_geom

---

### 16. `getEntrances`
```
Entrance[] getEntrances(String stopplacecode)
```
Returns station entrances with location and accessibility details.

**Response fields:** entrance_id, stopplacecode, entrancetype (e.g. "lift", null), level, geom (point), centroid, wheelchairaccess, stepfreeaccess, escalatorfreeaccess, liftfreeaccess, audiblesignsavailable, visualsignsavailable, tactileguidanceavailable, levelaccessintovehicle

---

### 17. `getAccessSpaces`
```
Accessspace[] getAccessSpaces(String stopplacecode)
```
Returns accessible spaces within a station.

**Response fields:** accessspace_id, stopplacecode, accessspacetype, level, geom (polygon), gmlpolygon, centroid, accessibility fields

**Known accessspacetypes:** tunnel, overPass, bookingHall, wc, waitingRoom, other

---

### 18. `getEquipments`
```
Equipment[] getEquipments(String stopplacecode)
```
Returns all equipment (lifts, escalators) at a station from the base registration.

**Response fields:** equipment_id, stopplacecode, equipmenttype, level_from, has_direction, site_component_type_from/to, site_component_from_id/to_id, foreign_code, geom (polygon), geom4326, centroid, name, width, depth, maximum_load, braille_buttons, throughloader, alarmbutton, tactile_actuators, accoustic_announcements

---

### 19. `getFacilities`
```
Facility[] getFacilities(String stopplacecode)
```
Returns station facilities.

**Response fields:** facility_id, name, type, stopplacecode, geom (point), centroid (WGS84)

**Example:** `{"params": ["NL:S:asd"]}` → 5 facilities including "Lift station Amsterdam Centraal"

---

### 20. `getEquipmentStatusesForStopplaces`
```
Object[] getEquipmentStatusesForStopplaces()
```
Bulk endpoint: returns **all** stations with their equipment and real-time status. Each entry has `stopplacecode` and `equipmentWithStatuses[]`.

Each equipment entry contains:
- `baseRegistrationEquipment`: equipment_id, stopplacecode, equipmenttype, foreign_code, code_supplier, objectnumber_supplier, geom (polygon), centroid, uiccode, netex_id, monitored, latest_announcement
- `equipmentCurrentState`: is_monitored, last_incoming_status ("ONLINE"/"OFFLINE"), last_outgoing_status, processed_at, status_update_timestamp, is_within_announcement_period
- `equipment`: equipment_id, is_active, object_id_supplier, supplier ("A"/"B"/"C"), unique_code_installation

**Announcement object:** announcement_id, object_type, object_code, startdate/enddate (epoch ms), is_available, description ("buiten gebruik", "lift in onderhoud", "leverancier wissel"), source

---

### 21. `getEquipmentStatusesForStopplace`
```
Object getEquipmentStatusesForStopplace(String stopplacecode)
```
Same as above but for a single station.

---

### 22. `getNavPathLinks`
```
NavPath[] getNavPathLinks(String stopplacecode, Integer componentFromId, String fromType, String toType)
```
Returns navigation path links between station components.

**Parameters:**
- `stopplacecode`: Station code
- `componentFromId`: ID of the source component (entrance_id, accessspace_id, etc.)
- `fromType`: Source component type — known valid values: `"entrance"`, `"accessspace"`
- `toType`: Target component type — known valid value: `"accessspace"`

**Response fields:** stopplacecode, site_component_type_from, site_component_from_id, site_component_type_to, site_component_to_id, path (array of component types traversed), access_feature_types (e.g. "other", "hall", "lift"), geom (line coordinates)

**Example:** `{"params": ["NL:S:asd", 313551, "entrance", "accessspace"]}` → 2 path links

---

### 23. `getSitePathLinkForComponent`
```
SitePathLink[] getSitePathLinkForComponent(Integer componentId, String componentType)
```
Returns path links connecting to a specific site component.

**Parameters:**
- `componentId`: Component ID (entrance_id, accessspace_id, equipment_id)
- `componentType`: Component type string (e.g. `"entrance"`, `"lift"`, `"accessspace"`)

**Response fields:** stopplacecode, site_component_type_from, site_component_from_id, site_component_type_to, site_component_to_id, equipment_id, access_feature_type, allowed_use, passage_type, geom (line)

---

## Data Model & Entity Relationships

```
Station (Stopplace)
 ├── stopplacecode (PK, e.g. "NL:S:asd")
 ├── uiccode
 ├── placecode → Place
 │
 ├──► Quays[]  (via getStopplace/getQuays)
 │    └── quaycode (e.g. "NL:Q:asd_11")
 │
 ├──► TopoQuays[]  (via getTopoQuaysForStopplace)
 │    └── topo_quay_id, topo_code, stopsidecode
 │        └── children[], railplatforms[], sectors[]
 │
 ├──► Entrances[]  (via getEntrances)
 │    └── entrance_id, entrancetype, level
 │
 ├──► AccessSpaces[]  (via getAccessSpaces)
 │    └── accessspace_id, accessspacetype, level
 │
 ├──► Equipment[]  (via getEquipments)
 │    └── equipment_id, equipmenttype, foreign_code
 │        └── EquipmentStatus  (via getEquipmentStatusesForStopplace)
 │            ├── is_monitored, last_incoming_status
 │            └── latest_announcement
 │
 ├──► Facilities[]  (via getFacilities)
 │    └── facility_id, name, type
 │
 └──► NavPathLinks  (via getNavPathLinks)
      └── Links between entrances ↔ accessspaces ↔ equipment
          Describes navigable routes through the station
```

## Coordinate Systems

- **EPSG:3857** (Web Mercator): Used for `geom`, `centroid` in most endpoints
- **EPSG:28992** (Amersfoort / RD New): Available in `geom28992`, `rd_x`, `rd_y`
- **EPSG:4326** (WGS84): Available in `geom4326`, `geomWgs84`, facility centroids

Conversion from EPSG:3857 to WGS84:
```
lon = x / 20037508.34 * 180
lat = atan(exp(y / 20037508.34 * π)) * 360 / π - 90
```

## Key Identifiers

| Entity | ID Format | Example |
|--------|-----------|---------|
| Station | `NL:S:{code}` | `NL:S:asd` |
| Quay | `NL:Q:{code}` | `NL:Q:asd_11` |
| Place | `NL:P:{code}` | `NL:P:asd` |
| Equipment (NeTEx) | `NL:CHB:LiftEquipment:{uic}_{seq}` | `NL:CHB:LiftEquipment:8400058_001` |
| Equipment (foreign) | `{station}-{type}-{seq}` | `ASD-LIF-001` |
| UIC code | 7-digit | `8400058` |

## Accessibility Status (prorail_codering)

| Value | Meaning | Count |
|-------|---------|-------|
| `Toegankelijk` | Accessible | 155 |
| `Herstel` | Needs repair/improvement | 190 |
| `Nog te doen` | Yet to be done | 52 |
| `n.b.` | Not applicable/unknown | 1 |
| `null` | No data | 7 |
