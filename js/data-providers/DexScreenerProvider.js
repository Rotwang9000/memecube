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
		this.apiEndpointPairs = 'https://api.dexscreener.com/latest/dex/pairs';
		this.apiEndpointTokenPairs = 'https://api.dexscreener.com/token-pairs/v1';
		
		// Storage for tokens and profiles
		this.tokenData = [];
		this.tokenProfiles = [];
		this.maxTokensToStore = 100;
		
		// Track tokens by page
		this.tokensByPage = new Map();
		this.currentPage = 'dexscreener/latest';
		
		// Initial load configuration
		this.isFirstLoad = true;
		this.refreshTokenCount = 2;      // Get 2 tokens on regular refresh
		
		// Set refresh rate for token data
		this.fetchInterval = 6000; // 6 seconds 
		
		// Token pair data cache (individual token pair details, NOT the full token list)
		this.tokenPairCache = new Map();
		this.cacheExpiryTime = 5 * 60 * 1000; // 5 minutes for token pair data
		
		// Track which tokens have already had market data fetched
		this.fetchedTokenAddresses = new Set();
		
		// Save timestamp of last cache save to localStorage
		this.lastCacheSave = 0;
		this.cacheSaveInterval = 60 * 1000; // 1 minute
		
		// Clear any outdated cache on initialization to ensure fresh data
		this.clearOutdatedCache();
		
		// Try to load cache from localStorage on initialization for token pair data only
		this.loadCacheFromStorage();
	}
	
	/**
	 * Clear any outdated cache from localStorage to ensure we start with fresh data for token pairs
	 */
	clearOutdatedCache() {
		try {
			const cachedData = localStorage.getItem('tokenPairCache');
			if (cachedData) {
				const parsedCache = JSON.parse(cachedData);
				const now = Date.now();
				// Clear cache if it's older than 5 minutes
				if (now - parsedCache.timestamp > this.cacheExpiryTime) {
					console.log('DexScreenerProvider: Clearing outdated token pair cache from localStorage');
					localStorage.removeItem('tokenPairCache');
				}
			}
		} catch (error) {
			console.error('Error clearing outdated cache:', error);
		}
	}
	
	/**
	 * Save the current cache to localStorage
	 */
	saveCacheToStorage() {
		try {
			const now = Date.now();
			// Only save cache periodically to avoid excessive writes
			if (now - this.lastCacheSave < this.cacheSaveInterval) {
				return;
			}
			
			// Convert the Map to an array of entries
			const cacheEntries = Array.from(this.tokenPairCache.entries());
			const cacheToSave = {
				timestamp: now,
				entries: cacheEntries
			};
			
			localStorage.setItem('tokenPairCache', JSON.stringify(cacheToSave));
			this.lastCacheSave = now;
			console.log('DexScreenerProvider: Saved token pair cache to localStorage');
		} catch (error) {
			console.error('Error saving cache to localStorage:', error);
		}
	}
	
	/**
	 * Load the cache from localStorage for token pair data only
	 */
	loadCacheFromStorage() {
		try {
			const cachedData = localStorage.getItem('tokenPairCache');
			if (!cachedData) return;
			
			const parsedCache = JSON.parse(cachedData);
			const now = Date.now();
			
			// Check if overall cache is expired (older than 5 minutes for token pair data)
			if (now - parsedCache.timestamp > this.cacheExpiryTime) {
				console.log('DexScreenerProvider: Cache in localStorage is older than 5 minutes, discarding');
				localStorage.removeItem('tokenPairCache');
				return;
			}
			
			// Reconstruct the Map from the array of entries
			const cacheMap = new Map(parsedCache.entries);
			
			// Filter out expired entries
			for (const [key, value] of cacheMap.entries()) {
				if (now - value.timestamp > this.cacheExpiryTime) {
					cacheMap.delete(key);
				}
			}
			
			this.tokenPairCache = cacheMap;
			console.log(`DexScreenerProvider: Loaded ${cacheMap.size} token pair details from localStorage cache`);
		} catch (error) {
			console.error('Error loading cache from localStorage:', error);
		}
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
	 * Check if a token pair is cached and not expired
	 * @param {string} chainId The chain ID
	 * @param {string} tokenAddress The token address
	 * @returns {Object|null} The cached pair data or null if not cached or expired
	 */
	getCachedTokenPair(chainId, tokenAddress) {
		const cacheKey = `${chainId}-${tokenAddress}`;
		const cachedData = this.tokenPairCache.get(cacheKey);
		
		if (!cachedData) return null;
		
		// Check if cache has expired
		const now = Date.now();
		if (now - cachedData.timestamp > this.cacheExpiryTime) {
			// Expired cache entry, remove it
			this.tokenPairCache.delete(cacheKey);
			return null;
		}
		
		return cachedData.data;
	}
	
	/**
	 * Add token pair data to cache
	 * @param {string} chainId The chain ID
	 * @param {string} tokenAddress The token address
	 * @param {Object} pairData The pair data to cache
	 */
	cacheTokenPair(chainId, tokenAddress, pairData) {
		const cacheKey = `${chainId}-${tokenAddress}`;
		this.tokenPairCache.set(cacheKey, {
			data: pairData,
			timestamp: Date.now()
		});
		
		// Schedule a cache save
		setTimeout(() => this.saveCacheToStorage(), 100);
	}
	
	/**
	 * Fetch token pair data directly using the pairs endpoint
	 * @param {string} chainId The chain ID
	 * @param {string} pairAddress The pair address
	 * @returns {Promise<Object|null>} The pair data or null if not found
	 */
	async fetchPairData(chainId, pairAddress) {
		try {
			const response = await fetch(`${this.apiEndpointPairs}/${chainId}/${pairAddress}`);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			
			const data = await response.json();
			if (data.pairs && data.pairs.length > 0) {
				return data.pairs[0];
			}
			
			return null;
		} catch (error) {
			console.error(`Error fetching pair data for ${chainId}/${pairAddress}:`, error);
			return null;
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
			console.log(`DexScreenerProvider: Fetching market data for ${tokens.length} tokens`);
			let cacheHits = 0;
			let apiHits = 0;
			
			// Create array of promises for each token's market data
			const promises = tokens.map(async (token) => {
				// Skip if token doesn't have required data
				if (!token.chainId || !token.tokenAddress) {
					return null;
				}
				
				// Check if we already have this token in our cache
				const cachedPair = this.getCachedTokenPair(token.chainId, token.tokenAddress);
				if (cachedPair) {
					// Use cached data but mark as fetched
					this.fetchedTokenAddresses.add(`${token.chainId}-${token.tokenAddress}`);
					cacheHits++;
					return { ...token, ...cachedPair };
				}
				
				// Mark token as fetched
				this.fetchedTokenAddresses.add(`${token.chainId}-${token.tokenAddress}`);
				
				// Use token-pairs endpoint to get all pairs for this token
				const url = `${this.apiEndpointTokenPairs}/${token.chainId}/${token.tokenAddress}`;
				
				const response = await fetch(url);
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}
				
				apiHits++;
				const data = await response.json();
				
				// If we got pairs data (should be an array of pairs)
				if (Array.isArray(data) && data.length > 0) {
					// Find the top pair by liquidity
					const topPair = data.reduce((best, current) => {
						const bestLiquidity = parseFloat(best.liquidity?.usd || 0);
						const currentLiquidity = parseFloat(current.liquidity?.usd || 0);
						return currentLiquidity > bestLiquidity ? current : best;
					}, data[0]);
					
					// Cache this pair for later use
					this.cacheTokenPair(token.chainId, token.tokenAddress, topPair);
					
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
			
			// Log source of token data
			console.log(`DexScreenerProvider: Data sources - API: ${apiHits}, Cache: ${cacheHits}`);
			
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
		
		// Process tokens from the latest API fetch
		console.log(`DexScreenerProvider: Processing ${profiles.length} token profiles for updates`);
		
		if (this.isFirstLoad) {
			console.log(`DexScreenerProvider: First load, selecting all ${profiles.length} tokens for market data update`);
			for (const token of profiles) {
				if (!token.chainId || !token.tokenAddress) continue;
				const tokenKey = `${token.chainId}-${token.tokenAddress}`;
				tokensToUpdate.push(token);
				this.fetchedTokenAddresses.add(tokenKey);
			}
			this.isFirstLoad = false;
			console.log(`DexScreenerProvider: First load completed`);
		} else {
			for (const token of profiles) {
				if (!token.chainId || !token.tokenAddress) continue;
				
				const tokenKey = `${token.chainId}-${token.tokenAddress}`;
				// Check if we need to fetch market data (not in cache or cache expired)
				const cachedData = this.getCachedTokenPair(token.chainId, token.tokenAddress);
				if (!cachedData) {
					tokensToUpdate.push(token);
					console.log(`Added token for update (no or expired cache): ${tokenKey}`);
				}
				// Mark as seen, even if using cached data
				this.fetchedTokenAddresses.add(tokenKey);
			}
			
			// If not the first load, refresh a few existing tokens
			console.log(`DexScreenerProvider: Regular refresh, selecting up to ${this.refreshTokenCount} additional tokens`);
			
			if (this.tokenData.length > 0) {
				const randomCount = Math.min(this.refreshTokenCount, this.tokenData.length);
				const indexes = new Set();
				
				while (indexes.size < randomCount) {
					indexes.add(Math.floor(Math.random() * this.tokenData.length));
				}
				
				for (const index of indexes) {
					const token = this.tokenData[index];
					const tokenKey = `${token.chainId}-${token.tokenAddress}`;
					
					// Remove from cache to force fresh data fetch
					if (token.chainId && token.tokenAddress) {
						const cacheKey = `${token.chainId}-${token.tokenAddress}`;
						if (this.tokenPairCache.has(cacheKey)) {
							this.tokenPairCache.delete(cacheKey);
							console.log(`Removed token from cache to force refresh: ${cacheKey}`);
						}
					}
					
					if (!tokensToUpdate.some(t => `${t.chainId}-${t.tokenAddress}` === tokenKey)) {
						tokensToUpdate.push(token);
					}
				}
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
	
	/**
	 * Get tokens by page identifier
	 * @param {string} pageId The page identifier (e.g., 'dexscreener/latest')
	 * @returns {Promise<Array>} Array of tokens for the requested page
	 */
	async getTokensByPage(pageId = 'dexscreener/latest') {
		// Set as current page
		this.currentPage = pageId;
		
		// Check if we already have tokens for this page
		if (this.tokensByPage.has(pageId) && this.tokensByPage.get(pageId).length > 0) {
			return this.tokensByPage.get(pageId);
		}
		
		// Handle different page types
		if (pageId === 'dexscreener/latest') {
			// Fetch latest token profiles
			const profiles = await this.fetchLatestTokenProfiles();
			
			// Fetch market data for these profiles
			const tokensWithData = await this.fetchTokenMarketData(profiles);
			
			// Store in our page map
			this.tokensByPage.set(pageId, tokensWithData);
			
			// Also update our main token data store
			this.updateTokenDataWithNewMarketData(tokensWithData);
			
			return tokensWithData;
		}
		
		// For future page types, add more handlers here
		
		// Default: return empty array if page type not recognized
		return [];
	}
	
	/**
	 * Get tokens for the current page
	 * @returns {Promise<Array>} Array of token data for current page
	 */
	async getCurrentPageTokens() {
		// Get the current page data
		if (!this.tokensByPage.has(this.currentPage) || this.tokensByPage.get(this.currentPage).length === 0) {
			await this.updateCurrentPageTokens();
		}
		
		// Return tokens for the current page
		const tokens = this.tokensByPage.get(this.currentPage) || [];
		
		// Add metadata to identify these tokens as coming from the provider
		return tokens.map(token => ({
			...token,
			_metadata: {
				source: 'dexscreener',
				page: this.currentPage,
				fetchedAt: Date.now()
			}
		}));
	}
	
	/**
	 * Update tokens for the current page
	 * @returns {Promise<Array>} Updated tokens for the current page
	 */
	async updateCurrentPageTokens() {
		// Clear the current page from cache to force refresh
		this.tokensByPage.delete(this.currentPage);
		
		// Fetch fresh tokens for the current page
		return this.getTokensByPage(this.currentPage);
	}
	
	// --- TokenDataProvider Interface Implementation ---
	
	/**
	 * Refresh all token data from DexScreener
	 * @returns {Promise<Array>} The updated token data
	 */
	async refreshData() {
		try {
			console.log("DexScreenerProvider: Refreshing token data...");
			
			// Only perform a full refresh of all tokens if:
			// 1. It's been more than 60 seconds since last refresh, OR
			// 2. We have no token data yet
			const now = Date.now();
			const fullRefreshNeeded = this.tokenData.length === 0 || 
				(now - this.lastFetchTime > 60000);
				
			// Log refresh type
			console.log(`DexScreenerProvider: Performing ${fullRefreshNeeded ? 'FULL' : 'PARTIAL'} refresh`);
			
			let currentPageTokens;
			
			if (fullRefreshNeeded) {
				// For full refresh, update the entire current page
				currentPageTokens = await this.updateCurrentPageTokens();
			} else {
				// For partial refresh, use existing token data with selected updates
				currentPageTokens = this.tokensByPage.get(this.currentPage) || [];
				
				// If no tokens in cache yet, force a full refresh
				if (currentPageTokens.length === 0) {
					console.log("DexScreenerProvider: No tokens in cache, forcing full refresh");
					currentPageTokens = await this.updateCurrentPageTokens();
				}
			}
			
			// Select which tokens to fetch market data for
			const tokensToUpdate = this.selectTokensForMarketDataUpdate(currentPageTokens);
			console.log(`DexScreenerProvider: Selected ${tokensToUpdate.length} tokens for market data update`);
			
			// Only fetch market data if we have tokens to update
			if (tokensToUpdate.length > 0) {
				// Fetch market data for selected tokens
				const updatedTokens = await this.fetchTokenMarketData(tokensToUpdate);
				console.log(`DexScreenerProvider: Updated market data for ${updatedTokens.length} tokens (from cache and/or API)`);
				
				// Update existing token data with the new market data
				this.updateTokenDataWithNewMarketData(updatedTokens);
				
				// Sort and limit data
				this.sortTokenData();
			} else {
				console.log("DexScreenerProvider: No tokens selected for update");
			}
			
			// Track last update time
			this.lastFetchTime = now;
			
			// Save cache periodically
			this.saveCacheToStorage();
			
			// Notify callbacks with current page tokens
			// ONLY if we actually updated something
			if (tokensToUpdate.length > 0 || fullRefreshNeeded) {
				console.log("DexScreenerProvider: Notifying callbacks with updated token data");
				await this.notifyCallbacks(currentPageTokens);
			} else {
				console.log("DexScreenerProvider: Skipping callback notification (no significant changes)");
			}
			
			return currentPageTokens;
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
		if (!token || !token.chainId || !token.pairAddress) {
			return null;
		}
		
		try {
			// Construct API URL - Note: Correct endpoint for candles
			const url = `${this.apiEndpointPairs}/${token.chainId}/${token.pairAddress}/candles`;
			
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
	 * @deprecated Use getCurrentPageTokens() instead for async token retrieval
	 */
	getAllTokenData() {
		console.warn('getAllTokenData() is deprecated, use getCurrentPageTokens() instead for async token retrieval');
		return [...this.tokenData];
	}
	
	/**
	 * Calculate a visual size for a token based on its market cap and volume
	 * @param {Object} token Token to calculate size for
	 * @returns {number} Size value based on a reference scale of 0.5 to 2.0
	 */
	calculateTokenSize(token) {
		if (!token) return 0.7; // Default size
		
		// Get market cap
		const marketCap = parseFloat(token.marketCap || 0);
		if (marketCap <= 0) {
			// If no market cap, use volume-based sizing
			const volume = parseFloat(token.volume?.h24 || 0);
			if (volume > 0) {
				// Map volume to size (reference scale 0.5 - 1.5)
				const volumeSizeScale = Math.log10(volume) / 8; // Log scale
				return 0.5 + volumeSizeScale;
			}
			return 0.7; // Default size
		}
		
		// Map market cap to size using logarithmic scale
		// This gives better distribution across wide market cap ranges
		// Reference scale - Small cap: 0.5-0.8, Mid cap: 0.8-1.2, Large cap: 1.2-2.0
		const sizeScale = Math.log10(marketCap) / 8;
		return 0.5 + sizeScale;
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