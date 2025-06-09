/**
 * Shared constants for BitBurner hacking operations
 * Used by both mcp.js and get_stats.js to avoid sync issues
 */

// Hacking thresholds
export const SEC_THRESHOLD = 10      // Security difference threshold
export const MONEY_PERCENTAGE = 0.05 // Start hacking at 5% money
export const MONEY_MINIMUM = 1000000 // Minimum absolute money threshold