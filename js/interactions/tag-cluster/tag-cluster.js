/**
 * TagCluster - Integration layer between DexScreener token data and the tag system
 * Creates and manages tags based on token data with market cap-based sizing
 */

import { TagManager } from '../tag-manager.js';
import { TagPhysics } from '../tag-physics.js';

export class TagCluster {
	/**
	 * Create a new TagCluster
	 * @param {THREE.Scene} scene - Three.js scene
	 * @param {THREE.Camera} camera - Three.js camera
	 * @param {Object} options - Configuration options
	 */
	constructor(scene, camera, options = {}) {
		// Store references
		this.scene = scene;
		this.camera = camera;
		
		// Configuration
		this.options = {
			maxTags: 50,                     // Maximum number of tags to display
			updateInterval: 10000,           // How often to update tokens (ms)
			minTagSize: 0.5,                 // Minimum tag size
			maxTagSize: 2.0,                 // Maximum tag size
			initialTagCount: 5,              // Initial number of tags
			baseTokenUrl: 'https://dexscreener.com/ethereum/',
			...options
		};
		
		// Create the tag manager
		this.tagManager = new TagManager(scene, camera);
		
		// Track tokens and tags
		this.tokens = [];           // Token data from DexScreener
		this.tokenTags = new Map(); // Map token addresses to tag IDs
		
		// State tracking
		this.initialized = false;
		this.lastUpdateTime = 0;
		this.updateCallback = null;
	}
	
	/**
	 * Initialize the tag cluster with initial data
	 * @param {Array} initialTokens - Initial token data
	 */
	initialize(initialTokens = []) {
		if (!this.tagManager.fontLoaded) {
			// Wait for font to load before initializing
			setTimeout(() => this.initialize(initialTokens), 100);
			return;
		}
		
		// Store initial tokens
		this.tokens = [...initialTokens];
		
		// Add initial tags if we have tokens
		if (this.tokens.length > 0) {
			// Add up to initialTagCount tags
			const tagsToAdd = Math.min(this.options.initialTagCount, this.tokens.length);
			
			for (let i = 0; i < tagsToAdd; i++) {
				this.addTokenTag(this.tokens[i]);
			}
		}
		
		// Mark as initialized
		this.initialized = true;
		console.log('Tag cluster initialized with', this.tokenTags.size, 'tokens');
	}
	
	/**
	 * Update the tag cluster with new token data
	 * @param {Array} newTokens - New token data from DexScreener
	 */
	updateTokens(newTokens) {
		if (!this.initialized || !newTokens) return;
		
		// Track the current time
		const now = Date.now();
		
		// Check if we should update (rate limiting)
		if (now - this.lastUpdateTime < this.options.updateInterval) {
			return;
		}
		
		// Store the last update time
		this.lastUpdateTime = now;
		
		// Store the new tokens
		this.tokens = [...newTokens];
		
		// Track tokens to add and remove
		const existingTokenAddresses = Array.from(this.tokenTags.keys());
		const newTokenAddresses = this.tokens.map(t => `${t.chainId}-${t.tokenAddress}`);
		
		// Find tokens to remove (no longer in the list)
		const tokensToRemove = existingTokenAddresses.filter(
			addr => !newTokenAddresses.includes(addr)
		);
		
		// Find tokens to add (new tokens, up to max tags)
		const tokensToAdd = this.tokens.filter(t => {
			const key = `${t.chainId}-${t.tokenAddress}`;
			return !this.tokenTags.has(key);
		});
		
		// Remove old tokens
		tokensToRemove.forEach(addr => this.removeTokenTag(addr));
		
		// Add new tokens (up to max tags)
		const tagsToAdd = Math.min(
			tokensToAdd.length,
			this.options.maxTags - this.tokenTags.size
		);
		
		for (let i = 0; i < tagsToAdd; i++) {
			this.addTokenTag(tokensToAdd[i]);
		}
		
		// Update existing token tags
		this.tokens.forEach(token => {
			const key = `${token.chainId}-${token.tokenAddress}`;
			if (this.tokenTags.has(key)) {
				this.updateTokenTag(token);
			}
		});
		
		// If we have an update callback, call it
		if (this.updateCallback) {
			this.updateCallback(this.tokens, this.tokenTags);
		}
	}
	
