export const HOURS_24 = Array.from(
  { length: 24 },
  (_, i) => `${i.toString().padStart(2, "0")}:00`,
);

export const HOUR_HEIGHT = 120;
export const INITIAL_SCROLL_OFFSET = 9 * HOUR_HEIGHT; // Puedes ajustar esto si quieres

export function getEventHeight(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);

  const startTotal = startHour * 60 + (startMin || 0);
  const endTotal = endHour * 60 + (endMin || 0);
  const duration = endTotal - startTotal;

  if (duration < 60) {
    return Math.max(24, Math.round((duration / 60) * HOUR_HEIGHT));
  }

  return Math.max(40, Math.round((duration / 60) * HOUR_HEIGHT));
}

export function getEventTop(
  startTime: string,
  startHourOfDay: number = 0,
): number {
  const [hour, minute] = startTime.split(":").map(Number);
  const totalMinutes = (hour - startHourOfDay) * 60 + (minute || 0);
  const offset = totalMinutes * (HOUR_HEIGHT / 60);

  return Math.round(offset);
}

export function getCurrentTimePosition(
  date: Date = new Date(),
  startHourOfDay: number = 0,
): number {
  const hour = date.getHours();
  const minute = date.getMinutes();
  const totalMinutes = (hour - startHourOfDay) * 60 + minute;
  const offset = totalMinutes * (HOUR_HEIGHT / 60);

  return Math.max(0, Math.round(offset));
}

export function getEventDuration(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);
  const startTotal = startHour * 60 + (startMin || 0);
  const endTotal = endHour * 60 + (endMin || 0);

  return endTotal - startTotal;
}
