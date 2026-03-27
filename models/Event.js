const mongoose = require("mongoose");

const EventSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "GeoUser" },
    userName: String,
    userEmail: String,
    zoneId: { type: mongoose.Schema.Types.ObjectId, ref: "Zone" },
    zoneName: String,
    type: { type: String, enum: ["enter", "exit", "info"] },
    lat: Number,
    lng: Number,
    distanceToCenter: Number,
    message: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Event", EventSchema);
