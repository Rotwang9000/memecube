/**
 * TagManager - Core component for tag creation, visualization and interaction
 * Handles font loading, tag styling, and user interaction (hover/click)
 */

import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { TagPhysics } from './tag-physics.js';

export class TagManager {
	/**
	 * Create a new TagManager
	 * @param {THREE.Scene} scene - Three.js scene
	 * @param {THREE.Camera} camera - Three.js camera
	 * @param {Object} options - Configuration options
	 * @param {Object} visualizationManager - Reference to VisualizationManager
	 */
	constructor(scene, camera, options = {}, visualizationManager = null) {
		// Store references
		this.scene = scene;
		this.camera = camera;
		this.visualizationManager = visualizationManager;
		
		// Log if visualization manager is already available
		if (visualizationManager) {
			console.log('TagManager created with VisualizationManager already set');
		}
		
		// Configuration
		this.options = {
			fontPath: `/fonts/${['shmup.json', 'freshman.json', 'heysei.json'][Math.floor(Math.random() * 3)]}`,
			hoverColor: 0xffcc00,
			defaultColor: 0xaaaaaa,
			colorVariance: 0.1,  // Reduced variance for more uniform appearance
			showWireframe: true,  // Enable wireframe visualization by default
			wireframeColor: 0xFFFFFF, // Black wireframe
			...options
		};
		
		// Collection of tags
		this.tags = [];
		this.tagsByName = new Map();
		
		// Create the physics engine
		this.physics = new TagPhysics(scene, { tagManager: this });
		
		// Font loading state
		this.fontLoaded = false;
		this.tagStyle = {
			font: null,
			bevelEnabled: false,
			bevelThickness: 0,
			bevelSize: 0,
			bevelSegments: 1,
			curveSegments: 3,
			depth: 0.85
		};
		
		// Interaction tracking
		this.raycaster = new THREE.Raycaster();
		this.mouse = new THREE.Vector2();
		this.hoveredTag = null;
		this.clickedTag = null;
		
		// Load font
		this.loadFont();
		
		// Register event listeners
		this.setupEventListeners();
	}
	
	/**
	 * Set the VisualizationManager reference after construction
	 * @param {Object} visualizationManager - Reference to VisualizationManager
	 */
	setVisualizationManager(visualizationManager) {
		if (!visualizationManager) {
			console.warn('Attempted to set null VisualizationManager');
			return;
		}
		
		this.visualizationManager = visualizationManager;
		
		// Verify scoreboard is available
		if (this.visualizationManager.tokenScoreboard) {
			console.log('VisualizationManager with tokenScoreboard set for TagManager');
		} else {
			console.warn('VisualizationManager set but tokenScoreboard not available');
		}
	}
	
	/**
	 * Load the font for 3D text
	 */
	loadFont() {
		const loader = new FontLoader();
		
		console.log(`Attempting to load font from: ${this.options.fontPath}`);
		
		loader.load(this.options.fontPath, (font) => {
			this.tagStyle.font = font;
			this.fontLoaded = true;
			console.log('Font loaded successfully', {
				fontPath: this.options.fontPath,
				fontAvailable: !!this.tagStyle.font,
				fontLoaded: this.fontLoaded
			});
		}, 
		// Progress
		(xhr) => {
			console.log(`Font loading: ${(xhr.loaded / xhr.total * 100).toFixed(0)}%`);
		},
		// Error
		(error) => {
			console.error('Error loading font:', error);
			console.error(`Font path was: ${this.options.fontPath}`);
			// Try a fallback font
			this.tryFallbackFont();
		});
	}
	
	/**
	 * Try loading a fallback font if the main one fails
	 */
	tryFallbackFont() {
		console.log('Trying fallback font: helvetiker_bold.typeface.json');
		const loader = new FontLoader();
		
		loader.load('/fonts/helvetiker_bold.typeface.json', (font) => {
			this.tagStyle.font = font;
			this.fontLoaded = true;
			console.log('Fallback font loaded successfully');
		}, null, (error) => {
			console.error('Error loading fallback font:', error);
			console.error('CRITICAL: No fonts could be loaded - tag creation will fail');
		});
	}
	
