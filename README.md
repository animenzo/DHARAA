# DHARAA

Dynamic Hydrological Agriculture Resource Allocation and Automation

DHARAA is a smart agriculture platform for monitoring farms, managing irrigation hardware, and generating AI-assisted crop advice. The project combines a React dashboard, an Express/MongoDB backend, MQTT communication with ESP32 devices, a FastAPI AI service, and Python smart-irrigation research modules.

The application is designed around a practical farm workflow: a user creates a farm, links an IoT device, receives live sensor readings, controls pump/valve actuators, manages irrigation schedules, and uses AI services for crop, disease, fertilizer, weather, and smart-irrigation recommendations.

## Current Project Structure

```text
cropsensegit/
|-- README.md
|-- .gitattributes
|-- arduino/
|   `-- 3.0_HiveMQ_Cloud.ino
|-- backend/
|   |-- index.js
|   |-- package.json
|   |-- config/
|   |   `-- mqtt.js
|   |-- controllers/
|   |-- middleware/
|   |-- models/
|   |-- routes/
|   |-- services/
|   `-- utils/
|-- frontend/
|   |-- index.html
|   |-- package.json
|   |-- vite.config.js
|   |-- public/
|   `-- src/
|       |-- components/
|       |-- context/
|       |-- hooks/
|       |-- pages/
|       |-- routes/
|       |-- services/
|       `-- utils/
|-- ai-cropdisease/
|   |-- main.py
|   |-- requirements.txt
|   |-- Dockerfile
|   |-- models/
|   |-- routers/
|   |-- services/
|   `-- train/
`-- smart_irrigation4.1/
    |-- main.py
    |-- api.py
    |-- requirements.txt
    |-- Irrigation_Schedular/
    |-- Moisture_Prediction_Dataset/
    |-- Water_Model/
    |-- data_set/
    |-- soil_pred/
    |-- weather_model/
    `-- wethermodel3/
```

## Main Modules

| Folder | Purpose |
| --- | --- |
| `frontend/` | React 19 + Vite web app for dashboards, farm management, schedules, weather, AI advisor, and IoT control. |
| `backend/` | Express 5 API with MongoDB models, authentication, MQTT bridge, Socket.IO real-time updates, schedule runner, and irrigation execution services. |
| `ai-cropdisease/` | FastAPI AI microservice for chat, crop recommendation, plant disease prediction, fertilizer advice, irrigation advice, and weather advice. |
| `smart_irrigation4.1/` | Python research/prototype layer for weather forecasting, soil moisture prediction, water-use estimation, irrigation scheduling, and simulation. |
| `arduino/` | ESP32 firmware sketch for MQTT-based sensor and actuator integration. |

## Features

- JWT-based user authentication.
- Farm CRUD with crop, soil, location, farm dimensions, tank details, and irrigation metadata.
- ESP32 device provisioning per farm.
- MQTT telemetry ingestion using `farm/{deviceId}/...` topics.
- Live sensor dashboard using Socket.IO.
- Sensor history, latest reading, 24-hour aggregation, daily averages, and analytics.
- Pump and valve command lifecycle with command logs, retry, cancel, timeout, and acknowledgement handling.
- Device status monitoring, stale-device detection, LWT configuration, and broker status endpoint.
- Manual irrigation schedules and backend schedule runner.
- AI mode support on farms/devices.
- Smart-irrigation recommendation and execution tracking.
- Plant disease image prediction through FastAPI and TensorFlow model files.
- Crop recommendation using trained model assets.
- Multilingual AI chat and farm advisory proxy routes.
- Weather, fertilizer, crop, irrigation, and disease-focused advisory endpoints.
- PWA-ready frontend assets.

## Tech Stack

| Layer | Tools |
| --- | --- |
| Frontend | React 19, Vite 7, React Router 7, Tailwind CSS 4, TanStack Query, Recharts, Framer Motion, Axios, Socket.IO client |
| Backend | Node.js, Express 5, MongoDB, Mongoose 9, Socket.IO, MQTT.js, Helmet, express-rate-limit, Multer, node-cron |
| AI service | FastAPI, Uvicorn, TensorFlow, scikit-learn, SHAP, Pandas, NumPy, Pillow, OpenAI SDK |
| Smart irrigation research | Python, Torch, NumPy, Pandas, Matplotlib, FastAPI |
| Hardware | ESP32, MQTT broker, soil moisture sensors, DHT sensor, rain sensor, ultrasonic water-level sensor, relay-based pump/valve control |

## How The Project Works

