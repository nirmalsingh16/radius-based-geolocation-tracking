const Event = require("../models/Event");

/* GET /api/events */
async function getEvents(req, res) {
  try {
    const { zoneId, limit = 60, page = 1 } = req.query;
    const filter = zoneId ? { zoneId } : {};
    const [events, total] = await Promise.all([
      Event.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * +limit)
        .limit(+limit),
      Event.countDocuments(filter),
    ]);
    res.json({ events, total, page: +page, pages: Math.ceil(total / +limit) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

module.exports = { getEvents };
