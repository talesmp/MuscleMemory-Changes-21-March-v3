/**
 * @brief Calculates joint angle from three MediaPipe landmarks.
 * @param a Top joint (e.g., hip) - Must not be null.
 * @param b Middle joint (e.g., knee) - The vertex of the angle.
 * @param c Bottom joint (e.g., ankle) - Must not be null.
 * @return Angle in degrees between 0 and 180.
 */
export const calculateAngle = (
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): number => {
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180.0) {
    angle = 360 - angle;
  }
  return angle;
};

/**
 * @brief Calculates accuracy percentage based on target and deviation.
 * @param current Current angle.
 * @param target Target angle.
 * @param deviation Acceptable deviation.
 * @return Accuracy percentage (0-100).
 */
export const calculateAccuracy = (
  current: number,
  target: number,
  deviation: number,
): number => {
  const diff = Math.abs(current - target);
  if (diff <= deviation) return 100;
  // Linear drop-off up to 3x deviation
  const maxDiff = deviation * 3;
  if (diff >= maxDiff) return 0;
  return 100 - ((diff - deviation) / (maxDiff - deviation)) * 100;
};
