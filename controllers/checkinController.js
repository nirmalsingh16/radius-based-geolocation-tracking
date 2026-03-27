const CheckIn = require("../models/CheckIn");
const GeoUser = require("../models/GeoUser");
const { cloudinary } = require("../config/cloudinary");
const { sendMail, fmtDate } = require("../utils/mailer");

/* POST /api/checkin */
async function createCheckin(req, res) {
  try {
    const { userId, lat, lng, note } = req.body;
    if (!req.file) return res.status(400).json({ error: "Image is required" });
    if (!lat || !lng) return res.status(400).json({ error: "lat and lng are required" });

    let userName = "Unknown", userEmail = "", userObjectId = null;
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

    console.log(`📸  Check-In saved: ${userName} at ${lat},${lng} → ${req.file.path}`);

    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      const mapsLink = `https://www.google.com/maps?q=${lat},${lng}`;
      const ciHtml = `<!DOCTYPE html><html><body style="margin:0;padding:20px;background:#f0f0f0;font-family:Arial,sans-serif">
<div style="max-width:550px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.12)">
  <div style="background:linear-gradient(135deg,#0d3b1e,#145a2e);padding:28px 32px 22px;text-align:center">
    <div style="font-size:48px;margin-bottom:8px">📸</div>
    <h1 style="color:#00e676;margin:0;font-size:22px;font-weight:700">Zone Check-In</h1>
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
      await sendMail(adminEmail, `📸 Check-In: ${userName} is inside the zone`, ciHtml);
    }

    res.status(201).json({ success: true, report });
  } catch (e) {
    console.error("Checkin error:", e.message);
    res.status(500).json({ error: e.message });
  }
}

/* GET /api/checkin */
async function getCheckins(req, res) {
  try {
    const { limit = 50, page = 1 } = req.query;
    const [reports, total] = await Promise.all([
      CheckIn.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * +limit)
        .limit(+limit),
      CheckIn.countDocuments(),
    ]);
    res.json({ reports, total, page: +page, pages: Math.ceil(total / +limit) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

/* DELETE /api/checkin/:id */
async function deleteCheckin(req, res) {
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
}

module.exports = { createCheckin, getCheckins, deleteCheckin };
