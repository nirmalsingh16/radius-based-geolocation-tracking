const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Storage for check-in images ──────────────────────────────
const checkinStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "geofence_checkins",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ quality: "auto", fetch_format: "auto" }],
  },
});

// ── Storage for profile images ───────────────────────────────
const profileStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "geofence_profiles",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [
      { width: 400, height: 400, crop: "fill", gravity: "face", quality: "auto" },
    ],
  },
});

const uploadCheckin = multer({ storage: checkinStorage });
const uploadProfile = multer({ storage: profileStorage });

module.exports = { cloudinary, uploadCheckin, uploadProfile };
