import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { TagPhysics } from './tag-physics.js';

/**
 * TagManager - Handles the creation, positioning and visualization of tags
 * Integrates with the TagPhysics system for physically-based movement and positioning
 */
export class TagManager {
	constructor(scene, camera) {
		this.scene = scene;
		this.camera = camera;
		
		// Create the physics engine
		this.physics = new TagPhysics(scene);
		
		// Store tags
		this.tags = [];
		this.tagsByName = new Map();
		
		// Flight parameters
		this.tagFlightDuration = 2.0; // seconds
		
		// Raycaster for interaction
		this.raycaster = new THREE.Raycaster();
		this.mouse = new THREE.Vector2();
		
		// Styling options
		this.tagStyle = {
			font: null,            // Will be set later
			size: 0.5,             // Base text size
			height: 0.2,           // Text extrusion height
			curveSegments: 4,      // Text curve detail
			bevelEnabled: true,    // Enable bevel
			bevelThickness: 0.03,  // Bevel thickness
			bevelSize: 0.02,       // Bevel size
			bevelOffset: 0,        // Bevel offset
			bevelSegments: 3       // Bevel detail
		};
		
		// Set up click handlers
		window.addEventListener('click', this.handleClick.bind(this));
		window.addEventListener('mousemove', this.handleMouseMove.bind(this));
		
		// Set up hover state
		this.hoveredTag = null;
		
		// Font loader
		this.fontLoader = new FontLoader();
		this.fontLoaded = false;
		this.loadFont();
	}
	
	/**
	 * Load the font for text geometry
	 */
	loadFont() {
		this.fontLoader.load('fonts/helvetiker_bold.typeface.json', (font) => {
			this.tagStyle.font = font;
			this.fontLoaded = true;
			
			// Process any pending tags
			if (this.pendingTags) {
				this.pendingTags.forEach(tag => this.createTag(tag.name, tag.url, tag.options));
				this.pendingTags = null;
			}
		});
	}
	
