/**
 * Timezone utilities for consistent date/time display across the application
 * All times are displayed in user's selected timezone - NEVER in UTC
 */

import { formatInTimeZone } from 'date-fns-tz';
import { format as formatDate, parseISO } from 'date-fns';

// Common timezones grouped by region
export const TIMEZONES = [
  // Americas
  { value: 'America/New_York', label: 'Eastern Time (ET)', region: 'Americas' },
  { value: 'America/Chicago', label: 'Central Time (CT)', region: 'Americas' },
  { value: 'America/Denver', label: 'Mountain Time (MT)', region: 'Americas' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', region: 'Americas' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)', region: 'Americas' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)', region: 'Americas' },
  { value: 'America/Phoenix', label: 'Arizona (MST)', region: 'Americas' },
  { value: 'America/Toronto', label: 'Toronto', region: 'Americas' },
  { value: 'America/Vancouver', label: 'Vancouver', region: 'Americas' },
  { value: 'America/Mexico_City', label: 'Mexico City', region: 'Americas' },
  { value: 'America/Sao_Paulo', label: 'São Paulo', region: 'Americas' },
  { value: 'America/Buenos_Aires', label: 'Buenos Aires', region: 'Americas' },
  
  // Europe
  { value: 'Europe/London', label: 'London (GMT/BST)', region: 'Europe' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)', region: 'Europe' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)', region: 'Europe' },
  { value: 'Europe/Rome', label: 'Rome (CET/CEST)', region: 'Europe' },
  { value: 'Europe/Madrid', label: 'Madrid (CET/CEST)', region: 'Europe' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam (CET/CEST)', region: 'Europe' },
  { value: 'Europe/Brussels', label: 'Brussels (CET/CEST)', region: 'Europe' },
  { value: 'Europe/Zurich', label: 'Zurich (CET/CEST)', region: 'Europe' },
  { value: 'Europe/Stockholm', label: 'Stockholm (CET/CEST)', region: 'Europe' },
  { value: 'Europe/Athens', label: 'Athens (EET/EEST)', region: 'Europe' },
  { value: 'Europe/Istanbul', label: 'Istanbul (TRT)', region: 'Europe' },
  { value: 'Europe/Moscow', label: 'Moscow (MSK)', region: 'Europe' },
  
  // Asia
  { value: 'Asia/Dubai', label: 'Dubai (GST)', region: 'Asia' },
  { value: 'Asia/Karachi', label: 'Karachi (PKT)', region: 'Asia' },
  { value: 'Asia/Kolkata', label: 'India (IST)', region: 'Asia' },
  { value: 'Asia/Bangkok', label: 'Bangkok (ICT)', region: 'Asia' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)', region: 'Asia' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)', region: 'Asia' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)', region: 'Asia' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)', region: 'Asia' },
  { value: 'Asia/Seoul', label: 'Seoul (KST)', region: 'Asia' },
  { value: 'Asia/Manila', label: 'Manila (PHT)', region: 'Asia' },
  { value: 'Asia/Jakarta', label: 'Jakarta (WIB)', region: 'Asia' },
  
  // Oceania
  { value: 'Australia/Sydney', label: 'Sydney (AEDT/AEST)', region: 'Oceania' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEDT/AEST)', region: 'Oceania' },
  { value: 'Australia/Brisbane', label: 'Brisbane (AEST)', region: 'Oceania' },
  { value: 'Australia/Perth', label: 'Perth (AWST)', region: 'Oceania' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZDT/NZST)', region: 'Oceania' },
  
  // Africa
  { value: 'Africa/Cairo', label: 'Cairo (EET)', region: 'Africa' },
  { value: 'Africa/Johannesburg', label: 'Johannesburg (SAST)', region: 'Africa' },
  { value: 'Africa/Lagos', label: 'Lagos (WAT)', region: 'Africa' },
  { value: 'Africa/Nairobi', label: 'Nairobi (EAT)', region: 'Africa' },
];

const TIMEZONE_STORAGE_KEY = 'user-timezone';

/**
 * Get the user's selected timezone from localStorage
 * Falls back to browser's timezone if not set
 * NEVER returns UTC
 */
