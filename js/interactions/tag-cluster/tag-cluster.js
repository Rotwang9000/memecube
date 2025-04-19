import * as THREE from 'three';
import { Utils } from '../../utils/utils.js';

/**
 * TagCluster - Integration layer between DexScreener token data and tag system
 * 
 * This class is responsible for:
 * 1. Converting token data from DexScreener into tags in the 3D space
 * 2. Updating token tags when their data changes (price, market cap)
 * 3. Handling token-specific visualization features (color coding by price change)
 * 4. Managing the lifecycle of token tags (add/update/remove)
 * 
 * Usage flow:
 * - DexScreenerManager creates this class and provides token data
 * - This class uses the TagsManager to add/update tags based on tokens
 * - Token properties like market cap determine tag size
 * - Price changes are reflected in tag colors
 * 
 * Implementation notes:
 * - Replaced the previous token-cube.js with improved physics
 * - Maintains mappings between token symbols and tag IDs
 * - Uses market cap for sizing tags proportionally
 * - Colors tags based on price movement (green for up, red for down)
 */
export class TagCluster {
	constructor(scene, camera, tagsManager) {
		this.scene = scene;
		this.camera = camera;
		this.tagsManager = tagsManager;
		this.utils = new Utils();
		
		// Token data tracking
		this.tokenSymbols = new Set(); // Track which tokens we've added
		this.symbolToTagId = new Map(); // Map symbols to tag IDs
		
		// Token update settings
		this.updateInterval = 6000; // Update every 6 seconds
		this.lastUpdateTime = 0;
		
		// Size settings
		this.minTokenSize = 0.5;
		this.maxTokenSize = 2.0;
		
		// Create container group for compatibility with old code
		this.cubeGroup = new THREE.Group();
		this.scene.add(this.cubeGroup);
		
		// Visibility state
		this.isVisible = true;
		
		console.log("TagCluster initialized - will add tokens through tag system");
	}
	
	/**
	 * Update tokens with new data from DexScreener
	 * @param {Array} tokenData - Array of token data objects
	 */
	updateTokens(tokenData) {
		if (!tokenData || !Array.isArray(tokenData)) return;
		
		const currentTime = Date.now();
		this.lastUpdateTime = currentTime;
		
		// Step 1: Track current tokens
		const currentTokenSymbols = new Set(this.tokenSymbols);
		const newTokenSymbols = new Set();
		
		// Record all valid symbols from new data
		tokenData.forEach(token => {
			if (token.baseToken?.symbol) {
				newTokenSymbols.add(token.baseToken.symbol);
			}
		});
		
		// Step 2: Process tokens to add (in new data but not current)
		for (const token of tokenData) {
			if (!token.baseToken?.symbol) continue;
			
			const symbol = token.baseToken.symbol;
			
			if (!currentTokenSymbols.has(symbol)) {
				this.addToken(token);
			} else {
				this.updateToken(token);
			}
		}
		
		// Step 3: Process tokens to remove (in current but not in new data)
		for (const symbol of currentTokenSymbols) {
			if (!newTokenSymbols.has(symbol)) {
				this.removeToken(symbol);
			}
		}
	}
	
	/**
	 * Add a new token to the visualization using the tag system
	 * @param {Object} tokenData - Token data from DexScreener
	 */
	async addToken(tokenData) {
		if (!tokenData.baseToken?.symbol) return;
		
		const symbol = tokenData.baseToken.symbol;
		const marketCap = tokenData.marketCap || 1000000; // Default if not available
		const size = this.calculateTokenSize(marketCap);
		const url = tokenData.url || `https://dexscreener.com/${tokenData.chainId || 'eth'}/${tokenData.pairAddress || ''}`;
		
		try {
			// Add through tag manager (which handles entry animations)
			const tag = await this.tagsManager.addTag(symbol, url, size);
			
			if (tag) {
				// Store mapping for future updates
				this.symbolToTagId.set(symbol, tag.id);
				this.tokenSymbols.add(symbol);
				
				// Track additional token metadata in the tag object
				tag.metadata = {
					isToken: true,
					marketCap: marketCap,
					chainId: tokenData.chainId || 'unknown',
					priceUsd: tokenData.priceUsd || '0',
					priceChange: tokenData.priceChange?.h24 || 0
				};
				
				// Set tag color based on price change
				if (tag.mesh && tag.mesh.material) {
					const priceChange = tokenData.priceChange?.h24 || 0;
					if (priceChange > 0) {
						// Green for positive
						tag.mesh.material.color.setRGB(0.2, 0.8, 0.3);
						tag.mesh.material.emissive.setRGB(0.1, 0.3, 0.1);
					} else if (priceChange < 0) {
						// Red for negative
						tag.mesh.material.color.setRGB(0.8, 0.2, 0.2);
						tag.mesh.material.emissive.setRGB(0.3, 0.1, 0.1);
					} else {
						// Blue for neutral
						tag.mesh.material.color.setRGB(0.2, 0.5, 0.8);
						tag.mesh.material.emissive.setRGB(0.1, 0.2, 0.3);
					}
				}
			}
		} catch (error) {
			console.error(`Error adding token ${symbol} to tag cluster:`, error);
		}
	}
	
