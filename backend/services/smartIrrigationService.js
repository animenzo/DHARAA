// backend/services/smartIrrigationService.js
const axios = require("axios");

const SMART_IRRIGATION_URL =
  process.env.SMART_IRRIGATION_URL || "http://127.0.0.1:8001";

const smartIrrigationClient = axios.create({
  baseURL: SMART_IRRIGATION_URL,
  timeout: 60000,
  headers: {
    "Content-Type": "application/json",
  },
});

function validateRecommendation(data) {
  const errors = [];
  if (data?.schemaVersion !== "1.0") errors.push("schemaVersion must be 1.0");
  if (!data?.prediction || typeof data.prediction !== "object") errors.push("prediction is required");
  for (const field of ["futureMoisture", "cropSchedule", "dayForecast", "hourlyForecast"]) {
    if (!Array.isArray(data?.prediction?.[field])) errors.push(`prediction.${field} must be an array`);
  }
  if (!data?.schedule || typeof data.schedule !== "object") errors.push("schedule is required");
  if (!(data?.waterRequirement === null || typeof data?.waterRequirement === "object")) {
    errors.push("waterRequirement must be an object or null");
  }
  if (!data?.recommendation || typeof data.recommendation !== "object") errors.push("recommendation is required");
  if (!data?.execution || typeof data.execution !== "object") errors.push("execution is required");
  if (errors.length) throw new Error(`Invalid smart irrigation response: ${errors.join("; ")}`);
  return data;
}

async function getIrrigationRecommendation(payload) {
  let response;
  try {
    console.log("\n" + "=".repeat(80));
    console.log("[Node → FastAPI] SMART-IRRIGATION REQUEST");
    console.log(JSON.stringify(payload, null, 2));
    response = await smartIrrigationClient.post(
      "/irrigation/recommendation",
      payload
    );
    console.log("[FastAPI → Node] SMART-IRRIGATION RESPONSE");
    console.log(JSON.stringify(response.data, null, 2));
    console.log("=".repeat(80) + "\n");
  } catch (error) {
    console.error("[Node ↔ FastAPI] REQUEST FAILED", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    if (error.response) {
      const detail =
        typeof error.response.data === "string"
          ? error.response.data
          : JSON.stringify(error.response.data);
      error.message = `Smart irrigation API ${error.response.status}: ${detail}`;
    }
    throw error;
  }

  return validateRecommendation(response.data);
}

async function generateCropSchedule(payload) {
  const response = await smartIrrigationClient.post(
    "/crop-schedule/generate",
    payload
  );

  return response.data;
}



module.exports = {
  getIrrigationRecommendation,
};