1. The user signs up or logs in from the React frontend.
2. The frontend sends authenticated requests to the Express backend.
3. The user creates a farm with crop, soil, location, size, and tank details.
4. The backend stores farm data in MongoDB and provisions or links an IoT device.
5. The ESP32 publishes sensor readings to MQTT topics such as `farm/{deviceId}/data`.
6. `backend/services/mqttService.js` receives MQTT messages, validates payloads, stores readings in MongoDB, updates device status, checks thresholds, and emits live Socket.IO events.
7. The IoT dashboard receives real-time updates and displays current field conditions.
8. When the user sends a pump or valve command, the backend stores a command log and publishes the command to `farm/{deviceId}/cmd`.
9. The ESP32 executes the command and publishes an acknowledgement to `farm/{deviceId}/cmd/ack`.
10. Schedule and irrigation services run in the backend to support timed irrigation and smart execution tracking.
11. AI-related backend routes proxy requests to the FastAPI service in `ai-cropdisease/`.
12. The Python smart-irrigation modules provide supporting models and algorithms for future moisture prediction, water requirement calculation, and irrigation planning.

## Architecture

```text
ESP32 sensors and relays
        |
        v
MQTT broker
        |
        v
Express backend
  - REST API
  - MQTT bridge
  - Socket.IO server
  - schedule runner
  - irrigation execution manager
        |
        +--> MongoDB
        |
        +--> FastAPI AI service
        |
        v
React frontend dashboard
```

## Prerequisites

- Node.js 18 or newer.
- npm.
- Python 3.10 or newer.
- MongoDB local instance or MongoDB Atlas URI.
- MQTT broker such as Mosquitto, HiveMQ Cloud, or another MQTT-compatible broker.
- Arduino IDE or PlatformIO for ESP32 firmware changes.

## Environment Variables

Create `backend/.env`:

```env
PORT=5000
MONGO_URI=
JWT_SECRET=replace-with-a-strong-secret
CLIENT_URL=http://localhost:5173

MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_CLIENT_ID=backend_server
MQTT_USERNAME=
MQTT_PASSWORD=
MQTT_OFFLINE_THRESHOLD_MINUTES=5
CMD_ACK_TIMEOUT_MS=10000

FASTAPI_URL=http://localhost:8000
RESEND_API_KEY=
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000

VITE_NEWSDATA_API_KEY=
VITE_GNEWS_API_KEY=
VITE_DATAGOV_API_KEY=
VITE_YOUTUBE_API_KEY=
```

Create `ai-cropdisease/.env`:

```env
ALLOWED_ORIGINS=http://localhost:5000,http://localhost:5173
OPENAI_API_KEY=
```

## Installation And Local Setup

### 1. Start MongoDB

Use a local MongoDB server or set `MONGO_URI` to a MongoDB Atlas connection string.

### 2. Start an MQTT broker

For local development, Mosquitto is a common choice:

```bash
mosquitto -v -p 1883
```

If you use HiveMQ Cloud or another hosted broker, update `MQTT_BROKER_URL`, `MQTT_USERNAME`, and `MQTT_PASSWORD` in `backend/.env`.

### 3. Install and start the backend

```bash
cd backend
npm install
npm start
```

The backend starts:

- Express API on `http://localhost:5000`.
- Socket.IO server on the same HTTP server.
- MongoDB connection.
- MQTT service after MongoDB connects.
- schedule runner.
- irrigation execution manager.
- daily DHARAA generation manager.

### 4. Install and start the FastAPI AI service

```bash
cd ai-cropdisease
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Health checks:

```text
http://localhost:8000/
http://localhost:8000/health
```

### 5. Install and start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

### 6. Flash/configure ESP32 firmware

Use the sketch in `arduino/3.0_HiveMQ_Cloud.ino` as the starting point. Configure:

- Wi-Fi SSID and password.
- MQTT broker host, port, username, and password.
- device ID matching the farm/device record.
- topic names compatible with `farm/{deviceId}/...`.
- device auth token returned by the backend provisioning flow.

## Frontend Routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Public | Redirects authenticated users to `/iot`, otherwise to `/home`. |
| `/home` | Public | Home page. |
| `/login` | Public | Login/signup UI. |
| `/howitworks` | Public | Project explanation page. |
| `/agriinfo` | Public | Agriculture information page. |
| `/dashboard` | Protected | Redirects to `/iot`. |
| `/iot` | Protected | Main IoT dashboard. |
| `/farms` | Protected | Farm list. |
| `/farms/new` | Protected | Create farm. |
| `/farms/:id/edit` | Protected | Edit farm. |
| `/schedules` | Protected | Irrigation schedule list. |
| `/schedules/new` | Protected | Create schedule. |
| `/schedules/:id/edit` | Protected | Edit schedule. |
| `/profile` | Protected | User profile. |
| `/weather` | Protected | Weather page. |
| `/ai-advisor` | Protected | AI crop advisor. |

## Backend API Overview

Protected routes require a JWT using the `Authorization: Bearer <token>` header, and some flows may also use cookies depending on the frontend request.

| Mount | Purpose |
| --- | --- |
| `/auth` | Signup, login, forgot password, reset password, profile. |
| `/farms` | Farm CRUD, crop list, soil list. |
| `/schedules` | Irrigation schedule CRUD. |
| `/iot` | Devices, sensor data, commands, notifications, analytics, AI mode. |
| `/iot/broker` | MQTT/broker status. |
| `/api/ai/chat` | AI chat proxy. |
| `/api/ai/crop` | Crop recommendation proxy. |
| `/api/ai/disease` | Plant disease prediction proxy. |
| `/api/ai/irrigation` | Irrigation advice proxy. |
| `/api/ai/smart-irrigation` | Smart-irrigation recommendation and execution routes. |
| `/api/ai/fertilizer` | Fertilizer advice proxy. |
| `/api/ai/weather` | Weather advice proxy. |

Important IoT endpoints:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/iot/:farmId/device` | Get farm device. |
| `PATCH` | `/iot/:farmId/device` | Update device metadata. |
| `GET` | `/iot/:farmId/device/connection-info` | Get MQTT connection details. |
| `GET` | `/iot/:farmId/device/status` | Get device status. |
| `GET` | `/iot/:farmId/sensor/latest` | Latest sensor reading. |
| `GET` | `/iot/:farmId/sensor/history` | Sensor history. |
| `GET` | `/iot/:farmId/sensor/last24h` | 24-hour aggregation. |
| `GET` | `/iot/:farmId/sensor/daily-averages` | Daily averages. |
| `POST` | `/iot/:farmId/command` | Send pump/valve command. |
| `GET` | `/iot/:farmId/command/history` | Command history. |
| `GET` | `/iot/command/:id/status` | Command status. |
| `POST` | `/iot/command/:id/retry` | Retry command. |
| `POST` | `/iot/command/:id/cancel` | Cancel command. |
| `GET` | `/iot/notifications` | Notifications. |
| `PATCH` | `/iot/:farmId/ai-mode` | Update AI mode. |

