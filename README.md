# DHARAA

Dynamic Hydrological Agriculture Resource Allocation and Automation

DHARAA is a smart irrigation platform that combines a MERN-style web app, MQTT-based ESP32 telemetry, farm scheduling, real-time dashboards, and AI-assisted crop, disease, irrigation, fertilizer, and weather advice.

The current repository contains:

- `frontend/` - React 19 + Vite web application
- `backend/` - Express 5 API, MongoDB models, MQTT bridge, Socket.IO, schedule runner
- `ai-service/` - FastAPI microservice used by backend AI proxy routes
- `mosquitto/` - local Mosquitto broker configuration
- `arduino/` and `3.0_HiveMQ_Cloud.ino` - ESP32 firmware experiments/sketches
- `smart_irrigation2.1/` and `smart_irrigation3.1 integration/` - Python irrigation, weather, prediction, and simulation modules

## Architecture

```text
ESP32 sensors/relays
  -> MQTT broker: Mosquitto or HiveMQ
  -> backend/services/mqttService.js
  -> MongoDB: farms, devices, sensor readings, schedules, commands
  -> Socket.IO user room
  -> React IoT dashboard

React app
  -> Express REST API
  -> Express AI proxy routes
  -> FastAPI ai-service
```

Core data flow:

1. A user signs up through `/auth/signup`.
2. The user creates a farm through `/farms/farm`.
3. Farm creation provisions one ESP32 device for that farm, using the submitted `deviceId`.
4. The API returns the device topics and one-time auth token.
5. The ESP32 publishes JSON sensor data to MQTT topic `farm/{deviceId}/data`.
6. The backend validates `authToken`, stores the reading, checks thresholds, and emits live updates to the frontend.
7. Pump or valve commands are issued from the frontend through `/iot/:farmId/command`, published to MQTT, and tracked through command logs and ACK messages.

## Features

- User authentication with JWT and HTTP-only token cookie support
- Farm CRUD with crop, soil, location, tank, irrigation, and sowing metadata
- One device per farm, provisioned during farm creation
- MQTT telemetry ingestion with per-device auth token validation
- Sensor history, latest reading, 24-hour aggregation, daily averages, and analytics
- Pump and valve command lifecycle with retry, cancel, timeout, and ACK support
- Socket.IO real-time dashboard updates
- Device status, stale-device detection, LWT config, and broker health endpoint
- Irrigation schedules and a backend schedule runner
- Notifications from threshold checks
- AI chat, crop recommendation, disease detection, irrigation advice, fertilizer advice, and weather advice
- Optional standalone FastAPI AI service for ML/NVIDIA-backed inference
- Local Mosquitto broker configuration for development

## Tech Stack

| Layer | Main tools |
| --- | --- |
| Frontend | React 19, Vite 7, React Router 7, Tailwind CSS 4, TanStack Query, Recharts, Framer Motion, Socket.IO client |
| Backend | Node.js, Express 5, Mongoose 9, MongoDB, Socket.IO, MQTT.js, Helmet, express-rate-limit, Multer |
| AI service | FastAPI, Uvicorn, Pillow, NumPy, Pandas, scikit-learn, SHAP, TensorFlow, NVIDIA API integration |
| Broker | Eclipse Mosquitto 2, or HiveMQ Cloud from firmware experiments |
| Hardware | ESP32, DHT11, soil sensors, rain sensor, HC-SR04, relay-controlled pump/valve, LCD, optional SIM800 |

## Current Project Structure

