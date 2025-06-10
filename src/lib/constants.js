/**
 * Shared constants for BitBurner hacking operations
 * Used by both mcp.js and get_stats.js to avoid sync issues
 */

// Hacking thresholds
export const SEC_THRESHOLD = 5      // Security difference threshold
export const MONEY_PERCENTAGE = 0.5 // Remote servers start hacking at 50% money
export const MONEY_MAX_PERCENTAGE = 1 // Purchased servers start hacking at 100% money
export const MONEY_MINIMUM = 2000000 // Minimum absolute money threshold