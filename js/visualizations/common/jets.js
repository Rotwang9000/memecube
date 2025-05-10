import * as THREE from 'three';

/**
 * Handles particle jet effects for the scoreboard
 */
export class JetsManager {
	constructor(parentGroup, cornerBolts) {
		this.parentGroup = parentGroup;
		this.cornerBolts = cornerBolts;
		this.jets = [];
		this.jetsGroup = new THREE.Group();
		this.lastMovementTime = 0;
		this.jetFadeSpeed = 1.2; // Reduced fade speed for longer-lasting particles
		this._needsTestEmission = true; // Set to true to emit test particles on first update
		
		// Add jets group to parent
		this.parentGroup.add(this.jetsGroup);
		
		// Make sure the group is visible and has high render order
		this.jetsGroup.visible = true;
		this.jetsGroup.renderOrder = 1000;
		
		// Create jet effects
		this.createCornerJets();
		
		// Initialize jet positions
		this.syncJetsWithBolts(true);
		
		// Force visible particles on startup after a short delay
		setTimeout(() => {
			console.log("Initial particle burst for visibility testing");
			this.forceTestParticles();
		}, 500);
	}
	
	/**
	 * Create corner jets - these are the particle emitters attached to each bolt
	 */
	createCornerJets() {
		// Create shared star texture
		const starTexture = this.createStarTexture();
		
		// Create each jet for each bolt
		this.cornerBolts.forEach((bolt, boltIndex) => {
			// Create geometry for jet particles - increased count for more visible effect
			const particleCount = 200; // Increased from 150 for more visible effect
			const jetGeometry = new THREE.BufferGeometry();
			const positions = new Float32Array(particleCount * 3);
			const colors = new Float32Array(particleCount * 3);
			const sizes = new Float32Array(particleCount);
			const opacities = new Float32Array(particleCount); // Add opacity attribute
			
			// Get bolt position - critical to use the correct coordinate space
			const pos = bolt.position.clone();
			
			// Initialize all positions to the jet origin
			for (let i = 0; i < particleCount; i++) {
				positions[i * 3] = pos.x;
				positions[i * 3 + 1] = pos.y;
				positions[i * 3 + 2] = pos.z;
				
				// Brighter and more varied colors - enhanced blue to cyan
				colors[i * 3] = 0.2 + Math.random() * 0.4;     // R - slightly more red variation
				colors[i * 3 + 1] = 0.6 + Math.random() * 0.4; // G - increased green for brightness
				colors[i * 3 + 2] = 0.8 + Math.random() * 0.2; // B - bright blue
				
				// Larger sizes for more visibility
				sizes[i] = 0.1 + Math.random() * 0.12; // Increased size for better visibility
				
				// Initialize opacity to 0
				opacities[i] = 0;
			}
			
			// Set attributes
			jetGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
			jetGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
			jetGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
			jetGeometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));
			
			// Create shader material for better star rendering
			const jetMaterial = new THREE.ShaderMaterial({
				uniforms: {
					pointTexture: { value: starTexture || this.createStarTexture() }
				},
				vertexShader: `
					attribute float size;
					attribute float opacity;
					varying float vOpacity;
					varying vec3 vColor;
					
					void main() {
						vColor = color;
						vOpacity = opacity;
						vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
						gl_PointSize = size * (500.0 / -mvPosition.z); // Increased from 400 to 500 for larger particles
						gl_Position = projectionMatrix * mvPosition;
					}
				`,
				fragmentShader: `
					uniform sampler2D pointTexture;
					varying float vOpacity;
					varying vec3 vColor;
					
					void main() {
						gl_FragColor = vec4(vColor, vOpacity) * texture2D(pointTexture, gl_PointCoord);
						if (gl_FragColor.a < 0.1) discard; // Discard nearly transparent fragments
					}
				`,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
				depthTest: false, // Disable depth testing to ensure particles are always visible
				transparent: true,
				vertexColors: true
			});
			
			// Create the jet particle system
			const jetSystem = new THREE.Points(jetGeometry, jetMaterial);
			jetSystem.renderOrder = 1000; // Very high render order to ensure visibility
			jetSystem.frustumCulled = false; // Prevent frustum culling which might hide particles
			
			// CRITICAL FIX: Position at origin - particles will be positioned in world space coordinates
			// Particle positions are already set correctly, the system itself should be at origin
			jetSystem.position.set(0, 0, 0);
			
			// Store jet data for animation - explicitly link to the bolt
			this.jets.push({
				system: jetSystem,
				geometry: jetGeometry,
				basePosition: pos.clone(), // Start at bolt position
				particles: Array(particleCount).fill().map(() => ({
					life: 0,
					maxLife: 0,
					velocity: new THREE.Vector3()
				})),
				cornerIndex: boltIndex, // Match exact bolt index
				bolt: bolt // Direct reference to bolt
			});
			
			// Add to jets group - this is a child of parentGroup
			this.jetsGroup.add(jetSystem);
			
			// Log positions for debugging
			// console.log(`Created jet ${boltIndex} at position ${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}`);
		});
		
		// Set jetsGroup at origin to ensure correct coordinate space
		this.jetsGroup.position.set(0, 0, 0);
	}
	
	/**
	 * Create a star-shaped texture for particles
	 */
	createStarTexture() {
		const canvas = document.createElement('canvas');
		canvas.width = 128; // Increased from 64 for higher resolution
		canvas.height = 128; // Increased from 64 for higher resolution
		const ctx = canvas.getContext('2d');
		
		// Clear canvas
		ctx.clearRect(0, 0, 128, 128);
		
		// Set center point
		const centerX = 64;
		const centerY = 64;
		
		// Draw sharp star (more points for finer detail)
		ctx.fillStyle = 'white';
		ctx.beginPath();
		
		// Draw a more pointed 8-point star - larger outer radius for more dramatic effect
		const outerRadius = 60; // Increased from 32 for larger texture
		const innerRadius = 12;  // Reduced from 8 for sharper points
		
		for (let i = 0; i < 16; i++) {
			const radius = i % 2 === 0 ? outerRadius : innerRadius;
			const angle = (i * Math.PI) / 8;
			const x = centerX + radius * Math.cos(angle);
			const y = centerY + radius * Math.sin(angle);
			
			if (i === 0) {
				ctx.moveTo(x, y);
			} else {
				ctx.lineTo(x, y);
			}
		}
		
		ctx.closePath();
		ctx.fill();
		
		// Draw stronger glow with multiple layers
		const gradientLayers = [
			{ stop1: 0, stop2: 0.4, alpha1: 0.9, alpha2: 0.6 },
			{ stop1: 0.4, stop2: 0.7, alpha1: 0.6, alpha2: 0.3 },
			{ stop1: 0.7, stop2: 1.0, alpha1: 0.3, alpha2: 0 }
		];
		
		// First clear with a solid white center
		ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';
		ctx.beginPath();
		ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
		ctx.fill();
		
		// Now add gradient layers for better glow effect
		gradientLayers.forEach(layer => {
			const gradient = ctx.createRadialGradient(
				centerX, centerY, outerRadius * layer.stop1,
				centerX, centerY, outerRadius * layer.stop2
			);
			gradient.addColorStop(0, `rgba(255, 255, 255, ${layer.alpha1})`);
			gradient.addColorStop(1, `rgba(255, 255, 255, ${layer.alpha2})`);
			
			ctx.globalCompositeOperation = 'lighter';
			ctx.fillStyle = gradient;
			ctx.fillRect(0, 0, 128, 128);
		});
		
		// Create texture from canvas
		const texture = new THREE.CanvasTexture(canvas);
		texture.needsUpdate = true;
		return texture;
	}
	
	/**
	 * Activate jets when movement is detected
	 * @param {THREE.Vector3} movement - Movement vector
	 * @param {boolean} skipTopJets - Whether to skip the top jets (for tall mode)
	 */
	activateJets(movement, skipTopJets = false) {
		// Ensure movement is a THREE.Vector3
		const moveDir = movement instanceof THREE.Vector3 
			? movement.clone().normalize() 
			: new THREE.Vector3(0, 0, -1);
		
		// Record the time of last movement
		this.lastMovementTime = performance.now();
		
		// Determine if this is part of an animated movement
		const isAnimated = this.isMoving;
		
		// Always emit some test particles to ensure visibility
		// console.log("Activating jets with direction:", moveDir);
		
		// Go through each jet
		this.jets.forEach((jet, index) => {
			// Skip top jets if requested (used during tall mode transition)
			if (skipTopJets && (index === 0 || index === 1)) {
				return;
			}
			
			const cornerVector = jet.basePosition.clone().normalize();
			
			// Determine jet activation based on direction
			// Jets opposite to movement direction should fire
			const activation = -cornerVector.dot(moveDir);
			
			// Lower threshold for activation and ensure some activation regardless of direction
			const effectiveActivation = Math.max(0.3, activation); // At least 0.3 activation (increased from 0.2)
			
			// Always emit at least some particles for testing
			const particleCount = Math.ceil(effectiveActivation * (isAnimated ? 40 : 25)); // Increased from 30/15
			
			// Create direction vector with inverted Y
			const correctedMoveDir = moveDir.clone().multiplyScalar(-1);
			correctedMoveDir.y = -correctedMoveDir.y;
			correctedMoveDir.z = -correctedMoveDir.z;
			
			// Emit particles from this jet
			// console.log(`Emitting ${particleCount} particles from jet ${index} with activation ${effectiveActivation.toFixed(2)}`);
			for (let i = 0; i < particleCount; i++) {
				this.emitJetParticle(jet, correctedMoveDir, effectiveActivation * (isAnimated ? 2.5 : 2.0)); // Increased intensity
			}
		});
		
		// Force all jet systems to be visible
		this.jets.forEach(jet => {
			if (jet.system) {
				jet.system.visible = true;
				jet.system.renderOrder = 1000;
			}
		});
	}
	
	/**
	 * Emit a new particle from a jet
	 */
	emitJetParticle(jet, moveDir, intensity) {
		// Find dead particle to reuse
		const particleIndex = jet.particles.findIndex(p => p.life <= 0);
		if (particleIndex === -1) return;
		
		const particle = jet.particles[particleIndex];
		
		// Set lifetime - make last longer for better fade and longer trails during animation
		particle.life = 2.5 + Math.random() * 1.5 + (intensity > 1.0 ? 1.5 : 0); // Increased from 2.0/1.0/1.0
		particle.maxLife = particle.life;
		
		// Set initial position (at jet base with small random offset)
		const positions = jet.geometry.attributes.position.array;
		positions[particleIndex * 3] = jet.basePosition.x + (Math.random() - 0.5) * 0.15; // Increased spread
		positions[particleIndex * 3 + 1] = jet.basePosition.y + (Math.random() - 0.5) * 0.15;
		positions[particleIndex * 3 + 2] = jet.basePosition.z; // Ensure Z position is exactly at bolt position for visibility
		
		// Set velocity - opposite to movement direction with randomness
		// Ensure moveDir is a Vector3
		const oppositeDir = moveDir instanceof THREE.Vector3 
			? moveDir.clone() 
			: new THREE.Vector3(0, 0, 1);
			
		// Create velocity - direction should already be corrected by the caller
		// Move particles more toward the camera (negative Z direction)
		particle.velocity.copy(oppositeDir)
			.multiplyScalar(0.1 + Math.random() * 0.15 * intensity) // Faster particles
			.add(new THREE.Vector3(
				(Math.random() - 0.5) * 0.03, // Increased spread (0.02 → 0.03)
				(Math.random() - 0.5) * 0.03,
				-0.05 - Math.random() * 0.05 * intensity // Added bias toward camera
			));
		
		// Update colors based on intensity - brighter for higher intensity
		const colors = jet.geometry.attributes.color.array;
		const intensityBoost = Math.min(1.0, intensity * 0.7);
		
		// More varied, intense colors
		colors[particleIndex * 3] = 0.3 + Math.random() * 0.4 + intensityBoost * 0.4;      // R - more red for higher intensity
		colors[particleIndex * 3 + 1] = 0.6 + Math.random() * 0.4 - intensityBoost * 0.2;  // G - reduced with higher intensity
		colors[particleIndex * 3 + 2] = 0.8 + Math.random() * 0.2 - intensityBoost * 0.3;  // B - less blue for higher intensity
		
		// Set size based on intensity - larger particles
		const sizes = jet.geometry.attributes.size.array;
		sizes[particleIndex] = (0.1 + Math.random() * 0.12) * (1.0 + intensityBoost * 1.5); // Increased size multiplier
		
		// Set opacity to full
		const opacities = jet.geometry.attributes.opacity.array;
		opacities[particleIndex] = 1.0;
		
		// Force system to be visible when emitting particles
		if (jet.system) {
			jet.system.visible = true;
			jet.system.renderOrder = 1000;
		}
		
		// Mark attributes as needing update
		jet.geometry.attributes.position.needsUpdate = true;
		jet.geometry.attributes.color.needsUpdate = true;
		jet.geometry.attributes.size.needsUpdate = true;
		jet.geometry.attributes.opacity.needsUpdate = true;
	}
	
	/**
	 * Update jet particles positions and lifetimes
	 */
	updateJetParticles(jet, deltaTime) {
		const positions = jet.geometry.attributes.position.array;
		const colors = jet.geometry.attributes.color.array;
		const sizes = jet.geometry.attributes.size.array;
		const opacities = jet.geometry.attributes.opacity.array;
		const now = performance.now();
		
		// Calculate time since last movement - used for fading after movement stops
		const timeSinceMovement = (now - this.lastMovementTime) / 1000; // in seconds
		const fadeMultiplier = timeSinceMovement > 0.5 ? this.jetFadeSpeed * (1 + timeSinceMovement * 1.5) : 1;
		
		// Update each particle
		jet.particles.forEach((particle, index) => {
			if (particle.life <= 0) return;
			
			// Reduce lifetime - fade more gradually
			particle.life -= deltaTime * fadeMultiplier;
			
			// If still alive, update position
			if (particle.life > 0) {
				// Get current position
				const i3 = index * 3;
				const x = positions[i3];
				const y = positions[i3 + 1];
				const z = positions[i3 + 2];
				
				// Update position based on velocity
				positions[i3] = x + particle.velocity.x;
				positions[i3 + 1] = y + particle.velocity.y;
				positions[i3 + 2] = z + particle.velocity.z;
				
				// Slow down velocity over time for more natural movement - slower decay
				particle.velocity.multiplyScalar(0.99); // Changed from 0.98 for more sustained movement
				
				// Fade out color and size based on remaining life - more gradual fade
				const lifeRatio = particle.life / particle.maxLife;
				// Use linear fade for longer visibility
				opacities[index] = Math.max(0.2, lifeRatio * lifeRatio * 1.2); // Maintain some opacity longer
				sizes[index] = (0.1 + Math.random() * 0.12) * (0.7 + lifeRatio * 0.6); // Larger base size and slower shrink
			} else {
				// Make completely invisible when dead
				opacities[index] = 0;
			}
		});
		
		// Mark attributes as needing update
		jet.geometry.attributes.position.needsUpdate = true;
		jet.geometry.attributes.color.needsUpdate = true;
		jet.geometry.attributes.size.needsUpdate = true;
		jet.geometry.attributes.opacity.needsUpdate = true;
	}
	
	/**
	 * Update all jet particles
	 * @param {number} deltaTime - Time since last frame in seconds
	 */
	update(deltaTime) {
		// Force more consistent fading by always updating jets
		this.jets.forEach(jet => {
			this.updateJetParticles(jet, deltaTime || 1/60);
		});
		
		// Check if we should emit test particles 
		if (this._needsTestEmission && this.jets && this.jets.length > 0) {
			this._needsTestEmission = false;
			// console.log("Emitting test particles to verify jet system");
			
			// Emit test particles from each jet
			this.jets.forEach(jet => {
				// Create random direction with strong backwards Z component
				const testDirection = new THREE.Vector3(
					(Math.random() - 0.5) * 0.5,
					(Math.random() - 0.5) * 0.5,
					-1.0
				).normalize();
				
				// Emit a burst of particles
				for (let i = 0; i < 30; i++) {
					this.emitJetParticle(jet, testDirection, 1.5);
				}
			});
			
			// Update last movement time to prevent immediate fade
			this.lastMovementTime = performance.now();
		}
	}
	
	/**
	 * Sync jets with their corresponding bolts and detect movement
	 * This ensures jets always follow bolts and fire when bolts move
	 * @param {boolean} forceUpdate - Force an update without checking for movement
	 */
	syncJetsWithBolts(forceUpdate = false) {
		// Skip if we don't have jets or bolts
		if (!this.jets || !this.jets.length || !this.cornerBolts || !this.cornerBolts.length) {
			return;
		}
		
		// Make sure the jets group is visible
		if (this.jetsGroup) {
			this.jetsGroup.visible = true;
			this.jetsGroup.traverse(obj => {
				if (obj instanceof THREE.Points) {
					obj.visible = true;
				}
			});
		}
		
		// Ensure we have the same number of jets as bolts for proper synchronization
		const minLength = Math.min(this.jets.length, this.cornerBolts.length);
		
		// For each jet, find its bolt and update position
		for (let i = 0; i < minLength; i++) {
			const jet = this.jets[i];
			const bolt = this.cornerBolts[i]; // Direct indexing since they should match
			
			if (bolt) {
				// Skip if bolt isn't visible
				if (!bolt.visible) {
					// console.log(`Bolt ${i} not visible, skipping jet sync`);
					continue;
				}
				
				// Store previous position to detect movement
				const previousPosition = jet.basePosition.clone();
				
				// Get bolt position in world space - CRITICAL FIX: Use local position
				// The system is already in the parentGroup, so we need local coordinates
				const boltLocalPos = bolt.position.clone();
				
				// Ensure the jet's base position is set correctly
				jet.basePosition.copy(boltLocalPos);
				
				// CRITICAL FIX: Reset the system's position to origin
				// The particles are already in the correct parent group
				if (jet.system) {
					jet.system.position.set(0, 0, 0);
				}
				
				// Only check for movement if not forcing an update
				if (!forceUpdate) {
					// Calculate movement and activate jets if significant
					const movement = new THREE.Vector3().subVectors(jet.basePosition, previousPosition);
					const movementMagnitude = movement.length();
					
					// If movement is significant, emit particles
					if (movementMagnitude > 0.01) {
						// console.log(`Bolt ${i} moved by ${movementMagnitude.toFixed(4)}, activating jet`);
						const direction = movement.clone().normalize().multiplyScalar(-1);
						// Invert Y component to fix direction
						direction.y = -direction.y;
						// Intensity based on movement magnitude
						const intensity = Math.min(1.5, movementMagnitude * 10);
						
						// Emit more particles for larger movements
						const particleCount = Math.ceil(intensity * 5);
						for (let j = 0; j < particleCount; j++) {
							this.emitJetParticle(jet, direction, intensity);
						}
						
						// Update last movement time
						this.lastMovementTime = performance.now();
					}
				} else if (forceUpdate) {
					// On force update, ensure particles stay attached to bolts
					// console.log(`Syncing jet ${i} with bolt position: ${boltLocalPos.x.toFixed(2)}, ${boltLocalPos.y.toFixed(2)}, ${boltLocalPos.z.toFixed(2)}`);
					
					// Force update the jet particles with the new position
					const positions = jet.geometry.attributes.position.array;
					for (let p = 0; p < jet.particles.length; p++) {
						const particle = jet.particles[p];
						
						// Only update particles that haven't been emitted yet (life <= 0)
						if (particle.life <= 0) {
							positions[p * 3] = boltLocalPos.x;
							positions[p * 3 + 1] = boltLocalPos.y;
							positions[p * 3 + 2] = boltLocalPos.z;
						}
					}
					
					// Mark positions as needing update
					jet.geometry.attributes.position.needsUpdate = true;
					
					// When forcing update, set a flag to emit test particles on next update
					this._needsTestEmission = Math.random() < 0.3; // 30% chance to emit test particles
				}
			} else {
				console.warn(`No matching bolt found for jet ${i}`);
			}
		}
	}
	
	/**
	 * Clean up resources
	 */
	dispose() {
		this.jets.forEach(jet => {
			if (jet.geometry) jet.geometry.dispose();
			if (jet.system && jet.system.material) {
				if (jet.system.material.uniforms && jet.system.material.uniforms.pointTexture) {
					jet.system.material.uniforms.pointTexture.value.dispose();
				}
				jet.system.material.dispose();
			}
		});
		
		if (this.jetsGroup && this.parentGroup) {
			this.parentGroup.remove(this.jetsGroup);
		}
		
		this.jets = [];
		this.cornerBolts = null;
	}
	
	/**
	 * Force test particles to be emitted from all jets
	 * Used for debugging visibility issues
	 */
	forceTestParticles() {
		if (!this.jets || this.jets.length === 0) return;
		
		console.log("Forcing test particles from all jets");
		
		this.jets.forEach((jet, index) => {
			// Create test direction - strongly toward camera (negative Z)
			const testDirection = new THREE.Vector3(
				(Math.random() - 0.5) * 0.2,
				(Math.random() - 0.5) * 0.2,
				-1.0
			).normalize();
			
			// Emit many particles for high visibility
			for (let i = 0; i < 40; i++) {
				this.emitJetParticle(jet, testDirection, 2.0);
			}
			
			// Ensure system is visible
			if (jet.system) {
				jet.system.visible = true;
				jet.system.renderOrder = 1000;
				
				// Debug info
				// console.log(`Jet ${index} system: visible=${jet.system.visible}, renderOrder=${jet.system.renderOrder}`);
				// console.log(`Base position: x=${jet.basePosition.x.toFixed(2)}, y=${jet.basePosition.y.toFixed(2)}, z=${jet.basePosition.z.toFixed(2)}`);
			}
		});
		
		// Update last movement time to prevent immediate fade
		this.lastMovementTime = performance.now();
	}
} 