	/**
	 * Add a new tag for a token
	 * @param {Object} token - Token data from DexScreener
	 * @returns {Object|null} - The created tag or null
	 */
	addTokenTag(token) {
		if (!token) {
			console.warn("Attempted to add null token");
			return null;
		}
		
		// Extract chainId and tokenAddress, handling different data structures
		let chainId = token.chainId;
		let tokenAddress = token.tokenAddress;
		
		// Handle case where data is nested differently
		if (!chainId && token.baseToken && token.baseToken.chainId) {
			chainId = token.baseToken.chainId;
		}
		
		if (!tokenAddress && token.baseToken && token.baseToken.address) {
			tokenAddress = token.baseToken.address;
		}
		
		// If we still don't have the required fields, use fallbacks
		if (!chainId) chainId = 'eth'; // Default to Ethereum
		
		if (!tokenAddress) {
			// Create a unique identifier based on what we do have
			if (token.pairAddress) {
				tokenAddress = token.pairAddress;
			} else if (token.baseToken?.symbol) {
				tokenAddress = `symbol-${token.baseToken.symbol}`;
			} else if (token.symbol) {
				tokenAddress = `symbol-${token.symbol}`;
			} else {
				// Use a timestamp as last resort
				tokenAddress = `token-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
			}
		}
		
		// Generate key for this token
		const tokenKey = `${chainId}-${tokenAddress}`;
		
		// Skip if already added
		if (this.tokenTags.has(tokenKey)) {
			return null;
		}
		
		// Determine symbol to display
		let symbol;
		if (token.baseToken?.symbol) {
			symbol = token.baseToken.symbol;
		} else if (token.symbol) {
			symbol = token.symbol;
		} else if (token.name) {
			symbol = token.name;
		} else {
			// Fall back to a generic name
			symbol = 'TOKEN';
		}
		
		// Calculate tag size based on market data
		const size = this.calculateTokenSize(token);
		
		// Generate URL for this token
		const tokenUrl = this.generateTokenUrl(token);
		
		// Add $ prefix to symbol if not already present
		const displaySymbol = symbol.startsWith('$') ? symbol : `$${symbol}`;
		
		console.log(`Creating tag for token: ${displaySymbol} with size ${size.toFixed(2)}`);
		
		// Create the tag
		const tag = this.tagManager.createTag(displaySymbol, tokenUrl, {
			scale: size,
			size: 0.5,     // Base text size before scaling
			depth: 0.65,   // Extrusion depth 
			token: token   // Store reference to token data
		});
		
		// If successful, store in our mapping
		if (tag) {
			this.tokenTags.set(tokenKey, tag.id);
			console.log(`Added token tag: ${displaySymbol} with size ${size.toFixed(2)}`);
		} else {
			console.error(`Failed to create tag for token: ${displaySymbol}`);
		}
		
		return tag;
	}
	
	/**
	 * Update an existing token tag with new data
	 * @param {Object} token - Updated token data
	 * @returns {boolean} - Whether the update was successful
	 */
	updateTokenTag(token) {
		if (!token) {
			return false;
		}
		
		// Extract chainId and tokenAddress, handling different data structures
		let chainId = token.chainId;
		let tokenAddress = token.tokenAddress;
		
		// Handle case where data is nested differently
		if (!chainId && token.baseToken && token.baseToken.chainId) {
			chainId = token.baseToken.chainId;
		}
		
		if (!tokenAddress && token.baseToken && token.baseToken.address) {
			tokenAddress = token.baseToken.address;
		}
		
		// If we still don't have the required fields, try fallbacks
		if (!chainId) chainId = 'eth'; // Default to Ethereum
		
		if (!tokenAddress) {
			// Try to use other identifiers
			if (token.pairAddress) {
				tokenAddress = token.pairAddress;
			} else if (token.baseToken?.symbol) {
				tokenAddress = `symbol-${token.baseToken.symbol}`;
			} else if (token.symbol) {
				tokenAddress = `symbol-${token.symbol}`;
			} else {
				// Not enough info to identify the token
				return false;
			}
		}
		
		// Generate key for this token
		const tokenKey = `${chainId}-${tokenAddress}`;
		
		// Get existing tag ID
		const tagId = this.tokenTags.get(tokenKey);
		if (!tagId) return false;
		
		// Find the tag object
		const tag = this.tagManager.tags.find(t => t.id === tagId);
		if (!tag) return false;
		
		// Calculate new size based on updated market data
		const newSize = this.calculateTokenSize(token);
		
		// Only resize if the size has changed significantly (>5%)
		const currentSize = tag.mesh?.scale.x || 0;
		if (Math.abs(newSize - currentSize) / currentSize > 0.05) {
			this.tagManager.resizeTag(tagId, newSize);
		}
		
		// Update token reference
		tag.token = token;
		
		return true;
	}
	
	/**
	 * Remove a token tag
	 * @param {string} tokenKey - Token key to remove
	 * @returns {boolean} - Whether removal was successful
	 */
	removeTokenTag(tokenKey) {
		// Get tag ID
		const tagId = this.tokenTags.get(tokenKey);
		if (!tagId) return false;
		
		// Find the tag to get its name for logging
		const tag = this.tagManager.tags.find(t => t.id === tagId);
		const name = tag ? tag.originalName : tokenKey;
		
		// Remove from tag manager
		this.tagManager.removeTag(tagId);
		
		// Remove from our mapping
		this.tokenTags.delete(tokenKey);
		
		console.log(`Removed token tag: ${name}`);
		return true;
	}
	
	/**
	 * Calculate token size based on market data
	 * @param {Object} token - Token data
	 * @returns {number} - Size value between minTagSize and maxTagSize
	 */
	calculateTokenSize(token) {
		const { minTagSize, maxTagSize } = this.options;
		
		// Base size
		let size = 1.0;
		
		// Handle different token data structures
		const marketCap = parseFloat(token.marketCap || token.fdv || 0);
		const liquidity = parseFloat(
			token.liquidity?.usd || 
			(token.liquidity && typeof token.liquidity === 'string' ? token.liquidity : 0)
		);
		
		let priceChange = 0;
		if (token.priceChange?.h24) {
			priceChange = parseFloat(token.priceChange.h24);
		} else if (token.priceChange) {
			priceChange = parseFloat(token.priceChange);
		}
		
		// If we have market cap, use it as primary size factor
		if (marketCap > 0) {
			// Logarithmic scale between $10K and $10B
			const minMarketCap = 10_000;      // $10K
			const maxMarketCap = 10_000_000_000; // $10B
			
			// Use logarithmic scale
			const logMin = Math.log(minMarketCap);
			const logMax = Math.log(maxMarketCap);
			const logValue = Math.log(Math.max(minMarketCap, Math.min(maxMarketCap, marketCap)));
			
			// Normalize to 0-1 range
			const normalizedValue = (logValue - logMin) / (logMax - logMin);
			
			// Calculate size
			size = minTagSize + (maxTagSize - minTagSize) * normalizedValue;
		} 
		// Fallback to liquidity if no market cap
		else if (liquidity > 0) {
			// Logarithmic scale between $1K and $1M
			const minLiquidity = 1_000;       // $1K
			const maxLiquidity = 1_000_000;   // $1M
			
			// Use logarithmic scale
			const logMin = Math.log(minLiquidity);
			const logMax = Math.log(maxLiquidity);
			const logValue = Math.log(Math.max(minLiquidity, Math.min(maxLiquidity, liquidity)));
			
			// Normalize to 0-1 range
			const normalizedValue = (logValue - logMin) / (logMax - logMin);
			
			// Calculate size
			size = minTagSize + (maxTagSize - minTagSize) * normalizedValue;
		}
		
		// Bonus size boost for high price change (positive or negative)
		if (priceChange !== 0) {
			const absPriceChange = Math.abs(priceChange);
			
			// If price change is significant (>5%), boost size
			if (absPriceChange > 5) {
				// Cap at 50% change
				const changeFactor = Math.min(absPriceChange, 50) / 50; 
				
				// Add up to 30% bonus size for high volatility
				size *= (1 + changeFactor * 0.3);
			}
		}
		
		// Ensure size is within bounds
		return Math.max(minTagSize, Math.min(size, maxTagSize));
	}
	
	/**
	 * Generate a URL for a token
	 * @param {Object} token - Token data
	 * @returns {string} - URL for the token
	 */
	generateTokenUrl(token) {
		if (!token) return this.options.baseTokenUrl;
		
		// Extract chainId, handling different data structures
		let chainId = token.chainId;
		if (!chainId && token.baseToken && token.baseToken.chainId) {
			chainId = token.baseToken.chainId;
		}
		if (!chainId) chainId = 'ethereum'; // Default to Ethereum
		
		// For tokens with a pairAddress, use that for a specific URL
		if (token.pairAddress) {
			return `https://dexscreener.com/${chainId}/${token.pairAddress}`;
		}
		
		// For tokens with just an address, use token URL
		if (token.tokenAddress) {
			return `https://dexscreener.com/${chainId}/${token.tokenAddress}`;
		}
		
		// For tokens with baseToken address
		if (token.baseToken && token.baseToken.address) {
			return `https://dexscreener.com/${chainId}/${token.baseToken.address}`;
		}
		
		// If token has a URL directly
		if (token.url) {
			return token.url;
		}
		
		// Fallback to base URL
		return this.options.baseTokenUrl;
	}
	
	/**
	 * Set a callback for token updates
	 * @param {Function} callback - Function to call on token updates
	 */
	setUpdateCallback(callback) {
		if (typeof callback === 'function') {
			this.updateCallback = callback;
		}
	}
	
	/**
	 * Update function to be called every frame
	 */
	update() {
		// Update tag manager
		if (this.tagManager) {
			this.tagManager.update();
		}
	}
	
	/**
	 * Dispose of resources
	 */
	dispose() {
		// Clean up tag manager
		if (this.tagManager) {
			// Remove all tags
			const tagIds = this.tagManager.tags.map(tag => tag.id);
			tagIds.forEach(id => this.tagManager.removeTag(id));
			
			// Clear token tag map
			this.tokenTags.clear();
		}
		
		// Clear tokens
		this.tokens = [];
		
		console.log('Tag cluster disposed');
	}
}
