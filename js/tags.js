import * as THREE from 'three';
import { TagFontLoader } from './tag-font-loader.js';
import { TagCreator } from './tag-creator.js';
import { TagPositioning } from './tag-positioning.js';
import { TagAnimation } from './tag-animation.js';
import { TagInteraction } from './tag-interaction.js';

/**
 * Main class for managing tags in 3D space
 */
export class TagsManager {
	constructor(scene, camera) {
		this.scene = scene;
		this.camera = camera;
		this.tags = [];
		this.cubeRadius = 1; // Tiny initial radius - just a single point
		this.growthFactor = 1.0; // How much the cube has grown
		
		// Initialize modules
		this.fontLoader = new TagFontLoader();
		this.tagCreator = new TagCreator();
		this.positioning = new TagPositioning();
		this.animation = new TagAnimation();
		
		// Group to hold all tags
		this.tagsGroup = new THREE.Group();
		this.scene.add(this.tagsGroup);
		
		// Load font
		this.loadFont();
		
		// Set up interaction handler after font is loaded
		this.interaction = new TagInteraction(camera, this.tags, scene);
	}
	
	async loadFont() {
		try {
			await this.fontLoader.loadRandomFont();
			console.log('Font loaded for TagsManager');
		} catch (error) {
			console.error('Error loading font in TagsManager:', error);
		}
	}
	
	async addTag(text, url, size = null) {
		// Wait for font to load if it hasn't already
		if (!this.fontLoader.getFont()) {
			await new Promise(resolve => {
				const checkFont = () => {
					if (this.fontLoader.getFont()) {
						resolve();
					} else {
						setTimeout(checkFont, 100);
					}
				};
				checkFont();
			});
		}
		
		let finalSize;
		
		// If size is explicitly provided, use it
		if (size !== null) {
			finalSize = size;
		} else {
			// Generate a more varied random size with occasional larger tags
			// Use an exponential distribution to favor smaller tags with occasional larger ones
			const baseSize = 0.4 + Math.random() * 0.9; // Base size from 0.4 to 1.3
			
			// Occasionally create a much larger tag (10% chance)
			if (Math.random() < 0.10) {
				finalSize = baseSize * (1.5 + Math.random() * 1.0); // 1.5-2.5x multiplier
			} else {
				finalSize = baseSize;
			}
		}
		
		// Create tag mesh
		const textMeshData = this.tagCreator.createTagMesh(
			text, 
			this.fontLoader.getFont(), 
			finalSize, 
			this.fontLoader.getFontName()
		);
		
		// Find best position for this tag - pass the size to help with positioning
		const placement = this.positioning.findBestPositionForNewTag(
			textMeshData.geometry, 
			finalSize,
			this.tags
		);
		
		// Create tag data
		const tag = this.tagCreator.createTagData(
			textMeshData, 
			text, 
			url, 
			finalSize, 
			placement
		);
		
		// Set initial position for animation
		this.tagCreator.setInitialTagPosition(tag, placement);
		
		// Add to scene and tracking arrays
		this.tagsGroup.add(tag.mesh);
		this.tags.push(tag);
		this.animation.animatingTags.push(tag);
		
		// Update the interaction handler with new tags array
		this.interaction.updateTagsReference(this.tags);
		
		return tag;
	}
	
	generateRandomTag() {
		return this.tagCreator.generateRandomTag();
	}
	
	/**
	 * Update tag sizes based on market cap data
	 * @param {Array} tokenData - Array of token data with text and marketCap properties
	 */
	updateTagSizes(tokenData) {
		if (!tokenData || tokenData.length === 0) return;
		
		// Find min and max market caps for scaling
		let minMarketCap = Infinity;
		let maxMarketCap = -Infinity;
		
		for (const token of tokenData) {
			if (token.marketCap) {
				minMarketCap = Math.min(minMarketCap, token.marketCap);
				maxMarketCap = Math.max(maxMarketCap, token.marketCap);
			}
		}
		
		// Update sizes for existing tags
		for (const token of tokenData) {
			// Find matching tag
			const tag = this.tags.find(t => t.text.replace('$', '') === token.text.replace('$', ''));
			
			if (tag && token.marketCap) {
				// Use the interaction system to handle resize with physics
				this.interaction.resizeTagByMarketCap(tag, token.marketCap, minMarketCap, maxMarketCap);
			}
		}
	}
	
	/**
	 * Update loop to be called in the animation loop
	 */
	update() {
		// Update animations
		this.animation.update();
		
		// Update physics and interactions
		this.interaction.update();
	}
} 