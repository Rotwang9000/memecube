import * as THREE from 'three';
import { TagManager } from './tag-manager.js';

/**
 * TagsManager - Main public API for the tag cluster system
 * 
 * This class serves as:
 * 1. A compatibility wrapper around the new TagManager/TagPhysics system
 * 2. The primary entry point for other application components to interact with tags
 * 3. A manager for tag aging and lifecycle features
 * 
 * Usage guidelines:
 * - Always use this class rather than accessing TagManager/TagPhysics directly
 * - Use addTag() to add new tags to the system
 * - Access tags array for read operations only
 * - For tag removal or updates, use the methods provided here
 * 
 * Implementation notes:
 * - This class maintains backwards compatibility with older code
 * - It delegates core functionality to the TagManager class
 * - Tag aging and demo functionality are implemented at this level
 */
export class TagsManager {
	constructor(scene, camera) {
		this.scene = scene;
		this.camera = camera;
		
		// Create the new tag manager
		this.tagManager = new TagManager(scene, camera);
		
		// Create container for tags (for compatibility)
		this.coreGroup = new THREE.Group();
		this.scene.add(this.coreGroup);
		
		// Initialize tag age system
		this.lastAgeUpdateTime = Date.now();
		
		// For compatibility with old code
		this.tags = this.tagManager.tags;
		this.cubeRadius = 1;
		this.growthFactor = 1.0;
		
		console.log('TagsManager initialized with new physics-based system');
	}
	
	/**
	 * Add a new tag to the system
	 * @param {string} text - The tag text
	 * @param {string} url - The URL associated with the tag
	 * @param {number} size - The size of the tag
	 * @returns {Object} The created tag object
	 */
	async addTag(text, url, size = null) {
		// Wait for font to load if it hasn't already
		if (!this.tagManager.fontLoaded) {
			await new Promise(resolve => {
				const checkFont = () => {
					if (this.tagManager.fontLoaded) {
						resolve();
					} else {
						setTimeout(checkFont, 100);
					}
				};
				checkFont();
			});
		}
		
		// Determine final size
		let finalSize;
		if (size !== null) {
			finalSize = size;
		} else {
			// Generate a more consistent size range for better isometric structure
			// Narrower size range (0.6-0.9) for more uniform appearance
			const baseSize = 0.6 + Math.random() * 0.3;
			
			// Occasionally create a larger tag (10% chance)
			if (Math.random() < 0.10) {
				finalSize = baseSize * (1.1 + Math.random() * 0.2);
			} else {
				finalSize = baseSize;
			}
		}
		
		// Create the tag using the new manager
		const tag = this.tagManager.createTag(text, url, {
			scale: finalSize,
			size: 0.5 // Base text size before scaling
		});
		
		// Update references to ensure we always have the latest tags
		this.tags = this.tagManager.tags;
		
		// Add age tracking (for compatibility with old system)
		if (tag) {
			tag.creationTime = Date.now();
			this.sortTagsByAge();
		}
		
		return tag;
	}
	
	/**
	 * Sort tags by age, with oldest first
	 */
	sortTagsByAge() {
		this.tags.sort((a, b) => a.creationTime - b.creationTime);
	}
	
	/**
	 * Initialize tag age system for all tags
	 */
	initializeTagAgeSystem() {
		const currentTime = Date.now();
		
		// Track creation time for all tags that don't have it yet
		this.tags.forEach((tag, index) => {
			if (!tag.creationTime) {
				// Stagger creation times for existing tags
				// More gradual staggering for smoother aging transitions
				tag.creationTime = currentTime - (this.tags.length - index) * 2000;
			}
		});
		
		// Sort tags by age
		this.sortTagsByAge();
	}
	
	/**
	 * Generate a random tag for demo mode
	 * @returns {Object} Random tag object
	 */
	generateRandomTag() {
		const randomText = this.getRandomTagText();
		const randomUrl = `https://example.com/${randomText.toLowerCase()}`;
		
		// More consistent size range (0.65-0.85) for better isometric structure
		const size = 0.65 + Math.random() * 0.2;
		
		return {
			text: randomText,
			url: randomUrl,
			size: size
		};
	}
	
	/**
	 * Generate a random tag name
	 * @returns {string} Random tag name
	 */
	getRandomTagText() {
		const prefixes = ['MOON', 'DOGE', 'SHIB', 'APE', 'FLOKI', 'PEPE', 'CAT', 'BABY', 'TURBO', 'SPACE', 'ELON', 'ROCKET', 'BASED', 'CHAD', 'WOJAK', 'MUSK', 'ALPHA', 'DRAGON', 'FIRE', 'DUCK', 'FROG', 'ZERO'];
		const suffixes = ['COIN', 'TOKEN', 'MOON', 'ROCKET', 'INU', 'SWAP', 'FI', 'CHAIN', 'DAO', 'VERSE', 'MUSK', 'LABS', 'X', 'DOGE', 'PEPE', 'CHAD', 'BANK', 'MONEY', 'GOLD'];
		
		// To create more varied and interesting tag names:
		// 50% chance of prefix only, 40% chance of prefix+suffix, 10% chance of suffix only
		const random = Math.random();
		
		if (random < 0.5) {
			// Prefix only
			return prefixes[Math.floor(Math.random() * prefixes.length)];
		} else if (random < 0.9) {
			// Prefix + suffix
			const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
			const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
			return `${prefix}${suffix}`;
		} else {
			// Suffix only
			return suffixes[Math.floor(Math.random() * suffixes.length)];
		}
	}
	
