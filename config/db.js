const mongoose = require("mongoose");

async function connectDB() {
  try {
    await mongoose.connect(
      process.env.MONGO_URI || "mongodb://localhost:27017/geofence"
    );
    console.log("✅  MongoDB connected");
  } catch (e) {
    console.error("❌  MongoDB:", e.message);
    process.exit(1);
  }
}

module.exports = connectDB;
