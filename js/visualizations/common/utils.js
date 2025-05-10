/**
 * Common utility functions for visualizations
 */

/**
 * Easing function for smooth animations
 * @param {number} t - Progress value between 0 and 1
 * @returns {number} Eased value
 */
export function easeInOutQuad(t) {
	return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Clamp a value between min and max
 * @param {number} value - The value to clamp
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @returns {number} Clamped value
 */
export function clamp(value, min, max) {
	return Math.min(Math.max(value, min), max);
}

/**
 * Calculate a horizontal spread factor based on screen width
 * @param {number} screenWidth - The screen width in pixels
 * @returns {number} Appropriate horizontal spread factor
 */
export function calculateHorizontalSpreadFactor(screenWidth) {
	const isVeryNarrowScreen = screenWidth < 600;  // Mobile phones
	const isNarrowScreen = screenWidth < 750 && !isVeryNarrowScreen; // Small tablets
	
	let horizontalSpreadFactor = 0.35; // Default: use 35% of the screen width from center
	
	if (isVeryNarrowScreen) {
		// For very narrow screens, calculate a more aggressive reduction
		const narrowRatio = screenWidth / 600; // 600px as reference
		horizontalSpreadFactor = 0.35 * narrowRatio * 0.9;
		
		// Ensure the spread is not too small (at least 15% of view width)
		horizontalSpreadFactor = Math.max(0.15, horizontalSpreadFactor);
	} 
	else if (isNarrowScreen) {
		// Use a smaller spread on narrow screens
		const narrowRatio = screenWidth / 750; // 750px as reference
		horizontalSpreadFactor = 0.35 * (0.8 + narrowRatio * 0.2); // Scale between 0.28-0.35
	}
	
	return horizontalSpreadFactor;
}

/**
 * Calculate scale factor based on screen width
 * @param {number} screenWidth - The screen width in pixels
 * @returns {number} Appropriate scale factor
 */
export function calculateScaleFactor(screenWidth) {
	const isVeryNarrowScreen = screenWidth < 600;  // Mobile phones
	
	let scale = 0.3; // Default scale
	if (isVeryNarrowScreen) {
		// Use pixel width-based scaling for very narrow screens
		const narrowRatio = screenWidth / 600; // Use 600px as reference width
		scale = 0.3 * narrowRatio;
		scale = clamp(scale, 0.18, 0.3); // Clamp between 0.18 and 0.3
	}
	
	return scale;
} 