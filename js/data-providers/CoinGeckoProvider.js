/**
 * CoinGecko API Provider
 * Implementation of TokenDataProvider for CoinGecko API
 */

import { TokenDataProvider } from './TokenDataProvider.js';

export class CoinGeckoProvider extends TokenDataProvider {
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
		
		// Token data storage
		this.tokenData = [];
		this.maxTokensToStore = 100;
		
		// Cache for fetched data
		this.coinIdCache = new Set();
		
		// Set refresh rate
		this.fetchInterval = 60000; // 1 minute (respect API rate limits)
	}
	
	/**
	 * Refresh all token data from CoinGecko
	 * @returns {Promise<Array>} The updated token data
	 */
	async refreshData() {
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
			this.tokenData = this.processData(rawData);
			
			// Sort and limit data
			this.sortTokenData();
			
			this.lastFetchTime = Date.now();
			
			// Notify callbacks with updated data
			this.notifyCallbacks(this.tokenData);
			
			return this.tokenData;
		} catch (error) {
			console.error('Error fetching CoinGecko data:', error);
			return this.tokenData;
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
	 * Sort token data by market cap (descending)
	 */
	sortTokenData() {
		// Sort by market cap (highest first)
		this.tokenData.sort((a, b) => {
			const mcapA = parseFloat(a.marketCap || 0);
			const mcapB = parseFloat(b.marketCap || 0);
			
			return mcapB - mcapA;
		});
		
		// Limit the number of tokens
		if (this.tokenData.length > this.maxTokensToStore) {
			this.tokenData = this.tokenData.slice(0, this.maxTokensToStore);
		}
	}
	
	/**
	 * Get top tokens by market cap
	 * @param {number} limit Maximum number of tokens to return
	 * @returns {Promise<Array>} Array of top tokens
	 */
	async getTopTokens(limit = 10) {
		// Ensure we have some data
		if (this.tokenData.length === 0) {
			await this.refreshData();
		}
		
		// Return top N tokens
		return this.tokenData.slice(0, limit);
	}
	
	/**
	 * Get price history for a specific token
	 * @param {Object} token Token to get price history for
	 * @returns {Promise<Array>} Array of price history points
	 */
	async getTokenPriceHistory(token) {
		try {
			const coinId = token.tokenAddress; // We use coin ID as tokenAddress
			const url = `${this.coinDetailsEndpoint}/${coinId}/market_chart?vs_currency=usd&days=7`;
			
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
			console.error(`Error fetching price history for token ${token.baseToken?.symbol}:`, error);
			return null;
		}
	}
	
	/**
	 * Get all available token data
	 * @returns {Array} All available token data
	 */
	getAllTokenData() {
		return [...this.tokenData];
	}
	
	/**
	 * Calculate a normalized size value for a token based on its market metrics
	 * Used for visualizations like the token cube
	 * @param {Object} token Token data
	 * @returns {number} Size value based on a reference scale of 0.5 to 2.0
	 */
	calculateTokenSize(token) {
		// Base size
		let size = 1.0;
		
		// Adjust by volume
		const volumeUsd = parseFloat(token.volume?.h24 || 0);
		if (volumeUsd > 0) {
			const volumeFactor = Math.log10(volumeUsd) / 10;
			size += volumeFactor * 0.5;
		}
		
		// Adjust by price change
		const priceChange = Math.abs(parseFloat(token.priceChange?.h24 || 0));
		if (priceChange > 0) {
			const changeFactor = priceChange / 100;
			size += changeFactor * 0.5;
		}
		
		// Adjust by market cap rank
		if (token.rank && token.rank <= 10) {
			size += 0.3; // Boost size for top 10 coins
		}
		
		// Return the calculated size without clamping
		return size;
	}
	
	/**
	 * Format market cap for display
	 * @param {number} marketCap Market cap value
	 * @returns {string} Formatted market cap
	 */
	formatMarketCap(marketCap) {
		if (!marketCap || marketCap <= 0) return 'N/A';
		
		if (marketCap >= 1e9) {
			return `$${(marketCap / 1e9).toFixed(2)}B`;
		} else if (marketCap >= 1e6) {
			return `$${(marketCap / 1e6).toFixed(2)}M`;
		} else if (marketCap >= 1e3) {
			return `$${(marketCap / 1e3).toFixed(2)}K`;
		} else {
			return `$${marketCap.toFixed(2)}`;
		}
	}
	
	/**
	 * Fetch detailed data for a specific coin (not part of standard interface)
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
} 