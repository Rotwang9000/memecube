/**
 * DexScreener Data Provider
 * Implements TokenDataProvider for DexScreener API
 */

import { TokenDataProvider } from './TokenDataProvider.js';

export class DexScreenerProvider extends TokenDataProvider {
	constructor() {
		super();
		
		// DexScreener API endpoints
		this.apiEndpointProfiles = 'https://api.dexscreener.com/token-profiles/latest/v1';
		this.apiEndpointSearch = 'https://api.dexscreener.com/latest/dex/search';
		this.apiEndpointPairs = 'https://api.dexscreener.com/token-pairs/v1';
		this.apiEndpointTokens = 'https://api.dexscreener.com/tokens/v1';
		
		// Storage for tokens and profiles
		this.tokenData = [];
		this.tokenProfiles = [];
		this.maxTokensToStore = 100;
		
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
	 * @returns {Array} Array of tokens to update
	 */
	selectTokensForMarketDataUpdate(profiles) {
		const tokensToUpdate = [];
		
		// 1. Filter for new tokens we haven't fetched market data for yet
		for (const token of profiles) {
			if (!token.chainId || !token.tokenAddress) continue;
			
			const tokenKey = `${token.chainId}-${token.tokenAddress}`;
			if (!this.fetchedTokenAddresses.has(tokenKey)) {
				tokensToUpdate.push(token);
				this.fetchedTokenAddresses.add(tokenKey);
			}
		}
		
		// 2. Add a few random tokens from our existing collection for refresh
		// Choose 2 random tokens from existing data to update
		if (this.tokenData.length > 0) {
			const randomCount = Math.min(2, this.tokenData.length);
			const indexes = new Set();
			
			// Get random indexes to update
			while (indexes.size < randomCount) {
				indexes.add(Math.floor(Math.random() * this.tokenData.length));
			}
			
			// Add randomly selected tokens to update list
			for (const index of indexes) {
				tokensToUpdate.push(this.tokenData[index]);
			}
		}
		
		return tokensToUpdate;
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
			
			// Find index of existing token
			const existingIndex = this.tokenData.findIndex(token => 
				token.chainId === updatedToken.chainId && 
				token.tokenAddress === updatedToken.tokenAddress
			);
			
			if (existingIndex >= 0) {
				// Update existing token data
				this.tokenData[existingIndex] = { ...this.tokenData[existingIndex], ...updatedToken };
			} else {
				// Add as new token
				this.tokenData.push(updatedToken);
			}
		}
	}
	
	// --- TokenDataProvider Interface Implementation ---
	
	/**
	 * Refresh all token data from DexScreener
	 * @returns {Promise<Array>} The updated token data
	 */
	async refreshData() {
		try {
			console.log("DexScreenerProvider: Refreshing token data...");
			
			// Get token profiles
			const profiles = await this.fetchLatestTokenProfiles();
			console.log(`DexScreenerProvider: Fetched ${profiles.length} token profiles`);
			
			// Select which tokens to fetch market data for
			const tokensToUpdate = this.selectTokensForMarketDataUpdate(profiles);
			console.log(`DexScreenerProvider: Selected ${tokensToUpdate.length} tokens for market data update`);
			
			// Fetch market data for selected tokens
			const updatedTokens = await this.fetchTokenMarketData(tokensToUpdate);
			console.log(`DexScreenerProvider: Fetched market data for ${updatedTokens.length} tokens`);
			
			// Update existing token data with the new market data
			this.updateTokenDataWithNewMarketData(updatedTokens);
			
			// Sort and limit data
			this.sortTokenData();
			
			this.lastFetchTime = Date.now();
			
			// Notify callbacks with updated data
			console.log(`DexScreenerProvider: Notifying callbacks with ${this.tokenData.length} tokens`);
			this.notifyCallbacks(this.tokenData);
			
			// Output some sample token data for debugging
			if (this.tokenData.length > 0) {
				console.log("DexScreenerProvider: Sample token data:", this.tokenData[0]);
			}
			
			return this.tokenData;
		} catch (error) {
			console.error('Error refreshing DexScreener data:', error);
			return this.tokenData;
		}
	}
	
	/**
	 * Sort token data by market cap (descending)
	 */
	sortTokenData() {
		// Sort by market cap (highest first)
		this.tokenData.sort((a, b) => {
			const marketCapA = parseFloat(a.marketCap || 0);
			const marketCapB = parseFloat(b.marketCap || 0);
			
			// If market caps are equal, sort by volume
			if (marketCapA === marketCapB) {
				const volumeA = parseFloat(a.volume?.h24 || 0);
				const volumeB = parseFloat(b.volume?.h24 || 0);
				return volumeB - volumeA;
			}
			
			return marketCapB - marketCapA;
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
	 * Get all available token data
	 * @returns {Array} All available token data
	 */
	getAllTokenData() {
		return [...this.tokenData];
	}
	
	/**
	 * Calculate a visual size for a token based on its market cap and volume
	 * @param {Object} token Token to calculate size for
	 * @returns {number} Size value between 0.5 and 2.0
	 */
	calculateTokenSize(token) {
		if (!token) return 0.7; // Default size
		
		// Get market cap
		const marketCap = parseFloat(token.marketCap || 0);
		if (marketCap <= 0) {
			// If no market cap, use volume-based sizing
			const volume = parseFloat(token.volume?.h24 || 0);
			if (volume > 0) {
				// Map volume to size (0.5 - 1.5)
				const volumeSizeScale = Math.log10(volume) / 8; // Log scale
				return 0.5 + Math.min(1.0, volumeSizeScale);
			}
			return 0.7; // Default size
		}
		
		// Map market cap to size using logarithmic scale
		// This gives better distribution across wide market cap ranges
		// Small cap: 0.5-0.8, Mid cap: 0.8-1.2, Large cap: 1.2-2.0
		const sizeScale = Math.log10(marketCap) / 8;
		return 0.5 + Math.min(1.5, sizeScale);
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
} 