/**
 * Geofence Tracker — Backend
 * Stack : Express · Mongoose · Nodemailer
 *
 * SETUP:
 *   1. npm install express mongoose cors dotenv nodemailer
 *   2. Create .env file in THIS SAME FOLDER (see .env.example)
 *   3. node server.js
 *
 * GMAIL APP PASSWORD NOTE:
 *   - Go to: https://myaccount.google.com/apppasswords
 *   - Generate a 16-char password like: elih xbwo sjaq vgxe
 *   - In .env file, wrap it in quotes: EMAIL_PASS="elih xbwo sjaq vgxe"
 */

const path = require("path");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: "doavqstpu",
  api_key: "694563958266697",
  api_secret: "xnvUfWWqBms9bZRiIIIMmkKJDWI",
});

// ── CRITICAL: Load .env from the SAME directory as this file ──
const dotenv = require("dotenv");
const envPath = path.join(__dirname, ".env");
const envResult = dotenv.config({ path: envPath });
dotenv.config();

// Startup diagnostics
console.log("\n====================================");
console.log("  GEOFENCE TRACKER — STARTUP");
console.log("====================================");

if (envResult.error) {
  console.error("❌  .env file NOT found at:", envPath);
  console.error("    Create a .env file next to server.js");
  console.error("    See .env.example for the template");
} else {
  console.log("✅  .env loaded from:", envPath);
}

// Log every env variable (masked)
console.log("\n── Environment ──────────────────────");
console.log("   MONGO_URI   :", process.env.MONGO_URI || "❌ NOT SET");
console.log("   EMAIL_USER  :", process.env.EMAIL_USER || "❌ NOT SET");
console.log(
  "   EMAIL_PASS  :",
  process.env.EMAIL_PASS
    ? "✅ SET (" + process.env.EMAIL_PASS.length + " chars)"
    : "❌ NOT SET",
);
console.log("   ADMIN_EMAIL :", process.env.ADMIN_EMAIL || "❌ NOT SET");
console.log("   PORT        :", process.env.PORT || "3000 (default)");
console.log("────────────────────────────────────\n");

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const nodemailer = require("nodemailer");

const app = express();
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "ngrok-skip-browser-warning",
    ],
  }),
);
app.options("*", cors());
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, ngrok-skip-browser-warning",
  );
  res.setHeader("ngrok-skip-browser-warning", "true");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});
app.use((req, res, next) => {
  res.setHeader("ngrok-skip-browser-warning", "true");
  next();
});

/* ─────────────────────────────────────────────────────────────
   MONGODB
───────────────────────────────────────────────────────────── */
mongoose
  .connect(process.env.MONGO_URI || "mongodb://localhost:27017/geofence")
  .then(() => console.log("✅  MongoDB connected"))
  .catch((e) => console.error("❌  MongoDB:", e.message));

/* ─────────────────────────────────────────────────────────────
   NODEMAILER — Gmail SMTP (port 465, SSL)
   App Password spaces are fine — nodemailer handles them.
   In .env, quote the password: EMAIL_PASS="elih xbwo sjaq vgxe"
───────────────────────────────────────────────────────────── */
let transporter = null;

function buildTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    console.warn(
      "⚠  Email NOT configured — set EMAIL_USER and EMAIL_PASS in .env",
    );
    return null;
  }

  // Remove any quotes that might have been left in the value
  const cleanPass = pass.replace(/^["']|["']$/g, "").trim();

  const t = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // STARTTLS — works more reliably in most hosted environments
    auth: { user, pass: cleanPass },
    tls: { rejectUnauthorized: false, ciphers: "SSLv3" },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  // Verify connection at startup
  t.verify((err, success) => {
    if (err) {
      console.error("❌  Gmail SMTP verify failed:", err.message);
      console.error("    Tips:");
      console.error("    • Use an App Password, NOT your real Gmail password");
      console.error(
        "    • Generate at: https://myaccount.google.com/apppasswords",
      );
      console.error(
        '    • In .env, wrap in quotes: EMAIL_PASS="elih xbwo sjaq vgxe"',
      );
      console.error(
        "    • Make sure 2-Step Verification is ON in your Google account",
      );
    } else {
      console.log("✅  Gmail SMTP ready — emails will be sent from:", user);
    }
  });

  return t;
}

transporter = buildTransporter();

/* Send mail helper with full error logging */
async function sendMail(to, subject, html) {
  if (!transporter) {
    console.warn("⚠  Skipping mail (transporter not ready) → to:", to);
    return;
  }
  const user = process.env.EMAIL_USER;
  try {
    const info = await transporter.sendMail({
      from: `"Geofence Tracker" <${user}>`,
      to,
      subject,
      html,
    });
    console.log(
      `📧  Email sent → ${to} | Subject: ${subject} | ID: ${info.messageId}`,
    );
    return info;
  } catch (e) {
    console.error(`❌  Email FAILED → ${to}`);
    console.error("    Error:", e.message);
    console.error("    Code:", e.code || "N/A");
  }
}

/* ── EMAIL TEMPLATES ── */
function fmtDist(d) {
  return d >= 1000 ? (d / 1000).toFixed(2) + " km" : Math.round(d) + " m";
}
function fmtDate() {
  return new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

function tplEnter(user, zone, dist) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:20px;background:#f0f0f0;font-family:Arial,sans-serif">
<div style="max-width:500px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.12)">
  <div style="background:linear-gradient(135deg,#0d3b1e,#145a2e);padding:32px;text-align:center">
    <div style="font-size:48px;margin-bottom:12px">✅</div>
    <h1 style="color:#00e676;margin:0;font-size:24px;font-weight:700">Entered Zone</h1>
  </div>
  <div style="padding:28px 32px">
    <p style="color:#333;font-size:16px;margin-bottom:20px">Hi <strong>${user.name}</strong>,</p>
    <p style="color:#555;margin-bottom:24px">You have <strong style="color:#1a7a40">entered</strong> the geofence zone.</p>
    <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e0e0e0">
      <tr style="background:#f0faf4"><td style="padding:12px 16px;color:#888;font-size:13px;width:40%">📍 Zone</td><td style="padding:12px 16px;font-weight:600;font-size:13px">${zone.name}</td></tr>
      <tr><td style="padding:12px 16px;color:#888;font-size:13px">📏 Distance to center</td><td style="padding:12px 16px;font-size:13px">${fmtDist(dist)}</td></tr>
      <tr style="background:#f0faf4"><td style="padding:12px 16px;color:#888;font-size:13px">⊙ Radius</td><td style="padding:12px 16px;font-size:13px">${fmtDist(zone.radius)}</td></tr>
      <tr><td style="padding:12px 16px;color:#888;font-size:13px">🕐 Time</td><td style="padding:12px 16px;font-size:13px">${fmtDate()}</td></tr>
    </table>
  </div>
  <div style="background:#f9f9f9;padding:14px 32px;font-size:11px;color:#aaa;text-align:center">Geofence Tracker · Automated Alert</div>
</div></body></html>`;
}

function tplExit(user, zone, dist) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:20px;background:#f0f0f0;font-family:Arial,sans-serif">
<div style="max-width:500px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.12)">
  <div style="background:linear-gradient(135deg,#3b0d0d,#5a1414);padding:32px;text-align:center">
    <div style="font-size:48px;margin-bottom:12px">🚨</div>
    <h1 style="color:#ff4060;margin:0;font-size:24px;font-weight:700">Left Zone</h1>
  </div>
  <div style="padding:28px 32px">
    <p style="color:#333;font-size:16px;margin-bottom:20px">Hi <strong>${user.name}</strong>,</p>
    <p style="color:#555;margin-bottom:24px">You have <strong style="color:#c0392b">exited</strong> the geofence zone.</p>
    <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e0e0e0">
      <tr style="background:#fdf4f4"><td style="padding:12px 16px;color:#888;font-size:13px;width:40%">📍 Zone</td><td style="padding:12px 16px;font-weight:600;font-size:13px">${zone.name}</td></tr>
      <tr><td style="padding:12px 16px;color:#888;font-size:13px">📏 Distance to center</td><td style="padding:12px 16px;font-size:13px">${fmtDist(dist)}</td></tr>
      <tr style="background:#fdf4f4"><td style="padding:12px 16px;color:#888;font-size:13px">⊙ Radius</td><td style="padding:12px 16px;font-size:13px">${fmtDist(zone.radius)}</td></tr>
      <tr><td style="padding:12px 16px;color:#888;font-size:13px">🕐 Time</td><td style="padding:12px 16px;font-size:13px">${fmtDate()}</td></tr>
    </table>
  </div>
  <div style="background:#f9f9f9;padding:14px 32px;font-size:11px;color:#aaa;text-align:center">Geofence Tracker · Automated Alert</div>
</div></body></html>`;
}

function tplAdmin(user, zone, dist, type) {
  const isEnter = type === "enter";
  return `<!DOCTYPE html><html><body style="margin:0;padding:20px;background:#f0f0f0;font-family:Arial,sans-serif">
<div style="max-width:500px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.12)">
  <div style="background:linear-gradient(135deg,#0a0d18,#14182e);padding:32px;text-align:center">
    <div style="font-size:48px;margin-bottom:12px">${isEnter ? "📍" : "🔴"}</div>
    <h1 style="color:#00bcd4;margin:0;font-size:22px;font-weight:700">Admin Alert — User ${isEnter ? "Entered" : "Left"}</h1>
  </div>
  <div style="padding:28px 32px">
    <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e0e0e0">
      <tr style="background:#f0f4fa"><td style="padding:12px 16px;color:#888;font-size:13px;width:40%">👤 User</td><td style="padding:12px 16px;font-weight:600;font-size:13px">${user.name}</td></tr>
      <tr><td style="padding:12px 16px;color:#888;font-size:13px">📧 Email</td><td style="padding:12px 16px;font-size:13px">${user.email}</td></tr>
      <tr style="background:#f0f4fa"><td style="padding:12px 16px;color:#888;font-size:13px">📍 Zone</td><td style="padding:12px 16px;font-size:13px">${zone.name}</td></tr>
      <tr><td style="padding:12px 16px;color:#888;font-size:13px">📏 Distance</td><td style="padding:12px 16px;font-size:13px">${fmtDist(dist)}</td></tr>
      <tr style="background:#f0f4fa"><td style="padding:12px 16px;color:#888;font-size:13px">⚡ Event</td><td style="padding:12px 16px;font-weight:700;font-size:13px;color:${isEnter ? "#1a7a40" : "#c0392b"}">${type.toUpperCase()}</td></tr>
      <tr><td style="padding:12px 16px;color:#888;font-size:13px">🕐 Time</td><td style="padding:12px 16px;font-size:13px">${fmtDate()}</td></tr>
    </table>
  </div>
  <div style="background:#f9f9f9;padding:14px 32px;font-size:11px;color:#aaa;text-align:center">Geofence Tracker · Admin Notification</div>
</div></body></html>`;
}

/* ─────────────────────────────────────────────────────────────
   SCHEMAS
───────────────────────────────────────────────────────────── */
const Zone = mongoose.model(
  "Zone",
  new mongoose.Schema(
    {
      name: { type: String, required: true },
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      radius: { type: Number, default: 500 },
      active: { type: Boolean, default: true },
    },
    { timestamps: true },
  ),
);

const GeoUser = mongoose.model(
  "GeoUser",
  new mongoose.Schema(
    {
      name: { type: String, required: true },
      email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
      },
      sessionId: String,
      lat: Number,
      lng: Number,
      accuracy: Number,
      isInside: { type: Boolean, default: false },
      distanceToCenter: { type: Number, default: 0 },
      zoneId: { type: mongoose.Schema.Types.ObjectId, ref: "Zone" },
      lastSeen: { type: Date, default: Date.now },
    },
    { timestamps: true },
  ),
);

