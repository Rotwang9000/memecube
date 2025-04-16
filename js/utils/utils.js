import * as THREE from 'three';

/**
 * Utility functions for the application
 */

export class Utils {
	constructor() {
		this.messageTimeout = null;
	}
	
	/**
	 * Generate a random color with high saturation
	 * @param {number} minLightness - Minimum lightness value (0-1)
	 * @param {number} maxLightness - Maximum lightness value (0-1)
	 * @returns {THREE.Color} - A vibrant THREE.Color object
	 */
	getRandomVibrantColor(minLightness = 0.5, maxLightness = 0.8) {
		const hue = Math.random() * 360;
		const saturation = 0.7 + Math.random() * 0.3; // High saturation
		const lightness = minLightness + Math.random() * (maxLightness - minLightness);
		
		return new THREE.Color(`hsl(${hue}, ${saturation * 100}%, ${lightness * 100}%)`);
	}
	
	/**
	 * Checks if a string is a valid URL
	 * @param {string} url - The URL to validate
	 * @returns {boolean} - Whether the URL is valid
	 */
	isValidUrl(url) {
		try {
			new URL(url);
			return true;
		} catch (e) {
			return false;
		}
	}
	
	/**
	 * Generates a random position within a cube
	 * @param {number} cubeSize - The size of the cube
	 * @param {number} buffer - Buffer space to keep away from edges
	 * @returns {THREE.Vector3} - A random position vector
	 */
	getRandomPositionInCube(cubeSize, buffer = 0) {
		const halfSize = (cubeSize / 2) - buffer;
		
		return new THREE.Vector3(
			THREE.MathUtils.randFloatSpread(halfSize * 2),
			THREE.MathUtils.randFloatSpread(halfSize * 2),
			THREE.MathUtils.randFloatSpread(halfSize * 2)
		);
	}
	
	/**
	 * Calculate size based on payment amount (for future implementation)
	 * @param {number} paymentAmount - The amount paid in SOL
	 * @param {number} minSize - Minimum size
	 * @param {number} maxSize - Maximum size
	 * @returns {number} - The calculated size
	 */
	calculateSizeFromPayment(paymentAmount, minSize = 0.5, maxSize = 2.5) {
		// Example scaling function, can be adjusted later
		// This just does a simple linear scaling between min and max
		const MAX_PAYMENT = 10; // Example: 10 SOL for max size
		const normalizedPayment = Math.min(paymentAmount, MAX_PAYMENT) / MAX_PAYMENT;
		return minSize + normalizedPayment * (maxSize - minSize);
	}
	
	/**
	 * Easing function for smoother animations
	 * @param {number} t - Input value (0-1)
	 * @returns {number} - Eased value (0-1)
	 */
	easeOutBack(t) {
		const c1 = 1.70158;
		const c3 = c1 + 1;
		
		return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
	}
	
	/**
	 * Converts degrees to radians
	 * @param {number} degrees - Angle in degrees
	 * @returns {number} - Angle in radians
	 */
	degToRad(degrees) {
		return degrees * (Math.PI / 180);
	}
	
	/**
	 * Converts radians to degrees
	 * @param {number} radians - Angle in radians
	 * @returns {number} - Angle in degrees
	 */
	radToDeg(radians) {
		return radians * (180 / Math.PI);
	}
	
	/**
	 * Creates a loading indicator
	 * @returns {HTMLElement} - The loading element
	 */
	createLoadingIndicator() {
		const loading = document.createElement('div');
		loading.className = 'loading';
		loading.innerHTML = 'Loading...';
		document.body.appendChild(loading);
		return loading;
	}
	
	/**
	 * Removes a loading indicator
	 * @param {HTMLElement} loadingElement - The loading element to remove
	 */
	removeLoadingIndicator(loadingElement) {
		if (loadingElement && loadingElement.parentNode) {
			loadingElement.parentNode.removeChild(loadingElement);
		}
	}
	
	/**
	 * Show a temporary message on screen
	 * @param {string} message The message to display
	 * @param {number} duration Duration in milliseconds to show message
	 */
	showTemporaryMessage(message, duration = 3000) {
		// Clear any existing message
		this.clearTemporaryMessage();
		
		// Create message element
		const messageElement = document.createElement('div');
		messageElement.id = 'temp-message';
		messageElement.textContent = message;
		messageElement.style.position = 'fixed';
		messageElement.style.bottom = '30px';
		messageElement.style.left = '50%';
		messageElement.style.transform = 'translateX(-50%)';
		messageElement.style.padding = '10px 20px';
		messageElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
		messageElement.style.color = 'white';
		messageElement.style.borderRadius = '5px';
		messageElement.style.zIndex = '1000';
		messageElement.style.fontFamily = 'Arial, sans-serif';
		messageElement.style.fontSize = '14px';
		messageElement.style.boxShadow = '0 0 10px rgba(0, 150, 200, 0.5)';
		messageElement.style.border = '1px solid rgba(0, 150, 200, 0.3)';
		
		// Add fade-in animation
		messageElement.style.opacity = '0';
		messageElement.style.transition = 'opacity 0.3s ease-in-out';
		
		// Add to document
		document.body.appendChild(messageElement);
		
		// Trigger fade-in
		setTimeout(() => {
			messageElement.style.opacity = '1';
		}, 10);
		
		// Set timeout to remove message
		this.messageTimeout = setTimeout(() => {
			this.clearTemporaryMessage();
		}, duration);
	}
	
	/**
	 * Clear temporary message if one exists
	 */
	clearTemporaryMessage() {
		if (this.messageTimeout) {
			clearTimeout(this.messageTimeout);
			this.messageTimeout = null;
		}
		
		const existingMessage = document.getElementById('temp-message');
		if (existingMessage) {
			// Fade out
			existingMessage.style.opacity = '0';
			
			// Remove after transition
			setTimeout(() => {
				if (existingMessage.parentNode) {
					existingMessage.parentNode.removeChild(existingMessage);
				}
			}, 300);
		}
	}
	
	/**
	 * Generate a random color with specified hue range
	 * @param {number} minHue Minimum hue value (0-360)
	 * @param {number} maxHue Maximum hue value (0-360)
	 * @param {number} saturation Saturation value (0-100)
	 * @param {number} lightness Lightness value (0-100)
	 * @returns {string} CSS HSL color string
	 */
	randomColor(minHue = 0, maxHue = 360, saturation = 70, lightness = 50) {
		const hue = minHue + Math.random() * (maxHue - minHue);
		return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
	}
	
	/**
	 * Format a number with commas
	 * @param {number} x The number to format
	 * @returns {string} Formatted number string
	 */
	numberWithCommas(x) {
		return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	}
	
	/**
	 * Format a Unix timestamp to readable date/time
	 * @param {number} timestamp Unix timestamp
	 * @returns {string} Formatted date string
	 */
	formatTimestamp(timestamp) {
		const date = new Date(timestamp);
		return date.toLocaleString();
	}
} 