import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { TagPhysics } from './tag-physics.js';

/**
 * TagManager - Core component for tag creation, visualization and interaction
 * 
 * This class is responsible for:
 * 1. Creating the 3D text meshes for tags with proper styling
 * 2. Loading and managing fonts for text rendering
 * 3. Handling user interactions (hover/click) with tags
 * 4. Providing the visual representation and effects for tags
 * 5. Integrating with TagPhysics for positioning and movement
 * 
 * Usage flow:
 * - TagsManager delegates to this class for core tag operations
 * - This class creates and manages the actual THREE.js objects
 * - TagPhysics handles all movement and positioning calculations
 * - This class provides methods for tag creation, resizing, and removal
 * 
 * Implementation notes:
 * - Primarily concerned with the visual aspects of tags
 * - Delegates physics calculations to TagPhysics
 * - Handles font loading and text geometry creation
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
		
		// Flight parameters - reduced for tighter cluster formation
		this.tagFlightDuration = 1.5; // seconds (reduced from 2.0)
		
		// Raycaster for interaction
		this.raycaster = new THREE.Raycaster();
		this.mouse = new THREE.Vector2();
		
		// Styling options - improved for isometric cluster look
		this.tagStyle = {
			font: null,            // Will be set later
			size: 0.5,             // Base text size
			height: 0.25,          // Text extrusion height (increased from 0.2)
			curveSegments: 4,      // Text curve detail
			bevelEnabled: true,    // Enable bevel
			bevelThickness: 0.035, // Bevel thickness (increased from 0.03)
			bevelSize: 0.025,      // Bevel size (increased from 0.02)
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
		const fontFiles = [
			'fonts/helvetiker_bold.typeface.json',
			'fonts/shmup.json',
			'fonts/heysei.json',
			'fonts/freshman.json'
		];
		const randomFontFile = fontFiles[Math.floor(Math.random() * fontFiles.length)];
		
		this.fontLoader.load(randomFontFile, (font) => {
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
		
		// Ensure name is a valid string
		if (!name || typeof name !== 'string') {
			console.warn('Invalid tag name provided:', name);
			name = 'UNKNOWN';
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
		
		// Center geometry properly for better cluster formation
		textGeometry.computeBoundingBox();
		const centerOffset = new THREE.Vector3();
		textGeometry.boundingBox.getCenter(centerOffset);
		textGeometry.translate(-centerOffset.x, -centerOffset.y, -centerOffset.z);
		
		// Create material with improved settings for isometric look
		const material = new THREE.MeshStandardMaterial({
			color: options.color || this.getRandomColor(),
			metalness: 0.7,  // Reduced from 0.8
			roughness: 0.3,  // Increased from 0.2 for better light diffusion
			emissive: new THREE.Color(0x222222),
			emissiveIntensity: 0.2, // Added for subtle glow
			flatShading: false  // Smooth shading for better isometric look
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
		
		// Initialize in physics system - properly set as new tag
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
		
		// Let physics system handle the resizing with animations
		this.physics.handleTagResize(tag, newSize);
	}
	
	/**
	 * Generate a random appealing color
	 */
	getRandomColor() {
		// Generate colors in a pleasing range for isometric structure
		// More saturated, brighter colors for better visibility
		const hue = Math.random() * 360;
		const saturation = 0.8 + Math.random() * 0.2; // Higher saturation (was 0.7-1.0)
		const lightness = 0.6 + Math.random() * 0.2; // Brighter (was 0.5-0.7)
		
		// Convert HSL to hex
		return new THREE.Color().setHSL(hue/360, saturation, lightness);
	}
	
	/**
	 * Handle click events for tag interaction
	 */
	handleClick(event) {
		// Update mouse position
		this.updateMousePosition(event);
		
		// Find intersected tag
		const tag = this.findIntersectedTag();
		
		if (tag) {
			// Animate the tag
			this.pulseTag(tag);
			
			// Open URL
			if (tag.url && tag.url !== '#') {
				window.open(tag.url, '_blank');
			}
		}
	}
	
	/**
	 * Handle mouse movement for hover effects
	 */
	handleMouseMove(event) {
		// Update mouse position
		this.updateMousePosition(event);
		
		// Find intersected tag
		const tag = this.findIntersectedTag();
		
		// Update hover states
		if (tag !== this.hoveredTag) {
			if (this.hoveredTag) {
				this.setTagHoverState(this.hoveredTag, false);
			}
			
			if (tag) {
				this.setTagHoverState(tag, true);
			}
			
			this.hoveredTag = tag;
		}
	}
	
	/**
	 * Set tag hover visual state
	 */
	setTagHoverState(tag, isHovered) {
		if (!tag || !tag.mesh) return;
		
		if (isHovered) {
			// Highlight effect
			tag.originalEmissive = tag.mesh.material.emissive.clone();
			tag.originalEmissiveIntensity = tag.mesh.material.emissiveIntensity;
			
			// Enhance emissive for glow effect
			tag.mesh.material.emissive.setRGB(1, 1, 1);
			tag.mesh.material.emissiveIntensity = 0.3;
			
			// Scale up slightly
			tag.originalScale = tag.mesh.scale.x;
			tag.mesh.scale.multiplyScalar(1.1);
			
			// Add cursor styling
			document.body.style.cursor = 'pointer';
		} else {
			// Restore original properties
			if (tag.originalEmissive) {
				tag.mesh.material.emissive.copy(tag.originalEmissive);
				tag.mesh.material.emissiveIntensity = tag.originalEmissiveIntensity || 0.1;
			}
			
			if (tag.originalScale) {
				tag.mesh.scale.set(
					tag.originalScale,
					tag.originalScale,
					tag.originalScale
				);
			}
			
			// Reset cursor
			document.body.style.cursor = 'auto';
		}
	}
	
	/**
	 * Update mouse position from event
	 */
	updateMousePosition(event) {
		this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
		this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
	}
	
	/**
	 * Find tag under the mouse cursor
	 */
	findIntersectedTag() {
		this.raycaster.setFromCamera(this.mouse, this.camera);
		
		// Get all tag meshes
		const meshes = this.tags.map(tag => tag.mesh).filter(Boolean);
		
		// Check for intersections
		const intersects = this.raycaster.intersectObjects(meshes);
		
		if (intersects.length > 0) {
			const mesh = intersects[0].object;
			return this.tags.find(tag => tag.mesh === mesh);
		}
		
		return null;
	}
	
	/**
	 * Create a pulse animation on a tag
	 */
	pulseTag(tag) {
		if (!tag || !tag.mesh) return;
		
		// Store original scale
		const originalScale = tag.mesh.scale.x;
		
		// Pulse animation timings
		const duration = 300; // ms
		const startTime = Date.now();
		
		// Create animation function
		const animate = () => {
			const elapsed = Date.now() - startTime;
			const progress = Math.min(1.0, elapsed / duration);
			
			// Pulse wave: grow then shrink back
			const scale = originalScale * (1 + 0.2 * Math.sin(progress * Math.PI));
			tag.mesh.scale.set(scale, scale, scale);
			
			if (progress < 1.0) {
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
	 * Update all tags (called once per frame)
	 */
	update() {
		// Update physics system
		this.physics.update(this.tags);
	}
} 