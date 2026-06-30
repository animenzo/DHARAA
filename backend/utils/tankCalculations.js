function toPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function round(value, places = 2) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function calculateTankCapacityLiters(tankDetails = {}) {
  const dimensions = tankDetails.dimensions || {};
  const height = toPositiveNumber(dimensions.height);
  if (!height) return null;

  if (tankDetails.type === "rectangle") {
    const length = toPositiveNumber(dimensions.length);
    const width = toPositiveNumber(dimensions.width);
    if (!length || !width) return null;
    return round(length * width * height * 1000);
  }

  if (tankDetails.type === "circle") {
    const diameter = toPositiveNumber(dimensions.diameter);
    if (!diameter) return null;
    const radius = diameter / 2;
    return round(Math.PI * radius * radius * height * 1000);
  }

  return null;
}

function calculateTankReading(farm, sensorDistanceValue) {
  const sensorDistance = Number(sensorDistanceValue);
  if (!Number.isFinite(sensorDistance)) {
    return {
      sensorDistance: null,
      waterHeight: null,
      currentWaterLiters: null,
      waterLevelPercent: null,
    };
  }

  const details = farm?.tankDetails || {};
  const dimensions = details.dimensions || {};
  const tankHeight = toPositiveNumber(dimensions.height);
  const totalCapacityLiters =
    toPositiveNumber(farm?.totalCapacityLiters) ||
    calculateTankCapacityLiters(details);

  if (!tankHeight || !totalCapacityLiters) {
    return {
      sensorDistance,
      waterHeight: null,
      currentWaterLiters: null,
      waterLevelPercent: null,
    };
  }

  const waterHeight = Math.min(Math.max(tankHeight - sensorDistance, 0), tankHeight);
  const waterLevelPercent = (waterHeight / tankHeight) * 100;
  const currentWaterLiters = (totalCapacityLiters * waterLevelPercent) / 100;

  return {
    sensorDistance: round(sensorDistance, 3),
    waterHeight: round(waterHeight, 3),
    currentWaterLiters: round(currentWaterLiters),
    waterLevelPercent: round(waterLevelPercent, 1),
  };
}

module.exports = {
  calculateTankCapacityLiters,
  calculateTankReading,
};
