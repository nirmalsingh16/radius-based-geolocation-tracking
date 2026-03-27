/**
 * geocoder.js
 * Converts Indian pincodes → GeoJSON polygon boundaries.
 *
 * Strategy (waterfall — first success wins):
 *   1. India Post API  → lat/lng of the post office
 *   2. Nominatim OSM   → polygon or point (with better User-Agent)
 *   3. OpenDataSoft    → lat/lng fallback
 *   Any lat/lng result → turf.buffer() to build a ~2km circle-polygon
 *
 * No API key needed for any of these sources.
 */

const fetch = require("node-fetch");
const turf = require("@turf/turf");

// Buffer radius in km when only a point (not a polygon) is returned
const POINT_BUFFER_KM = 2;

/* ── 1. India Post API ────────────────────────────────────────
   Returns array of post offices with Latitude/Longitude.
   Free, no key, no rate limit issues.
*/
async function fromIndiaPost(pincode) {
  try {
    const url = `https://api.postalpincode.in/pincode/${pincode}`;
    const resp = await fetch(url, {
      timeout: 8000,
      headers: { Accept: "application/json" },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    // Response: [{ Status, PostOffice: [{ Latitude, Longitude, District, State, Name, ... }] }]
    if (!Array.isArray(data) || data[0]?.Status !== "Success") return null;
    const offices = data[0].PostOffice || [];

    // Collect all valid lat/lng points
    const points = offices
      .map((o) => ({
        lat: parseFloat(o.Latitude),
        lng: parseFloat(o.Longitude),
        district: o.District || "",
        state: o.State || "",
        area: o.Name || "",
        taluk: o.Taluk || "",
      }))
      .filter(
        (p) => !isNaN(p.lat) && !isNaN(p.lng) && p.lat !== 0 && p.lng !== 0,
      );

    if (points.length === 0) {
      // Still return district info even without coords
      const first = offices[0];
      if (first) {
        return {
          lat: null,
          lng: null,
          district: first.District || "",
          state: first.State || "",
          area: first.Name || "",
          taluk: first.Taluk || "",
        };
      }
      return null;
    }

    // Average position as centre
    const avgLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
    const avgLng = points.reduce((s, p) => s + p.lng, 0) / points.length;

    console.log(
      `  ✅  India Post: ${pincode} → ${avgLat.toFixed(4)}, ${avgLng.toFixed(4)} (${points.length} offices)`,
    );
    return {
      lat: avgLat,
      lng: avgLng,
      district: points[0].district,
      state: points[0].state,
      area: points[0].area,
      taluk: points[0].taluk,
    };
  } catch (e) {
    console.warn(`  ⚠  India Post failed for ${pincode}:`, e.message);
    return null;
  }
}

/* ── Get district/area info for a single pincode ──────────────
   Used for enriching pincode zone display in admin panel.
*/
async function getDistrictForPincode(pincode) {
  try {
    const result = await fromIndiaPost(pincode);
    if (!result) return null;
    return {
      district: result.district || "",
      state: result.state || "",
      area: result.area || "",
      taluk: result.taluk || "",
    };
  } catch (e) {
    console.warn(
      `  ⚠  getDistrictForPincode failed for ${pincode}:`,
      e.message,
    );
    return null;
  }
}

/* ── 2. Nominatim OSM ─────────────────────────────────────────
   Returns polygon if area boundary exists, else point.
   Requires a descriptive User-Agent per OSM policy.
*/
async function fromNominatim(pincode) {
  try {
    const params = new URLSearchParams({
      q: `${pincode}, India`,
      format: "geojson",
      polygon_geojson: "1",
      limit: "1",
      countrycodes: "in",
    });
    const url = `https://nominatim.openstreetmap.org/search?${params}`;
    const resp = await fetch(url, {
      timeout: 10000,
      headers: {
        "User-Agent": `GeofenceTrackerApp/3.0 (${process.env.ADMIN_EMAIL || "admin@geofenceapp.local"}; Indian pincode lookup)`,
        "Accept-Language": "en",
        Referer: "https://github.com/geofence-tracker",
      },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (!data.features?.length) return null;

    const geom = data.features[0].geometry;

    if (geom.type === "Polygon") {
      console.log(`  ✅  Nominatim: ${pincode} → Polygon`);
      return { polygon: turf.polygon(geom.coordinates, { pincode }) };
    }
    if (geom.type === "MultiPolygon") {
      const polys = geom.coordinates.map((c) => turf.polygon(c));
      const merged = polys.reduce((a, p) => {
        try {
          return turf.union(a, p);
        } catch {
          return a;
        }
      });
      console.log(`  ✅  Nominatim: ${pincode} → MultiPolygon`);
      return { polygon: merged };
    }
    if (geom.type === "Point") {
      const [lng, lat] = geom.coordinates;
      console.log(
        `  ✅  Nominatim: ${pincode} → Point ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      );
      return { lat, lng };
    }
    return null;
  } catch (e) {
    console.warn(`  ⚠  Nominatim failed for ${pincode}:`, e.message);
    return null;
  }
}

/* ── 3. OpenDataSoft India Pincodes dataset ───────────────────
   Public dataset, no auth needed.
*/
async function fromOpenDataSoft(pincode) {
  try {
    const url =
      `https://public.opendatasoft.com/api/records/1.0/search/` +
      `?dataset=indian-pincodes&q=${pincode}&rows=1`;
    const resp = await fetch(url, { timeout: 8000 });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const rec = data.records?.[0]?.fields;
    if (!rec) return null;
    const lat = parseFloat(rec.latitude || rec.lat);
    const lng = parseFloat(rec.longitude || rec.lng || rec.long);
    if (isNaN(lat) || isNaN(lng)) return null;
    console.log(
      `  ✅  OpenDataSoft: ${pincode} → ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    );
    return { lat, lng };
  } catch (e) {
    console.warn(`  ⚠  OpenDataSoft failed for ${pincode}:`, e.message);
    return null;
  }
}

/* ── Build polygon from a lat/lng point ─────────────────────── */
function pointToPolygon(lat, lng, pincode) {
  const buffered = turf.buffer(turf.point([lng, lat]), POINT_BUFFER_KM, {
    units: "kilometers",
  });
  return turf.polygon(buffered.geometry.coordinates, { pincode });
}

/* ── Main: resolve one pincode → turf Polygon feature ────────── */
async function pincodeToPolygon(pincode) {
  console.log(`🔍  Resolving pincode ${pincode}…`);

  // 1. Try Nominatim first (may return a real polygon boundary)
  const nominatim = await fromNominatim(pincode);
  if (nominatim?.polygon) return nominatim.polygon;

  // Small delay before next external call
  await new Promise((r) => setTimeout(r, 500));

  // 2. India Post (most reliable for Indian pincodes)
  const indiaPost = await fromIndiaPost(pincode);
  if (indiaPost) return pointToPolygon(indiaPost.lat, indiaPost.lng, pincode);

  await new Promise((r) => setTimeout(r, 300));

  // 3. OpenDataSoft fallback
  const ods = await fromOpenDataSoft(pincode);
  if (ods) return pointToPolygon(ods.lat, ods.lng, pincode);

  // If we got a point from Nominatim (not polygon), use that
  if (nominatim?.lat)
    return pointToPolygon(nominatim.lat, nominatim.lng, pincode);

  console.error(`❌  Could not resolve pincode ${pincode} from any source`);
  return null;
}

/* ── Resolve array of pincodes → merged union polygon ─────────── */
async function pincodesToUnionPolygon(pincodes) {
  if (!pincodes || pincodes.length === 0) return null;

  const polys = [];
  for (const pc of pincodes) {
    const poly = await pincodeToPolygon(pc.trim());
    if (poly) polys.push(poly);
    // Brief pause between pincodes
    await new Promise((r) => setTimeout(r, 600));
  }

  if (polys.length === 0) return null;

  // Union all polygons into one
  let union = polys[0];
  for (let i = 1; i < polys.length; i++) {
    try {
      union = turf.union(union, polys[i]);
    } catch {
      /* keep going */
    }
  }

  const centroid = turf.centroid(union);
  const [lng, lat] = centroid.geometry.coordinates;
  return { polygon: union, center: { lat, lng } };
}

module.exports = {
  pincodeToPolygon,
  pincodesToUnionPolygon,
  getDistrictForPincode,
};
