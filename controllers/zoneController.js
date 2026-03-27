/**
 * zoneController.js
 * Handles all zone CRUD + pincode-polygon resolution + manual polygon zones.
 */

const Zone = require("../models/Zone");
const {
  pincodesToUnionPolygon,
  getDistrictForPincode,
} = require("../utils/geocoder");
const turf = require("@turf/turf");

/* Compute centroid of a polygon coordinate array [[lng,lat],...] */
function polygonCentroid(coords) {
  try {
    const poly = turf.polygon([coords]);
    const c = turf.centroid(poly);
    return { lat: c.geometry.coordinates[1], lng: c.geometry.coordinates[0] };
  } catch {
    // fallback: average
    const avg = coords
      .slice(0, -1)
      .reduce((a, p) => ({ lat: a.lat + p[1], lng: a.lng + p[0] }), {
        lat: 0,
        lng: 0,
      });
    const n = coords.length - 1;
    return { lat: avg.lat / n, lng: avg.lng / n };
  }
}

/* Ensure polygon ring is closed (first === last point) */
function closeRing(coords) {
  if (!coords || coords.length < 3) return coords;
  const first = coords[0],
    last = coords[coords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    return [...coords, first];
  }
  return coords;
}

/* GET /api/zones */
async function getAllZones(req, res) {
  try {
    res.json(await Zone.find().sort({ createdAt: -1 }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

/* GET /api/zones/active/primary */
async function getActiveZone(req, res) {
  try {
    const z = await Zone.findOne({ active: true }).sort({ updatedAt: -1 });
    if (!z) return res.status(404).json({ error: "No active zone" });
    res.json(z);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

/* GET /api/zones/:id */
async function getZoneById(req, res) {
  try {
    const z = await Zone.findById(req.params.id);
    if (!z) return res.status(404).json({ error: "Not found" });
    res.json(z);
  } catch (e) {
    res.status(404).json({ error: "Not found" });
  }
}

/* POST /api/zones */
async function createZone(req, res) {
  try {
    const {
      name,
      lat,
      lng,
      radius,
      pincodes,
      active,
      polygonCoords,
      zoneType,
    } = req.body;
    if (!name) return res.status(400).json({ error: "Zone name is required" });

    const zoneData = { name, active: active !== false };

    // ── POLYGON zone (manually drawn or coordinate-entered) ──
    if (
      zoneType === "polygon" ||
      (polygonCoords && polygonCoords.length >= 3)
    ) {
      if (!polygonCoords || polygonCoords.length < 3)
        return res.status(400).json({
          error: "Polygon requires at least 3 coordinates [[lng,lat],...]",
        });

      const ring = closeRing(polygonCoords);
      if (ring.length < 4)
        return res
          .status(400)
          .json({ error: "Polygon ring must have at least 3 distinct points" });

      const center = polygonCentroid(ring);
      zoneData.zoneType = "polygon";
      zoneData.lat = center.lat;
      zoneData.lng = center.lng;
      zoneData.radius = 0;
      zoneData.pincodes = [];
      zoneData.boundary = { type: "Polygon", coordinates: [ring] };

      const zone = await new Zone(zoneData).save();
      return res.status(201).json(zone);
    }

    // ── PINCODE zone ──
    if (pincodes && pincodes.length > 0) {
      console.log(`🗺  Resolving pincodes for zone "${name}":`, pincodes);

      // Fetch district info for all pincodes in parallel
      const districtInfoMap = {};
      await Promise.all(
        pincodes.map(async (pc) => {
          const info = await getDistrictForPincode(pc.trim()).catch(() => null);
          if (info) districtInfoMap[pc] = info;
        }),
      );

      let result = null;
      try {
        result = await pincodesToUnionPolygon(pincodes);
      } catch (geoErr) {
        console.error("Geocoding threw:", geoErr.message);
      }

      if (!result) {
        console.warn(
          `⚠  All pincodes failed to resolve for "${name}" — saving as placeholder`,
        );
        zoneData.zoneType = "pincode";
        zoneData.pincodes = pincodes;
        zoneData.pincodeDistrictInfo = districtInfoMap;
        zoneData.lat = lat || 28.6139;
        zoneData.lng = lng || 77.209;
        zoneData.radius = 5000;
        zoneData.boundary = undefined;
        const zone = await new Zone(zoneData).save();
        return res.status(201).json({
          ...zone.toObject(),
          _warning:
            "Pincode geocoding failed — zone saved with placeholder location.",
        });
      }

      zoneData.zoneType = "pincode";
      zoneData.pincodes = pincodes;
      zoneData.pincodeDistrictInfo = districtInfoMap;
      zoneData.lat = result.center.lat;
      zoneData.lng = result.center.lng;
      zoneData.radius = 0;
      zoneData.boundary = {
        type: "Polygon",
        coordinates: result.polygon.geometry.coordinates,
      };
      console.log(`✅  Pincode polygon built for "${name}"`);
    } else {
      // ── CIRCULAR zone ──
      if (lat == null || lng == null)
        return res
          .status(400)
          .json({ error: "lat and lng are required for circular zones" });
      zoneData.zoneType = "circular";
      zoneData.lat = lat;
      zoneData.lng = lng;
      zoneData.radius = radius || 500;
      zoneData.pincodes = [];
    }

    const zone = await new Zone(zoneData).save();
    res.status(201).json(zone);
  } catch (e) {
    console.error("createZone error:", e.message);
    res.status(400).json({ error: e.message });
  }
}

/* PUT /api/zones/:id */
async function updateZone(req, res) {
  try {
    const {
      pincodes,
      name,
      lat,
      lng,
      radius,
      active,
      polygonCoords,
      zoneType,
    } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (active !== undefined) updates.active = active;

    // ── POLYGON update ──
    if (
      zoneType === "polygon" ||
      (polygonCoords && polygonCoords.length >= 3)
    ) {
      if (!polygonCoords || polygonCoords.length < 3)
        return res
          .status(400)
          .json({ error: "Polygon requires at least 3 coordinates" });

      const ring = closeRing(polygonCoords);
      const center = polygonCentroid(ring);
      updates.zoneType = "polygon";
      updates.lat = center.lat;
      updates.lng = center.lng;
      updates.radius = 0;
      updates.pincodes = [];
      updates.pincodeDistrictInfo = {};
      updates.boundary = { type: "Polygon", coordinates: [ring] };
    } else if (pincodes && pincodes.length > 0) {
      // ── PINCODE update ──
      console.log(`🗺  Re-resolving pincodes for zone update:`, pincodes);

      const districtInfoMap = {};
      await Promise.all(
        pincodes.map(async (pc) => {
          const info = await getDistrictForPincode(pc.trim()).catch(() => null);
          if (info) districtInfoMap[pc] = info;
        }),
      );

      let result = null;
      try {
        result = await pincodesToUnionPolygon(pincodes);
      } catch {}

      if (!result) {
        return res.status(400).json({
          error: "Could not resolve pincodes. Check values and try again.",
        });
      }
      updates.zoneType = "pincode";
      updates.pincodes = pincodes;
      updates.pincodeDistrictInfo = districtInfoMap;
      updates.lat = result.center.lat;
      updates.lng = result.center.lng;
      updates.radius = 0;
      updates.boundary = {
        type: "Polygon",
        coordinates: result.polygon.geometry.coordinates,
      };
    } else {
      // ── CIRCULAR update ──
      if (lat !== undefined) updates.lat = lat;
      if (lng !== undefined) updates.lng = lng;
      if (radius !== undefined) updates.radius = radius;
      if (pincodes !== undefined && pincodes.length === 0) {
        updates.zoneType = "circular";
        updates.pincodes = [];
        updates.pincodeDistrictInfo = {};
        updates.$unset = { boundary: 1 };
      }
    }

    const zone = await Zone.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!zone) return res.status(404).json({ error: "Not found" });
    res.json(zone);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}

/* DELETE /api/zones/:id */
async function deleteZone(req, res) {
  try {
    await Zone.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

/* POST /api/zones/resolve-pincodes — preview before saving */
async function resolvePincodes(req, res) {
  try {
    const { pincodes } = req.body;
    if (!pincodes || pincodes.length === 0)
      return res.status(400).json({ error: "pincodes array is required" });

    console.log("🗺  Preview resolving pincodes:", pincodes);

    let result = null;
    try {
      result = await pincodesToUnionPolygon(pincodes);
    } catch (e) {
      console.error("Preview geocoding error:", e.message);
    }

    if (!result) {
      return res.status(400).json({
        error:
          "Could not resolve these pincodes. " +
          "Check that they are valid 6-digit Indian pincodes and try again.",
      });
    }

    res.json({
      center: result.center,
      boundary: {
        type: "Polygon",
        coordinates: result.polygon.geometry.coordinates,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

/* POST /api/zones/resolve-polygon — validate & preview a manual polygon */
async function resolvePolygon(req, res) {
  try {
    const { polygonCoords } = req.body;
    if (!polygonCoords || polygonCoords.length < 3)
      return res
        .status(400)
        .json({ error: "Need at least 3 [lng,lat] coordinate pairs" });

    const ring = closeRing(polygonCoords);
    const center = polygonCentroid(ring);

    res.json({
      center,
      boundary: { type: "Polygon", coordinates: [ring] },
      vertexCount: ring.length - 1,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}

module.exports = {
  getAllZones,
  getActiveZone,
  getZoneById,
  createZone,
  updateZone,
  deleteZone,
  resolvePincodes,
  resolvePolygon,
};
