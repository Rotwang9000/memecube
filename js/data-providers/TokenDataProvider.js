/**
 * Token Data Provider Interface
 * Base class for providing token data to visualizations
 * Provider-agnostic interface that different data sources can implement
 */

export class TokenDataProvider {
	constructor() {
		this.callbacks = [];
		this.lastFetchTime = 0;
		this.fetchInterval = 60000; // Default 1 minute
		this.autoRefreshInterval = null;
	}
	
	/**
	 * Register a callback to be called when data is updated
	 * @param {Function} callback The callback function to register
	 */
	registerUpdateCallback(callback) {
		if (typeof callback === 'function' && !this.callbacks.includes(callback)) {
			this.callbacks.push(callback);
		}
	}
	
	/**
	 * Unregister a callback
	 * @param {Function} callback The callback function to unregister
	 */
	unregisterUpdateCallback(callback) {
		const index = this.callbacks.indexOf(callback);
		if (index !== -1) {
			this.callbacks.splice(index, 1);
		}
	}
	
	/**
	 * Notify all registered callbacks with the updated data
	 * @param {Array} data The updated data
	 */
	notifyCallbacks(data) {
		for (const callback of this.callbacks) {
			try {
				callback(data);
			} catch (error) {
				console.error('Error in data update callback:', error);
			}
		}
	}
	
	/**
	 * Start auto-refresh of data
	 * @param {number} interval Optional custom refresh interval in milliseconds
	 */
	startAutoRefresh(interval = null) {
		if (interval !== null) {
			this.fetchInterval = interval;
		}
		
		// Clear any existing interval
		this.stopAutoRefresh();
		
		// Set up new interval
		this.autoRefreshInterval = setInterval(async () => {
			await this.refreshData();
		}, this.fetchInterval);
	}
	
	/**
	 * Stop auto-refresh of data
	 */
	stopAutoRefresh() {
		if (this.autoRefreshInterval) {
			clearInterval(this.autoRefreshInterval);
			this.autoRefreshInterval = null;
		}
	}
	
	// --- Methods that must be implemented by subclasses ---
	
	/**
	 * Refresh all token data from the source
	 * @returns {Promise<Array>} Array of token data
	 */
	async refreshData() {
		throw new Error('refreshData() must be implemented by subclasses');
	}
	
	/**
	 * Get top tokens (by some provider-specific criteria)
	 * @param {number} limit Maximum number of tokens to return
	 * @returns {Promise<Array>} Array of top tokens
	 */
	async getTopTokens(limit = 10) {
		throw new Error('getTopTokens() must be implemented by subclasses');
	}
	
	/**
	 * Get price history for a specific token
	 * @param {Object} token Token to get price history for
	 * @returns {Promise<Array>} Array of price history points
	 */
	async getTokenPriceHistory(token) {
		throw new Error('getTokenPriceHistory() must be implemented by subclasses');
	}
	
	/**
	 * Get all available token data
	 * @returns {Array} All available token data
	 */
	getAllTokenData() {
		throw new Error('getAllTokenData() must be implemented by subclasses');
	}
	
	/**
	 * Calculate a visual size for a token based on its data
	 * @param {Object} token Token to calculate size for
	 * @returns {number} Size value (typically between 0.5 and 2.0)
	 */
	calculateTokenSize(token) {
		throw new Error('calculateTokenSize() must be implemented by subclasses');
	}
	
	/**
	 * Format market cap for display
	 * @param {number} marketCap Market cap value
	 * @returns {string} Formatted market cap
	 */
	formatMarketCap(marketCap) {
		throw new Error('formatMarketCap() must be implemented by subclasses');
	}
} 