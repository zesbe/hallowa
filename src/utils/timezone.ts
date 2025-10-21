import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';

// Default timezone untuk Indonesia (Jakarta)
export const DEFAULT_TIMEZONE = 'Asia/Jakarta';

// Daftar timezone yang tersedia - lengkap untuk seluruh dunia
export const TIMEZONES = [
  // Asia - Indonesia
  { value: 'Asia/Jakarta', label: 'WIB - Jakarta (UTC+7)' },
  { value: 'Asia/Makassar', label: 'WITA - Makassar (UTC+8)' },
  { value: 'Asia/Jayapura', label: 'WIT - Jayapura (UTC+9)' },
  
  // Asia - Southeast
  { value: 'Asia/Singapore', label: 'Singapore (UTC+8)' },
  { value: 'Asia/Kuala_Lumpur', label: 'Malaysia (UTC+8)' },
  { value: 'Asia/Bangkok', label: 'Bangkok (UTC+7)' },
  { value: 'Asia/Manila', label: 'Manila (UTC+8)' },
  { value: 'Asia/Ho_Chi_Minh', label: 'Ho Chi Minh (UTC+7)' },
  
  // Asia - East
  { value: 'Asia/Tokyo', label: 'Tokyo (UTC+9)' },
  { value: 'Asia/Seoul', label: 'Seoul (UTC+9)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (UTC+8)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (UTC+8)' },
  { value: 'Asia/Taipei', label: 'Taipei (UTC+8)' },
  
  // Asia - South
  { value: 'Asia/Kolkata', label: 'India (UTC+5:30)' },
  { value: 'Asia/Dhaka', label: 'Bangladesh (UTC+6)' },
  { value: 'Asia/Karachi', label: 'Pakistan (UTC+5)' },
  
  // Asia - Middle East
  { value: 'Asia/Dubai', label: 'Dubai (UTC+4)' },
  { value: 'Asia/Riyadh', label: 'Saudi Arabia (UTC+3)' },
  { value: 'Asia/Jerusalem', label: 'Israel (UTC+2)' },
  { value: 'Asia/Istanbul', label: 'Istanbul (UTC+3)' },
  
  // Australia & Pacific
  { value: 'Australia/Sydney', label: 'Sydney (UTC+10/+11)' },
  { value: 'Australia/Melbourne', label: 'Melbourne (UTC+10/+11)' },
  { value: 'Australia/Perth', label: 'Perth (UTC+8)' },
  { value: 'Pacific/Auckland', label: 'New Zealand (UTC+12/+13)' },
  
  // Europe - West
  { value: 'Europe/London', label: 'London (GMT/UTC+1)' },
  { value: 'Europe/Dublin', label: 'Dublin (GMT/UTC+1)' },
  { value: 'Europe/Lisbon', label: 'Lisbon (GMT/UTC+1)' },
  
  // Europe - Central
  { value: 'Europe/Paris', label: 'Paris (UTC+1/+2)' },
  { value: 'Europe/Berlin', label: 'Berlin (UTC+1/+2)' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam (UTC+1/+2)' },
  { value: 'Europe/Brussels', label: 'Brussels (UTC+1/+2)' },
  { value: 'Europe/Madrid', label: 'Madrid (UTC+1/+2)' },
  { value: 'Europe/Rome', label: 'Rome (UTC+1/+2)' },
  { value: 'Europe/Zurich', label: 'Zurich (UTC+1/+2)' },
  { value: 'Europe/Vienna', label: 'Vienna (UTC+1/+2)' },
  { value: 'Europe/Prague', label: 'Prague (UTC+1/+2)' },
  { value: 'Europe/Stockholm', label: 'Stockholm (UTC+1/+2)' },
  { value: 'Europe/Copenhagen', label: 'Copenhagen (UTC+1/+2)' },
  { value: 'Europe/Oslo', label: 'Oslo (UTC+1/+2)' },
  
  // Europe - East
  { value: 'Europe/Athens', label: 'Athens (UTC+2/+3)' },
  { value: 'Europe/Helsinki', label: 'Helsinki (UTC+2/+3)' },
  { value: 'Europe/Warsaw', label: 'Warsaw (UTC+1/+2)' },
  { value: 'Europe/Bucharest', label: 'Bucharest (UTC+2/+3)' },
  { value: 'Europe/Moscow', label: 'Moscow (UTC+3)' },
  
  // Americas - North
  { value: 'America/New_York', label: 'New York (UTC-5/-4)' },
  { value: 'America/Chicago', label: 'Chicago (UTC-6/-5)' },
  { value: 'America/Denver', label: 'Denver (UTC-7/-6)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (UTC-8/-7)' },
  { value: 'America/Anchorage', label: 'Alaska (UTC-9/-8)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (UTC-10)' },
  { value: 'America/Toronto', label: 'Toronto (UTC-5/-4)' },
  { value: 'America/Vancouver', label: 'Vancouver (UTC-8/-7)' },
  { value: 'America/Mexico_City', label: 'Mexico City (UTC-6/-5)' },
  
  // Americas - South
  { value: 'America/Sao_Paulo', label: 'São Paulo (UTC-3/-2)' },
  { value: 'America/Buenos_Aires', label: 'Buenos Aires (UTC-3)' },
  { value: 'America/Santiago', label: 'Santiago (UTC-4/-3)' },
  { value: 'America/Lima', label: 'Lima (UTC-5)' },
  { value: 'America/Bogota', label: 'Bogotá (UTC-5)' },
  
  // Africa
  { value: 'Africa/Cairo', label: 'Cairo (UTC+2)' },
  { value: 'Africa/Johannesburg', label: 'Johannesburg (UTC+2)' },
  { value: 'Africa/Lagos', label: 'Lagos (UTC+1)' },
  { value: 'Africa/Nairobi', label: 'Nairobi (UTC+3)' },
  
  // UTC/GMT
  { value: 'UTC', label: 'UTC/GMT (UTC+0)' },
  { value: 'Etc/GMT', label: 'GMT (UTC+0)' },
];

/**
 * Get user's timezone from localStorage or use default (Jakarta)
 */
export function getUserTimezone(): string {
  return localStorage.getItem('user-timezone') || DEFAULT_TIMEZONE;
}

/**
 * Set user's timezone to localStorage
 */
export function setUserTimezone(timezone: string): void {
  localStorage.setItem('user-timezone', timezone);
}

/**
 * Convert local datetime-local input value to UTC for storage
 * @param localDateTimeString - Format: "2024-10-21T20:05" (from datetime-local input)
 * @param timezone - User's timezone (default: Jakarta)
 * @returns ISO string in UTC
 */
export function convertLocalToUTC(localDateTimeString: string, timezone: string = getUserTimezone()): string {
  // Parse the local datetime string as if it's in the user's timezone
  const localDate = new Date(localDateTimeString);
  
  // Convert from user's timezone to UTC
  const utcDate = fromZonedTime(localDate, timezone);
  
  return utcDate.toISOString();
}

/**
 * Convert UTC datetime to local timezone for display
 * @param utcDateString - ISO string in UTC
 * @param timezone - User's timezone (default: Jakarta)
 * @returns Date object in local timezone
 */
export function convertUTCToLocal(utcDateString: string, timezone: string = getUserTimezone()): Date {
  const utcDate = new Date(utcDateString);
  return toZonedTime(utcDate, timezone);
}

/**
 * Format UTC datetime to local datetime-local input format
 * @param utcDateString - ISO string in UTC
 * @param timezone - User's timezone (default: Jakarta)
 * @returns Format: "2024-10-21T20:05" for datetime-local input
 */
export function formatUTCToLocalInput(utcDateString: string, timezone: string = getUserTimezone()): string {
  const localDate = convertUTCToLocal(utcDateString, timezone);
  
  // Format to YYYY-MM-DDTHH:mm for datetime-local input
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  const hours = String(localDate.getHours()).padStart(2, '0');
  const minutes = String(localDate.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Format UTC datetime to readable local format
 * @param utcDateString - ISO string in UTC
 * @param timezone - User's timezone (default: Jakarta)
 * @param format - Date format (default: 'dd MMM yyyy, HH:mm')
 * @returns Formatted string in local timezone
 */
export function formatUTCToLocalDisplay(
  utcDateString: string, 
  timezone: string = getUserTimezone(),
  format: string = 'EEE, dd MMM yyyy HH:mm'
): string {
  return formatInTimeZone(new Date(utcDateString), timezone, format, { locale: undefined });
}

/**
 * Get current time in user's timezone formatted for datetime-local input
 * @param timezone - User's timezone (default: Jakarta)
 * @returns Format: "2024-10-21T20:05" for datetime-local input
 */
export function getCurrentLocalTime(timezone: string = getUserTimezone()): string {
  const now = new Date();
  const localNow = toZonedTime(now, timezone);
  
  const year = localNow.getFullYear();
  const month = String(localNow.getMonth() + 1).padStart(2, '0');
  const day = String(localNow.getDate()).padStart(2, '0');
  const hours = String(localNow.getHours()).padStart(2, '0');
  const minutes = String(localNow.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Get timezone offset display (e.g., "WIB (UTC+7)")
 * @param timezone - Timezone identifier
 * @returns Display string with offset
 */
export function getTimezoneDisplay(timezone: string = getUserTimezone()): string {
  const now = new Date();
  const formatted = formatInTimeZone(now, timezone, 'zzz');
  return formatted;
}
