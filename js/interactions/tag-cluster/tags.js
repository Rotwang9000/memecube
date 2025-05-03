/**
 * TagsManager - High-level compatibility wrapper for backward compatibility with the old system
 * Handles tag sorting, demo functionality, and provides a consistent API
 */

import { TagManager } from '../tag-manager.js';

export class TagsManager {
	/**
	 * Create a new TagsManager
	 * @param {THREE.Scene} scene - Three.js scene
	 * @param {THREE.Camera} camera - Three.js camera
	 * @param {Object} options - Configuration options
	 */
	constructor(scene, camera, options = {}) {
		// Store references
		this.scene = scene;
		this.camera = camera;
		
		// Create the core TagManager
		this.tagManager = new TagManager(scene, camera, options);
		
		// Reference tags directly from the TagManager for compatibility
		this.tags = this.tagManager.tags;
		
		// For tracking last update time
		this.lastUpdateTime = Date.now();
		
		// Store reference to VisualizationManager (to be set later)
		this.visualizationManager = null;
		
		// Demo functionality
		this.demoActive = false;
		this.demoAddInterval = null;
		this.demoTags = [
			'BTC', 'ETH', 'SOL', 'DOGE', 'SHIB', 'PEPE', 'FLOKI', 
			'BONK', 'WIF', 'MEME', 'TURBO', 'SHIBA', 'ELON', 'APE'
		];
	}
	
	/**
	 * Set visualization manager reference
	 * @param {Object} visualizationManager - Reference to the VisualizationManager
	 */
	setVisualizationManager(visualizationManager) {
		if (!visualizationManager) {
			console.warn('Attempted to set null VisualizationManager to TagsManager');
			return;
		}
		
		// Store reference
		this.visualizationManager = visualizationManager;
		
		// Ensure the reference is strong by storing it in a property that won't be garbage collected
		this._permanentVisualizationManagerRef = visualizationManager;
		
		// Pass it to the tagManager
		if (this.tagManager) {
			this.tagManager.setVisualizationManager(visualizationManager);
			
			// Double-check success
			if (!this.tagManager.visualizationManager) {
				console.error('Failed to set VisualizationManager in TagManager!');
			}
		} else {
			console.error('TagManager not available in TagsManager');
		}
		
		console.log('VisualizationManager set for TagsManager and TagManager');
	}
	
	/**
	 * Get the visualization manager, recovering it if needed
	 * @returns {Object|null} The visualization manager or null if not found
	 */
	getVisualizationManager() {
		// Return existing reference if available
		if (this.visualizationManager) {
			return this.visualizationManager;
		}
		
		// Try to recover from permanent reference
		if (this._permanentVisualizationManagerRef) {
			console.log('Recovering VisualizationManager from permanent reference');
			this.visualizationManager = this._permanentVisualizationManagerRef;
			
			// Re-establish connection to TagManager
			if (this.tagManager && !this.tagManager.visualizationManager) {
				this.tagManager.setVisualizationManager(this.visualizationManager);
			}
			
			return this.visualizationManager;
		}
		
		// Try to recover from global scope
		if (window.memeCube && window.memeCube.visualizationManager) {
			console.log('Recovering VisualizationManager from window.memeCube');
			this.visualizationManager = window.memeCube.visualizationManager;
			
			// Store in permanent reference
			this._permanentVisualizationManagerRef = this.visualizationManager;
			
			// Re-establish connection to TagManager
			if (this.tagManager && !this.tagManager.visualizationManager) {
				this.tagManager.setVisualizationManager(this.visualizationManager);
			}
			
			return this.visualizationManager;
		}
		
		console.error('Failed to recover VisualizationManager reference');
		return null;
	}
	
