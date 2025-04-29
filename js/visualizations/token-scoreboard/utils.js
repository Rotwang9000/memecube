/**
 * Utilities for the token scoreboard
 */

/**
 * Format price based on its magnitude
 * @param {number|string} price - The price to format
 * @returns {string} Formatted price string
 */
export function formatPrice(price) {
	const numPrice = typeof price === 'string' ? parseFloat(price) : price;
	
	if (isNaN(numPrice)) {
		return "N/A";
	} else if (numPrice >= 1e6) {
		return (numPrice / 1e6).toFixed(1) + 'M'; // Millions
	} else if (numPrice >= 1e3) {
		return (numPrice / 1e3).toFixed(1) + 'k'; // Thousands
	} else if (numPrice >= 100) {
		return numPrice.toFixed(2);
	} else if (numPrice >= 1) {
		return numPrice.toFixed(4);
	} else if (numPrice >= 0.01) {
		return numPrice.toFixed(6);
	} else {
		// For very small numbers, use more precision or scientific notation
		if (numPrice < 0.0000001) {
			return numPrice.toExponential(2);
		} else {
			return numPrice.toFixed(8);
		}
	}
}

export function formatChangePrice(price) {
	const numPrice = typeof price === 'string' ? parseFloat(price) : price;

	if (isNaN(numPrice)) {
		return "N/A";
	} else if (numPrice >= 1e6) {
		return (numPrice / 1e6).toFixed(1) + 'M'; // Millions
	} else if (numPrice >= 1e3) {
		return (numPrice / 1e3).toFixed(1) + 'k'; // Thousands
	} else if (numPrice >= 100) {
		return numPrice.toFixed(0);
	} else if (numPrice >= 1) {
		return numPrice.toFixed(1);
	} else if (numPrice >= 0.01) {
		return numPrice.toFixed(2);
	} else {
		// For very small numbers, use more precision or scientific notation
		if (numPrice < 0.0000001) {
			return numPrice.toExponential(2);
		} else {
			return numPrice.toFixed(8);
		}
	}
}

/**
 * Format percentage change with sign and fixed precision
 * @param {number|string} change - The percentage change
 * @returns {string} Formatted change string with sign and % symbol
 */
export function formatChange(change, noSign = false) {
	const numChange = typeof change === 'string' ? parseFloat(change) : change;
	
	if (isNaN(numChange)) {
		return "+0.00%";
	}
	
	const sign = noSign ? '' : numChange >= 0 ? '+' : '-';
	const value = formatChangePrice(Math.abs(numChange));
	return `${sign}${value}` + (noSign ? '' : '%');
}

/**
 * Get color name based on change value
 * @param {number|string} change - The percentage change
 * @returns {string} Color name ('green' for positive, 'red' for negative)
 */
export function getChangeColor(change) {
	const numChange = typeof change === 'string' ? parseFloat(change) : change;
	return !isNaN(numChange) && numChange >= 0 ? 'green' : 'red';
}

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

/**
 * Format a number in a compact format
 * @param {number|string} value - The number to format
 * @returns {string} Formatted number string
 */
export function formatCompactNumber(value, decimals = 0) {
	const num = typeof value === 'string' ? parseFloat(value) : value;
	if (isNaN(num)) return 'N/A';
	const absNum = Math.abs(num);
	let formatted;
	if (absNum >= 1e12) {
		formatted = (num / 1e12).toFixed(2) + 'T';
	} else if (absNum >= 1e9) {
		formatted = (num / 1e9).toFixed(2) + 'B';
	} else if (absNum >= 1e6) {
		formatted = (num / 1e6).toFixed(2) + 'M';
	} else if (absNum >= 1e3) {
		formatted = (num / 1e3).toFixed(2) + 'K';
	} else {
		formatted = num.toFixed(decimals);
	}
	return formatted;
} 