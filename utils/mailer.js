/**
 * mailer.js
 * Nodemailer setup + all HTML email templates.
 */

const nodemailer = require("nodemailer");

let transporter = null;

function fmtDist(d) {
  return d >= 1000 ? (d / 1000).toFixed(2) + " km" : Math.round(d) + " m";
}
function fmtDate() {
  return new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

function buildTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) {
    console.warn("⚠  Email NOT configured — set EMAIL_USER and EMAIL_PASS in .env");
    return null;
  }
  const cleanPass = pass.replace(/^["']|["']$/g, "").trim();
  const t = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user, pass: cleanPass },
    tls: { rejectUnauthorized: false, ciphers: "SSLv3" },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  t.verify((err) => {
    if (err) console.error("❌  Gmail SMTP verify failed:", err.message);
    else console.log("✅  Gmail SMTP ready — sending from:", user);
  });
  return t;
}

transporter = buildTransporter();

async function sendMail(to, subject, html) {
  if (!transporter) {
    console.warn("⚠  Skipping mail (transporter not ready) →", to);
    return;
  }
  try {
    const info = await transporter.sendMail({
      from: `"Geofence Tracker" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`📧  Email sent → ${to} | ${subject} | ${info.messageId}`);
    return info;
  } catch (e) {
    console.error(`❌  Email FAILED → ${to}:`, e.message);
  }
}

/* ── Templates ──────────────────────────────────────────────── */
function tplEnter(user, zone, dist) {
  const zoneType = zone.pincodes && zone.pincodes.length > 0
    ? `Pincodes: ${zone.pincodes.join(", ")}`
    : `Radius: ${fmtDist(zone.radius)}`;
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
      <tr style="background:#f0faf4"><td style="padding:12px 16px;color:#888;font-size:13px">⊙ Boundary</td><td style="padding:12px 16px;font-size:13px">${zoneType}</td></tr>
      <tr><td style="padding:12px 16px;color:#888;font-size:13px">🕐 Time</td><td style="padding:12px 16px;font-size:13px">${fmtDate()}</td></tr>
    </table>
  </div>
  <div style="background:#f9f9f9;padding:14px 32px;font-size:11px;color:#aaa;text-align:center">Geofence Tracker · Automated Alert</div>
</div></body></html>`;
}

function tplExit(user, zone, dist) {
  const zoneType = zone.pincodes && zone.pincodes.length > 0
    ? `Pincodes: ${zone.pincodes.join(", ")}`
    : `Radius: ${fmtDist(zone.radius)}`;
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
      <tr style="background:#fdf4f4"><td style="padding:12px 16px;color:#888;font-size:13px">⊙ Boundary</td><td style="padding:12px 16px;font-size:13px">${zoneType}</td></tr>
      <tr><td style="padding:12px 16px;color:#888;font-size:13px">🕐 Time</td><td style="padding:12px 16px;font-size:13px">${fmtDate()}</td></tr>
    </table>
  </div>
  <div style="background:#f9f9f9;padding:14px 32px;font-size:11px;color:#aaa;text-align:center">Geofence Tracker · Automated Alert</div>
</div></body></html>`;
}

function tplAdmin(user, zone, dist, type) {
  const isEnter = type === "enter";
  const zoneType = zone.pincodes && zone.pincodes.length > 0
    ? `Pincodes: ${zone.pincodes.join(", ")}`
    : `Radius: ${fmtDist(zone.radius)}`;
  return `<!DOCTYPE html><html><body style="margin:0;padding:20px;background:#f0f0f0;font-family:Arial,sans-serif">
<div style="max-width:500px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.12)">
  <div style="background:linear-gradient(135deg,#0a0d18,#14182e);padding:32px;text-align:center">
    <div style="font-size:48px;margin-bottom:12px">${isEnter ? "📍" : "🔴"}</div>
    <h1 style="color:#00bcd4;margin:0;font-size:22px;font-weight:700">Admin Alert — User ${isEnter ? "Entered" : "Left"}</h1>
  </div>
  <div style="padding:28px 32px">
    ${user.profileImageUrl ? `<div style="text-align:center;margin-bottom:16px"><img src="${user.profileImageUrl}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid #00bcd4"/></div>` : ""}
    <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e0e0e0">
      <tr style="background:#f0f4fa"><td style="padding:12px 16px;color:#888;font-size:13px;width:40%">👤 User</td><td style="padding:12px 16px;font-weight:600;font-size:13px">${user.name}</td></tr>
      <tr><td style="padding:12px 16px;color:#888;font-size:13px">📧 Email</td><td style="padding:12px 16px;font-size:13px">${user.email}</td></tr>
      ${user.pincode ? `<tr style="background:#f0f4fa"><td style="padding:12px 16px;color:#888;font-size:13px">📮 Pincode</td><td style="padding:12px 16px;font-size:13px">${user.pincode}</td></tr>` : ""}
      <tr ${user.pincode ? "" : 'style="background:#f0f4fa"'}><td style="padding:12px 16px;color:#888;font-size:13px">📍 Zone</td><td style="padding:12px 16px;font-size:13px">${zone.name}</td></tr>
      <tr style="background:#f0f4fa"><td style="padding:12px 16px;color:#888;font-size:13px">⊙ Boundary</td><td style="padding:12px 16px;font-size:13px">${zoneType}</td></tr>
      <tr><td style="padding:12px 16px;color:#888;font-size:13px">📏 Distance</td><td style="padding:12px 16px;font-size:13px">${fmtDist(dist)}</td></tr>
      <tr style="background:#f0f4fa"><td style="padding:12px 16px;color:#888;font-size:13px">⚡ Event</td><td style="padding:12px 16px;font-weight:700;font-size:13px;color:${isEnter ? "#1a7a40" : "#c0392b"}">${type.toUpperCase()}</td></tr>
      <tr><td style="padding:12px 16px;color:#888;font-size:13px">🕐 Time</td><td style="padding:12px 16px;font-size:13px">${fmtDate()}</td></tr>
    </table>
  </div>
  <div style="background:#f9f9f9;padding:14px 32px;font-size:11px;color:#aaa;text-align:center">Geofence Tracker · Admin Notification</div>
</div></body></html>`;
}

function tplTestEmail() {
  return `<div style="font-family:Arial;padding:24px;background:#f5f5f5">
    <div style="background:#fff;border-radius:10px;padding:24px;max-width:400px;margin:auto">
      <h2 style="color:#1a7a40">✅ Email is working!</h2>
      <p>Your Geofence Tracker email is configured correctly.</p>
      <p style="color:#888;font-size:12px">Sent at: ${fmtDate()}</p>
    </div>
  </div>`;
}

module.exports = { sendMail, tplEnter, tplExit, tplAdmin, tplTestEmail, fmtDist, fmtDate };
