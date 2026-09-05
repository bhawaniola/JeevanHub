/**
 * Centralized date formatting utilities for JeevanHub.
 * Standardizes all date displays across the application to DD/MM/YYYY (or DD MMM YYYY).
 */

/**
 * Formats a date string, Date object, or timestamp to standard DD/MM/YYYY.
 *
 * @param {string | number | Date} value
 * @param {string} [fallback="—"]
 * @returns {string} Formatted date (e.g. "09/08/2026")
 */
export function formatDate(value, fallback = "—") {
	if (!value) return fallback;
	const date = new Date(value);
	if (isNaN(date.getTime())) return fallback;
	return date.toLocaleDateString("en-GB");
}

/**
 * Formats a date to readable Day-first format (e.g. "09 Aug 2026").
 *
 * @param {string | number | Date} value
 * @param {string} [fallback="—"]
 * @returns {string} Formatted date (e.g. "09 Aug 2026")
 */
export function formatDateReadable(value, fallback = "—") {
	if (!value) return fallback;
	const date = new Date(value);
	if (isNaN(date.getTime())) return fallback;
	return date.toLocaleDateString("en-GB", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	});
}

/**
 * Formats a date with time in 24h or 12h format (e.g. "09/08/2026, 14:30").
 *
 * @param {string | number | Date} value
 * @param {string} [fallback="—"]
 * @returns {string} Formatted date and time
 */
export function formatDateTime(value, fallback = "—") {
	if (!value) return fallback;
	const date = new Date(value);
	if (isNaN(date.getTime())) return fallback;
	return date.toLocaleString("en-GB", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}
