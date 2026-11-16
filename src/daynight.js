// daynight.js — the clock (06:00–22:00 per day, 7 days) and the sun/sky that follows it.
import { DAY_START_MIN, DAY_END_MIN, TOTAL_DAYS, fmtClock } from './data.js';

// One game minute passes every 0.25 real seconds: a day lasts about 4 minutes of play.
const MIN_PER_SEC = 4;

export function createClock() {
  return { day: 1, minutes: DAY_START_MIN };
}

export function updateClock(clock, dt) {
  clock.minutes += MIN_PER_SEC * dt;
  return clock.minutes >= DAY_END_MIN;
}

export function endDay(clock) {
  clock.day += 1;
  clock.minutes = DAY_START_MIN;
  return clock.day > TOTAL_DAYS;
}

export function clockText(clock) { return `Hari ${clock.day}/${TOTAL_DAYS} · ${fmtClock(clock.minutes)}`; }

/** 0.25 = deep night … 1 = bright midday. */
export function daylight(minutes) {
  if (minutes < 6 * 60 || minutes >= 20 * 60) return 0.25;
  if (minutes < 8 * 60) return 0.25 + ((minutes - 360) / 120) * 0.65;
  if (minutes < 17 * 60) return 0.9;
  if (minutes < 19 * 60) return 0.9 - ((minutes - 1020) / 120) * 0.55;
  return 0.35;
}

/** Move the sun, dim the lights, tint the sky — sunset turns Membuku orange. */
export function applyDayNight(lights, minutes) {
  const d = daylight(minutes);
  const sunset = minutes >= 17 * 60 && minutes < 19 * 60;
  const night = minutes >= 19 * 60 || minutes < 7 * 60;
  const dayFrac = (minutes - DAY_START_MIN) / (DAY_END_MIN - DAY_START_MIN);
  const ang = Math.PI * (0.15 + dayFrac * 0.7);
  lights.sun.position.set(Math.cos(ang) * 120, Math.sin(ang) * 120 + 10, 40);
  // Night is REALLY dark now: the sun is below the horizon (almost no
  // direct light), the hemisphere is a faint blue, and only the moon gives
  // a dim glow — village lamps, the torch and the flashlight matter.
  lights.sun.intensity = night ? 0.05 : 0.3 + d * 2.0;
  lights.hemi.intensity = night ? 0.12 : 0.25 + d * 0.7;
  lights.moon.intensity = night ? 0.35 : 0;
  const sky = lights.scene.background;
  if (sunset) sky.set(0xff9a56);
  else if (night) sky.set(0x081426);
  else sky.set(0x87ceeb);
  lights.scene.fog.color.copy(sky);
}
