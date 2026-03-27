/**
 * userController.js
 * User registration (with optional profile image + pincode),
 * live tracking, location updates with turf.js inside checks.
 */

const GeoUser = require("../models/GeoUser");
const Zone = require("../models/Zone");
const Event = require("../models/Event");
const { cloudinary } = require("../config/cloudinary");
const { isInsideZone, distanceToCenter } = require("../utils/geo");
const { sendMail, tplEnter, tplExit, tplAdmin, fmtDist } = require("../utils/mailer");

/* ── POST /api/users/register ───────────────────────────────── */
async function registerUser(req, res) {
  try {
    const { name, email, sessionId, pincode } = req.body;
    if (!name || !email)
      return res.status(400).json({ error: "Name and email required" });

    const updateData = {
      name: name.trim(),
      sessionId,
      lastSeen: new Date(),
    };

    if (pincode) updateData.pincode = pincode.trim();

    // Profile image (uploaded via multipart, handled by uploadProfile middleware)
    if (req.file) {
      // If user already had a profile image, delete the old one from Cloudinary
      const existing = await GeoUser.findOne({ email: email.toLowerCase().trim() });
      if (existing && existing.profileImagePublicId) {
        await cloudinary
          .uploader
          .destroy(existing.profileImagePublicId)
          .catch(() => {});
      }
      updateData.profileImageUrl = req.file.path;
      updateData.profileImagePublicId = req.file.filename;
    }

    const user = await GeoUser.findOneAndUpdate(
      { email: email.toLowerCase().trim() },
      updateData,
      { upsert: true, new: true }
    );

    console.log(`👤  User registered/updated: ${user.name} <${user.email}>${user.pincode ? " [" + user.pincode + "]" : ""}`);
    res.json(user);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}

/* ── GET /api/users ─────────────────────────────────────────── */
async function getAllUsers(req, res) {
  try {
    res.json(await GeoUser.find().sort({ lastSeen: -1 }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

/* ── GET /api/users/live ────────────────────────────────────── */
async function getLiveUsers(req, res) {
  try {
    const since = new Date(Date.now() - 3 * 60 * 1000);
    res.json(
      await GeoUser.find({ lastSeen: { $gte: since } }).sort({ lastSeen: -1 })
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

/* ── POST /api/users/location ───────────────────────────────── *
 * Body: { userId, lat, lng, accuracy, zoneId }
 * Server now does the inside/outside check using turf — frontend
 * just sends GPS coordinates, no longer sends isInside / distanceToCenter.
 * (Frontend values accepted too for backwards compat but server overrides.)
 */
async function updateLocation(req, res) {
  try {
    const { userId, lat, lng, accuracy, zoneId } = req.body;

    const user = await GeoUser.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const prevInside = user.isInside;

    // Server-side spatial check using turf
    let isInside = false;
    let dist = 0;
    let zone = null;

    if (zoneId) {
      zone = await Zone.findById(zoneId);
      if (zone) {
        isInside = isInsideZone(zone, lat, lng);
        dist = distanceToCenter(zone, lat, lng);
      }
    }

    Object.assign(user, {
      lat,
      lng,
      accuracy,
      zoneId: zone ? zone._id : undefined,
      isInside,
      distanceToCenter: dist,
      lastSeen: new Date(),
    });
    await user.save();

    // State change → save event + send emails
    if (zone && prevInside !== isInside) {
      const type = isInside ? "enter" : "exit";
      console.log(
        `⚡  ${type.toUpperCase()} event: ${user.name} (${user.email}) — zone: ${zone.name} — dist: ${fmtDist(dist)}`
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
        distanceToCenter: dist,
        message: isInside ? "Entered zone" : "Left zone",
      }).save();

      // User notification
      const subj = isInside
        ? `✅ You entered "${zone.name}"`
        : `🚨 You left "${zone.name}"`;
      const html = isInside
        ? tplEnter(user, zone, dist)
        : tplExit(user, zone, dist);
      await sendMail(user.email, subj, html);

      // Admin notification
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail && adminEmail !== user.email) {
        const adminSubj = isInside
          ? `📍 ${user.name} entered "${zone.name}"`
          : `🔴 ${user.name} left "${zone.name}"`;
        await sendMail(adminEmail, adminSubj, tplAdmin(user, zone, dist, type));
      }
    }

    res.json(user);
  } catch (e) {
    console.error("Location update error:", e.message);
    res.status(400).json({ error: e.message });
  }
}

module.exports = { registerUser, getAllUsers, getLiveUsers, updateLocation };