export function getUserTimezone(): string {
  const saved = localStorage.getItem(TIMEZONE_STORAGE_KEY);
  if (saved) {
    return saved;
  }
  // Get browser's timezone (will be something like "America/New_York", never "UTC")
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Set the user's preferred timezone
 */
export function setUserTimezone(timezone: string): void {
  localStorage.setItem(TIMEZONE_STORAGE_KEY, timezone);
}

/**
 * Format a date in the user's selected timezone
 * @param date - Date object, ISO string, or timestamp
 * @param formatStr - Format string (date-fns format)
 * @returns Formatted date string in user's timezone
 */
export function formatInUserTimezone(
  date: Date | string | number,
  formatStr: string = 'PPpp' // Default: "Apr 29, 2023, 9:30 AM"
): string {
  const timezone = getUserTimezone();
  
  // Handle different input types
  let dateObj: Date;
  if (typeof date === 'string') {
    dateObj = parseISO(date);
  } else if (typeof date === 'number') {
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }
  
  // Format in user's timezone
  return formatInTimeZone(dateObj, timezone, formatStr);
}

/**
 * Format a date for display in user's timezone (common formats)
 */
export const formatDateTime = {
  /**
   * Full date and time: "Apr 29, 2023, 9:30 AM"
   */
  full: (date: Date | string | number) => formatInUserTimezone(date, 'PPpp'),
  
  /**
   * Short date and time: "04/29/2023, 9:30 AM"
   */
  short: (date: Date | string | number) => formatInUserTimezone(date, 'Pp'),
  
  /**
   * Date only: "Apr 29, 2023"
   */
  date: (date: Date | string | number) => formatInUserTimezone(date, 'PP'),
  
  /**
   * Short date: "04/29/2023"
   */
  dateShort: (date: Date | string | number) => formatInUserTimezone(date, 'P'),
  
  /**
   * Time only: "9:30 AM"
   */
  time: (date: Date | string | number) => formatInUserTimezone(date, 'p'),
  
  /**
   * Time with seconds: "9:30:45 AM"
   */
  timeWithSeconds: (date: Date | string | number) => formatInUserTimezone(date, 'pp'),
  
  /**
   * Relative: "Today at 9:30 AM" or "Tomorrow at 9:30 AM" or full date
   */
  relative: (date: Date | string | number) => {
    const timezone = getUserTimezone();
    const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);
    const now = new Date();
    
    // Get dates in user's timezone
    const dateInTz = formatInTimeZone(dateObj, timezone, 'yyyy-MM-dd');
    const todayInTz = formatInTimeZone(now, timezone, 'yyyy-MM-dd');
    const tomorrowInTz = formatInTimeZone(new Date(now.getTime() + 86400000), timezone, 'yyyy-MM-dd');
    
    const timeStr = formatInTimeZone(dateObj, timezone, 'p');
    
    if (dateInTz === todayInTz) {
      return `Today at ${timeStr}`;
    } else if (dateInTz === tomorrowInTz) {
      return `Tomorrow at ${timeStr}`;
    } else {
      return formatInTimeZone(dateObj, timezone, 'PPpp');
    }
  },
  
  /**
   * Calendar format: "Mon, Apr 29" or "Monday, April 29, 2023"
   */
  calendar: (date: Date | string | number, includeYear: boolean = false) => 
    formatInUserTimezone(date, includeYear ? 'PPPP' : 'EEE, MMM d'),
};

/**
 * Get the current time in user's timezone
 */
export function nowInUserTimezone(): Date {
  return new Date();
}

/**
 * Convert a date to ISO string for API submission (will be in UTC for backend)
 * Backend receives UTC, but user never sees UTC
 */
export function toISOString(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toISOString();
}

/**
 * Get datetime-local input value in user's timezone
 * For use with <input type="datetime-local">
 */
export function toDateTimeLocalValue(date: Date | string | number): string {
  const timezone = getUserTimezone();
  const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);
  
  // Format for datetime-local input: "2023-04-29T09:30"
  return formatInTimeZone(dateObj, timezone, "yyyy-MM-dd'T'HH:mm");
}

/**
 * Parse datetime-local input value from user's timezone
 * Converts to proper Date object accounting for timezone
 */
export function fromDateTimeLocalValue(value: string): Date {
  const timezone = getUserTimezone();
  
  // The value is in format "2023-04-29T09:30"
  // We need to interpret this as being in the user's timezone
  const date = new Date(value);
  
  // Get the offset difference
  const localOffset = date.getTimezoneOffset() * 60000;
  const targetDate = new Date(date.getTime() - localOffset);
  
  return targetDate;
}

/**
 * Get minimum datetime for datetime-local input (5 minutes from now in user's timezone)
 */
export function getMinDateTime(): string {
  const minDate = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
  return toDateTimeLocalValue(minDate);
}

/**
 * Check if a date is in the past (in user's timezone)
 */
export function isInPast(date: Date | string): boolean {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return dateObj.getTime() < Date.now();
}

/**
 * Get timezone display name
 */
export function getTimezoneDisplayName(timezone?: string): string {
  const tz = timezone || getUserTimezone();
  const tzInfo = TIMEZONES.find(t => t.value === tz);
  return tzInfo ? tzInfo.label : tz;
}

/**
 * Group timezones by region for dropdown display
 */
export function getTimezonesByRegion(): Record<string, typeof TIMEZONES> {
  const grouped: Record<string, typeof TIMEZONES> = {};
  
  TIMEZONES.forEach(tz => {
    if (!grouped[tz.region]) {
      grouped[tz.region] = [];
    }
    grouped[tz.region].push(tz);
  });
  
  return grouped;
}
