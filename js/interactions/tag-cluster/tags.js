/**
 * TagsManager - High-level compatibility wrapper for backward compatibility with the old system
 * Handles tag aging, demo functionality, and provides a consistent API
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
		
		// Track tag age for resizing
		this.lastAgeUpdateTime = Date.now();
		this.ageUpdateInterval = options.ageUpdateInterval || 30000; // 30 seconds
		
		// Demo functionality
		this.demoActive = false;
		this.demoAddInterval = null;
		this.demoTags = [
			'BTC', 'ETH', 'SOL', 'DOGE', 'SHIB', 'PEPE', 'FLOKI', 
			'BONK', 'WIF', 'MEME', 'TURBO', 'SHIBA', 'ELON', 'APE'
		];
	}
	
	/**
	 * Add a new tag
	 * @param {string} text - Tag text (without $ prefix)
	 * @param {string} url - URL to navigate to when clicked
	 * @param {number} size - Size of the tag (0.5-2.0)
	 * @returns {Promise<Object|null>} - Created tag or null
	 */
	async addTag(text, url, size = null) {
		// Ensure text doesn't have $ prefix (will be added by TagManager)
		const tagText = text.startsWith('$') ? text.substring(1) : text;
		
		// Determine final size
		let finalSize = size !== null ? size : 1.0;
		
		// Create the tag
		const tag = this.tagManager.createTag(tagText, url, {
			scale: finalSize,
			size: 0.5 // Base text size before scaling
		});
		
		// Update references
		this.tags = this.tagManager.tags;
		
		// Add age tracking
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
	
	/**
	 * Update tag sizes based on age
	 */
	updateTagSizesByAge() {
		const now = Date.now();
		
		// Only update periodically for performance
		if (now - this.lastAgeUpdateTime < this.ageUpdateInterval) return;
		
		this.lastAgeUpdateTime = now;
		
		// Sort tags by age
		this.sortTagsByAge();
		
		// Update each tag's size
		for (let i = 0; i < this.tags.length; i++) {
			const tag = this.tags[i];
			
			// Calculate age position (0 = oldest, 1 = newest)
			const agePosition = i / Math.max(1, this.tags.length - 1);
			
			// Get original size from options or default to current size
			const originalSize = tag.options?.scale || tag.mesh.scale.x;
			
			// Calculate new size based on age
			const newSize = this.calculateSizeByAge(originalSize, agePosition);
			
			// Apply new size if significantly different
			if (Math.abs(newSize - tag.mesh.scale.x) / tag.mesh.scale.x > 0.05) {
				this.tagManager.resizeTag(tag.id, newSize);
			}
		}
	}
	
	/**
	 * Calculate tag size based on age
	 * @param {number} originalSize - Original tag size
	 * @param {number} agePosition - Age position (0-1, 0=oldest, 1=newest)
	 * @returns {number} - New size
	 */
	calculateSizeByAge(originalSize, agePosition) {
		// Older tags should be smaller
		// For the oldest tag (agePosition = 0), size is reduced to 40%
		// For the newest tag (agePosition = 1), size stays at 100%
		const minSizeFactor = 0.4;
		const sizeFactor = minSizeFactor + (1 - minSizeFactor) * agePosition;
		
		// Calculate new size but don't go below minimum
		return Math.max(0.2, originalSize * sizeFactor);
	}
	
	/**
	 * Start demo mode
	 * @param {Object} options - Demo options
	 */
	startDemo(options = {}) {
		if (this.demoActive) return;
		
		// Configure demo
		const demoConfig = {
			interval: options.interval || 5000,
			maxTags: options.maxTags || 20,
			baseUrl: options.baseUrl || 'https://example.com/'
		};
		
		// Start adding tags periodically
		this.demoAddInterval = setInterval(() => {
			// Check if we've reached max tags
			if (this.tags.length >= demoConfig.maxTags) {
				// Remove oldest tag
				this.removeOldestTag();
			}
			
			// Add a random tag
			const randomIndex = Math.floor(Math.random() * this.demoTags.length);
			const tagName = this.demoTags[randomIndex];
			const tagSize = 0.5 + Math.random() * 1.5;
			const tagUrl = `${demoConfig.baseUrl}${tagName.toLowerCase()}`;
			
			this.addTag(tagName, tagUrl, tagSize);
			
		}, demoConfig.interval);
		
		this.demoActive = true;
	}
	
	/**
	 * Stop demo mode
	 */
	stopDemo() {
		if (this.demoAddInterval) {
			clearInterval(this.demoAddInterval);
			this.demoAddInterval = null;
		}
		
		this.demoActive = false;
	}
	
	/**
	 * Generate a random tag (for demo mode)
	 * @returns {Object} - Random tag with text, url, and size
	 */
	generateRandomTag() {
		const prefixes = ['MOON', 'DOGE', 'SHIB', 'APE', 'FLOKI', 'PEPE'];
		const suffixes = ['COIN', 'TOKEN', 'MOON', 'ROCKET', 'INU', 'SWAP'];
		
		const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
		const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
		const text = Math.random() > 0.5 ? `${prefix}${suffix}` : prefix;
		const url = `https://example.com/${text.toLowerCase()}`;
		const size = 0.5 + Math.random() * 0.8;
		
		return { text, url, size };
	}
	
	/**
	 * Update function called each frame
	 */
	update() {
		// Update tag manager
		this.tagManager.update();
		
		// Update tag sizes based on age
		this.updateTagSizesByAge();
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