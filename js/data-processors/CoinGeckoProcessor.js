/**
 * CoinGecko API Processor
 * Sample implementation to demonstrate how to add a new data source
 */

import { DataProcessor } from './DataProcessor.js';

export class CoinGeckoProcessor extends DataProcessor {
	constructor() {
		super();
		
		// CoinGecko API endpoints
		this.apiEndpoint = 'https://api.coingecko.com/api/v3';
		this.coinListEndpoint = `${this.apiEndpoint}/coins/markets`;
		this.coinDetailsEndpoint = `${this.apiEndpoint}/coins`;
		
		// Set default parameters
		this.defaultParams = {
			vs_currency: 'usd',
			order: 'market_cap_desc',
			per_page: 50,
			page: 1,
			sparkline: false,
			price_change_percentage: '24h'
		};
		
		// Cache for fetched data
		this.coinIdCache = new Set();
		
		// Set refresh rate
		this.fetchInterval = 60000; // 1 minute (respect API rate limits)
	}
	
	/**
	 * Fetch data from CoinGecko API
	 * @returns {Promise<Array>} The fetched and processed data
	 */
	async fetchData() {
		try {
			// Construct URL with parameters
			const params = new URLSearchParams(this.defaultParams);
			const url = `${this.coinListEndpoint}?${params.toString()}`;
			
			// Fetch data
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			
			// Parse response
			const rawData = await response.json();
			
			// Process data
			this.data = this.processData(rawData);
			
			// Sort and limit
			this.sortAndLimitData(this.coinSortFunction);
			
			this.lastFetchTime = Date.now();
			return this.data;
		} catch (error) {
			console.error('Error fetching CoinGecko data:', error);
			return this.data;
		}
	}
	
	/**
	 * Process the raw data from CoinGecko
	 * @param {Array} rawData Raw data from the API
	 * @returns {Array} Processed data in a standardized format
	 */
	processData(rawData) {
		// Transform CoinGecko data to match our standard format
		return rawData.map(coin => {
			// Add coin ID to cache
			this.coinIdCache.add(coin.id);
			
			// Convert to our standardized format
			return {
				baseToken: {
					symbol: coin.symbol.toUpperCase(),
					name: coin.name
				},
				chainId: 'multi',  // CoinGecko coins are often multi-chain
				tokenAddress: coin.id,  // Use coin ID as identifier
				priceUsd: coin.current_price.toString(),
				priceChange: {
					h24: coin.price_change_percentage_24h || 0
				},
				volume: {
					h24: coin.total_volume.toString()
				},
				marketCap: coin.market_cap.toString(),
				liquidity: {
					usd: (coin.total_volume * 0.2).toString() // Estimate liquidity as 20% of volume
				},
				imageUrl: coin.image,
				rank: coin.market_cap_rank,
				dataSource: 'coingecko'
			};
		});
	}
	
	/**
	 * Fetch detailed data for a specific coin
	 * @param {string} coinId CoinGecko coin ID
	 * @returns {Promise<Object>} Detailed coin data
	 */
	async fetchCoinDetails(coinId) {
		try {
			const url = `${this.coinDetailsEndpoint}/${coinId}`;
			
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			
			return await response.json();
		} catch (error) {
			console.error(`Error fetching details for coin ${coinId}:`, error);
			return null;
		}
	}
	
	/**
	 * Fetch price history for a specific coin
	 * @param {string} coinId CoinGecko coin ID
	 * @param {number} days Number of days of data to fetch
	 * @returns {Promise<Array>} Price history data
	 */
	async fetchPriceHistory(coinId, days = 7) {
		try {
			const url = `${this.coinDetailsEndpoint}/${coinId}/market_chart?vs_currency=usd&days=${days}`;
			
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			
			const data = await response.json();
			
			// Convert to our standard format
			if (data.prices && Array.isArray(data.prices)) {
				return data.prices.map(point => ({
					time: point[0], // timestamp
					price: point[1]  // price
				}));
			}
			
			return null;
		} catch (error) {
			console.error(`Error fetching price history for coin ${coinId}:`, error);
			return null;
		}
	}
	
	/**
	 * Default sort function for coin data
	 * @param {Object} a First coin
	 * @param {Object} b Second coin
	 * @returns {number} Sort order
	 */
	coinSortFunction(a, b) {
		// Sort by market cap (descending)
		const mcapA = parseFloat(a.marketCap || 0);
		const mcapB = parseFloat(b.marketCap || 0);
		
		return mcapB - mcapA;
	}
	
	/**
	 * Calculate a normalized size value for a coin based on its market metrics
	 * Used for visualizations like the token cube
	 * @param {Object} coin Coin data
	 * @returns {number} Normalized size value (0.5 to 2.0)
	 */
	calculateTokenSize(coin) {
		// Base size
		let size = 1.0;
		
		// Adjust by volume
		const volumeUsd = parseFloat(coin.volume?.h24 || 0);
		if (volumeUsd > 0) {
			const volumeFactor = Math.min(Math.log10(volumeUsd) / 10, 1);
			size += volumeFactor * 0.5;
		}
		
		// Adjust by price change
		const priceChange = Math.abs(parseFloat(coin.priceChange?.h24 || 0));
		if (priceChange > 0) {
			const changeFactor = Math.min(priceChange / 100, 1);
			size += changeFactor * 0.5;
		}
		
		// Adjust by market cap rank
		if (coin.rank && coin.rank <= 10) {
			size += 0.3; // Boost size for top 10 coins
		}
		
		// Cap size between 0.5 and 2.0
		return Math.max(0.5, Math.min(size, 2.0));
	}
} 