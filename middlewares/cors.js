const cors = require("cors");

const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "ngrok-skip-browser-warning"],
};

function applyCors(app) {
  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions));

  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, ngrok-skip-browser-warning");
    res.setHeader("ngrok-skip-browser-warning", "true");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
  });
}

module.exports = applyCors;
