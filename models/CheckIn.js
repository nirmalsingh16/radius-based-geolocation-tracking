const mongoose = require("mongoose");

const CheckInSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "GeoUser" },
    userName: String,
    userEmail: String,
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    imageUrl: { type: String, required: true },
    imagePublicId: String,
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CheckIn", CheckInSchema);
