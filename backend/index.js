const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const http = require("http");
const { Server } = require("socket.io");

require("dotenv").config();

/* ---------------- ROUTES ---------------- */

const authRoutes = require("./routes/authRoutes");
const farmRoutes = require("./routes/farmRoutes");
const scheduleRoutes = require("./routes/scheduleRoutes");
// const deviceRoutes = require("./routes/deviceRoutes");

const aiChatRoutes = require("./routes/aiChatRoutes");
const aiCropRoutes = require("./routes/cropRoutes");
const aiDiseaseRoutes = require("./routes/diseaseRoutes");

const irrigationRoutes = require("./routes/irrigationRoutes");
const fertilizerRoutes = require("./routes/fertilizerRoutes");
const weatherRoutes = require("./routes/weatherRoutes");
const smartIrrigationRoutes = require("./routes/smartIrrigationRoutes");
const iotRoutes = require("./routes/iotRoutes");
const { initSocketService } = require("./services/socketService");
const brokerRoutes = require("./routes/brokerRoutes");
const { startScheduleRunner, stopScheduleRunner } = require("./services/scheduleRunner");
const {
  startIrrigationExecutionManager,
  stopIrrigationExecutionManager,
} = require("./services/irrigationExecutionManager");
const {
  startDharaaDailyGenerationManager,
  stopDharaaDailyGenerationManager,
} = require("./services/dharaaDailyGenerationManager");

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://cropsense-ruddy.vercel.app"
    ],
    credentials: true
  }
});

/* ---------------- SECURITY ---------------- */



/* ---------------- CORS ---------------- */

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://cropsense-ruddy.vercel.app"
    ],
    credentials: true
  })
);
app.use(helmet());

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: "Too many requests, slow down 🚫",
  standardHeaders: true,
  legacyHeaders: false
});

app.use(globalLimiter);

app.set("trust proxy", 1);

/* ---------------- BODY PARSERS ---------------- */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* ---------------- SOCKET EVENTS ---------------- */

// io.on("connection", (socket) => {

//   console.log(
//     `Socket Connected: ${socket.id}`
//   );

//   socket.on(
//     "disconnect",
//     () => {


//       console.log(
//         `Socket Disconnected: ${socket.id}`
//       );

//     }


//   );

// });

/* Make io available everywhere */

app.set("io", io);
initSocketService(io);

/* ---------------- ROUTES ---------------- */

app.use("/auth", authRoutes);

app.use("/farms", farmRoutes);

app.use("/schedules", scheduleRoutes);

// app.use("/device", deviceRoutes);

app.use("/api/ai/chat", aiChatRoutes);

app.use("/api/ai/crop", aiCropRoutes);

app.use("/api/ai/disease", aiDiseaseRoutes);

app.use("/api/ai/irrigation", irrigationRoutes);

app.use("/api/ai/smart-irrigation", smartIrrigationRoutes);

app.use("/api/ai/fertilizer", fertilizerRoutes);

app.use("/api/ai/weather", weatherRoutes);
app.use("/iot", iotRoutes);
app.use("/iot/broker", brokerRoutes);

/* ---------------- HEALTH CHECK ---------------- */

app.get("/", (req, res) => {

  res.send(
    "DHARAA API is running"
  );

});

/* ---------------- DATABASE ---------------- */

// async function connectDB() {

//   try {

// await mongoose.connect(
//   process.env.MONGO_URI
// );

// console.log(
//   "MongoDB connected"
// );

// /* Start MQTT */

// initializeMQTT(io);

// console.log(
//   "MQTT initialized"
// );

// /* Start Device Monitor */

// startMonitor();

// console.log(
//   "Device monitor started"
// );


//   }
//   catch (error) {

// console.log(
//   "MongoDB connection error:",
//   error
// );

// process.exit(1);


//   }

// }

// connectDB();

/* ---------------- SERVER ---------------- */

// const PORT =
//   process.env.PORT || 5000;

// server.listen(
//   PORT,
//   "0.0.0.0",
//   () => {


//     console.log(
//       `Server running on port ${PORT}`
//     );


//   }
// );

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // ── Connect to MongoDB ──────────────────────────────────────────────────
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");

    // ── Start HTTP server ───────────────────────────────────────────────────
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`✅ HTTP + Socket.IO server running on port ${PORT}`);
    });

    // ── Connect to Mosquitto MQTT broker ───────────────────────────────────
    // Imported here (not at top-level) so it connects AFTER mongoose is ready.
    // mqttService needs to write to MongoDB when messages arrive.
    const { initMqttService } = require("./services/mqttService");
    initMqttService(io);
    // io is passed in so mqttService can emit Socket.IO events
    // when sensor data arrives.
    startScheduleRunner();
    startIrrigationExecutionManager();
    startDharaaDailyGenerationManager();
    console.log("✅ Schedule runner started");
  } catch (error) {
    console.error("❌ Server startup failed:", error.message);
    process.exit(1);
  }
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────
process.on("SIGTERM", async () => {
  stopScheduleRunner();
  stopIrrigationExecutionManager();
  stopDharaaDailyGenerationManager();
  console.log("🔄 SIGTERM received — shutting down gracefully...");
  server.close(async () => {
    await mongoose.connection.close();
    console.log("✅ MongoDB connection closed.");
    process.exit(0);
  });
});

process.on("SIGINT", async () => {
  stopScheduleRunner();
  stopIrrigationExecutionManager();
  stopDharaaDailyGenerationManager();
  console.log("🔄 SIGINT received — shutting down gracefully...");
  server.close(async () => {
    await mongoose.connection.close();
    console.log("✅ MongoDB connection closed.");
    process.exit(0);
  });
});

startServer();

// module.exports = {
//   app,
//   server,
//   io
// };
