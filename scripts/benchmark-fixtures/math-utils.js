/**
 * Math utilities with edge cases that naive tests miss.
 */

function clamp(value, min, max) {
  if (min > max) throw new RangeError('min must be <= max');
  return Math.min(Math.max(value, min), max);
}

function lerp(a, b, t) {
  if (t < 0 || t > 1) throw new RangeError('t must be in [0, 1]');
  return a + (b - a) * t;
}

function movingAverage(values, windowSize) {
  if (!Array.isArray(values) || values.length === 0) return [];
  if (windowSize < 1) throw new RangeError('windowSize must be >= 1');
  const result = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const window = values.slice(start, i + 1);
    result.push(window.reduce((sum, v) => sum + v, 0) / window.length);
  }
  return result;
}

module.exports = { clamp, lerp, movingAverage };