	/**
	 * Update tag sizes based on token data
	 * @param {Object} tokenData - Token data with market cap info
	 */
	updateTagSizes(tokenData) {
		if (!tokenData || !tokenData.tokens) return;
		
		// Get the minimum and maximum market caps
		let minMarketCap = Number.MAX_VALUE;
		let maxMarketCap = 0;
		
		for (const token of tokenData.tokens) {
			if (token.marketCap > 0) {
				minMarketCap = Math.min(minMarketCap, token.marketCap);
				maxMarketCap = Math.max(maxMarketCap, token.marketCap);
			}
		}
		
		// Update sizes for matching tags
		for (const token of tokenData.tokens) {
			const matchingTag = this.tags.find(tag => 
				tag.originalName?.toLowerCase() === token.symbol.toLowerCase() ||
				tag.name?.toLowerCase() === `$${token.symbol.toLowerCase()}`
			);
			
			if (matchingTag && token.marketCap > 0) {
				// Calculate size based on market cap (logarithmic scale)
				const minSize = 0.6; // Increased from 0.5 for better visibility
				const maxSize = 1.2; // Reduced from 2.0 for more cohesive structure
				
				// Use logarithmic scale
				const logMin = Math.log(minMarketCap);
				const logMax = Math.log(maxMarketCap);
				const logValue = Math.log(token.marketCap);
				
				// Normalize to 0-1 range
				const normalizedValue = (logValue - logMin) / (logMax - logMin);
				
				// Calculate new size with a more compressed range
				const newSize = minSize + (maxSize - minSize) * normalizedValue;
				
				// Resize tag using the new system
				this.tagManager.resizeTag(matchingTag.id, newSize);
			}
		}
	}
	
	/**
	 * Update the tag system (called once per frame)
	 * @param {number} deltaTime - Time since last frame in seconds
	 */
	update(deltaTime) {
		// Update tag manager
		this.tagManager.update();
		
		// Update tag aging if needed
		this.updateTagAging(deltaTime);
		
		// Update references (in case tags were added/removed)
		this.tags = this.tagManager.tags;
	}
	
	/**
	 * Update tag aging (making older tags smaller and move inward)
	 * @param {number} deltaTime - Time since last frame in seconds
	 */
	updateTagAging(deltaTime) {
		// Only update every few seconds to reduce computation
		const currentTime = Date.now();
		const timeSinceLastUpdate = currentTime - this.lastAgeUpdateTime;
		
		// Reduced update interval from 5000ms to 3000ms for more responsive aging
		if (timeSinceLastUpdate < 3000) return; // 3 seconds
		
		this.lastAgeUpdateTime = currentTime;
		
		// Update all tags
		for (const tag of this.tags) {
			if (!tag.mesh) continue;
			
			// Skip any tags that are still animating
			if (tag.isAnimating) continue;
			
			// Calculate age as a 0-1 value (1 = newest, 0 = oldest)
			const age = (currentTime - tag.creationTime) / 1000; // Age in seconds
			
			// More frequent aging effects 
			// After initial 300 seconds (5 min), age more slowly
			const agingThreshold = age < 300 ? 45 : 180; // seconds
			
			if (age > 0 && age % agingThreshold < 5) {
				// Position in the aging queue (oldest first, newest last)
				const agePosition = this.tags.indexOf(tag) / Math.max(1, this.tags.length - 1);
				
				// Calculate new size based on age position
				const newSize = this.calculateSizeByAge(tag.options?.scale || tag.mesh.scale.x, agePosition);
				
				// Update tag size
				if (Math.abs(tag.mesh.scale.x - newSize) > 0.01) {
					this.tagManager.resizeTag(tag.id, newSize);
				}
			}
		}
	}
	
	/**
	 * Calculate size based on age position (0 = oldest, 1 = newest)
	 * @param {number} originalSize - Original tag size
	 * @param {number} agePosition - Age position from 0 (oldest) to 1 (newest)
	 * @returns {number} New size
	 */
	calculateSizeByAge(originalSize, agePosition) {
		// Older tags should be smaller but maintain minimum size for visibility
		// For the oldest tag (agePosition = 0), size is reduced to 50% (up from 40%)
		// For the newest tag (agePosition = 1), size stays at 100%
		const minSizeFactor = 0.5; // Increased from 0.4 for better visibility
		const sizeFactor = minSizeFactor + (1 - minSizeFactor) * agePosition;
		
		// Calculate new size but don't go below minimum
		return Math.max(0.3, originalSize * sizeFactor);
	}
} 