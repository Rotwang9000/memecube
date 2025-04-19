/**
 * DexScreener API Processor
 * Fetches and processes token data from DexScreener API
 */

import { DataProcessor } from './DataProcessor.js';

export class DexScreenerProcessor extends DataProcessor {
	constructor() {
		super();
		
		// DexScreener API endpoints
		this.apiEndpointProfiles = 'https://api.dexscreener.com/token-profiles/latest/v1';
		this.apiEndpointSearch = 'https://api.dexscreener.com/latest/dex/search';
		this.apiEndpointPairs = 'https://api.dexscreener.com/token-pairs/v1';
		this.apiEndpointTokens = 'https://api.dexscreener.com/tokens/v1';
		
		// Storage for different types of data
		this.tokenProfiles = [];
		this.maxTokensToDisplay = 50;
		
		// Set faster refresh rate for token data
		this.fetchInterval = 6000; // 6 seconds
		
		// Track which tokens have already had market data fetched
		this.fetchedTokenAddresses = new Set();
	}
	
	/**
	 * Fetch token profiles from DexScreener API
	 * @returns {Promise<Array>} Array of token profiles
	 */
	async fetchLatestTokenProfiles() {
		try {
			const response = await fetch(this.apiEndpointProfiles);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			const data = await response.json();
			
			// Store profiles for later use
			// Check if the data is an array (direct token array) or has a tokens property
			this.tokenProfiles = Array.isArray(data) ? data : data.tokens || [];
			
			return this.tokenProfiles;
		} catch (error) {
			console.error('Error fetching token profiles:', error);
			return [];
		}
	}
	