const Event = mongoose.model(
  "Event",
  new mongoose.Schema(
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
    { timestamps: true },
  ),
);

const CheckIn = mongoose.model(
  "CheckIn",
  new mongoose.Schema(
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
    { timestamps: true },
  ),
);

/* ─── Cloudinary / Multer upload setup ─── */
const ciStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "geofence_checkins",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ quality: "auto", fetch_format: "auto" }],
  },
});
const ciUpload = multer({ storage: ciStorage });

/* ─────────────────────────────────────────────────────────────
   ZONE API
───────────────────────────────────────────────────────────── */
app.get("/api/zones", async (_, res) =>
  res.json(await Zone.find().sort({ createdAt: -1 })),
);

app.get("/api/zones/active/primary", async (_, res) => {
  const z = await Zone.findOne({ active: true }).sort({ updatedAt: -1 });
  z ? res.json(z) : res.status(404).json({ error: "No active zone" });
});

app.get("/api/zones/:id", async (req, res) => {
  const z = await Zone.findById(req.params.id).catch(() => null);
  z ? res.json(z) : res.status(404).json({ error: "Not found" });
});

app.post("/api/zones", async (req, res) => {
  try {
    res.status(201).json(await new Zone(req.body).save());
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.put("/api/zones/:id", async (req, res) => {
  try {
    res.json(
      await Zone.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      }),
    );
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete("/api/zones/:id", async (req, res) => {
  await Zone.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

/* ─────────────────────────────────────────────────────────────
   USER API
───────────────────────────────────────────────────────────── */
app.post("/api/users/register", async (req, res) => {
  try {
    const { name, email, sessionId } = req.body;
    if (!name || !email)
      return res.status(400).json({ error: "Name and email required" });
    const user = await GeoUser.findOneAndUpdate(
      { email: email.toLowerCase().trim() },
      { name, sessionId, lastSeen: new Date() },
      { upsert: true, new: true },
    );
    console.log(`👤  User registered/updated: ${user.name} <${user.email}>`);
    res.json(user);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/api/users", async (_, res) =>
  res.json(await GeoUser.find().sort({ lastSeen: -1 })),
);

app.get("/api/users/live", async (_, res) => {
  const since = new Date(Date.now() - 3 * 60 * 1000);
  res.json(
    await GeoUser.find({ lastSeen: { $gte: since } }).sort({ lastSeen: -1 }),
  );
});

/* ── Update location — triggers email on enter/exit ── */
app.post("/api/users/location", async (req, res) => {
  try {
    const { userId, lat, lng, accuracy, zoneId, isInside, distanceToCenter } =
      req.body;

    const user = await GeoUser.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const prevInside = user.isInside;
    Object.assign(user, {
      lat,
      lng,
      accuracy,
      zoneId,
      isInside,
      distanceToCenter,
      lastSeen: new Date(),
    });
    await user.save();

    /* State changed → save event + send emails */
    if (prevInside !== isInside && zoneId) {
      const zone = await Zone.findById(zoneId);
      if (zone) {
        const type = isInside ? "enter" : "exit";
        console.log(
          `⚡  ${type.toUpperCase()} event: ${user.name} (${user.email}) — zone: ${zone.name} — dist: ${fmtDist(distanceToCenter)}`,
        );

        await new Event({
          userId: user._id,
          userName: user.name,
          userEmail: user.email,
          zoneId: zone._id,
          zoneName: zone.name,
          type,
          lat,
          lng,
          distanceToCenter,
          message: isInside ? "Entered zone" : "Left zone",
        }).save();

        // Send to user
        if (isInside) {
          await sendMail(
            user.email,
            `✅ You entered "${zone.name}"`,
            tplEnter(user, zone, distanceToCenter),
          );
        } else {
          await sendMail(
            user.email,
            `🚨 You left "${zone.name}"`,
            tplExit(user, zone, distanceToCenter),
          );
        }

        // Send to admin
        const adminEmail = process.env.ADMIN_EMAIL;
        if (adminEmail && adminEmail !== user.email) {
          const subj = isInside
            ? `📍 ${user.name} entered "${zone.name}"`
            : `🔴 ${user.name} left "${zone.name}"`;
          await sendMail(
            adminEmail,
            subj,
            tplAdmin(user, zone, distanceToCenter, type),
          );
        }
      }
    }

    res.json(user);
  } catch (e) {
    console.error("Location update error:", e.message);
    res.status(400).json({ error: e.message });
  }
});

/* ─────────────────────────────────────────────────────────────
   EVENTS API
───────────────────────────────────────────────────────────── */
app.get("/api/events", async (req, res) => {
  const { zoneId, limit = 60, page = 1 } = req.query;
  const filter = zoneId ? { zoneId } : {};
  const [events, total] = await Promise.all([
    Event.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(+limit),
    Event.countDocuments(filter),
  ]);
  res.json({ events, total, page: +page, pages: Math.ceil(total / limit) });
});

/* ─────────────────────────────────────────────────────────────
   STATS
───────────────────────────────────────────────────────────── */
app.get("/api/stats", async (_, res) => {
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
});

/* ─────────────────────────────────────────────────────────────
   SOS REPORT API
───────────────────────────────────────────────────────────── */

/* POST /api/checkin — submit SOS with image upload */
app.post("/api/checkin", ciUpload.single("image"), async (req, res) => {
  try {
    const { userId, lat, lng, note } = req.body;

    if (!req.file) return res.status(400).json({ error: "Image is required" });
    if (!lat || !lng)
      return res.status(400).json({ error: "lat and lng are required" });

    let userName = "Unknown";
    let userEmail = "";
    let userObjectId = null;

    if (userId) {
      const user = await GeoUser.findById(userId).catch(() => null);
      if (user) {
        userName = user.name;
        userEmail = user.email;
        userObjectId = user._id;
      }
    }

    const report = await new CheckIn({
      userId: userObjectId,
      userName,
      userEmail,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      imageUrl: req.file.path,
      imagePublicId: req.file.filename,
      note: note || "",
    }).save();

    console.log(
      `📸  Check-In saved: ${userName} at ${lat},${lng} → ${req.file.path}`,
    );

    // Notify admin
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      const mapsLink = `https://www.google.com/maps?q=${lat},${lng}`;
      const ciHtml = `<!DOCTYPE html><html><body style="margin:0;padding:20px;background:#f0f0f0;font-family:Arial,sans-serif">
<div style="max-width:550px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.12)">
  <div style="background:linear-gradient(135deg,#0d3b1e,#145a2e);padding:28px 32px 22px;text-align:center">
    <div style="font-size:48px;margin-bottom:8px">📸</div>
    <h1 style="color:#00e676;margin:0;font-size:22px;font-weight:700">Zone Check-In</h1>
    <p style="color:#a5d6a7;margin:6px 0 0;font-size:13px">${userName} has checked in from inside the zone</p>
  </div>
  <div style="padding:24px 28px">
    <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e0e0e0;margin-bottom:18px">
      <tr style="background:#f0faf4"><td style="padding:11px 14px;color:#888;font-size:13px;width:38%">👤 User</td><td style="padding:11px 14px;font-weight:600;font-size:13px">${userName}</td></tr>
      <tr><td style="padding:11px 14px;color:#888;font-size:13px">📧 Email</td><td style="padding:11px 14px;font-size:13px">${userEmail || "N/A"}</td></tr>
      <tr style="background:#f0faf4"><td style="padding:11px 14px;color:#888;font-size:13px">📍 Location</td><td style="padding:11px 14px;font-size:13px">${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)}</td></tr>
      <tr><td style="padding:11px 14px;color:#888;font-size:13px">🕐 Time</td><td style="padding:11px 14px;font-size:13px">${fmtDate()}</td></tr>
      ${note ? `<tr style="background:#f0faf4"><td style="padding:11px 14px;color:#888;font-size:13px">📝 Note</td><td style="padding:11px 14px;font-size:13px">${note}</td></tr>` : ""}
    </table>
    <a href="${mapsLink}" style="display:block;background:#1a7a40;color:#fff;text-align:center;padding:13px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;margin-bottom:16px">📍 View Location on Maps</a>
    <img src="${req.file.path}" style="width:100%;border-radius:8px;border:1px solid #e0e0e0" alt="Check-in photo"/>
  </div>
  <div style="background:#f9f9f9;padding:12px 28px;font-size:11px;color:#aaa;text-align:center">Geofence Tracker · Check-In System</div>
</div></body></html>`;
      await sendMail(
        adminEmail,
        `📸 Check-In: ${userName} is inside the zone`,
        ciHtml,
      );
    }

    res.status(201).json({ success: true, report });
  } catch (e) {
    console.error("SOS error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

/* GET /api/checkin — admin view all Check-ins */
app.get("/api/checkin", async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const [reports, total] = await Promise.all([
      CheckIn.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(+limit),
      CheckIn.countDocuments(),
    ]);
    res.json({ reports, total, page: +page, pages: Math.ceil(total / limit) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* DELETE /api/checkin/:id */
app.delete("/api/checkin/:id", async (req, res) => {
  try {
    const report = await CheckIn.findById(req.params.id);
    if (!report) return res.status(404).json({ error: "Not found" });
    if (report.imagePublicId) {
      await cloudinary.uploader.destroy(report.imagePublicId).catch(() => {});
    }
    await CheckIn.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ─────────────────────────────────────────────────────────────
   TEST EMAIL ROUTE (GET /api/test-email?to=xxx@gmail.com)
───────────────────────────────────────────────────────────── */
app.get("/api/test-email", async (req, res) => {
  const to = req.query.to || process.env.ADMIN_EMAIL;
  if (!to)
    return res.status(400).json({ error: "Provide ?to=email@example.com" });
  try {
    await sendMail(
      to,
      "✅ Geofence Email Test",
      `
      <div style="font-family:Arial;padding:24px;background:#f5f5f5">
        <div style="background:#fff;border-radius:10px;padding:24px;max-width:400px;margin:auto">
          <h2 style="color:#1a7a40">✅ Email is working!</h2>
          <p>Your Geofence Tracker email is configured correctly.</p>
          <p style="color:#888;font-size:12px">Sent at: ${fmtDate()}</p>
        </div>
      </div>`,
    );
    res.json({ success: true, message: "Test email sent to " + to });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ─────────────────────────────────────────────────────────────
   START
───────────────────────────────────────────────────────────── */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀  Server running → http://localhost:${PORT}`);
  console.log(
    `\n🧪  Test email: http://localhost:${PORT}/api/test-email?to=${process.env.ADMIN_EMAIL || "your@email.com"}`,
  );
  console.log("────────────────────────────────────\n");
});
