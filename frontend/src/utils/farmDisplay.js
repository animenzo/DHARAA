export function getCropLabel(crop, fallback = "Mixed Crop") {
  if (!crop) return fallback;
  if (typeof crop === "string") return crop;
  return crop.Crop || crop.name || crop._id || fallback;
}

export function getSoilLabel(soil, fallback = "Not specified") {
  if (!soil) return fallback;
  if (typeof soil === "string") return soil;
  return soil["Soil type"] || soil.name || soil._id || fallback;
}

export function getFarmAreaAcres(farm) {
  const dimensions = farm?.farmDimensions || {};
  let areaM2 = 0;

  if (farm?.farmShape === "rectangle") {
    areaM2 = Number(dimensions.length) * Number(dimensions.width);
  } else if (farm?.farmShape === "circle") {
    const radius = Number(dimensions.diameter) / 2;
    areaM2 = Math.PI * radius * radius;
  }

  if (!Number.isFinite(areaM2) || areaM2 <= 0) {
    return Number(farm?.size_acres) || 0;
  }

  return areaM2 / 4046.8564224;
}

export function formatFarmAreaAcres(farm) {
  const acres = getFarmAreaAcres(farm);
  if (!acres) return "0";
  return acres < 1 ? acres.toFixed(2) : acres.toFixed(1);
}
