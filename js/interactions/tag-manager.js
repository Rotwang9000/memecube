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
	 */
	constructor(scene, camera, options = {}) {
		// Store references
		this.scene = scene;
		this.camera = camera;
		
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
	 * Load the font for 3D text
	 */
	loadFont() {
		const loader = new FontLoader();
		
		loader.load(this.options.fontPath, (font) => {
			this.tagStyle.font = font;
			this.fontLoaded = true;
			console.log('Font loaded successfully');
		}, 
		// Progress
		(xhr) => {
			console.log(`Font loading: ${(xhr.loaded / xhr.total * 100).toFixed(0)}%`);
		},
		// Error
		(error) => {
			console.error('Error loading font:', error);
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
			console.warn('Font not loaded, cannot create tag');
			return null;
		}
		
		// Ensure name is a string
		if (typeof name !== 'string') {
			console.error('Tag name must be a string');
			return null;
		}
		
		console.log(`Creating tag: ${name} with URL: ${url}`);
		if (tokenData) {
			console.log(`Tag has token data:`, tokenData);
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
			tokenData // Store token data for scoreboard display
		};
		
		console.log(`Created tag with ID: ${id}, name: ${displayName}, hasTokenData: ${!!tokenData}`);
		
		// Add to collections
		this.tags.push(tag);
		this.tagsByName.set(displayName, tag);
		
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
			this.tagsByName.delete(displayName);
			
			return null;
		}
		
		return tag;
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
	handleTagClick(tag) {
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
			hasTokenData: !!tag.tokenData
		});
		
		// Update lastInteractionTime
		tag.lastInteractionTime = Date.now();
		
		// Animate the tag (pulse)
		this.pulseTag(tag);
		
		// Always display token information in scoreboard - never open URLs directly
		console.log('Displaying token scoreboard for tag');
		this.displayTokenScoreboard(tag);
		
		// Log click
		console.log(`Tag click handling complete for ${tag.name}`);
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
		if (!tag) return;
		
		console.log("Displaying token scoreboard for tag:", tag.name);
		
		// Use token data if available, or create minimal info from tag itself
		const tokenData = tag.tokenData || this.createMinimalTokenData(tag);
		console.log("Using token data:", tokenData);
		
		// Create or update scoreboard element
		let scoreboard = document.getElementById('token-scoreboard');
		if (!scoreboard) {
			scoreboard = document.createElement('div');
			scoreboard.id = 'token-scoreboard';
			scoreboard.className = 'token-scoreboard';
			document.body.appendChild(scoreboard);
		}
		
		// Build the HTML content
		let htmlContent = `
			<div class="token-header">
				<h2>${tokenData.baseToken?.symbol || tag.originalName || tag.name.replace('$', '') || 'Unknown'}</h2>
				<button class="close-scoreboard">×</button>
			</div>
			<div class="token-price">
				<div>Token: ${tag.name}</div>
				<div>URL: <a href="${tag.url}" target="_blank">${tag.url}</a></div>
			</div>
		`;
		
		// Add token data if available
		if (tokenData.priceUsd || tokenData.priceNative) {
			htmlContent += `
				<div class="token-metrics">
					<div>Price: ${tokenData.priceUsd || 'N/A'}</div>
					<div>Price (Native): ${tokenData.priceNative || 'N/A'}</div>
				</div>
			`;
		}
		
		// Add token pair info
		if (tokenData.baseToken?.symbol || tokenData.quoteToken?.symbol) {
			htmlContent += `
				<div class="token-pair">
					<div>Pair: ${tokenData.baseToken?.symbol || 'Unknown'} / ${tokenData.quoteToken?.symbol || 'Unknown'}</div>
					<div>DEX: ${tokenData.dexId || 'Unknown'}</div>
					<div>Chain: ${tokenData.chainId || 'Unknown'}</div>
				</div>
			`;
		}
		
		// Add metrics
		if (tokenData.liquidity?.usd || tokenData.marketCap || tokenData.fdv) {
			htmlContent += `
				<div class="token-metrics">
					${tokenData.liquidity?.usd ? `<div>Liquidity: $${tokenData.liquidity.usd.toLocaleString()}</div>` : ''}
					${tokenData.marketCap ? `<div>Market Cap: $${tokenData.marketCap.toLocaleString()}</div>` : ''}
					${tokenData.fdv ? `<div>FDV: $${tokenData.fdv.toLocaleString()}</div>` : ''}
				</div>
			`;
		}
		
		// Basic info if nothing else is available
		if (!tokenData.priceUsd && !tokenData.liquidity?.usd && !tokenData.marketCap) {
			htmlContent += `
				<div class="token-minimal-info">
					<p>Limited information available for this token.</p>
					<p>Added to MemeCube: ${new Date(tag.createdAt).toLocaleString()}</p>
				</div>
			`;
		}
		
		// Set scoreboard content
		scoreboard.innerHTML = htmlContent;
		
		// Add planets container
		const planetsContainer = document.createElement('div');
		planetsContainer.className = 'token-planets';
		
		// Always add the tag's URL as a planet
		if (tag.url && tag.url !== '#') {
			const planet = this.createPlanet('website', tag.url);
			planetsContainer.appendChild(planet);
		}
		
		// Add the planets container
		scoreboard.appendChild(planetsContainer);
		
		// Show scoreboard
		scoreboard.style.display = 'block';
		
		// Add event listener for close button
		const closeButton = scoreboard.querySelector('.close-scoreboard');
		if (closeButton) {
			closeButton.addEventListener('click', () => {
				scoreboard.style.display = 'none';
			});
		}
		
		// Add event listeners for planets
		const planets = scoreboard.querySelectorAll('.planet');
		planets.forEach(planet => {
			planet.addEventListener('click', (e) => {
				e.stopPropagation();
				const url = planet.getAttribute('data-url');
				if (url) {
					window.open(url, '_blank');
				}
			});
		});
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
		return {
			baseToken: {
				symbol: symbol,
				name: `${symbol} Token`
			},
			info: {
				imageUrl: `https://cryptologos.cc/logos/${symbol.toLowerCase()}-${symbol.toLowerCase()}-logo.png`,
				websites: [
					{ url: tag.url }
				]
			}
		};
	}
} 