```text
cropsensegit/
|-- README.md
|-- TESTING_CHECKLIST.md
|-- docker-compose.yml
|-- test-mqtt.js
|-- 3.0_HiveMQ_Cloud.ino
|-- arduino/
|   `-- 3.0.ino
|-- mosquitto/
|   |-- config/
|   |   `-- mosquitto.conf
|   `-- data/
|-- backend/
|   |-- index.js
|   |-- package.json
|   |-- config/
|   |   `-- mqtt.js
|   |-- controllers/
|   |   |-- aiController.js
|   |   |-- analyticsController.js
|   |   |-- authController.js
|   |   |-- cropController.js
|   |   |-- diseaseController.js
|   |   |-- farmController.js
|   |   |-- fertilizerController.js
|   |   |-- irrigationController.js
|   |   |-- iotController.js
|   |   |-- scheduleController.js
|   |   `-- weatherController.js
|   |-- middleware/
|   |   |-- auth.js
|   |   |-- deviceAuth.js
|   |   `-- rateLimit.js
|   |-- models/
|   |   |-- CommandLog.js
|   |   |-- CropFinalDataset.js
|   |   |-- CropSchedule.js
|   |   |-- DayForecast.js
|   |   |-- Device.js
|   |   |-- DeviceLog.js
|   |   |-- Farm.js
|   |   |-- FutureMoisturePrediction.js
|   |   |-- FuturePredction.js
|   |   |-- HourlyWeatherForecast.js
|   |   |-- Notification.js
|   |   |-- PinConfig.js
|   |   |-- Schedule.js
|   |   |-- SensorData.js
|   |   |-- SoilDataset.js
|   |   |-- Template.js
|   |   |-- TodayState.js
|   |   `-- User.js
|   |-- routes/
|   |   |-- aiChatRoutes.js
|   |   |-- authRoutes.js
|   |   |-- brokerRoutes.js
|   |   |-- cropRoutes.js
|   |   |-- diseaseRoutes.js
|   |   |-- farmRoutes.js
|   |   |-- fertilizerRoutes.js
|   |   |-- irrigationRoutes.js
|   |   |-- iotRoutes.js
|   |   |-- scheduleRoutes.js
|   |   `-- weatherRoutes.js
|   |-- services/
|   |   |-- aiService.js
|   |   |-- commandService.js
|   |   |-- deviceCacheService.js
|   |   |-- deviceMonitor.js
|   |   |-- deviceStatusService.js
|   |   |-- mqttService.js
|   |   |-- payloadValidator.js
|   |   |-- provisioningService.js
|   |   |-- scheduleRunner.js
|   |   |-- socketService.js
|   |   |-- thresholdService.js
|   |   `-- ai/
|   |       `-- predictionService.js
|   `-- utils/
|-- frontend/
|   |-- index.html
|   |-- package.json
|   |-- vite.config.js
|   |-- public/
|   |   |-- favicon files, PWA icons, logo.svg
|   |   `-- scroll/
|   |-- src/
|   |   |-- App.jsx
|   |   |-- main.jsx
|   |   |-- components/
|   |   |   |-- iot/
|   |   |   |-- dashboard/
|   |   |   |-- forms/
|   |   |   |-- home/
|   |   |   `-- schedules/
|   |   |-- context/
|   |   |   |-- AuthContext.jsx
|   |   |   `-- SocketContext.jsx
|   |   |-- hooks/
|   |   |-- pages/
|   |   |   |-- AgriInfo.jsx
|   |   |   |-- AICropAdvisor.jsx
|   |   |   |-- FarmList.jsx
|   |   |   |-- Home.jsx
|   |   |   |-- IoTDashboard.jsx
|   |   |   |-- ScheduleList.jsx
|   |   |   |-- UserProfile.jsx
|   |   |   `-- WeatherPage.jsx
|   |   |-- routes/
|   |   |-- services/
|   |   `-- utils/
|-- ai-service/
|   |-- main.py
|   |-- requirements.txt
|   |-- routers/
|   |-- services/
|   `-- train/
|-- smart_irrigation2.1/
`-- smart_irrigation3.1 integration/
```

Generated archives such as `backend.zip`, `frontend.zip`, and `ai-service.zip` are snapshots and are not needed for normal development.

## Prerequisites

- Node.js 18 or newer
- npm
- Python 3.10 or newer for `ai-service`
- MongoDB Atlas or local MongoDB
- Mosquitto 2.x, or Docker for the bundled Mosquitto service
- Arduino IDE or PlatformIO for ESP32 firmware work

## Environment Variables

### Backend: `backend/.env`

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/cropsense
JWT_SECRET=replace-with-a-long-random-secret
CLIENT_URL=http://localhost:5173

MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_CLIENT_ID=cropsense_backend_server
MQTT_USERNAME=
MQTT_PASSWORD=
MQTT_OFFLINE_THRESHOLD_MINUTES=5
CMD_ACK_TIMEOUT_MS=10000

FASTAPI_URL=http://localhost:8000
RESEND_API_KEY=
```

### Frontend: `frontend/.env`

```env
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000

# Optional keys used by AgriInfo.jsx
VITE_NEWSDATA_API_KEY=
VITE_GNEWS_API_KEY=
VITE_DATAGOV_API_KEY=
VITE_YOUTUBE_API_KEY=
```

### AI service: `ai-service/.env`

```env
ALLOWED_ORIGINS=http://localhost:5000,http://localhost:5173
NVIDIA_API_KEY=
```

## Local Development

### 1. Start Mosquitto

With Docker:

```bash
docker compose up -d mosquitto
docker compose logs -f mosquitto
```

Or run Mosquitto directly from the repository root:

```bash
mosquitto -v -c mosquitto/config/mosquitto.conf
```

The local broker exposes:

- MQTT on `1883`
- MQTT over WebSockets on `9001`

The development config allows anonymous clients.

### 2. Start the backend

```bash
cd backend
npm install
npm start
```

Expected service behavior:

- Connects to MongoDB using `MONGO_URI`
- Starts Express + Socket.IO on `PORT` (`5000` by default)
- Connects to the MQTT broker from `MQTT_BROKER_URL`
- Subscribes to `farm/+/#`
- Starts the schedule runner

### 3. Start the AI service

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend calls this service through `FASTAPI_URL`.

### 4. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## Frontend Routes

Public routes:

| Route | Page |
| --- | --- |
| `/home` | Landing page |
| `/login` | Login/signup UI |
| `/howitworks` | How-it-works page |
| `/agriinfo` | Agriculture information page |

Protected routes:

| Route | Page |
| --- | --- |
| `/iot` | Main IoT dashboard |
| `/farms` | Farm list |
| `/farms/new` | Create farm and provision device |
| `/farms/:id/edit` | Edit farm |
| `/schedules` | Schedule list |
| `/schedules/new` | Create schedule |
| `/schedules/:id/edit` | Edit schedule |
| `/profile` | User profile and device connection details |
| `/weather` | Weather page |
| `/ai-advisor` | AI crop advisor |

Root `/` redirects authenticated users to `/iot` and unauthenticated users to `/home`.

## API Reference

Protected routes require:

```http
Authorization: Bearer <jwt>
```

### Authentication

Mounted at `/auth`.

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/auth/signup` | No | Create a user account |
| `POST` | `/auth/login` | No | Login and return JWT |
| `POST` | `/auth/forgot-password` | No | Send reset link using configured email service |
| `POST` | `/auth/reset-password/:token` | No | Reset password |
| `GET` | `/auth/profile` | Yes | Get current user profile |

### Farms

Mounted at `/farms`.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/farms/crops` | Get crop dataset values for dropdowns |
| `GET` | `/farms/soils` | Get soil dataset values for dropdowns |
| `GET` | `/farms/farm` | List current user's farms |
| `POST` | `/farms/farm` | Create farm and provision one ESP32 device |
| `GET` | `/farms/farm/:id` | Get one farm |
| `PATCH` | `/farms/farm/:id` | Update farm |
| `DELETE` | `/farms/farm/:id` | Delete farm and linked device |

Farm creation requires a `deviceId`. The server creates a `Device`, `Template`, MQTT topics, and one-time plain auth token.

### Schedules

Mounted at `/schedules`.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/schedules/schedule` | List schedules |
| `POST` | `/schedules/schedule` | Create schedule |
| `PATCH` | `/schedules/schedule/:id` | Update schedule |
| `DELETE` | `/schedules/schedule/:id` | Delete schedule |

### IoT

Mounted at `/iot`.

Most IoT routes are farm-scoped because each farm has a linked device.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/iot/:farmId/device` | Get device linked to farm |
| `PATCH` | `/iot/:farmId/device` | Update device name/notes |

