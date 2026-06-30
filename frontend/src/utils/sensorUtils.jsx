// frontend/src/utils/sensorUtils.js
// =============================================================================
// Sensor value helpers
// =============================================================================

/**
 * Normalise any raw sensor reading into a 0-100% value for display.
 *
 * - null / undefined / NaN  -> null (no data)
 * - 0 <= value <= 100       -> rounded as-is (already a percentage —
 *                              this is the normal case for `waterLevel`,
 *                              which the backend already clamps to 0-100)
 * - value > 100             -> treated as a raw ADC/distance reading and
 *                              rescaled against `rawMax` (default 4095,
 *                              a typical 12-bit ADC ceiling)
 * - result is always clamped to [0, 100]
 *
 * @param {number|null|undefined} value
 * @param {Object} [opts]
 * @param {number} [opts.rawMax=4095]  Raw value that represents 100%
 * @returns {number|null}
 */
export function toPercentage(value, { rawMax = 4095 } = {}) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return null;
  }

  const num = Number(value);

  if (num >= 0 && num <= 100) {
    return Math.round(num);
  }

  const pct = (num / rawMax) * 100;
  return Math.round(Math.min(100, Math.max(0, pct)));
}

export default toPercentage;