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
 * - Support for sponsored tokens with special styling (gold color and increased size)
 */

import * as THREE from 'three';
import { TagManager } from '../tag-manager.js';
import { TagPhysics } from '../tag-physics.js';
import { getTokenKey } from '../../utils/tokenKey.js';
import { SponsoredTokenService } from '../../services/SponsoredTokenService.js';

export class TagCluster {
	/**
	 * Create a new TagCluster
	 * @param {THREE.Scene} scene - Three.js scene
	 * @param {THREE.Camera} camera - Three.js camera
	 * @param {Object} tagsManagerOrOptions - Either a TagsManager or configuration options
	 * @param {Object} options - Configuration options
	 */
	constructor(scene, camera, tagsManagerOrOptions = null, options = {}) {
		// Store references
		this.scene = scene;
		this.camera = camera;
		
		// Determine if the third parameter is a TagsManager/TagManager or options object
		let suppliedTagManager = null;
		let configOptions = {};
		
		if (tagsManagerOrOptions) {
			// If it looks like a TagManager (has createTag method) or a TagsManager wrapper (has tagManager property)
			if (typeof tagsManagerOrOptions.createTag === 'function' || tagsManagerOrOptions.tagManager) {
				// Handle both raw TagManager and TagsManager wrapper
				suppliedTagManager = tagsManagerOrOptions.tagManager ? tagsManagerOrOptions.tagManager : tagsManagerOrOptions;
			} else if (typeof tagsManagerOrOptions === 'object') {
				// Treat as configuration options
				configOptions = tagsManagerOrOptions;
			}
		}

		// Merge default options with provided configuration options and the explicit options param
		this.options = {
			maxTags: 150,                     // Maximum number of tags to display
			updateInterval: 10000,           // How often to update tokens (ms)
			minTagSize: 1,                 // Minimum tag size
			maxTagSize: 5.0,                 // Maximum tag size
			initialTagCount: 50,              // Initial number of tags
			baseTokenUrl: 'https://dexscreener.com/ethereum/',
			...configOptions,
			...options
		};

		// Use supplied TagManager if available, otherwise create a new one
		if (suppliedTagManager) {
			this.tagManager = suppliedTagManager;
		} else {
			this.tagManager = new TagManager(scene, camera);
		}
		
		// Create a sponsored token service
		this.sponsorService = new SponsoredTokenService();
		
		// Track tokens and tags
		this.tokens = [];           // Token data from DexScreener
		this.tokenTags = new Map(); // Map token addresses to tag IDs
		
		// State tracking
		this.initialized = false;
		this.lastUpdateTime = 0;
		this.updateCallback = null;
		this.firstUpdate = true; // Flag for first update to add 30 tags
		
		// Listen for sponsorship updates
		document.addEventListener('token-sponsorship-updated', this.handleSponsorshipUpdated.bind(this));
	}
	
	/**
	 * Handle sponsorship updates event
	 * @param {CustomEvent} event The sponsorship updated event
	 */
	handleSponsorshipUpdated(event) {
		if (!event.detail) return;
		
		const { tokenId, sponsorships } = event.detail;
		
		// Immediately apply sponsorship styling
		Array.from(this.tokenTags.entries()).forEach(([key, tagId]) => {
			if (key === tokenId) {
				this.applySponsorshipStyling(key);
			}
		});
	}
	
	/**
	 * Apply sponsorship styling to a tag if it's sponsored
	 * @param {string} tokenKey The token key
	 */
	applySponsorshipStyling(tokenKey) {
		// Get the tagId for this token
		const tagId = this.tokenTags.get(tokenKey);
		if (!tagId) return;
		
		// Find the tag
		const tag = this.tagManager.tags.find(t => t.id === tagId);
		if (!tag || !tag.mesh) return;
		
		// Parse the token key for chainId and tokenAddress
		const [chainId, tokenAddress] = tokenKey.split('-');
		if (!chainId || !tokenAddress) return;
		
		// Check if this token is sponsored
		const sponsorInfo = this.sponsorService.getSponsoredTokenVisuals(chainId, tokenAddress);
		
		if (sponsorInfo) {
			// Apply sponsor styling
			const originalSize = tag.originalScale || 1;
			const boostedSize = originalSize * sponsorInfo.sizeMultiplier;
			
			// Store original color if not already stored
			if (!tag.originalColor && tag.mesh.material) {
				tag.originalColor = tag.mesh.material.color.getHex();
			}
			
			// Apply gold color
			if (tag.mesh.material) {
				tag.mesh.material.color.setHex(sponsorInfo.color);
				// Add some glow to sponsored tokens
				tag.mesh.material.emissive = tag.mesh.material.emissive || new THREE.Color();
				tag.mesh.material.emissive.setHex(0x332200);
				tag.mesh.material.emissiveIntensity = 0.3;
			}
			
			// Apply size boost - store original scale if not already stored
			if (!tag.originalScale) {
				tag.originalScale = tag.mesh.scale.x;
			}
			
			// Apply boosted size
			tag.mesh.scale.set(boostedSize, boostedSize, boostedSize);
			
			// Log sponsorship applied
			console.log(`Applied sponsorship to ${tokenKey} - size multiplier: ${sponsorInfo.sizeMultiplier.toFixed(2)}x`);
		} else if (tag.originalColor) {
			// Restore original color if it was previously sponsored
			if (tag.mesh.material) {
				tag.mesh.material.color.setHex(tag.originalColor);
				// Remove glow
				tag.mesh.material.emissive.setHex(0x000000);
				tag.mesh.material.emissiveIntensity = 0;
			}
			
			// Restore original size
			if (tag.originalScale) {
				tag.mesh.scale.set(tag.originalScale, tag.originalScale, tag.originalScale);
			}
			
			// Clear stored originals
			delete tag.originalColor;
			delete tag.originalScale;
			
			console.log(`Removed sponsorship styling from ${tokenKey}`);
		}
	}
	