	/**
	 * Add a new tag
	 * @param {string} text - Tag text (without $ prefix)
	 * @param {string} url - URL to navigate to when clicked
	 * @param {number} size - Size of the tag (0.5-2.0)
	 * @param {Object} tokenData - Token data for the tag
	 * @param {Object} metadata - Additional metadata for tracking
	 * @returns {Promise<Object|null>} - Created tag or null
	 */
	async addTag(text, url, size = null, tokenData = null, metadata = {}) {
		// Ensure text doesn't have $ prefix (will be added by TagManager)
		const tagText = text.startsWith('$') ? text.substring(1) : text;
		
		// Determine final size
		let finalSize = size !== null ? size : 1.0;
		
		// Create the tag
		const tag = this.tagManager.createTag(tagText, url, {
			scale: finalSize,
			size: 0.5, // Base text size before scaling
			source: metadata.source || 'userAdded'
		}, tokenData);
		
		// Ensure the tagManager has a visualization manager reference
		if (!this.tagManager.visualizationManager) {
			// Get visualization manager using recovery methods
			const visualizationManager = this.getVisualizationManager();
			if (visualizationManager) {
				console.log('Recovered VisualizationManager for tag:', tagText);
				this.tagManager.setVisualizationManager(visualizationManager);
			} else {
				console.warn('Could not recover VisualizationManager for tag:', tagText);
			}
		}
		
		// Update references
		this.tags = this.tagManager.tags;
		
		// Add creation time
		if (tag) {
			tag.creationTime = Date.now();
			this.sortTagsByAge();
		}
		
		return tag;
	}
	
	/**
	 * Remove a tag
	 * @param {string} tagId - ID of tag to remove
	 * @returns {boolean} - Whether removal was successful
	 */
	removeTag(tagId) {
		const success = this.tagManager.removeTag(tagId);
		
		// Update references
		this.tags = this.tagManager.tags;
		
		// Resort by age
		this.sortTagsByAge();
		
		return success;
	}
	
	/**
	 * Remove the oldest tag
	 * @returns {boolean} - Whether removal was successful
	 */
	removeOldestTag() {
		// Make sure we have tags
		if (this.tags.length === 0) return false;
		
		// Sort by age (oldest first)
		this.sortTagsByAge();
		
		// Remove oldest
		return this.removeTag(this.tags[0].id);
	}
	
	/**
	 * Sort tags by age (oldest first)
	 */
	sortTagsByAge() {
		// Sort by creation time (oldest first)
		this.tags.sort((a, b) => (a.creationTime || 0) - (b.creationTime || 0));
	}
	
	// /**
	//  * Start demo mode
	//  * @param {Object} options - Demo options
	//  */
	// startDemo(options = {}) {
	// 	if (this.demoActive) return;
		
	// 	// Configure demo
	// 	const demoConfig = {
	// 		interval: options.interval || 5000,
	// 		maxTags: options.maxTags || 20,
	// 		baseUrl: options.baseUrl || 'https://example.com/'
	// 	};
		
	// 	// Start adding tags periodically
	// 	this.demoAddInterval = setInterval(() => {
	// 		// Check if we've reached max tags
	// 		if (this.tags.length >= demoConfig.maxTags) {
	// 			// Remove oldest tag
	// 			this.removeOldestTag();
	// 		}
			
	// 		// Add a random tag
	// 		const randomIndex = Math.floor(Math.random() * this.demoTags.length);
	// 		const tagName = this.demoTags[randomIndex];
	// 		const tagSize = 0.5 + Math.random() * 1.5;
	// 		const tagUrl = `${demoConfig.baseUrl}${tagName.toLowerCase()}`;
			
	// 		// Generate demo token data
	// 		const tokenData = this.generateDemoTokenData(tagName);
			
	// 		this.addTag(tagName, tagUrl, tagSize, tokenData);
			
	// 	}, demoConfig.interval);
		
	// 	this.demoActive = true;
	// }
	
	// /**
	//  * Stop demo mode
	//  */
	// stopDemo() {
	// 	if (this.demoAddInterval) {
	// 		clearInterval(this.demoAddInterval);
	// 		this.demoAddInterval = null;
	// 	}
		
	// 	this.demoActive = false;
	// }
	
	// /**
	//  * Generate demo token data for a tag
	//  * @param {string} symbol - Token symbol
	//  * @returns {Object} - Demo token data
	//  */
	// generateDemoTokenData(symbol) {
	// 	// Generate random values for demo token
	// 	const priceUsd = (Math.random() * 100).toFixed(4);
	// 	const priceNative = (Math.random() * 0.05).toFixed(6);
	// 	const liquidityUsd = Math.floor(Math.random() * 5000000) + 100000;
	// 	const marketCap = Math.floor(Math.random() * 50000000) + 1000000;
	// 	const fdv = marketCap * (1 + Math.random());
	// 	const volume24h = liquidityUsd * (Math.random() * 2);
	// 	const priceChange24h = (Math.random() * 40) - 20; // -20% to +20%
		
