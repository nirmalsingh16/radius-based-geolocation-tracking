/**
 * Geofence Tracker — Backend v3
 * ─────────────────────────────────────────────────────────────
 * Stack  : Express · Mongoose · Nodemailer · Turf.js · Cloudinary
 * New    : Pincode-based zones · Profile images · Turf.js (no haversine)
 *
 * SETUP:
 *   1. cp .env.example .env   and fill in values
 *   2. npm install
 *   3. npm run dev            (or npm start)
 */

const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, ".env") });

console.log("\n====================================");
console.log("  GEOFENCE TRACKER v3 — STARTUP");
console.log("====================================");
console.log("── Environment ──────────────────────");
console.log("   MONGO_URI   :", process.env.MONGO_URI || "❌ NOT SET");
console.log("   EMAIL_USER  :", process.env.EMAIL_USER || "❌ NOT SET");
console.log(
  "   EMAIL_PASS  :",
  process.env.EMAIL_PASS
    ? `✅ SET (${process.env.EMAIL_PASS.length} chars)`
    : "❌ NOT SET",
);
console.log("   ADMIN_EMAIL :", process.env.ADMIN_EMAIL || "❌ NOT SET");
console.log(
  "   CLOUDINARY  :",
  process.env.CLOUDINARY_CLOUD_NAME
    ? `✅ ${process.env.CLOUDINARY_CLOUD_NAME}`
    : "❌ NOT SET",
);
console.log("   PORT        :", process.env.PORT || "3000 (default)");
console.log("────────────────────────────────────\n");

const express = require("express");
const applyCors = require("./middlewares/cors");
const connectDB = require("./config/db");

// Routes
const zoneRoutes = require("./routes/zones");
const userRoutes = require("./routes/users");
const eventRoutes = require("./routes/events");
const checkinRoutes = require("./routes/checkins");

const { sendMail, tplTestEmail } = require("./utils/mailer");
const GeoUser = require("./models/GeoUser");
const Zone = require("./models/Zone");
const Event = require("./models/Event");

const app = express();

// ── Middleware ────────────────────────────────────────────────
applyCors(app);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Static frontend ───────────────────────────────────────────
app.use(express.static(path.join(__dirname, "..", "frontend", "public")));

// ── API Routes ────────────────────────────────────────────────
app.use("/api/zones", zoneRoutes);
app.use("/api/users", userRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/checkin", checkinRoutes);

// ── Stats ─────────────────────────────────────────────────────
app.get("/api/stats", async (_, res) => {
  try {
    const since = new Date(Date.now() - 3 * 60 * 1000);
    const [totalZones, activeUsers, totalEvents, insideCount, registeredUsers] =
      await Promise.all([
        Zone.countDocuments({ active: true }),
        GeoUser.countDocuments({ lastSeen: { $gte: since } }),
        Event.countDocuments(),
        GeoUser.countDocuments({ isInside: true, lastSeen: { $gte: since } }),
        GeoUser.countDocuments(),
      ]);
    res.json({
      totalZones,
      activeUsers,
      totalEvents,
      insideCount,
      registeredUsers,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Test email ────────────────────────────────────────────────
app.get("/api/test-email", async (req, res) => {
  const to = req.query.to || process.env.ADMIN_EMAIL;
  if (!to)
    return res.status(400).json({ error: "Provide ?to=email@example.com" });
  try {
    await sendMail(to, "✅ Geofence Email Test", tplTestEmail());
    res.json({ success: true, message: "Test email sent to " + to });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── SPA fallback ──────────────────────────────────────────────
app.get("*", (req, res) => {
  // Serve admin page for /admin, tracker for everything else
  if (req.path.startsWith("/admin")) {
    res.sendFile(
      path.join(__dirname, "..", "frontend", "public", "admin.html"),
    );
  } else {
    res.sendFile(
      path.join(__dirname, "..", "frontend", "public", "index.html"),
    );
  }
});

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀  Server running → http://localhost:${PORT}`);
    console.log(`🗺   Admin panel   → http://localhost:${PORT}/admin.html`);
    console.log(
      `🧪  Test email    → http://localhost:${PORT}/api/test-email?to=${process.env.ADMIN_EMAIL || "your@email.com"}`,
    );
    console.log("────────────────────────────────────\n");
  });
});
