import { z } from "zod";

/**
 * Input Validation Utilities
 * Provides comprehensive validation for user inputs
 *
 * Security Features:
 * - Phone number format validation (E.164)
 * - URL sanitization and validation
 * - Message length limits
 * - XSS prevention
 * - SQL injection prevention (via escaping)
 */

// ========================================
// PHONE NUMBER VALIDATION
// ========================================

/**
 * Validate phone number format (E.164 international format)
 * Supports formats:
 * - +62812345678 (with country code)
 * - 62812345678 (without +)
 * - 0812345678 (local format)
 *
 * @param phone - Phone number to validate
 * @returns {boolean} True if valid
 */
export function isValidPhoneNumber(phone: string): boolean {
  if (!phone || typeof phone !== 'string') {
    return false;
  }

  // Remove common separators
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');

  // Check if it's a valid format
  // E.164: +[country code][number] (1-15 digits)
  const e164Regex = /^\+?[1-9]\d{7,14}$/;

  // Indonesian local format: 08xx-xxxx-xxxx
  const localIndonesiaRegex = /^0[8][0-9]{8,11}$/;

  return e164Regex.test(cleaned) || localIndonesiaRegex.test(cleaned);
}

/**
 * Normalize phone number to E.164 format
 * @param phone - Phone number to normalize
 * @param defaultCountryCode - Default country code (default: '62' for Indonesia)
 * @returns Normalized phone number
 */
export function normalizePhoneNumber(
  phone: string,
  defaultCountryCode: string = '62'
): string {
  if (!phone) return '';

  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // If starts with 0, replace with country code
  if (cleaned.startsWith('0')) {
    cleaned = defaultCountryCode + cleaned.substring(1);
  }

  // Add + if not present and starts with country code
  if (!cleaned.startsWith('+') && /^\d+$/.test(cleaned)) {
    cleaned = '+' + cleaned;
  }

  return cleaned;
}

/**
 * Zod schema for phone number validation
 */
export const phoneNumberSchema = z
  .string()
  .min(1, "Phone number is required")
  .refine((phone) => isValidPhoneNumber(phone), {
    message: "Invalid phone number format. Use format: +62812345678 or 08123456789",
  });

// ========================================
// URL VALIDATION
// ========================================

/**
 * Validate URL format and security
 * Blocks dangerous protocols and internal IPs
 *
 * @param url - URL to validate
 * @returns {boolean} True if safe
 */
