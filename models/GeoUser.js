const mongoose = require("mongoose");

const GeoUserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Optional profile image
    profileImageUrl: { type: String, default: "" },
    profileImagePublicId: { type: String, default: "" },

    // Pincode entered by user during registration
    pincode: { type: String, default: "" },

    sessionId: String,
    lat: Number,
    lng: Number,
    accuracy: Number,
    isInside: { type: Boolean, default: false },
    distanceToCenter: { type: Number, default: 0 },
    zoneId: { type: mongoose.Schema.Types.ObjectId, ref: "Zone" },
    lastSeen: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("GeoUser", GeoUserSchema);
