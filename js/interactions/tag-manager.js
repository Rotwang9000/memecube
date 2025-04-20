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
	 * @returns {Object|null} - The created tag or null if creation failed
	 */
	createTag(name, url, options = {}) {
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
			color: color,
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
			color: color.clone(),
			createdAt: Date.now(),
			options
		};
		
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
		if (!tag || !tag.url) return;
		
		// Animate the tag (pulse)
		this.pulseTag(tag);
		
		// Open the URL in a new tab
		if (tag.url !== '#') {
			window.open(tag.url, '_blank');
		}
		
		// Log click
		console.log(`Tag clicked: ${tag.name}`);
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
			return this.tags.find(tag => tag.mesh === intersectedMesh);
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
} 