	/**
	 * Create a new tag and add it to the scene
	 * @param {string} name - The tag text
	 * @param {string} url - The URL associated with the tag
	 * @param {Object} options - Additional options (size, color, etc.)
	 * @return {Object} The created tag object
	 */
	createTag(name, url, options = {}) {
		// If font isn't loaded yet, queue this tag for later
		if (!this.fontLoaded) {
			if (!this.pendingTags) this.pendingTags = [];
			this.pendingTags.push({name, url, options});
			return null;
		}
		
		// Add $ prefix for meme coins if not already present
		const displayName = name.startsWith('$') ? name : `$${name}`;
		
		// Skip if tag already exists
		if (this.tagsByName.has(displayName)) {
			return this.tagsByName.get(displayName);
		}
		
		// Create a unique ID
		const id = `tag_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
		
		// Create text geometry with dollar sign
		const textGeometry = new TextGeometry(displayName, {
			font: this.tagStyle.font,
			size: options.size || this.tagStyle.size,
			height: this.tagStyle.height,
			curveSegments: this.tagStyle.curveSegments,
			bevelEnabled: this.tagStyle.bevelEnabled,
			bevelThickness: this.tagStyle.bevelThickness,
			bevelSize: this.tagStyle.bevelSize,
			bevelOffset: this.tagStyle.bevelOffset,
			bevelSegments: this.tagStyle.bevelSegments
		});
		
		// Center geometry properly
		textGeometry.computeBoundingBox();
		const centerOffset = new THREE.Vector3();
		textGeometry.boundingBox.getCenter(centerOffset);
		textGeometry.translate(-centerOffset.x, -centerOffset.y, -centerOffset.z);
		
		// Create material
		const material = new THREE.MeshStandardMaterial({
			color: options.color || this.getRandomColor(),
			metalness: 0.8,
			roughness: 0.2,
			emissive: new THREE.Color(0x222222)
		});
		
		// Create mesh
		const mesh = new THREE.Mesh(textGeometry, material);
		
		// Set initial scale
		const scale = options.scale || 1.0;
		mesh.scale.set(scale, scale, scale);
		
		// Create tag object
		const tag = {
			id,
			name: displayName,
			originalName: name,
			url: url || '#',
			mesh,
			createdAt: Date.now(),
			options
		};
		
		// Add to scene
		this.scene.add(mesh);
		
		// Add to collections
		this.tags.push(tag);
		this.tagsByName.set(displayName, tag);
		
		// Initialize in physics system
		this.physics.addNewTag(tag, this.tags);
		
		return tag;
	}
	
	/**
	 * Remove a tag from the system
	 * @param {string} tagId - The ID of the tag to remove
	 */
	removeTag(tagId) {
		const tagIndex = this.tags.findIndex(t => t.id === tagId);
		if (tagIndex === -1) return;
		
		const tag = this.tags[tagIndex];
		
		// Remove from collections
		this.tags.splice(tagIndex, 1);
		this.tagsByName.delete(tag.name);
		
		// Remove from physics
		this.physics.removeTag(tagId);
		
		// Remove from scene
		if (tag.mesh) {
			this.scene.remove(tag.mesh);
			tag.mesh.geometry.dispose();
			tag.mesh.material.dispose();
		}
	}
	
	/**
	 * Update a tag's size
	 * @param {string} tagId - The ID of the tag to resize
	 * @param {number} newSize - The new size (scale) of the tag
	 */
	resizeTag(tagId, newSize) {
		const tag = this.tags.find(t => t.id === tagId);
		if (!tag || !tag.mesh) return;
		
		// Start a smooth scale animation
		this.animateTagResize(tag, newSize);
	}
	
	/**
	 * Smoothly animate tag resizing
	 * @param {Object} tag - The tag to resize
	 * @param {number} targetSize - The target size
	 */
	animateTagResize(tag, targetSize) {
		// Store the original scale
		const startSize = tag.mesh.scale.x;
		const startTime = Date.now();
		const duration = 1000; // 1 second animation
		
		// Create the animation function
		const animate = () => {
			const elapsed = Date.now() - startTime;
			const progress = Math.min(1.0, elapsed / duration);
			
			// Use a smooth easing function
			const eased = 1 - Math.pow(1 - progress, 3); // Cubic ease out
			
			// Calculate current size
			const currentSize = startSize + (targetSize - startSize) * eased;
			
			// Apply the scale
			tag.mesh.scale.set(currentSize, currentSize, currentSize);
			
			// Update physics
			this.physics.handleTagResize(tag, currentSize);
			
			// Continue animation if not done
			if (progress < 1.0) {
				requestAnimationFrame(animate);
			}
		};
		
		// Start the animation
		animate();
	}
	
	/**
	 * Generate a random appealing color
	 */
	getRandomColor() {
		// Generate colors in a pleasing range
		const hue = Math.random() * 360;
		const saturation = 0.7 + Math.random() * 0.3; // 70-100%
		const lightness = 0.5 + Math.random() * 0.2; // 50-70%
		
		// Convert HSL to RGB
		const color = new THREE.Color().setHSL(hue/360, saturation, lightness);
		return color;
	}
	
	/**
	 * Handle mouse click events
	 */
	handleClick(event) {
		// Update mouse position
		this.updateMousePosition(event);
		
		// Check for tag intersections
		const clickedTag = this.findIntersectedTag();
		
		if (clickedTag) {
			// Handle tag click (e.g. open URL)
			window.open(clickedTag.url, '_blank');
			
			// Visual feedback
			this.pulseTag(clickedTag);
		}
	}
	
	/**
	 * Handle mouse move events for tag hover effects
	 */
	handleMouseMove(event) {
		// Update mouse position
		this.updateMousePosition(event);
		
		// Check for tag intersections
		const hoveredTag = this.findIntersectedTag();
		
		// Handle hover state changes
		if (hoveredTag !== this.hoveredTag) {
			// Reset previous hover state
			if (this.hoveredTag && this.hoveredTag.mesh) {
				this.setTagHoverState(this.hoveredTag, false);
			}
			
			// Set new hover state
			if (hoveredTag) {
				this.setTagHoverState(hoveredTag, true);
			}
			
			this.hoveredTag = hoveredTag;
		}
	}
	
	/**
	 * Set tag hover visual state
	 */
	setTagHoverState(tag, isHovered) {
		if (!tag || !tag.mesh || !tag.mesh.material) return;
		
		if (isHovered) {
			// Store original emission
			if (!tag._originalEmissive) {
				tag._originalEmissive = tag.mesh.material.emissive.clone();
			}
			
			// Enhance emissive
			tag.mesh.material.emissive.set(0x444444);
			
			// Change cursor
			document.body.style.cursor = 'pointer';
		} else {
			// Reset emissive
			if (tag._originalEmissive) {
				tag.mesh.material.emissive.copy(tag._originalEmissive);
			}
			
			// Reset cursor
			document.body.style.cursor = 'auto';
		}
	}
	
	/**
	 * Update mouse position for raycasting
	 */
	updateMousePosition(event) {
		this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
		this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
	}
	
	/**
	 * Find the tag currently under the mouse cursor
	 */
	findIntersectedTag() {
		// Update the raycaster
		this.raycaster.setFromCamera(this.mouse, this.camera);
		
		// Get all meshes
		const meshes = this.tags.map(tag => tag.mesh).filter(mesh => mesh);
		
		// Find intersections
		const intersects = this.raycaster.intersectObjects(meshes);
		
		// Return the first hit tag
		if (intersects.length > 0) {
			const mesh = intersects[0].object;
			return this.tags.find(tag => tag.mesh === mesh);
		}
		
		return null;
	}
	
	/**
	 * Create a pulse effect on a tag for visual feedback
	 */
	pulseTag(tag) {
		if (!tag || !tag.mesh) return;
		
		// Store original scale
		const originalScale = tag.mesh.scale.clone();
		
		// Scale up quickly
		tag.mesh.scale.multiplyScalar(1.2);
		
		// Return to original scale
		setTimeout(() => {
			tag.mesh.scale.copy(originalScale);
			
			// Update physics to match new size
			this.physics.handleTagResize(tag, originalScale.x);
		}, 200);
	}
	
	/**
	 * Update function called each frame
	 */
	update() {
		// Update physics
		this.physics.update(this.tags);
	}
} 