| `GET` | `/iot/:farmId/device/connection-info` | Get broker host, port, topics, and Arduino snippet |
| `GET` | `/iot/device/status` | Get online/offline/stale status |
| `GET` | `/iot/device/lwt-config` | Get LWT config |
| `GET` | `/iot/:farmId/sensor/latest` | Latest reading |
| `GET` | `/iot/:farmId/sensor/history` | Raw readings with `from`, `to`, and `limit` filters |
| `GET` | `/iot/:farmId/sensor/last24h` | Last 24 hours aggregated |
| `GET` | `/iot/:farmId/sensor/daily-averages` | Daily averages with `days` filter |
| `POST` | `/iot/:farmId/command` | Send pump or valve command |
| `GET` | `/iot/:farmId/command/history` | Command history |
| `GET` | `/iot/command/:id/status` | Command status |
| `POST` | `/iot/command/:id/retry` | Retry command |
| `POST` | `/iot/command/:id/cancel` | Cancel command |
| `GET` | `/iot/notifications` | List notifications |
| `PATCH` | `/iot/notifications/read-all` | Mark all notifications read |
| `PATCH` | `/iot/notifications/:id/read` | Mark one notification read |
| `GET` | `/iot/:farmId/analytics/moisture` | Moisture analytics |
| `GET` | `/iot/:farmId/analytics/temperature` | Temperature analytics |
| `GET` | `/iot/:farmId/analytics/pump-usage` | Pump usage analytics |

### Broker Health

Mounted at `/iot/broker`.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/iot/broker/status` | MQTT connection, Socket.IO clients, cache stats, uptime, memory |

### AI Proxy Routes

Mounted by the Express backend and protected by JWT.

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/ai/chat` | Multilingual AI chat |
| `POST` | `/api/ai/crop/predict` | Advanced crop prediction |
| `POST` | `/api/ai/crop/easy-predict` | Farmer-friendly crop recommendation |
| `POST` | `/api/ai/disease/predict` | Plant disease image upload, `multipart/form-data` field `file` |
| `POST` | `/api/ai/irrigation/advise` | Farm-specific irrigation advice |
| `POST` | `/api/ai/fertilizer/advise` | Fertilizer advice |
| `POST` | `/api/ai/weather/advise` | Weather-based farm advice |

### FastAPI AI Service

The standalone service in `ai-service/` exposes routes under `/api` and is called by the Express backend through `backend/services/aiService.js`.

