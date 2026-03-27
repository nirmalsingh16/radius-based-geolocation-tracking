const express = require("express");
const router = express.Router();
const { uploadCheckin } = require("../config/cloudinary");
const { createCheckin, getCheckins, deleteCheckin } = require("../controllers/checkinController");

router.post("/", uploadCheckin.single("image"), createCheckin);
router.get("/", getCheckins);
router.delete("/:id", deleteCheckin);

module.exports = router;