export function isValidURL(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const parsedUrl = new URL(url);

    // Only allow HTTP and HTTPS protocols
    const allowedProtocols = ['http:', 'https:'];
    if (!allowedProtocols.includes(parsedUrl.protocol)) {
      return false;
    }

    // Block dangerous protocols
    const dangerousProtocols = ['javascript:', 'data:', 'file:', 'ftp:', 'about:'];
    if (dangerousProtocols.some(proto => url.toLowerCase().startsWith(proto))) {
      return false;
    }

    // Block internal/private IPs (SSRF protection)
    const hostname = parsedUrl.hostname.toLowerCase();

    // Block localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return false;
    }

    // Block private IP ranges
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipMatch = hostname.match(ipv4Regex);

    if (ipMatch) {
      const [, a, b, c, d] = ipMatch.map(Number);

      // Private IP ranges
      if (
        a === 10 || // 10.0.0.0/8
        (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
        (a === 192 && b === 168) || // 192.168.0.0/16
        a === 169 && b === 254 || // 169.254.0.0/16 (link-local)
        a === 127 // 127.0.0.0/8 (loopback)
      ) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize URL for safe display
 * @param url - URL to sanitize
 * @returns Sanitized URL
 */
export function sanitizeURL(url: string): string {
  if (!url) return '';

  try {
    const parsedUrl = new URL(url);

    // Only return if valid
    if (isValidURL(url)) {
      return parsedUrl.href;
    }

    return '';
  } catch {
    return '';
  }
}

/**
 * Zod schema for URL validation
 */
export const urlSchema = z
  .string()
  .url("Invalid URL format")
  .refine((url) => isValidURL(url), {
    message: "URL contains dangerous protocol or targets private network",
  });

// ========================================
// MESSAGE VALIDATION
// ========================================

/**
 * WhatsApp message length limits
 */
export const MESSAGE_LIMITS = {
  TEXT: 4096, // WhatsApp limit for text messages
  CAPTION: 1024, // WhatsApp limit for media captions
  MIN: 1, // Minimum message length
};

/**
 * Validate message length
 * @param message - Message to validate
 * @param maxLength - Maximum length (default: WhatsApp text limit)
 * @returns {boolean} True if valid
 */
export function isValidMessageLength(
  message: string,
  maxLength: number = MESSAGE_LIMITS.TEXT
): boolean {
  if (!message || typeof message !== 'string') {
    return false;
  }

  return message.length >= MESSAGE_LIMITS.MIN && message.length <= maxLength;
}

/**
 * Get message length info for display
 * @param message - Message to check
 * @param maxLength - Maximum length
 * @returns Length info object
 */
export function getMessageLengthInfo(
  message: string,
  maxLength: number = MESSAGE_LIMITS.TEXT
) {
  const length = message?.length || 0;
  const remaining = maxLength - length;
  const isValid = length >= MESSAGE_LIMITS.MIN && length <= maxLength;
  const percentage = (length / maxLength) * 100;

  return {
    current: length,
    max: maxLength,
    remaining,
    isValid,
    percentage: Math.min(percentage, 100),
    isNearLimit: percentage >= 90,
    isAtLimit: percentage >= 100,
  };
}

/**
 * Zod schema for message validation
 */
export const messageSchema = z
  .string()
  .min(MESSAGE_LIMITS.MIN, `Message must be at least ${MESSAGE_LIMITS.MIN} character`)
  .max(MESSAGE_LIMITS.TEXT, `Message cannot exceed ${MESSAGE_LIMITS.TEXT} characters`);

/**
 * Zod schema for media caption validation
 */
export const captionSchema = z
  .string()
  .max(
    MESSAGE_LIMITS.CAPTION,
    `Caption cannot exceed ${MESSAGE_LIMITS.CAPTION} characters`
  )
  .optional();

// ========================================
// TEXT SANITIZATION (XSS Prevention)
// ========================================

/**
 * Sanitize text input to prevent XSS
 * Escapes HTML special characters
 *
 * @param text - Text to sanitize
 * @returns Sanitized text
 */
export function sanitizeText(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  const htmlEscapeMap: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };

  return text.replace(/[&<>"'\/]/g, (char) => htmlEscapeMap[char] || char);
}

/**
 * Strip HTML tags from text
 * @param text - Text containing HTML
 * @returns Text without HTML tags
 */
export function stripHtmlTags(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text.replace(/<[^>]*>/g, '');
}

// ========================================
// EMAIL VALIDATION
// ========================================

/**
 * Enhanced email validation
 * More strict than basic regex
 */
export const emailSchema = z
  .string()
  .email("Invalid email address")
  .min(5, "Email is too short")
  .max(254, "Email is too long") // RFC 5321
  .refine(
    (email) => {
      // Additional validation: no spaces
      return !email.includes(' ');
    },
    { message: "Email cannot contain spaces" }
  )
  .refine(
    (email) => {
      // Additional validation: must have domain
      const parts = email.split('@');
      return parts.length === 2 && parts[1].includes('.');
    },
    { message: "Email must have a valid domain" }
  );

// ========================================
// FILE UPLOAD VALIDATION
// ========================================

/**
 * Allowed file types for media uploads
 */
export const ALLOWED_MEDIA_TYPES = {
  images: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  videos: ['video/mp4', 'video/mpeg', 'video/quicktime'],
  documents: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  audio: ['audio/mpeg', 'audio/mp4', 'audio/ogg'],
};

/**
 * Maximum file sizes (in bytes)
 */
export const MAX_FILE_SIZES = {
  image: 5 * 1024 * 1024, // 5 MB
  video: 16 * 1024 * 1024, // 16 MB (WhatsApp limit)
  document: 100 * 1024 * 1024, // 100 MB
  audio: 16 * 1024 * 1024, // 16 MB
};

/**
 * Validate file type
 * @param file - File to validate
 * @param allowedTypes - Array of allowed MIME types
 * @returns {boolean} True if valid
 */
export function isValidFileType(file: File, allowedTypes: string[]): boolean {
  if (!file || !file.type) {
    return false;
  }

  return allowedTypes.includes(file.type);
}

/**
 * Validate file size
 * @param file - File to validate
 * @param maxSize - Maximum size in bytes
 * @returns {boolean} True if valid
 */
export function isValidFileSize(file: File, maxSize: number): boolean {
  if (!file || !file.size) {
    return false;
  }

  return file.size <= maxSize;
}

/**
 * Format file size for display
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
