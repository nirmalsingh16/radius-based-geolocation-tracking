const express = require("express");
const router = express.Router();
const {
  getAllZones,
  getActiveZone,
  getZoneById,
  createZone,
  updateZone,
  deleteZone,
  resolvePincodes,
  resolvePolygon,
} = require("../controllers/zoneController");

router.get("/", getAllZones);
router.get("/active/primary", getActiveZone);
router.post("/resolve-pincodes", resolvePincodes); // must be before /:id
router.post("/resolve-polygon", resolvePolygon); // must be before /:id
router.get("/:id", getZoneById);
router.post("/", createZone);
router.put("/:id", updateZone);
router.delete("/:id", deleteZone);

module.exports = router;
