/**
 * geo.js
 * All spatial calculations use @turf/turf — haversine is gone.
 *
 * Exports:
 *   isInsideZone(zone, lat, lng)  → boolean
 *   distanceToCenter(zone, lat, lng) → metres (number)
 */

const turf = require("@turf/turf");

/**
 * Check whether a coordinate is inside a zone.
 *
 * - If zone has a stored GeoJSON boundary polygon → use turf.booleanPointInPolygon
 * - Otherwise fall back to circular check using turf.distance + zone.radius
 *
 * @param {Object} zone  Mongoose Zone document (plain object or doc)
 * @param {number} lat
 * @param {number} lng
 * @returns {boolean}
 */
function isInsideZone(zone, lat, lng) {
  const pt = turf.point([lng, lat]);

  // Pincode-polygon boundary takes priority
  if (
    zone.boundary &&
    zone.boundary.type === "Polygon" &&
    zone.boundary.coordinates &&
    zone.boundary.coordinates.length > 0
  ) {
    try {
      const poly = turf.polygon(zone.boundary.coordinates);
      return turf.booleanPointInPolygon(pt, poly);
    } catch (e) {
      console.warn(
        "⚠  booleanPointInPolygon failed, falling back to circle:",
        e.message,
      );
    }
  }

  // Circular fallback
  const center = turf.point([zone.lng, zone.lat]);
  const distM = turf.distance(pt, center, { units: "meters" });
  return distM <= zone.radius;
}

/**
 * Distance in metres from the user's position to the zone centre point.
 * Always uses the zone.lat/zone.lng centre regardless of boundary type.
 *
 * @param {Object} zone
 * @param {number} lat
 * @param {number} lng
 * @returns {number} distance in metres
 */
function distanceToCenter(zone, lat, lng) {
  const pt = turf.point([lng, lat]);
  const center = turf.point([zone.lng, zone.lat]);
  return turf.distance(pt, center, { units: "meters" });
}

module.exports = { isInsideZone, distanceToCenter };
