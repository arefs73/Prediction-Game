import { RoundPhase } from '../types/game';

export const TIMEZONE_AMSTERDAM = 'Europe/Amsterdam';

export interface AmsterdamClockDetails {
  date: Date;
  isoString: string;
  timeString: string; // HH:mm:ss
  dateString: string; // YYYY-MM-DD
  dayOfWeek: number; // 0-6 (0 is Sunday)
  hour: number;
  minute: number;
  second: number;
  phase: RoundPhase;
  phaseLabel: string;
  secondsUntilNextMilestone: number;
  nextMilestoneLabel: string;
}

/**
 * Returns precise time in Europe/Amsterdam timezone
 */
export function getAmsterdamClockDetails(customDate?: Date): AmsterdamClockDetails {
  const now = customDate || new Date();
  
  // Format parts in Europe/Amsterdam timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE_AMSTERDAM,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short',
  });

  const parts = formatter.formatToParts(now);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  const hour = parseInt(partMap.hour, 10);
  const minute = parseInt(partMap.minute, 10);
  const second = parseInt(partMap.second, 10);
  const year = partMap.year;
  const month = partMap.month;
  const day = partMap.day;

  const dateString = `${year}-${month}-${day}`;
  const pad = (n: number) => n.toString().padStart(2, '0');
  const timeString = `${pad(hour)}:${pad(minute)}:${pad(second)}`;

  // Determine current game round phase based on Game Rules v2.2
  // Open: 12:00:00 - 20:00:00
  // Locked / Live: 20:00:00 - 22:00:00
  // Announced: 22:00:00 - 23:59:59
  // Pre-Open: 00:00:00 - 11:59:59
  let phase: RoundPhase = 'OPEN';
  let phaseLabel = 'Prediction Window Open';
  let secondsUntilNextMilestone = 0;
  let nextMilestoneLabel = '';

  const totalCurrentSeconds = hour * 3600 + minute * 60 + second;
  const openSeconds = 12 * 3600;
  const freezeSeconds = 20 * 3600;
  const announceSeconds = 22 * 3600;

  if (totalCurrentSeconds < openSeconds) {
    phase = 'PRE_OPEN';
    phaseLabel = 'Pre-Window (Opens 12:00)';
    secondsUntilNextMilestone = openSeconds - totalCurrentSeconds;
    nextMilestoneLabel = 'Opens at 12:00';
  } else if (totalCurrentSeconds < freezeSeconds) {
    phase = 'OPEN';
    phaseLabel = 'Prediction Window Open';
    secondsUntilNextMilestone = freezeSeconds - totalCurrentSeconds;
    nextMilestoneLabel = 'Price Freeze at 20:00';
  } else if (totalCurrentSeconds < announceSeconds) {
    phase = 'LOCKED_LIVE';
    phaseLabel = 'Locked — Live Studio Active';
    secondsUntilNextMilestone = announceSeconds - totalCurrentSeconds;
    nextMilestoneLabel = 'Official Results at 22:00';
  } else {
    phase = 'ANNOUNCED';
    phaseLabel = 'Winners Announced & Claiming Open';
    // Until midnight or tomorrow's round
    secondsUntilNextMilestone = 24 * 3600 - totalCurrentSeconds + openSeconds;
    nextMilestoneLabel = "Next Round at 12:00 Tomorrow";
  }

  // Get day of week in Amsterdam
  const dayOfWeekIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(partMap.weekday);

  return {
    date: now,
    isoString: now.toISOString(),
    timeString,
    dateString,
    dayOfWeek: dayOfWeekIndex >= 0 ? dayOfWeekIndex : now.getDay(),
    hour,
    minute,
    second,
    phase,
    phaseLabel,
    secondsUntilNextMilestone,
    nextMilestoneLabel,
  };
}

/**
 * Format duration in seconds into HH:MM:SS
 */
export function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 0) totalSeconds = 0;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Format currency strictly to two decimal places
 */
export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
