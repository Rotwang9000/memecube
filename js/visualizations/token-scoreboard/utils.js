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
 * @param {boolean} noSign - Whether to omit the sign
 * @param {boolean} compact - Whether to use a more compact format for LED display
 * @returns {string} Formatted change string with sign and % symbol
 */
export function formatChange(change, noSign = false, compact = false) {
	const numChange = typeof change === 'string' ? parseFloat(change) : change;
	
	if (isNaN(numChange)) {
		return noSign ? "0.00" : "+0.00%";
	}
	
	const sign = noSign ? '' : numChange >= 0 ? '+' : '-';
	
	// For compact display, use more optimized formatting
	if (compact) {
		// For very small changes, show fewer decimals
		if (Math.abs(numChange) < 0.01) {
			return `${sign}0.00%`;
		}
		// For values between 0.01 and 1, show 2 decimals
		else if (Math.abs(numChange) < 1) {
			return `${sign}${Math.abs(numChange).toFixed(2)}%`;
		}
		// For values between 1 and 10, show 1 decimal
		else if (Math.abs(numChange) < 10) {
			return `${sign}${Math.abs(numChange).toFixed(1)}%`;
		}
		// For values over 10, show no decimals
		else {
			return `${sign}${Math.round(Math.abs(numChange))}%`;
		}
	}
	
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