	/**
	 * Fetch market data for specific tokens
	 * @param {Array} tokens Array of tokens to fetch market data for
	 * @returns {Promise<Array>} Array of tokens with market data
	 */
	async fetchTokenMarketData(tokens) {
		if (!tokens || tokens.length === 0) {
			return [];
		}
		
		try {
			// Create array of promises for each token's market data
			const promises = tokens.map(async (token) => {
				// Skip if token doesn't have required data
				if (!token.chainId || !token.tokenAddress) {
					return null;
				}
				
				// Check if we already have this token in our data
				const tokenKey = `${token.chainId}-${token.tokenAddress}`;
				this.fetchedTokenAddresses.add(tokenKey);
				
				// Construct query for this token
				const query = `${token.chainId}:${token.tokenAddress}`;
				
				// Fetch market data for this token
				const response = await fetch(`${this.apiEndpointSearch}?q=${encodeURIComponent(query)}`);
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}
				
				const data = await response.json();
				
				// If we got pairs data, add the top pair to our token data
				if (data.pairs && data.pairs.length > 0) {
					// Find the top pair by liquidity
					const topPair = data.pairs.reduce((best, current) => {
						const bestLiquidity = parseFloat(best.liquidity?.usd || 0);
						const currentLiquidity = parseFloat(current.liquidity?.usd || 0);
						return currentLiquidity > bestLiquidity ? current : best;
					}, data.pairs[0]);
					
					// Merge the pair data with our token data (preserving token profile info)
					return { 
						...token,
						...topPair
					};
				}
				
				return token;
			});
			
			// Wait for all promises to resolve
			const results = await Promise.all(promises);
			
			// Filter out null values
			return results.filter(result => result !== null);
		} catch (error) {
			console.error('Error fetching token market data:', error);
			return [];
		}
	}
	
	/**
	 * Select a subset of tokens for market data update
	 * @param {Array} profiles New token profiles
	 * @returns {Promise<Array>} Array of tokens to update
	 */
	async selectTokensForMarketDataUpdate(profiles) {
		const tokensToUpdate = [];
		
		// 1. Filter for new tokens we haven't fetched market data for yet
		for (const token of profiles) {
			const tokenKey = `${token.chainId}-${token.tokenAddress}`;
			if (!this.fetchedTokenAddresses.has(tokenKey)) {
				tokensToUpdate.push(token);
				this.fetchedTokenAddresses.add(tokenKey);
			}
		}
		
		// 2. Add a few random tokens from our existing collection for refresh
		// Choose 2 random tokens from existing data to update
		if (this.data.length > 0) {
			const randomCount = Math.min(2, this.data.length);
			const indexes = new Set();
			
			// Get random indexes to update
			while (indexes.size < randomCount) {
				indexes.add(Math.floor(Math.random() * this.data.length));
			}
			
			// Add randomly selected tokens to update list
			for (const index of indexes) {
				tokensToUpdate.push(this.data[index]);
			}
		}
		
		return tokensToUpdate;
	}
	
	/**
	 * Fetch token price history from DexScreener API
	 * @param {Object} token Token to fetch price history for
	 * @returns {Promise<Array>} Array of price history points
	 */
	async fetchTokenPriceHistory(token) {
		if (!token || !token.dexId || !token.pairAddress) {
			return null;
		}
		
		try {
			// Construct API URL
			const url = `https://api.dexscreener.com/latest/dex/pairs/${token.dexId}/${token.pairAddress}/candles?from=0&to=${Date.now()}&resolution=1h`;
			
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			
			const data = await response.json();
			
			// Process candlestick data
			if (data.candles && data.candles.length > 0) {
				// Sort by time
				const sortedCandles = [...data.candles].sort((a, b) => a.time - b.time);
				
				// Map to price points (time, price)
				return sortedCandles.map(candle => ({
					time: candle.time,
					price: parseFloat(candle.close)
				}));
			}
			
			return null;
		} catch (error) {
			console.error('Error fetching token price history:', error);
			return null;
		}
	}
	
	/**
	 * Updates existing token data with new market data
	 * @param {Array} updatedTokens Tokens with new market data
	 */
	updateTokenDataWithNewMarketData(updatedTokens) {
		if (!updatedTokens || updatedTokens.length === 0) {
			return;
		}
		
		// For each updated token, find and update or add to our data array
		for (const updatedToken of updatedTokens) {
			if (!updatedToken.tokenAddress || !updatedToken.chainId) continue;
			
			const tokenKey = `${updatedToken.chainId}-${updatedToken.tokenAddress}`;
			
			// Find index of existing token
			const existingIndex = this.data.findIndex(token => 
				token.chainId === updatedToken.chainId && 
				token.tokenAddress === updatedToken.tokenAddress
			);
			
			if (existingIndex >= 0) {
				// Update existing token data
				this.data[existingIndex] = { ...this.data[existingIndex], ...updatedToken };
			} else {
				// Add as new token
				this.data.push(updatedToken);
			}
		}
	}
	
	/**
	 * Main method to fetch data from DexScreener
	 * @returns {Promise<Array>} The fetched data
	 */
	async fetchData() {
		try {
			// Get token profiles
			const profiles = await this.fetchLatestTokenProfiles();
			
			// Select which tokens to fetch market data for
			const tokensToUpdate = await this.selectTokensForMarketDataUpdate(profiles);
			
			// Fetch market data for selected tokens
			const updatedTokens = await this.fetchTokenMarketData(tokensToUpdate);
			
			// Update existing token data with the new market data
			this.updateTokenDataWithNewMarketData(updatedTokens);
			
			// Sort and limit data
			this.sortAndLimitData(this.tokenSortFunction);
			
			this.lastFetchTime = Date.now();
			return this.data;
		} catch (error) {
			console.error('Error in DexScreener fetchData:', error);
			return this.data;
		}
	}
	
	/**
	 * Process the raw data from DexScreener
	 * @param {Array} rawData Raw data from the API
	 * @returns {Array} Processed data
	 */
	processData(rawData) {
		// In this implementation, most processing is done during fetchData
		// This method is provided for compatibility with the DataProcessor interface
		return rawData;
	}
	
	/**
	 * Default sort function for token data
	 * @param {Object} a First token
	 * @param {Object} b Second token
	 * @returns {number} Sort order
	 */
	tokenSortFunction(a, b) {
		// Default behavior: Sort by liquidity (descending)
		const liquidityA = parseFloat(a.liquidity?.usd || 0);
		const liquidityB = parseFloat(b.liquidity?.usd || 0);
		
		return liquidityB - liquidityA;
	}
	
	/**
	 * Refresh all token data
	 * @returns {Promise<Array>} Updated token data
	 */
	async refreshAllTokenData() {
		try {
			// Get latest token profiles
			const profiles = await this.fetchLatestTokenProfiles();
			
			if (!profiles || profiles.length === 0) {
				console.warn('No token profiles returned from API');
				return this.data;
			}
			
			// Take only the top N profiles to avoid too many API calls
			const limitedProfiles = profiles.slice(0, this.maxTokensToDisplay);
			
			// Fetch market data for all tokens
			const updatedTokens = await this.fetchTokenMarketData(limitedProfiles);
			
			// Clear existing data and replace with updated tokens
			this.data = updatedTokens;
			
			// Sort and limit
			this.sortAndLimitData(this.tokenSortFunction);
			
			return this.data;
		} catch (error) {
			console.error('Error refreshing all token data:', error);
			return this.data;
		}
	}
	
	/**
	 * Calculate a normalized size value for a token based on its market metrics
	 * Used for visualizations like the token cube
	 * @param {Object} token Token data
	 * @returns {number} Normalized size value (0.5 to 2.0)
	 */
	calculateTokenSize(token) {
		// Base size
		let size = 1.0;
		
		// Adjust by volume
		if (token.volume) {
			const volumeUsd = parseFloat(token.volume.h24 || 0);
			
			// Logarithmic scale for volume
			if (volumeUsd > 0) {
				const volumeFactor = Math.min(Math.log10(volumeUsd) / 10, 1);
				size += volumeFactor * 0.5;
			}
		}
		
		// Adjust by price change
		if (token.priceChange) {
			const priceChange = Math.abs(parseFloat(token.priceChange.h24 || 0));
			
			// Higher price change (pos or neg) = bigger size
			if (priceChange > 0) {
				const changeFactor = Math.min(priceChange / 100, 1);
				size += changeFactor * 0.5;
			}
		}
		
		// Cap size between 0.5 and 2.0
		return Math.max(0.5, Math.min(size, 2.0));
	}
	
	/**
	 * Format a market cap value to a human-readable string
	 * @param {number|string} marketCap Raw market cap value
	 * @returns {string} Formatted market cap
	 */
	formatMarketCap(marketCap) {
		if (!marketCap) return 'N/A';
		
		const cap = parseFloat(marketCap);
		if (isNaN(cap)) return 'N/A';
		
		if (cap >= 1e9) {
			return `$${(cap / 1e9).toFixed(2)}B`;
		} else if (cap >= 1e6) {
			return `$${(cap / 1e6).toFixed(2)}M`;
		} else if (cap >= 1e3) {
			return `$${(cap / 1e3).toFixed(2)}K`;
		} else {
			return `$${cap.toFixed(2)}`;
		}
	}
	
	/**
	 * Get a token by its index in the sorted data array
	 * @param {number} index Index of the token
	 * @returns {Object|null} Token data or null if not found
	 */
	getTokenByIndex(index) {
		if (index >= 0 && index < this.data.length) {
			return this.data[index];
		}
		return null;
	}
} 