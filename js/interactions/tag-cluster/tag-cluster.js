/**
 * TagCluster - Integration layer between DexScreener token data and the tag system
 * Creates and manages tags based on token data with market cap-based sizing
 * 
 * Features:
 * - Dynamic creation and removal of token tags with smooth animations
 * - Market cap-based sizing of tags for visual importance
 * - Fly-in animation for new tokens and fly-out animation for removed tokens
 * - Balanced addition of tokens (60 on first update, then 2 per update)
 * - Token data mapping with fallback strategies for incomplete data
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
			maxTags: 150,                     // Maximum number of tags to display
			updateInterval: 10000,           // How often to update tokens (ms)
			minTagSize: 0.5,                 // Minimum tag size
			maxTagSize: 5.0,                 // Maximum tag size
			initialTagCount: 50,              // Initial number of tags
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
		this.firstUpdate = true; // Flag for first update to add 30 tags
	}
	
	/**
	 * Initialize the tag cluster without initial data
	 */
	initialize() {
		if (!this.tagManager.fontLoaded) {
			// Wait for font to load before initializing
			setTimeout(() => this.initialize(), 100);
			return;
		}

		// Mark as initialized without adding any initial tags
		this.initialized = true;
		this.firstUpdate = true; // Flag for first update to add 30 tags
		console.log('Tag cluster initialized, ready to add tokens dynamically');
	}
	
	/**
	 * Update the tag cluster with new token data
	 * @param {Array} newTokens - New token data from DexScreener
	 * This method:
	 * 1. Maps existing tokens to efficiently identify changes
	 * 2. Adds up to 60 new tokens on first update, then 2 per update
	 * 3. Updates existing token properties (size, etc.)
	 * 4. Animates removal of tokens no longer in the dataset with a fly-out effect
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
		
		// Create map of existing tokens by key for faster lookup
		const existingTokensMap = new Map();
		Array.from(this.tokenTags.keys()).forEach(key => {
			existingTokensMap.set(key, true);
		});
		
		// Create map of new tokens by key
		const newTokensMap = new Map();
		newTokens.forEach(token => {
			const key = this.getTokenKey(token);
			if (key) {
				newTokensMap.set(key, token);
			}
		});
		
		// Store the new tokens
		this.tokens = [...newTokens];
		
		// Find tokens to remove (no longer in the list)
		const tokensToRemove = [];
		existingTokensMap.forEach((_, key) => {
			if (!newTokensMap.has(key)) {
				tokensToRemove.push(key);
			}
		});
		
		// Find tokens to add (new tokens, ensuring no duplicates)
		const tokensToAdd = [];
		newTokensMap.forEach((token, key) => {
			if (!existingTokensMap.has(key)) {
				tokensToAdd.push(token);
			}
		});
		
		// Add new tokens dynamically 
		const tagsToAddLimit = this.firstUpdate ? Math.min(60, this.options.maxTags) : 2; // Add up to 60 on first update, then 2 per update
		const tagsToAdd = Math.min(
			tokensToAdd.length,
			this.options.maxTags - this.tokenTags.size,
			tagsToAddLimit
		);
		
		// Log the number of tokens to add for debugging
		console.log(`Attempting to add ${tagsToAdd} new tokens out of ${tokensToAdd.length} available (firstUpdate: ${this.firstUpdate})`);
		
		// Add some new tokens
		for (let i = 0; i < tagsToAdd; i++) {
			if (i < tokensToAdd.length) {
				const addedTag = this.addTokenTag(tokensToAdd[i]);
				if (addedTag) {
					console.log(`Successfully added token ${i+1}/${tagsToAdd}: ${addedTag.originalName}`);
				} else {
					console.warn(`Failed to add token ${i+1}/${tagsToAdd}`);
				}
			}
		}
		
		// Update existing token tags
		newTokensMap.forEach((token, key) => {
			if (existingTokensMap.has(key)) {
				this.updateTokenTag(token);
			}
		});
		
		// Remove old tokens with animation
		tokensToRemove.forEach(key => this.animateTokenRemoval(key));
		
		// Reset first update flag after adding initial batch
		if (this.firstUpdate) {
			this.firstUpdate = false;
		}
		
		// If we have an update callback, call it
		if (this.updateCallback) {
			this.updateCallback(this.tokens, this.tokenTags);
		}
	}
	
	/**
	 * Get a consistent key for a token
	 * @param {Object} token - Token data
	 * @returns {string} - Unique key for the token
	 */
	getTokenKey(token) {
		if (!token) return null;
		
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
		return `${chainId}-${tokenAddress}`;
	}
	
	/**
	 * Animate token tag removal with fly-out effect
	 * @param {string} tokenKey - Token key to remove
	 */
	animateTokenRemoval(tokenKey) {
		// Get tag ID
		const tagId = this.tokenTags.get(tokenKey);
		if (!tagId) return;
		
		// Find the tag object
		const tag = this.tagManager.tags.find(t => t.id === tagId);
		if (!tag || !tag.mesh) return;
		
		// Create an animation to fly the tag away
		const duration = 2000; // Animation duration in ms (increased for smoother effect)
		const startTime = Date.now();
		const startPosition = tag.mesh.position.clone();
		
		// Calculate direction away from center (for a more natural fly-out)
		const direction = tag.mesh.position.clone().normalize();
		const distance = tag.mesh.position.length() * 2; // Fly twice as far as current distance
		const endPosition = direction.multiplyScalar(distance);
		
		// Store original rotation
		const startRotation = tag.mesh.rotation.clone();
		
		// Create the animation function
		const animateOut = () => {
			const elapsed = Date.now() - startTime;
			const progress = Math.min(elapsed / duration, 1);
			
			// Apply easing function
			const easedProgress = this.easeOutCubic(progress);
			
			// Update position
			if (tag.mesh) {
				tag.mesh.position.lerpVectors(startPosition, endPosition, easedProgress);
				
				// Add some rotation for a more dynamic effect
				tag.mesh.rotation.x = startRotation.x + easedProgress * Math.PI * 0.5;
				tag.mesh.rotation.y = startRotation.y + easedProgress * Math.PI * 0.25;
				
				// Scale down as it flies away
				const scale = 1 - easedProgress * 0.9;
				tag.mesh.scale.set(scale, scale, scale);
				
				// Continue animation if not complete
				if (progress < 1) {
					requestAnimationFrame(animateOut);
				} else {
					// Animation complete, remove the tag
					this.removeTokenTag(tokenKey);
				}
			} else {
				// Mesh was removed, clean up
				this.removeTokenTag(tokenKey);
			}
		};
		
		// Start the animation
		animateOut();
	}
	
	/**
	 * Easing function for smooth animation
	 * @param {number} t - Progress from 0 to 1
	 * @returns {number} - Eased value
	 */
	easeOutCubic(t) {
		return 1 - Math.pow(1 - t, 3);
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
		
		// Generate key for this token
		const tokenKey = this.getTokenKey(token);
		if (!tokenKey) return null;
		
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
		try {
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
		} catch (error) {
			console.error(`Error creating tag for token ${displaySymbol}:`, error);
			return null;
		}
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
		
		// Generate key for this token
		const tokenKey = this.getTokenKey(token);
		if (!tokenKey) return false;
		
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
