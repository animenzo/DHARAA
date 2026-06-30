# DHARAA — Final Integration Testing & Deployment Checklist
## Phase E: Complete Flow Verification

---

## ✅ PRE-DEPLOYMENT ENVIRONMENT CHECKS

### Backend `.env` required variables:
```
MONGO_URI=mongodb://...
JWT_SECRET=<strong-random-string-min-32-chars>
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_CLIENT_ID=cropsense_backend
PORT=5000
CMD_ACK_TIMEOUT_MS=10000
```

### Frontend `.env` / `VITE_*` variables:
```
VITE_API_URL=http://localhost:5000         (production: https://your-domain.com)
VITE_SOCKET_URL=http://localhost:5000      (production: https://your-domain.com)
```

### Mosquitto config (`mosquitto/config/mosquitto.conf`):
- Listener on port 1883
- `allow_anonymous true` (dev) or ACL file (production)
- Persistence enabled

---

## 🔄 PHASE E: COMPLETE FLOW TEST

### 1. User Signup → Device Provisioning
- [ ] POST `/auth/register` with name, email, password
- [ ] Response includes `authToken` (plain), `deviceId`, and `topics` object
- [ ] MongoDB: User created with `iotDevice` reference populated
- [ ] MongoDB: Device document created with `deviceId`, `authTokenHash`, `topics`
- [ ] MongoDB: Template document created and linked to Device
- [ ] `authToken` field in Device should be the plain token (shown once in UI)
- [ ] `authTokenHash` field must NOT appear in API response (select: false)

### 2. JWT Auth Flow
- [ ] POST `/auth/login` returns `token`
- [ ] GET `/auth/profile` with Bearer token returns user + populated `iotDevice`
- [ ] Expired token → 401 `TOKEN_EXPIRED`
- [ ] Missing token → 401 `NO_TOKEN`
- [ ] Tampered token → 401 `INVALID_TOKEN`

### 3. IoT Device API
- [ ] GET `/iot/device` → returns device with template, NO authTokenHash
- [ ] GET `/iot/device/connection-info` → returns `arduinoSnippet`, `brokerHost`, `brokerPort`, `topics`
- [ ] PATCH `/iot/device` with `{ name: "My Farm Sensor" }` → updates name
- [ ] POST `/iot/device/regenerate-token` → new plain token returned once, old token rejected on next MQTT publish

### 4. MQTT Broker Connection
- [ ] after opening config folder in terminal Start Mosquitto: `mosquitto -v -c config\mosquitto.conf` 
- [ ] Start backend: `node index.js` → see "✅ MQTT broker connected"
- [ ] Backend subscribes to `farm/+/+/#`
- [ ] Backend publishes `cropsense/backend/status` on connect

### 5. ESP32 Connects (or simulate with MQTT client like MQTTX)
- [ ] Publish to `farm/{userId}/{deviceId}/status`:
  ```json
  { "status": "online", "authToken": "<plain-token>" }
  ```
- [ ] Backend: Device status → "online", `isActive` → true, `lastSeen` updated
- [ ] Socket.IO: `deviceStatus` event emitted to user room
- [ ] Frontend: DeviceStatusCard shows "Online"
- [ ] Frontend: DeviceStatusBanner disappears

### 6. Sensor Data Flow
- [ ] Publish to `farm/{userId}/{deviceId}/data`:
  ```json
  {
    "authToken": "<plain-token>",
    "moisture": 65,
    "temperature": 28.5,
    "humidity": 72,
    "rain": 0,
    "waterLevel": 80,
    "pump": 0,
    "valve": 0
  }
  ```
- [ ] Backend: validates authToken hash → accepted
- [ ] Backend: SensorData document saved to MongoDB
- [ ] Backend: emits `sensorData` Socket.IO event to user room
- [ ] Frontend IoTDashboard: SensorDashboard cards update in real-time
- [ ] Frontend IoTDashboard: RealtimeChart appends new point
- [ ] Frontend IoTDashboard: `isLive` → true, "Live · last update Xs ago" label shown
- [ ] GET `/iot/sensor/latest` → returns most recent reading
- [ ] GET `/iot/sensor/last24h` → returns hourly aggregates

### 7. Invalid authToken Rejection
- [ ] Publish sensor data with wrong authToken → backend logs "invalid authToken — rejected"
- [ ] No SensorData saved, no Socket.IO event emitted
- [ ] Device status NOT updated to online

### 8. Pump Control (Manual)
- [ ] POST `/iot/command` with `{ actuator: "pump", value: 1, source: "manual" }`
- [ ] Backend: Creates CommandLog with status "pending"
- [ ] Backend: MQTT publishes to `farm/{userId}/{deviceId}/cmd` with `{ cmdId, pump: 1, ts }`
- [ ] ESP32 (or MQTT client): receives command on `/cmd` topic
- [ ] ESP32: publishes ACK to `farm/{userId}/{deviceId}/cmd/ack`:
  ```json
  { "cmdId": "<same-cmdId>", "ok": true }
  ```
