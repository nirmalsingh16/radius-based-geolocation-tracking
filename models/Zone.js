const mongoose = require("mongoose");

/**
 * Zone can be defined by:
 *  - (lat, lng, radius)  — circular geofence
 *  - pincodes            — pincode-polygon geofence (boundary auto-resolved via OSM)
 *  - polygonCoords       — manually drawn or coordinate-entered polygon
 *
 * zoneType: "circular" | "pincode" | "polygon"
 */
const ZoneSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    // Zone type discriminator
    zoneType: {
      type: String,
      enum: ["circular", "pincode", "polygon"],
      default: "circular",
    },

    // Centre point (used for map display & distance reporting)
    lat: { type: Number, default: 0 },
    lng: { type: Number, default: 0 },

    // Circular radius in metres (used only for circular zones)
    radius: { type: Number, default: 500 },

    // Pincode-based polygon boundary
    pincodes: { type: [String], default: [] },

    // District/area info cached per pincode: { "110001": { district: "Central Delhi", state: "Delhi", area: "Connaught Place" } }
    pincodeDistrictInfo: { type: mongoose.Schema.Types.Mixed, default: {} },

    // GeoJSON polygon built from pincodes OR drawn manually
    boundary: {
      type: {
        type: String,
        enum: ["Polygon"],
        default: undefined,
      },
      coordinates: { type: [[[Number]]], default: undefined }, // [[[lng, lat], …]]
    },

    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

ZoneSchema.index({ boundary: "2dsphere" });

module.exports = mongoose.model("Zone", ZoneSchema);