	/**
	 * Update an existing token with new data
	 * @param {Object} tokenData - New token data
	 */
	updateToken(tokenData) {
		if (!tokenData.baseToken?.symbol) return;
		
		const symbol = tokenData.baseToken.symbol;
		const tagId = this.symbolToTagId.get(symbol);
		
		if (!tagId) return;
		
		// Calculate new size based on market cap
		const marketCap = tokenData.marketCap || 1000000;
		const newSize = this.calculateTokenSize(marketCap);
		
		// Get tag from tags manager's tags array
		const tag = this.tagsManager.tags.find(t => t.id === tagId);
		
		if (tag) {
			// Update metadata
			tag.metadata = {
				...tag.metadata,
				marketCap: marketCap,
				priceUsd: tokenData.priceUsd || '0',
				priceChange: tokenData.priceChange?.h24 || 0
			};
			
			// Only update size if it changed significantly (>10%)
			const currentSize = tag.mesh ? tag.mesh.scale.x : 1;
			if (Math.abs(newSize - currentSize) / currentSize > 0.1) {
				this.tagsManager.tagManager.resizeTag(tagId, newSize);
				
				// Update color based on price change
				if (tag.mesh && tag.mesh.material) {
					const priceChange = tokenData.priceChange?.h24 || 0;
					if (priceChange > 0) {
						// Green for positive
						tag.mesh.material.color.setRGB(0.2, 0.8, 0.3);
						tag.mesh.material.emissive.setRGB(0.1, 0.3, 0.1);
					} else if (priceChange < 0) {
						// Red for negative
						tag.mesh.material.color.setRGB(0.8, 0.2, 0.2);
						tag.mesh.material.emissive.setRGB(0.3, 0.1, 0.1);
					} else {
						// Blue for neutral
						tag.mesh.material.color.setRGB(0.2, 0.5, 0.8);
						tag.mesh.material.emissive.setRGB(0.1, 0.2, 0.3);
					}
				}
			}
		}
	}
	
	/**
	 * Remove a token from the visualization
	 * @param {string} symbol - Token symbol to remove
	 */
	removeToken(symbol) {
		const tagId = this.symbolToTagId.get(symbol);
		if (!tagId) return;
		
		// Remove from tag system
		this.tagsManager.tagManager.removeTag(tagId);
		
		// Remove from tracking maps
		this.symbolToTagId.delete(symbol);
		this.tokenSymbols.delete(symbol);
	}
	
	/**
	 * Calculate token size based on market cap
	 * @param {number} marketCap - Token market cap
	 * @returns {number} - Calculated size
	 */
	calculateTokenSize(marketCap) {
		// Use a logarithmic scale for better visualization
		if (!marketCap || marketCap <= 0) return this.minTokenSize;
		
		const log10 = Math.log10(marketCap);
		const minLog = Math.log10(100000); // $100K minimum
		const maxLog = Math.log10(10000000000); // $10B maximum
		
		// Normalize the log value to 0-1 range
		const normalizedSize = (log10 - minLog) / (maxLog - minLog);
		
		// Clamp between 0 and 1
		const clampedSize = Math.max(0, Math.min(1, normalizedSize));
		
		// Map to size range with wider variance 
		// Add some randomness to create more interesting structure
		const randomFactor = 1.0 + (Math.random() * 0.3 - 0.15); // ±15% random variance
		return (this.minTokenSize + clampedSize * (this.maxTokenSize - this.minTokenSize)) * randomFactor;
	}
	
	/**
	 * Update the cluster visualization
	 * @param {number} deltaTime - Time since last update in seconds
	 */
	update(deltaTime) {
		// Most update logic is now handled by TagsManager and TagPhysics
		// This method is here for compatibility with the previous token-cube.js
		
		// Pass token size updates to TagsManager occasionally
		if (this.tagsManager && this.tokenSymbols.size > 0) {
			// Occasionally update tag sizes to reflect any changes in market cap
			const updateChance = Math.random();
			if (updateChance < 0.05) { // 5% chance each frame
				this.updateTagSizes();
			}
		}
	}
	
	/**
	 * Update tag sizes based on their market cap data
	 */
	updateTagSizes() {
		// Update sizes for token tags
		for (const [symbol, tagId] of this.symbolToTagId.entries()) {
			const tag = this.tagsManager.tags.find(t => t.id === tagId);
			if (tag && tag.metadata?.marketCap) {
				const newSize = this.calculateTokenSize(tag.metadata.marketCap);
				const currentSize = tag.mesh ? tag.mesh.scale.x : 1;
				
				// Only update if significant change
				if (Math.abs(newSize - currentSize) / currentSize > 0.15) {
					this.tagsManager.tagManager.resizeTag(tagId, newSize);
				}
			}
		}
	}
	
	/**
	 * Handle interaction - now using TagManager's own interaction handling
	 * @param {THREE.Raycaster} raycaster - Raycaster for interaction
	 * @returns {boolean} Whether interaction occurred
	 */
	handleInteraction(raycaster) {
		// Now handled by TagManager directly
		return false;
	}
} 