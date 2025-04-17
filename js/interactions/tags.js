import * as THREE from 'three';
import { TagManager } from './tag-manager.js';

/**
 * Main class for managing tags in 3D space
 * This is a compatibility wrapper around the new TagManager system
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
			// Generate a somewhat varied random size
			const baseSize = 0.5 + Math.random() * 0.5;
			
			// Occasionally create a larger tag (10% chance)
			if (Math.random() < 0.10) {
				finalSize = baseSize * (1.2 + Math.random() * 0.3);
			} else {
				finalSize = baseSize;
			}
		}
		
		// Create the tag using the new manager
		const tag = this.tagManager.createTag(text, url, {
			scale: finalSize,
			size: 0.5 // Base text size before scaling
		});
		
		// Update references
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
				tag.creationTime = currentTime - (this.tags.length - index) * 5000;
			}
		});
		
		// Sort tags by age
		this.sortTagsByAge();
	}
	
	/**
	 * Generate a random tag for demo mode
	 */
	generateRandomTag() {
		const randomText = this.getRandomTagText();
		const randomUrl = `https://example.com/${randomText.toLowerCase()}`;
		return this.addTag(randomText, randomUrl);
	}
	
	/**
	 * Generate a random tag name
	 */
	getRandomTagText() {
		const prefixes = ['MOON', 'DOGE', 'SHIB', 'APE', 'FLOKI', 'PEPE', 'CAT', 'BABY', 'TURBO', 'SPACE', 'ELON', 'ROCKET', 'BASED', 'CHAD', 'WOJAK', 'MUSK', 'ALPHA', 'DRAGON', 'FIRE', 'DUCK', 'FROG', 'ZERO'];
		const suffixes = ['COIN', 'TOKEN', 'MOON', 'ROCKET', 'INU', 'SWAP', 'FI', 'CHAIN', 'DAO', 'VERSE', 'MUSK', 'LABS', 'X', 'DOGE', 'PEPE', 'CHAD', 'BANK', 'MONEY', 'GOLD'];
		
		const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
		
		// 50% chance of adding a suffix
		if (Math.random() > 0.5) {
			const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
			return `${prefix}${suffix}`;
		}
		
		return prefix;
	}
	
	/**
	 * Update tag sizes based on token data
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
				const minSize = 0.5;
				const maxSize = 2.0;
				
				// Use logarithmic scale
				const logMin = Math.log(minMarketCap);
				const logMax = Math.log(maxMarketCap);
				const logValue = Math.log(token.marketCap);
				
				// Normalize to 0-1 range
				const normalizedValue = (logValue - logMin) / (logMax - logMin);
				
				// Calculate new size
				const newSize = minSize + (maxSize - minSize) * normalizedValue;
				
				// Resize tag using the new system
				this.tagManager.resizeTag(matchingTag.id, newSize);
			}
		}
	}
	
	/**
	 * Update the tag system (called once per frame)
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
	 */
	updateTagAging(deltaTime) {
		// Only update every few seconds to reduce computation
		const currentTime = Date.now();
		const timeSinceLastUpdate = currentTime - this.lastAgeUpdateTime;
		
		// Skip if not enough time has passed
		if (timeSinceLastUpdate < 5000) return; // 5 seconds
		
		this.lastAgeUpdateTime = currentTime;
		
		// Update all tags
		for (const tag of this.tags) {
			if (!tag.mesh) continue;
			
			// Skip any tags that are still animating
			if (tag.isAnimating) continue;
			
			// Calculate age as a 0-1 value (1 = newest, 0 = oldest)
			const age = (currentTime - tag.creationTime) / 1000; // Age in seconds
			
			// Apply age effects once every minute for the first 10 minutes
			// After that, age more slowly (every 5 minutes)
			const agingThreshold = age < 600 ? 60 : 300; // seconds
			
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
	 */
	calculateSizeByAge(originalSize, agePosition) {
		// Older tags should be smaller
		// For the oldest tag (agePosition = 0), size is reduced to 40%
		// For the newest tag (agePosition = 1), size stays at 100%
		const minSizeFactor = 0.4;
		const sizeFactor = minSizeFactor + (1 - minSizeFactor) * agePosition;
		
		return originalSize * sizeFactor;
	}
	
	/**
	 * Resize a tag
	 */
	resizeTag(tag, newSize) {
		// Use the new tag manager to resize
		this.tagManager.resizeTag(tag.id, newSize);
	}
} 