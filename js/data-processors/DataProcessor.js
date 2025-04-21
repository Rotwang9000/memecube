/**
 * Generic Data Processor
 * Base class for fetching and processing data from various API sources
 */

export class DataProcessor {
	constructor() {
		this.data = [];
		this.maxItemsToStore = 100;
		this.lastFetchTime = 0;
		this.fetchInterval = 6000; // 6 seconds default
		this.processingCallbacks = []; // Functions to call when data is processed
		this.autoRefreshEnabled = false;
		this.autoRefreshInterval = null;
	}

	/**
	 * Register a callback to be called when data is processed
	 * @param {Function} callback The callback function to register
	 */
	registerProcessingCallback(callback) {
		if (typeof callback === 'function' && !this.processingCallbacks.includes(callback)) {
			this.processingCallbacks.push(callback);
		}
	}

	/**
	 * Unregister a processing callback
	 * @param {Function} callback The callback function to unregister
	 */
	unregisterProcessingCallback(callback) {
		const index = this.processingCallbacks.indexOf(callback);
		if (index !== -1) {
			this.processingCallbacks.splice(index, 1);
		}
	}

	/**
	 * Start auto-refresh of data
	 * @param {number} interval Refresh interval in milliseconds
	 */
	startAutoRefresh(interval = null) {
		if (interval !== null) {
			this.fetchInterval = interval;
		}

		// Clear any existing interval
		this.stopAutoRefresh();

		// Set up new interval
		this.autoRefreshEnabled = true;
		this.autoRefreshInterval = setInterval(async () => {
			await this.fetchData();
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
		this.autoRefreshEnabled = false;
	}

	/**
	 * Fetch data from source - to be implemented by subclasses
	 * @returns {Promise<Array>} The fetched data
	 */
	async fetchData() {
		throw new Error('fetchData() must be implemented by subclasses');
	}

	/**
	 * Process raw data from the source - to be implemented by subclasses
	 * @param {Array} rawData The raw data to process
	 * @returns {Array} The processed data
	 */
	processData(rawData) {
		throw new Error('processData() must be implemented by subclasses');
	}

	/**
	 * Sort and limit data array
	 * @param {Function} sortFn Optional custom sort function
	 */
	sortAndLimitData(sortFn = null) {
		// If a custom sort function is provided, use it
		if (typeof sortFn === 'function') {
			this.data.sort(sortFn);
		}

		// Limit the number of items
		if (this.data.length > this.maxItemsToStore) {
			this.data = this.data.slice(0, this.maxItemsToStore);
		}

		// Notify all registered callbacks
		this.notifyProcessingCallbacks();
	}

	/**
	 * Notify all registered callbacks with the current data
	 */
	notifyProcessingCallbacks() {
		for (const callback of this.processingCallbacks) {
			try {
				callback(this.data);
			} catch (error) {
				console.error('Error in processing callback:', error);
			}
		}
	}

	/**
	 * Get data items by criteria
	 * @param {Function} filterFn Filter function to select items
	 * @param {number} limit Maximum number of items to return
	 * @returns {Array} Filtered data items
	 */
	getDataByFilter(filterFn, limit = 10) {
		if (typeof filterFn !== 'function') {
			return this.data.slice(0, limit);
		}
		
		return this.data.filter(filterFn).slice(0, limit);
	}

	/**
	 * Get all stored data
	 * @returns {Array} All data items
	 */
	getAllData() {
		return [...this.data];
	}

	/**
	 * Clear all stored data
	 */
	clearData() {
		this.data = [];
		this.notifyProcessingCallbacks();
	}
} 