	/**
	 * Set up event listeners for mouse interaction
	 */
	setupEventListeners() {
		// Mouse move for hover effects
		document.addEventListener('mousemove', (event) => {
			// Calculate normalized mouse coordinates (-1 to +1)
			this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
			this.mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
		});
		
		// Click for tag interaction
		document.addEventListener('click', (event) => {
			// Check if we're hovering over a tag
			const intersectedTag = this.findIntersectedTag();
			
			if (intersectedTag) {
				// Set as clicked tag
				this.clickedTag = intersectedTag;
				
				// Trigger tag action
				this.handleTagClick(intersectedTag);
			}
		});
	}
	
	/**
	 * Create a new tag
	 * @param {string} name - Tag name (will add $ prefix if not present)
	 * @param {string} url - URL to navigate to when clicked
	 * @param {Object} options - Additional options for the tag
	 * @param {Object} tokenData - Token data for scoreboard display
	 * @returns {Object|null} - The created tag or null if creation failed
	 */
	createTag(name, url, options = {}, tokenData = null) {
		// Wait for font to load
		if (!this.fontLoaded) {
			console.warn('Font not loaded, cannot create tag for:', name);
			return null;
		}

		if(!options.source) {
			console.warn('No source provided for tag:', name);
			return null;
		}
		
		// Check for tag font
		if (!this.tagStyle.font) {
			console.error('Font object missing even though font is marked as loaded!');
			console.error('Will attempt to reload font');
			// Try to reload the font
			this.loadFont();
			return null;
		}

		// Ensure name is a string
		if (typeof name !== 'string') {
			console.error('Tag name must be a string, received:', typeof name);
			return null;
		}
		
		console.log(`Creating tag: ${name} with URL: ${url}`);
		if (tokenData) {
			// Log condensed token data to avoid overwhelming the console
			console.log(`Tag has token data (symbol: ${tokenData.baseToken?.symbol || name})`);
		} else {
			console.log(`Tag has no token data`);
		}
		
		// Format name (add $ prefix if not present)
		const displayName = name.startsWith('$') ? name : `$${name}`;
		
		// Generate a unique ID for this tag
		const id = `tag_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
		
		// Merge default style with options
		const tagOptions = {
			...this.tagStyle,
			size: options.size || 0.5,  // Text size
			depth: options.depth || this.tagStyle.depth,
		};
		
		// Create geometry for the tag
		try {
			const geometry = new TextGeometry(displayName, {
				font: this.tagStyle.font,
				size: tagOptions.size,
				height: tagOptions.depth,
				curveSegments: tagOptions.curveSegments,
				bevelEnabled: tagOptions.bevelEnabled,
				bevelThickness: tagOptions.bevelThickness,
				bevelSize: tagOptions.bevelSize,
				bevelSegments: tagOptions.bevelSegments
			});
			
			// Center geometry
			geometry.computeBoundingBox();
			const centerOffset = new THREE.Vector3();
			geometry.boundingBox.getCenter(centerOffset);
			centerOffset.multiplyScalar(-1);
			
			geometry.translate(centerOffset.x, centerOffset.y, centerOffset.z);
			
			// Create material with slight random color variation for visual interest
			const colorVariance = this.options.colorVariance;
			const color = new THREE.Color(this.options.defaultColor);
			
			// Apply slight random variation to color
			color.r += (Math.random() * 2 - 1) * colorVariance;
			color.g += (Math.random() * 2 - 1) * colorVariance;
			color.b += (Math.random() * 2 - 1) * colorVariance;
			
			// Clamp values
			color.r = Math.max(0, Math.min(1, color.r));
			color.g = Math.max(0, Math.min(1, color.g));
			color.b = Math.max(0, Math.min(1, color.b));
			
			// Create material with physically based rendering
			const material = new THREE.MeshStandardMaterial({
				color: options.color ? new THREE.Color(options.color) : color,
				metalness: 0.9,  // Increased metalness for Borg-like appearance
				roughness: 0.1,   // Reduced roughness for a polished look
			});
			
			// Create mesh
			const mesh = new THREE.Mesh(geometry, material);
			
			// Set scale
			const scale = options.scale || 1.0;
			mesh.scale.set(scale, scale, scale);
			
			// Add to scene
			this.scene.add(mesh);
			
			// Create tag object
			const tag = {
				id,
				name: displayName,
				originalName: name,
				url: url || '#',
				mesh,
				color: options.color ? new THREE.Color(options.color) : color.clone(),
				createdAt: Date.now(),
				options,
				tokenData, // Store token data for scoreboard display
				metadata: {
					isToken: !!tokenData,
					addedAt: Date.now(),
					source: options.source || 'manual',
				}
			};
			
			// Store reference
			this.tags.push(tag);
			
			// Store by name for easy lookup (uppercase for case-insensitive lookup)
			const lookupName = name.toUpperCase();
			this.tagsByName.set(lookupName, tag);
			
			console.log(`Tag created successfully: ${displayName}`);
			
			// Add to physics system (place tag in space)
			const success = this.physics.addNewTag(tag, this.tags);
			
			if (!success) {
				console.warn(`Failed to place tag "${name}" in space`);
				// Remove from scene if physics placement failed
				this.scene.remove(mesh);
				
				// Remove from collections
				const index = this.tags.findIndex(t => t.id === tag.id);
				if (index !== -1) {
					this.tags.splice(index, 1);
				}
				this.tagsByName.delete(lookupName);
				
				return null;
			}
			
			return tag;
		} catch (error) {
			console.error(`Error creating tag geometry for "${displayName}":`, error);
			console.error('Font details:', {
				fontLoaded: this.fontLoaded,
				fontAvailable: !!this.tagStyle.font,
				fontPath: this.options.fontPath
			});
			return null;
		}
	}
	
	/**
	 * Remove a tag
	 * @param {string} tagId - ID of tag to remove
	 * @returns {boolean} - Whether removal was successful
	 */
	removeTag(tagId) {
		// Find tag index
		const tagIndex = this.tags.findIndex(t => t.id === tagId);
		if (tagIndex === -1) return false;
		
		// Get tag reference
		const tag = this.tags[tagIndex];
		
		// Remove from physics system
		this.physics.removeTag(tagId);
		
		// Remove from scene
		if (tag.mesh) {
			this.scene.remove(tag.mesh);
			if (tag.mesh.geometry) tag.mesh.geometry.dispose();
			if (tag.mesh.material) tag.mesh.material.dispose();
		}
		
		// Remove from collections
		this.tags.splice(tagIndex, 1);
		this.tagsByName.delete(tag.name);
		
		// If this was the hovered tag, clear it
		if (this.hoveredTag === tag) {
			this.hoveredTag = null;
		}
		
		// If this was the clicked tag, clear it
		if (this.clickedTag === tag) {
			this.clickedTag = null;
		}
		
		return true;
	}
	
	/**
	 * Resize a tag
	 * @param {string} tagId - ID of tag to resize
	 * @param {number} newSize - New size for the tag
	 * @returns {boolean} - Whether resizing was successful
	 */
	resizeTag(tagId, newSize) {
		// Find tag
		const tag = this.tags.find(t => t.id === tagId);
		if (!tag || !tag.mesh) return false;
		
		// Apply the resize through physics system
		return this.physics.handleTagResize(tag, newSize);
	}
	
	/**
	 * Handle a click on a tag
	 * @param {Object} tag - The tag that was clicked
	 */
	async handleTagClick(tag) {
		if (!tag) {
			console.warn('handleTagClick called with null tag');
			return;
		}
		
		console.log(`Tag clicked: ${tag.name} (ID: ${tag.id})`);
		console.log(`Tag properties:`, {
			id: tag.id,
			name: tag.name,
			originalName: tag.originalName,
			url: tag.url,
			hasTokenData: !!tag.tokenData,
			source: tag.metadata?.source
		});
		
		// Update lastInteractionTime
		tag.lastInteractionTime = Date.now();
		
		// Animate the tag (pulse)
		this.pulseTag(tag);
		
		// Verify we have the VisualizationManager reference - try to locate it if missing
		if (!this.visualizationManager) {
			console.warn(`VisualizationManager reference missing for tag: ${tag.name}`);
			
			// Try to locate from global scope as last resort
			if (window.memeCube && window.memeCube.visualizationManager) {
				console.log('Recovering VisualizationManager from window.memeCube');
				this.visualizationManager = window.memeCube.visualizationManager;
			} else {
				console.error('Cannot find VisualizationManager anywhere - tag click cannot display token info');
				
				// Still show a basic URL if available
				if (tag.url && tag.url !== '#') {
					console.log(`Tag has URL: ${tag.url} - could open in new window`);
					// Optionally open URL: window.open(tag.url, '_blank');
				}
				return;
			}
		}
		
		// Log scoreboard existence state
		console.log('VisualizationManager found:', !!this.visualizationManager);
		console.log('TokenScoreboard exists:', !!this.visualizationManager.tokenScoreboard);
		
		// Use TokenScoreboard to display token information
		console.log('Displaying token information using TokenScoreboard');
		
		// Get token data for display - either use existing data or create minimal data
		let tokenData = tag.tokenData ? { ...tag.tokenData } : this.createMinimalTokenData(tag);
		
		// Ensure token data has required fields, backfilling with defaults if needed
		this.ensureTokenDataComplete(tokenData, tag);
		
		console.log('Prepared token data for display:', tokenData);
		
		// Try to use the scoreboard from visualizationManager
		const scoreboard = this.visualizationManager?.tokenScoreboard;
		if (scoreboard) {
			console.log('Using tokenScoreboard from VisualizationManager');
			try {
				if (typeof scoreboard.showTokenDetail === 'function') {
					scoreboard.showTokenDetail(tokenData);
				} else {
					// Fallback to old behaviour
					scoreboard.updateTokenData([tokenData]);
				}
				// Ensure scoreboard is visible
				if (!scoreboard.isVisible) {
					scoreboard.toggleVisibility(true);
				}
			} catch (error) {
				console.error('Error displaying token scoreboard:', error);
			}
		} else {
			console.warn('TokenScoreboard not found in VisualizationManager');
		}
		
		// Log click completion
		console.log(`Tag click handling complete for ${tag.name}`);
	}
	
	/**
	 * Ensure token data has all required fields for display
	 * @param {Object} tokenData - Token data to augment
	 * @param {Object} tag - Original tag object
	 */
	ensureTokenDataComplete(tokenData, tag) {
		const symbol = tokenData.baseToken?.symbol || 
			tag.originalName || 
			tag.name.replace('$', '');
		
		// Ensure base token exists
		if (!tokenData.baseToken) {
			tokenData.baseToken = {
				symbol: symbol,
				name: `${symbol} Token`
			};
		}
		
		// Ensure quote token exists
		if (!tokenData.quoteToken) {
			tokenData.quoteToken = { symbol: 'USD' };
		}
		
		// Add common fields if missing
		if (!tokenData.marketCap) tokenData.marketCap = 1000000;
		if (!tokenData.fdv) tokenData.fdv = 5000000;
		if (!tokenData.liquidity) tokenData.liquidity = { usd: 100000 };
		if (!tokenData.volume) tokenData.volume = { h24: 50000 };
		if (!tokenData.priceChange) tokenData.priceChange = { h24: 0 };
		
		// Ensure social links exist - starting with URL as website
		if (!tokenData.socialLinks) {
			tokenData.socialLinks = [];
			
			// Add website URL as first social link
			if (tag.url && tag.url !== '#') {
				tokenData.socialLinks.push({ 
					type: 'website', 
					url: tag.url 
				});
			}
		}
		
		// Add info section if missing
		if (!tokenData.info) {
			tokenData.info = {
				description: `${symbol} is a cryptocurrency token.`,
				imageUrl: `https://cryptologos.cc/logos/${symbol.toLowerCase()}-${symbol.toLowerCase()}-logo.png`
			};
		}
		
		// Add websites to info if missing
		if (!tokenData.info.websites) {
			tokenData.info.websites = [];
			if (tag.url && tag.url !== '#') {
				tokenData.info.websites.push({ url: tag.url });
			}
		}
		
		// Add timestamps if missing
		if (!tokenData.createdAt) tokenData.createdAt = tag.createdAt || Date.now();
		if (!tokenData.updatedAt) tokenData.updatedAt = Date.now();
		
		// Ensure social links contains all available platforms from info
		if (tokenData.info) {
			const socialPlatforms = ['twitter', 'telegram', 'discord', 'github', 'medium', 'youtube', 'reddit', 'facebook', 'instagram'];
			
			socialPlatforms.forEach(platform => {
				if (tokenData.info[platform] && !tokenData.socialLinks.some(link => link.type === platform)) {
					tokenData.socialLinks.push({
						type: platform,
						url: this.getSocialUrl(platform, tokenData.info[platform])
					});
				}
			});
		}
		
		// Limit social links to 6 to prevent scoreboard scrolling
		if (tokenData.socialLinks.length > 6) {
			tokenData.socialLinks = tokenData.socialLinks.slice(0, 6);
		}
		
		return tokenData;
	}
	
	/**
	 * Create a pulse animation for a tag
	 * @param {Object} tag - Tag to pulse
	 */
	pulseTag(tag) {
		if (!tag || !tag.mesh) return;
		
		// Store original scale
		const originalScale = tag.mesh.scale.x;
		
		// Pulse timeline
		let pulseTime = 0;
		const pulseDuration = 0.5; // seconds
		const pulseAmount = 0.2;    // 20% larger
		
		// Animation function
		const animate = () => {
			// Update pulse time
			pulseTime += 0.016; // Approximate for 60fps
			
			// Calculate scale factor
			const progress = Math.min(pulseTime / pulseDuration, 1);
			const easedProgress = Math.sin(progress * Math.PI);
			const scaleFactor = 1 + easedProgress * pulseAmount;
			
			// Apply scale
			tag.mesh.scale.set(
				originalScale * scaleFactor,
				originalScale * scaleFactor,
				originalScale * scaleFactor
			);
			
			// Continue animation until done
			if (progress < 1) {
				requestAnimationFrame(animate);
			} else {
				// Reset to original scale
				tag.mesh.scale.set(originalScale, originalScale, originalScale);
			}
		};
		
		// Start animation
		animate();
	}
	
	/**
	 * Find which tag (if any) the mouse is currently over
	 * @returns {Object|null} - Intersected tag or null
	 */
	findIntersectedTag() {
		// Update raycaster
		this.raycaster.setFromCamera(this.mouse, this.camera);
		
		// Get all tag meshes
		const tagMeshes = this.tags.map(tag => tag.mesh);
		
		// Find intersections
		const intersects = this.raycaster.intersectObjects(tagMeshes);
		
		// Return first hit tag or null
		if (intersects.length > 0) {
			// Find which tag this mesh belongs to
			const intersectedMesh = intersects[0].object;
			const tag = this.tags.find(tag => tag.mesh === intersectedMesh);
			
			// Update lastInteractionTime when a tag is hovered
			if (tag) {
				tag.lastInteractionTime = Date.now();
			}
			
			return tag;
		}
		
		return null;
	}
	
	/**
	 * Reset tag color to its original color
	 * @param {Object} tag - Tag to reset color for
	 */
	resetTagColor(tag) {
		if (!tag || !tag.mesh || !tag.mesh.material) return;
		
		// Restore original color
		tag.mesh.material.color.copy(tag.color);
		tag.mesh.material.needsUpdate = true;
	}
	
	/**
	 * Set tag color to hover color
	 * @param {Object} tag - Tag to set hover color for
	 */
	setTagHoverColor(tag) {
		if (!tag || !tag.mesh || !tag.mesh.material) return;
		
		// Set hover color
		tag.mesh.material.color.set(this.options.hoverColor);
		tag.mesh.material.needsUpdate = true;
	}
	
	/**
	 * Update function called each frame
	 */
	update() {
		// Update physics
		this.physics.update();
		
		// Update hover effects
		const intersectedTag = this.findIntersectedTag();
		
		// Handle hover state changes
		if (intersectedTag !== this.hoveredTag) {
			// Reset previous hover
			if (this.hoveredTag) {
				this.resetTagColor(this.hoveredTag);
			}
			
			// Set new hover
			if (intersectedTag) {
				this.setTagHoverColor(intersectedTag);
			}
			
			// Update hovered tag reference
			this.hoveredTag = intersectedTag;
		}
	}
	
	/**
	 * Get a tag by name
	 * @param {string} name - Name of tag to find
	 * @returns {Object|null} - Found tag or null
	 */
	getTagByName(name) {
		// Format name (add $ prefix if not present)
		const displayName = name.startsWith('$') ? name : `$${name}`;
		return this.tagsByName.get(displayName) || null;
	}
	
	/**
	 * Get a tag by ID
	 * @param {string} id - ID of tag to find
	 * @returns {Object|null} - Found tag or null
	 */
	getTagById(id) {
		return this.tags.find(tag => tag.id === id) || null;
	}
	
	/**
	 * Toggle wireframe visibility for all tags
	 * @param {boolean} visible - Whether wireframes should be visible
	 */
	toggleWireframes(visible) {
		// Update option
		this.options.showWireframe = visible;
		
		// Update existing tags
		this.tags.forEach(tag => {
			if (tag.mesh && tag.mesh.userData.wireframe) {
				tag.mesh.userData.wireframe.visible = visible;
			}
		});
	}
	
	/**
	 * Dispose of resources used by the TagManager
	 */
	dispose() {
		// Remove event listeners
		document.removeEventListener('mousemove', this.onMouseMove);
		document.removeEventListener('click', this.onClick);
		
		// Clean up all tags
		const tagIds = [...this.tags.map(tag => tag.id)];
		tagIds.forEach(id => this.removeTag(id));
		
		// Clear collections
		this.tags = [];
		this.tagsByName.clear();
		
		// Clean up physics
		this.physics.dispose();
		
		console.log('Tag manager disposed');
	}
	
	/**
	 * Display token information in a scoreboard
	 * @param {Object} tag - The tag with token data
	 */
	displayTokenScoreboard(tag) {
		// This method is deprecated and should not be used
		console.warn('displayTokenScoreboard is deprecated, use TokenScoreboard instead');
		return;
	}
	
	/**
	 * Create a planet element for websites or socials
	 * @param {string} type - Type of planet (website, twitter, telegram, etc.)
	 * @param {string} url - URL to open when clicked
	 * @returns {HTMLElement} - Planet element
	 */
	createPlanet(type, url) {
		const planet = document.createElement('div');
		planet.className = `planet planet-${type.toLowerCase()}`;
		planet.setAttribute('data-url', url);
		planet.setAttribute('title', type);
		
		// Add icon based on type
		const icon = document.createElement('span');
		icon.className = `planet-icon planet-icon-${type.toLowerCase()}`;
		icon.innerHTML = this.getPlanetIcon(type);
		planet.appendChild(icon);
		
		return planet;
	}
	
	/**
	 * Get icon for planet based on type
	 * @param {string} type - Type of planet
	 * @returns {string} - HTML for icon
	 */
	getPlanetIcon(type) {
		// Simple icon mapping
		const icons = {
			website: '🌐',
			twitter: '🐦',
			telegram: '📱',
			discord: '💬',
			github: '🐙',
			medium: '📝',
			youtube: '📺',
			facebook: '📘',
			instagram: '📷',
			reddit: '🔴',
			default: '🪐'
		};
		
		return icons[type.toLowerCase()] || icons.default;
	}
	
	/**
	 * Get social media URL based on platform and handle
	 * @param {string} platform - Social media platform
	 * @param {string} handle - User handle or ID
	 * @returns {string} - URL to social media profile
	 */
	getSocialUrl(platform, handle) {
		// Simple platform URL mapping
		const platformUrls = {
			twitter: `https://twitter.com/${handle}`,
			telegram: `https://t.me/${handle}`,
			discord: handle.startsWith('http') ? handle : `https://discord.gg/${handle}`,
			github: `https://github.com/${handle}`,
			medium: `https://medium.com/${handle}`,
			youtube: `https://youtube.com/${handle}`,
			facebook: `https://facebook.com/${handle}`,
			instagram: `https://instagram.com/${handle}`,
			reddit: `https://reddit.com/r/${handle}`
		};
		
		return platformUrls[platform.toLowerCase()] || handle;
	}
	
	/**
	 * Get 24h volume from token data
	 * @param {Object} tokenData - Token data
	 * @returns {string} - Formatted 24h volume
	 */
	getVolume24h(tokenData) {
		if (!tokenData.volume) return null;
		
		// Get first volume property (24h)
		const volumes = Object.values(tokenData.volume);
		if (volumes.length > 0) {
			return `$${volumes[0].toLocaleString()}`;
		}
		
		return null;
	}
	
	/**
	 * Get 24h price change from token data
	 * @param {Object} tokenData - Token data
	 * @returns {string} - Formatted 24h price change
	 */
	getPriceChange24h(tokenData) {
		if (!tokenData.priceChange) return null;
		
		// Get first price change property (24h)
		const changes = Object.values(tokenData.priceChange);
		if (changes.length > 0) {
			const change = changes[0];
			const prefix = change >= 0 ? '+' : '';
			return `${prefix}${change.toFixed(2)}%`;
		}
		
		return null;
	}
	
	/**
	 * Create minimal token data from tag information
	 * @param {Object} tag - The tag to create token data for
	 * @returns {Object} - Minimal token data object
	 */
	createMinimalTokenData(tag) {
		const symbol = tag.originalName || tag.name.replace('$', '');
		
		// Create a more comprehensive token data structure
		return {
			baseToken: {
				symbol: symbol,
				name: `${symbol} Token`
			},
			quoteToken: {
				symbol: 'USD'
			},
			priceUsd: '$0.00',
			priceChange: {
				h24: 0
			},
			liquidity: {
				usd: 100000
			},
			volume: {
				h24: 50000
			},
			marketCap: 1000000,
			fdv: 5000000, // Fully diluted valuation
			dexId: 'Unknown',
			chainId: 'unknown',
			// Add social links including the URL as a website planet
			socialLinks: [
				{ type: 'website', url: tag.url || '#' }
			],
			// Add additional info for TokenScoreboard
			info: {
				description: `${symbol} is a cryptocurrency token.`,
				imageUrl: `https://cryptologos.cc/logos/${symbol.toLowerCase()}-${symbol.toLowerCase()}-logo.png`,
				websites: [
					{ url: tag.url || '#' }
				]
			},
			// Add timestamp for when this token was first seen
			createdAt: tag.createdAt || Date.now(),
			updatedAt: Date.now()
		};
	}
} 