Health endpoints:

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/` | Service info |
| `GET` | `/health` | Health check |

## MQTT Protocol

The current backend MQTT config uses device-id-only topics:

```text
farm/{deviceId}/data
farm/{deviceId}/status
farm/{deviceId}/cmd
farm/{deviceId}/cmd/ack
farm/{deviceId}/config
```

The backend subscribes to:

```text
farm/+/#
```

### Sensor Data Payload

Published by ESP32 to `farm/{deviceId}/data`.

```json
{
  "authToken": "plain-device-token",
  "moisture": 72,
  "temperature": 26.5,
  "humidity": 68,
  "rain": 0,
  "waterLevel": 85,
  "pump": 0,
  "valve": 0,
  "rssi": -58,
  "ts": 1718000000000,
  "fw": "1.0.0"
}
```

Known fields are clamped and sanitized by `backend/services/payloadValidator.js`. Unknown numeric fields are stored in `extra`; unknown non-numeric fields are dropped.

### Status Payload

Published by ESP32 to `farm/{deviceId}/status`.

```json
{
  "status": "online",
  "authToken": "plain-device-token"
}
```

Mosquitto LWT/offline payload:

```json
{
  "status": "offline"
}
```

### Command Payload

Published by backend to `farm/{deviceId}/cmd`.

```json
{
  "cmdId": "generated-command-id",
  "actuator": "pump",
  "value": 1,
  "ts": 1718000000000
}
```

The command service may also publish actuator-specific keys depending on command construction. The ESP32 must execute the command and ACK the same `cmdId`.

### Command ACK Payload

Published by ESP32 to `farm/{deviceId}/cmd/ack`.

```json
{
  "cmdId": "generated-command-id",
  "ok": true
}
```

## Socket.IO Events

The frontend creates a Socket.IO connection after authentication and emits:

```js
socket.emit("join", { userId: user._id });
```

The backend sends events to that user's room. Important server-to-client events include:

| Event | Purpose |
| --- | --- |
| `sensorData` | New validated MQTT sensor reading |
| `deviceStatus` | Device online/offline/stale update |
| `commandAck` | Command acknowledged by ESP32 |
| `commandTimeout` | Command exceeded ACK timeout |
| `commandCancelled` | Pending command cancelled |

## ESP32 Notes

The repository currently has two visible firmware sketches:

- `arduino/3.0.ino` - older Blynk-oriented irrigation firmware
- `3.0_HiveMQ_Cloud.ino` - HiveMQ Cloud MQTT experiment using `WiFiClientSecure` and `PubSubClient`

The backend's current local MQTT bridge expects the topic format `farm/{deviceId}/...` and JSON payloads with `authToken`. If you use the HiveMQ sketch, align the topic names and payload schema with the MQTT protocol above, or change `backend/config/mqtt.js` to match your broker/topic design.

Important hardware pins used in the sketches:

| GPIO | Purpose |
| --- | --- |
| 32 | HC-SR04 trigger |
| 33 | HC-SR04 echo |
| 34 | Soil sensor 1 |
| 35 | Soil sensor 2 |
| 25 | Rain sensor |
| 4 | DHT11 |
| 18 | Valve 1 relay |
| 19 | Valve 2 relay |
| 23 | Pump relay |
| 13 | Physical push button |
| 17/16 | SIM800 UART |

## Python Irrigation Modules

`smart_irrigation2.1/` and `smart_irrigation3.1 integration/` contain local research/prototype modules for:

- evapotranspiration and crop ET calculations
- soil water balance
- irrigation logic
- crop schedule generation
- water prediction
- weather model exports
- simulation/test runs
- dataset files such as `crop_final_data.csv` and `soildataset.csv`

These folders are not required to start the React/Express/MQTT application, but they are part of the irrigation intelligence experiments in the repository.

## Useful Commands

```bash
# Backend
cd backend
npm start

# Frontend
cd frontend
npm run dev
npm run build
npm run lint

# AI service
cd ai-service
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Mosquitto with Docker
docker compose up -d mosquitto
docker compose logs -f mosquitto

# Mosquitto directly
mosquitto -v -c mosquitto/config/mosquitto.conf
```

## Development Notes

- `backend/.env`, `frontend/.env`, and `ai-service/.env` exist locally and should not be committed with secrets.
- The frontend API client uses `http://localhost:5000` automatically on localhost; deployed builds use `VITE_API_URL`.
- `frontend/src/services/api.js` contains a refresh-token retry path for `/auth/refresh`, but the current backend route list does not define `/auth/refresh`.
- `frontend/src/services/api.js` has pin-management helper methods under `/device/...`, but `deviceRoutes` is currently commented out in `backend/index.js`.
- `frontend/src/services/api.js` uses `PUT` for `updateSchedule`, while the backend route currently defines `PATCH /schedules/schedule/:id`.
- `backend/routes/iotRoutes.js` mounts `/iot/device/status` and `/iot/device/lwt-config` without `:farmId`, while `iotController` currently resolves devices through `req.params.farmId`.
- The backend stores both `authToken` and `authTokenHash` on `Device`; `authTokenHash` is excluded from normal query results.
- Local Mosquitto config allows anonymous connections. Use usernames/passwords or TLS for production.

## Deployment

Frontend can be built with:

```bash
cd frontend
npm run build
```

Backend can run with:

```bash
cd backend
npm install --omit=dev
npm start
```

Mosquitto can be run from `docker-compose.yml`. The current compose file defines the broker service; backend containerization is present as commented guidance only.

For production, configure:

- HTTPS for frontend/backend
- MongoDB Atlas or managed MongoDB
- MQTT credentials and ideally TLS on port `8883`
- `FASTAPI_URL` pointing to the deployed AI service
- restricted CORS origins in both Express and FastAPI
- real API keys for optional external AI/news/weather integrations

## License

No license file is currently present in this repository. Add one before distributing or accepting external contributions.
