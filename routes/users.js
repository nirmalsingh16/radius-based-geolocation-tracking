const express = require("express");
const router = express.Router();
const { uploadProfile } = require("../config/cloudinary");
const {
  registerUser,
  getAllUsers,
  getLiveUsers,
  updateLocation,
} = require("../controllers/userController");

// Register — accepts optional profile image via multipart/form-data
router.post("/register", uploadProfile.single("profileImage"), registerUser);

router.get("/", getAllUsers);
router.get("/live", getLiveUsers);
router.post("/location", updateLocation);

module.exports = router;