	/**
	 * Initialize the tag cluster without initial data
	 */
	initialize() {
		console.log('Initializing TagCluster - checking font loaded status:', this.tagManager.fontLoaded);
		
		if (!this.tagManager.fontLoaded) {
			console.log('Font not loaded yet, will retry initialization in 100ms');
			// Wait for font to load before initializing
			setTimeout(() => this.initialize(), 100);
			return;
		}

		// Mark as initialized without adding any initial tags
		this.initialized = true;
		this.firstUpdate = true; // Flag for first update to add 30 tags
		console.log('Tag cluster initialized, ready to add tokens dynamically');
		
		// Perform additional verification of TagManager
		if (!this.tagManager.tagStyle?.font) {
			console.warn('WARNING: Font is marked as loaded but font object is missing!');
		} else {
			console.log('Font object verification successful');
		}
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
	async updateTokens(newTokens) {
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
			const key = getTokenKey(token);
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
		
		// Get sponsored tokens
		const sponsoredTokens = this.sponsorService.getAllSponsoredTokens();
		
		// Add any sponsored tokens not in the list with high priority
		for (const sponsoredToken of sponsoredTokens) {
			const { tokenData } = sponsoredToken;
			const key = getTokenKey(tokenData);
			
			// Only add if not already in the new tokens list or existing tokens
			if (key && !newTokensMap.has(key) && !existingTokensMap.has(key)) {
				// Add to the beginning to ensure sponsored tokens are added first
				tokensToAdd.unshift(tokenData);
				console.log(`Adding sponsored token with priority: ${key}`);
			}
		}
		
		// Add new tokens dynamically 
		const tagsToAddLimit = this.firstUpdate ? 60 : 2; // Add up to 60 on first update, then 2 per update
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
				const addedTag = await this.addTokenTag(tokensToAdd[i]);
				if (addedTag) {
					console.log(`Successfully added token ${i+1}/${tagsToAdd}: ${addedTag.originalName}`);
					
					// Check if it's sponsored and apply styling
					const tokenKey = getTokenKey(tokensToAdd[i]);
					if (tokenKey) {
						this.applySponsorshipStyling(tokenKey);
					}
				} else {
					console.warn(`Failed to add token ${i+1}/${tagsToAdd}`);
				}
			}
		}
		