Smart-irrigation endpoints:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/ai/smart-irrigation/recommendation` | Generate recommendation for a farm. |
| `GET` | `/api/ai/smart-irrigation/executions` | List irrigation executions. |
| `GET` | `/api/ai/smart-irrigation/result/:farmId` | Get stored smart-irrigation result. |
| `POST` | `/api/ai/smart-irrigation/executions/:executionId/stop` | Manually stop an execution. |

## MQTT Protocol

The backend MQTT config is in `backend/config/mqtt.js`.

Topic pattern:

```text
farm/{deviceId}/{subtopic}
```

Common topics:

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

Example sensor payload:

```json
{
  "authToken": "device-token",
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

Example command payload from backend to device:

```json
{
  "cmdId": "generated-command-id",
  "actuator": "pump",
  "value": 1,
  "ts": 1718000000000
}
```

Example acknowledgement from device:

```json
{
  "cmdId": "generated-command-id",
  "ok": true
}
```

## AI Service

`ai-cropdisease/` is a FastAPI service mounted by the backend through `FASTAPI_URL`.

Available service groups:

- `/api/chat`
- `/api/crop/predict`
- `/api/crop/easy-predict`
- `/api/disease/predict`
- `/api/irrigation/advise`
- `/api/fertilizer/advise`
- `/api/weather/advise`

Model files are stored under `ai-cropdisease/models/`, including plant disease and crop recommendation assets. Training scripts are available under `ai-cropdisease/train/`.

## Smart Irrigation Research Module

`smart_irrigation4.1/` contains Python modules and datasets for:

- crop schedule generation.
- future soil moisture prediction.
- evapotranspiration and soil balance calculations.
- water-use estimation.
- weather forecast exports.
- irrigation date/time scheduling.
- simulation and test runs.

This folder is useful for experimentation and model development. The main React/Express app can run without manually starting these scripts, but backend smart-irrigation services use the same concepts and persisted model outputs.

## Advantages

- Combines real-time IoT monitoring and AI advice in one workflow.
- Supports both manual and scheduled irrigation control.
- MQTT makes the hardware layer lightweight and suitable for unstable networks.
- Socket.IO gives immediate dashboard updates without page refreshes.
- Farm-specific data improves the usefulness of recommendations.
- Separate FastAPI AI service keeps ML dependencies out of the Node.js backend.
- Modular folders make frontend, backend, AI, firmware, and research code easier to work on independently.
- MongoDB persistence allows history, analytics, command logs, and device status tracking.

## Limitations

- Recommendations depend on sensor quality, calibration, and correct farm metadata.


## Useful Commands

```bash
# Backend
cd backend
npm install
npm start

# Frontend
cd frontend
npm install
npm run dev
npm run build
npm run lint

# AI service
cd ai-cropdisease
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Smart irrigation research module
cd smart_irrigation4.1
pip install -r requirements.txt
python main.py
```

## Deployment Notes

For production:

- Use HTTPS for frontend and backend.
- Use MongoDB Atlas or another managed MongoDB deployment.
- Use MQTT credentials and TLS where possible.
- Set strong `JWT_SECRET`.
- Restrict CORS origins in backend and FastAPI.
- Store `.env` values in the hosting provider's secret manager.
- Deploy `frontend/` as a Vite static build.
- Deploy `backend/` as a long-running Node.js service.
- Deploy `ai-cropdisease/` as a Python/FastAPI service with enough memory for ML models.
- Keep ESP32 firmware broker settings synchronized with deployed MQTT settings.

## License

No license file is currently present. Add a license before public distribution or accepting external contributions.