	// 	// Generate a random chain ID
	// 	const chains = ['eth', 'bsc', 'arbitrum', 'polygon', 'avalanche'];
	// 	const chainId = chains[Math.floor(Math.random() * chains.length)];
		
	// 	// Generate an Ethereum-like address
	// 	const generateAddress = () => {
	// 		let address = '0x';
	// 		for (let i = 0; i < 40; i++) {
	// 			address += '0123456789abcdef'[Math.floor(Math.random() * 16)];
	// 		}
	// 		return address;
	// 	};
		
	// 	// Create demo token data structure
	// 	return {
	// 		chainId,
	// 		dexId: ['uniswap', 'pancakeswap', 'sushiswap'][Math.floor(Math.random() * 3)],
	// 		url: `https://dexscreener.com/${chainId}/${generateAddress()}`,
	// 		pairAddress: generateAddress(),
	// 		baseToken: {
	// 			address: generateAddress(),
	// 			name: `${symbol} Token`,
	// 			symbol
	// 		},
	// 		quoteToken: {
	// 			address: generateAddress(),
	// 			name: Math.random() > 0.5 ? 'Ethereum' : 'USD Coin',
	// 			symbol: Math.random() > 0.5 ? 'ETH' : 'USDC'
	// 		},
	// 		priceNative,
	// 		priceUsd,
	// 		txns: {
	// 			h24: {
	// 				buys: Math.floor(Math.random() * 500) + 10,
	// 				sells: Math.floor(Math.random() * 400) + 5
	// 			}
	// 		},
	// 		volume: {
	// 			h24: volume24h
	// 		},
	// 		priceChange: {
	// 			h24: priceChange24h
	// 		},
	// 		liquidity: {
	// 			usd: liquidityUsd,
	// 			base: liquidityUsd / parseFloat(priceUsd),
	// 			quote: liquidityUsd * 0.5
	// 		},
	// 		fdv,
	// 		marketCap,
	// 		pairCreatedAt: Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000, // 0-30 days ago
	// 		info: {
	// 			imageUrl: `https://cryptologos.cc/logos/${symbol.toLowerCase()}-${symbol.toLowerCase()}-logo.png`,
	// 			websites: [
	// 				{ url: `https://${symbol.toLowerCase()}.io` }
	// 			],
	// 			socials: [
	// 				{ platform: 'twitter', handle: symbol.toLowerCase() },
	// 				{ platform: 'telegram', handle: symbol.toLowerCase() },
	// 				{ platform: 'discord', handle: symbol.toLowerCase() }
	// 			]
	// 		},
	// 		boosts: {
	// 			active: Math.random() > 0.5 ? 1 : 0
	// 		}
	// 	};
	// }
	
	// /**
	//  * Generate a random tag (for demo mode)
	//  * @returns {Object} - Random tag with text, url, and size
	//  */
	// generateRandomTag() {
	// 	const prefixes = ['MOON', 'DOGE', 'SHIB', 'APE', 'FLOKI', 'PEPE'];
	// 	const suffixes = ['COIN', 'TOKEN', 'MOON', 'ROCKET', 'INU', 'SWAP'];
		
	// 	const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
	// 	const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
	// 	const text = Math.random() > 0.5 ? `${prefix}${suffix}` : prefix;
	// 	const url = `https://example.com/${text.toLowerCase()}`;
	// 	const size = 0.5 + Math.random() * 0.8;
		
	// 	return { text, url, size };
	// }
	
	/**
	 * Update function called each frame
	 */
	update() {
		// Update tag manager
		this.tagManager.update();
	}
	
	/**
	 * Get a tag by name
	 * @param {string} name - Tag name
	 * @returns {Object|null} - Tag or null
	 */
	getTagByName(name) {
		return this.tagManager.getTagByName(name);
	}
	
	/**
	 * Clear all tags
	 */
	clearAllTags() {
		// Make a copy of tag IDs since we'll be modifying the array
		const tagIds = [...this.tags.map(tag => tag.id)];
		
		// Remove each tag
		tagIds.forEach(id => this.removeTag(id));
	}
	
	/**
	 * Clean up resources
	 */
	dispose() {
		// Stop demo if active
		this.stopDemo();
		
		// Clear all tags
		this.clearAllTags();
		
		// Dispose of tag manager
		this.tagManager.dispose();
	}
}