		// Update existing token tags
		newTokensMap.forEach((token, key) => {
			if (existingTokensMap.has(key)) {
				this.updateTokenTag(token);
				
				// Check if sponsored and apply styling
				this.applySponsorshipStyling(key);
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
	 * Get a colour based on the blockchain network
	 * @param {string} chainId - The ID of the blockchain network
	 * @returns {string} - Hex colour code
	 */
	getChainColour(chainId) {
		const chainColours = {
			'ethereum': '#3C3C3D', // Dark grey for Ethereum
			'binance-smart-chain': '#F0B90B', // Yellow for BSC
			'polygon': '#8247E5', // Purple for Polygon
			'avalanche': '#E84142', // Red for Avalanche
			'optimism': '#FF0420', // Bright red for Optimism
			'arbitrum': '#28A0F0', // Blue for Arbitrum
			'solana': '#14F195', // Bright teal for Solana
			'base': '#0052FF' // Bright blue for Base
		};
		return chainColours[chainId?.toLowerCase()] || '#FFFFFF'; // Default to white if chain not found
	}
	
	/**
	 * Add a new tag for a token
	 * @param {Object} token - Token data from DexScreener
	 * @returns {Promise<Object|null>} - The created tag or null
	 */
	async addTokenTag(token) {
		if (!token) {
			console.warn("Attempted to add null token");
			return null;
		}
		
		// Explicitly check font loading status first
		if (!this.tagManager || !this.tagManager.fontLoaded) {
			console.error("Cannot create tag - font not loaded yet");
			console.log("Font loading status:", this.tagManager?.fontLoaded);
			console.log("Will retry initialization in a moment...");
			
			// Wait and retry initialization
			if (!this.initialized && this.tagManager) {
				setTimeout(() => this.initialize(), 500);
			}
			return null;
		}
		
		// Generate key for this token
		const tokenKey = getTokenKey(token);
		if (!tokenKey) {
			console.warn("Cannot generate key for token, skipping");
			return null;
		}
		
		// Skip if already added
		if (this.tokenTags.has(tokenKey)) {
			return null;
		}
		
		// Check that token has address for identification
		if (!token.tokenAddress && !token.pairAddress && 
		    !(token.baseToken && token.baseToken.address)) {
			console.log("Token has no address for identification, skipping");
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
		
		// Determine the chain ID for colour assignment
		let chainId = token.chainId;
		if (!chainId && token.baseToken && token.baseToken.chainId) {
			chainId = token.baseToken.chainId;
		}
		if (!chainId) chainId = 'ethereum'; // Default to Ethereum
		
		// Get the colour based on the chain
		const tagColour = this.getChainColour(chainId);
		
		console.log(`Creating tag for token: ${displaySymbol} with size ${size.toFixed(2)} and colour ${tagColour}`);
		
		try {
			// Use TagsManager's addTag method if available
			if (window.memeCube && window.memeCube.tagsManager) {
				// Create the tag using the centralized tagsManager.addTag method
				const tag = await window.memeCube.tagsManager.addTag(displaySymbol, tokenUrl, size, token, {
					source: 'tagCluster',
					chainId: chainId,
					color: tagColour
				});
				
				// If successful, store in our mapping
				if (tag) {
					this.tokenTags.set(tokenKey, tag.id);
					console.log(`Added token tag via tagsManager: ${displaySymbol}`);
				}
				
				return tag;
			} else {
				// Fallback to direct creation if tagsManager not available
				const tag = this.tagManager.createTag(
					displaySymbol,
					tokenUrl,
					{
						scale: size,
						size: 0.5,     // Base text size before scaling
						depth: 0.65,   // Extrusion depth 
						color: tagColour, // Assign colour based on chain
						source: 'tagCluster'
					},
					token // Pass token data separately so TagManager can attach it correctly
				);
				
				// If successful, store in our mapping
				if (tag) {
					this.tokenTags.set(tokenKey, tag.id);
					// Set initial lastInteractionTime to creation time
					tag.lastInteractionTime = tag.createdAt;
					console.log(`Added token tag directly: ${displaySymbol}`);
				}
				
				return tag;
			}
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
		const tokenKey = getTokenKey(token);
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
	 * @returns {number} - Size value using minTagSize and maxTagSize as the scale reference
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
			const logValue = Math.log(Math.max(minMarketCap / 10, marketCap)); // Lower minimum to allow smaller sizes
			
			// Normalize to 0-1 range, but don't clamp - allow values outside 0-1 range
			const normalizedValue = (logValue - logMin) / (logMax - logMin);
			
			// Calculate size - can be bigger or smaller than reference scale
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
			const logValue = Math.log(Math.max(minLiquidity / 10, liquidity)); // Lower minimum to allow smaller sizes
			
			// Normalize to 0-1 range, but don't clamp - allow values outside 0-1 range
			const normalizedValue = (logValue - logMin) / (logMax - logMin);
			
			// Calculate size - can be bigger or smaller than reference scale
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
		
		// Return the calculated size without clamping
		return size;
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
	 * @param {number} deltaTime - Time since last update
	 */
	update(deltaTime) {
		// Track update frequency to limit updates
		if (!this._lastUpdateTime) {
			this._lastUpdateTime = 0;
			this._updateCounter = 0;
		}
		
		this._updateCounter++;
		
		// Only update every 2 frames to reduce performance impact
		if (this._updateCounter % 2 !== 0) {
			return;
		}
		
		// Further limit full updates to reduce physics calculations
		const now = performance.now();
		const timeSinceLastUpdate = now - this._lastUpdateTime;
		
		// If we're updating frequently (due to high FPS), limit physics updates
		// to no more than 30 times per second (33ms intervals)
		if (timeSinceLastUpdate < 33 && this.tagManager && this.tagManager.tags.length > 20) {
			// For large tag counts, further reduce update frequency
			if (this.tagManager.tags.length > 40 && this._updateCounter % 4 !== 0) {
				return;
			}
		}
		
		// Update tag manager with performance considerations
		if (this.tagManager) {
			this.tagManager.update();
		}
		
		this._lastUpdateTime = now;
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