- [ ] Backend: CommandLog status → "acked"
- [ ] Socket.IO: `commandAck` event emitted to user room
- [ ] Frontend: ActuatorPanel shows pump as ON

### 9. Pump Control Security (Cross-User Isolation)
- [ ] User A sends POST `/iot/command` — only User A's device receives command
- [ ] User B's JWT cannot control User A's device (iotController uses `Device.findOne({ user: req.user._id })`)
- [ ] User B cannot view User A's MQTT credentials (GET `/iot/device` scoped to `user: req.user._id`)
- [ ] User B cannot view User A's sensor data (all queries scoped to authenticated user)

### 10. Device Offline Detection
- [ ] Publish to `farm/{userId}/{deviceId}/status`:
  ```json
  { "status": "offline" }
  ```
  (simulates LWT / graceful disconnect)
- [ ] Device status → "offline"
- [ ] Socket.IO: `deviceStatus` event with `{ status: "offline" }` emitted
- [ ] Frontend: DeviceStatusCard shows "Offline"
- [ ] Frontend: DeviceStatusBanner appears with offline warning

### 11. Heartbeat Monitor
- [ ] If no MQTT data received for > OFFLINE_THRESHOLD minutes:
- [ ] deviceStatusService marks device offline automatically
- [ ] Socket.IO event emitted
- [ ] (Test by stopping ESP32 / MQTT client and waiting)

### 12. Profile Page (Phase A)
- [ ] GET `/iot/device/connection-info` → brokerHost, brokerPort, arduinoSnippet, topics
- [ ] UserProfile page shows all 6 sections (user, device overview, MQTT credentials, topics, template, ESP32 guide)
- [ ] Auth token is masked by default (eye icon toggles visibility)
- [ ] Device ID copy button works
- [ ] Each topic copy button works
- [ ] Arduino snippet copy button works
- [ ] "Regenerate Token" shows confirmation dialog, generates new token, shows it once
- [ ] After regeneration: old ESP32 MQTT publishes are rejected

### 13. Schedule Runner
- [ ] POST `/schedules` creates a schedule
- [ ] scheduleRunner checks at due time
- [ ] commandService.issueCommand() called with `source: "schedule"`
- [ ] CommandLog shows source as "schedule"

### 14. Dashboard (Legacy)
- [ ] GET `/device/live/:farmId` returns `{ online, sensors, _migrated: true }` from MongoDB
- [ ] Dashboard sensor cards update via polling (2s interval)
- [ ] Pump modal appears when START is clicked
- [ ] POST `/device/control` returns 410 deprecation notice
 

---

## 🔒 SECURITY CHECKLIST

- [ ] `authTokenHash` never appears in any API response (`select: false` on schema)
- [ ] `authToken` field in Device is plain — note: consider masking after first display
- [ ] All `/iot/*` routes protected by `auth` middleware
- [ ] JWT_SECRET is at least 32 random characters
- [ ] Mosquitto: production should use password auth or TLS
- [ ] Rate limiter: 200 req/15min globally (adjust down for production)
- [ ] CORS: restricted to known origins
- [ ] helmet() applied (sets secure HTTP headers)
- [ ] No Blynk tokens in environment variables (check `.env`)
- [ ] No Blynk imports in active execution paths

---

## 🚀 DEPLOYMENT READINESS

### Docker Compose (cropsensegit/docker-compose.yml)
- [ ] MongoDB service
- [ ] Mosquitto service  
- [ ] Backend service (`node index.js`)
- [ ] Frontend service (Vite build + serve, or nginx)
- [ ] Environment variables injected via `.env` or secrets

### Health Endpoints to add (optional but recommended):
- [ ] GET `/health` → `{ status: "ok", db: "connected", mqtt: "connected", uptime }`
- [ ] GET `/broker/status` (already exists via `brokerRoutes.js`)

### Final steps:
- [ ] `npm ci --production` in backend
- [ ] `npm run build` in frontend
- [ ] Serve frontend build via nginx or a static CDN
- [ ] Mosquitto running as a daemon
- [ ] Backend running via PM2 or systemd
- [ ] MongoDB with authentication enabled in production

---

## 📋 DASHBOARD.JSX — REMAINING WORK NOTE

`Dashboard.jsx` (the main dashboard at `/dashboard`) still uses:
- `API.post("/device/control", ...)` for pump control → **should migrate to `iotApi.sendCommand()`**
- `API.get("/device/live/${farmId}")` for sensor data → currently handled by the migrated `deviceController.getLiveData()` which reads from MongoDB ✅

**Recommended follow-up**: update `Dashboard.jsx` `handleFinalConfirm()` to call:
```js
await iotApi.sendCommand({ actuator: "pump", value: action ? 1 : 0, source: "manual" });
```
instead of the deprecated `API.post("/device/control", { pin: "v8", value: ... })`.
