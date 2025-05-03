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
		
		// Add jets group to parent
		this.parentGroup.add(this.jetsGroup);
		
		// Create jet effects
		this.createCornerJets();
		
		// Initialize jet positions
		this.syncJetsWithBolts(true);
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
			const particleCount = 500; // Increased from 300 for significantly more visible effect
			const jetGeometry = new THREE.BufferGeometry();
			const positions = new Float32Array(particleCount * 3);
			const colors = new Float32Array(particleCount * 3);
			const sizes = new Float32Array(particleCount);
			const opacities = new Float32Array(particleCount); // Add opacity attribute
			
			// Get bolt position
			const pos = bolt.position.clone();
			
			// Initialize all positions to the jet origin
			for (let i = 0; i < particleCount; i++) {
				positions[i * 3] = pos.x;
				positions[i * 3 + 1] = pos.y;
				positions[i * 3 + 2] = pos.z;
				
				// Even brighter colors with strong blue component for visibility
				colors[i * 3] = 0.3 + Math.random() * 0.5;     // R - more red variation
				colors[i * 3 + 1] = 0.8 + Math.random() * 0.2; // G - maximized green for brightness
				colors[i * 3 + 2] = 1.0;                       // B - full blue intensity
				
				// Much larger sizes for dramatically better visibility
				sizes[i] = 0.25 + Math.random() * 0.25; // Doubled size for immediately obvious jets
				
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
					attribute vec3 color;
					varying float vOpacity;
					varying vec3 vColor;
					
					void main() {
						vColor = color;
						vOpacity = opacity;
						vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
						gl_PointSize = size * (800.0 / -mvPosition.z); // Increased from 500 to 800 for dramatically larger particles
						gl_Position = projectionMatrix * mvPosition;
					}
				`,
				fragmentShader: `
					uniform sampler2D pointTexture;
					varying float vOpacity;
					varying vec3 vColor;
					
					void main() {
						gl_FragColor = vec4(vColor, vOpacity) * texture2D(pointTexture, gl_PointCoord);
					}
				`,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
				depthTest: false, // Critical: Disable depth testing to ensure particles are always visible
				transparent: true,
				vertexColors: true
			});
			
			// Create the jet particle system
			const jetSystem = new THREE.Points(jetGeometry, jetMaterial);
			jetSystem.renderOrder = 2000; // Extremely high render order to ensure total visibility
			
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
			
			// Add to jets group
			this.jetsGroup.add(jetSystem);
			
			// Force some initial particles for visibility
			for (let i = 0; i < 20; i++) {
				const randomDir = new THREE.Vector3(
					(Math.random() - 0.5) * 0.1,
					(Math.random() - 0.5) * 0.1,
					(Math.random() - 0.5) * 0.1 - 0.9
				);
				this.emitJetParticle(this.jets[this.jets.length - 1], randomDir, 0.8);
			}
		});
	}
	
	/**
	 * Create a star-shaped texture for particles
	 * @returns {THREE.Texture} Star texture
	 */
	createStarTexture() {
		// Create canvas for star texture - larger for better quality
		const canvas = document.createElement('canvas');
		canvas.width = 128; // Increased from 64 for higher quality
		canvas.height = 128; // Increased from 64 for higher quality
		const context = canvas.getContext('2d');
		
		// Clear canvas
		context.fillStyle = 'rgba(0,0,0,0)';
		context.fillRect(0, 0, canvas.width, canvas.height);
		
		// Draw a bright center circle
		const centerX = canvas.width / 2;
		const centerY = canvas.height / 2;
		
		// Create an extremely bright glow that fades out
		const outerRadius = canvas.width / 2;
		const gradientOuter = context.createRadialGradient(
			centerX, centerY, 0,
			centerX, centerY, outerRadius
		);
		
		// Create an extremely bright gradient for maximum visibility
		gradientOuter.addColorStop(0, 'rgba(255, 255, 255, 1.0)'); // Pure white center
		gradientOuter.addColorStop(0.1, 'rgba(255, 255, 255, 0.95)'); // Almost entirely opaque
		gradientOuter.addColorStop(0.2, 'rgba(200, 220, 255, 0.9)'); // Bright blue-white with high opacity
		gradientOuter.addColorStop(0.5, 'rgba(150, 170, 255, 0.7)'); // Very visible blue in mid-range
		gradientOuter.addColorStop(0.7, 'rgba(100, 120, 255, 0.4)'); // Extended visibility in outer area
		gradientOuter.addColorStop(1, 'rgba(50, 50, 200, 0.0)'); // Transparent edge with blue tint
		
		context.fillStyle = gradientOuter;
		context.fillRect(0, 0, canvas.width, canvas.height);
		
		// Add a star shape for more visual interest
		context.save();
		context.translate(centerX, centerY);
		
		// Draw a bright star shape
		context.beginPath();
		const spikes = 6;
		const outerRadius2 = canvas.width / 3;
		const innerRadius = canvas.width / 6;
		
		for (let i = 0; i < spikes * 2; i++) {
			const radius = i % 2 === 0 ? outerRadius2 : innerRadius;
			const angle = (Math.PI * 2 * i) / (spikes * 2);
			const x = radius * Math.cos(angle);
			const y = radius * Math.sin(angle);
			
			if (i === 0) {
				context.moveTo(x, y);
			} else {
				context.lineTo(x, y);
			}
		}
		
		context.closePath();
		
		// Create a bright gradient for the star
		const starGradient = context.createRadialGradient(
			0, 0, innerRadius,
			0, 0, outerRadius2
		);
		
		starGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
		starGradient.addColorStop(0.5, 'rgba(200, 220, 255, 0.7)');
		starGradient.addColorStop(1, 'rgba(100, 150, 255, 0.0)');
		
		context.fillStyle = starGradient;
		context.fill();
		
		context.restore();
		
		// Create the texture
		const texture = new THREE.CanvasTexture(canvas);
		
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
			const effectiveActivation = Math.max(0.2, activation); // At least 0.2 activation
			
			if (effectiveActivation > 0.05) { // Reduced threshold to activate more often
				// Emit new particles - more during animation
				const particleCount = Math.ceil(effectiveActivation * (isAnimated ? 30 : 15)); // Increased from 20/10
				// Create direction vector with inverted Y
				const correctedMoveDir = moveDir.clone().multiplyScalar(-1);
				correctedMoveDir.y = -correctedMoveDir.y;
				for (let i = 0; i < particleCount; i++) {
					this.emitJetParticle(jet, correctedMoveDir, effectiveActivation * (isAnimated ? 2.0 : 1.5)); // Increased intensity
				}
			}
		});
	}
	
	/**
	 * Emit a new particle from a jet
	 */
	emitJetParticle(jet, moveDir, intensity) {
		// Find dead particle to reuse
		const particleIndex = jet.particles.findIndex(p => p.life <= 0);
		if (particleIndex === -1) {
			console.log("No dead particles found, creating new ones");
			return;
		}
		
		const particle = jet.particles[particleIndex];
		
		// Set lifetime - make last longer for better fade and longer trails during animation
		particle.life = 4.0 + Math.random() * 3.0 + (intensity > 1.0 ? 3.0 : 0); // Increased lifetime significantly
		particle.maxLife = particle.life;
		
		// Set initial position (at jet base with small random offset)
		const positions = jet.geometry.attributes.position.array;
		positions[particleIndex * 3] = jet.basePosition.x + (Math.random() - 0.5) * 0.25; // Increased spread for better visibility
		positions[particleIndex * 3 + 1] = jet.basePosition.y + (Math.random() - 0.5) * 0.25;
		positions[particleIndex * 3 + 2] = jet.basePosition.z + (Math.random() - 0.5) * 0.25;
		
		// Set velocity - opposite to movement direction with randomness
		// Ensure moveDir is a Vector3
		const oppositeDir = moveDir instanceof THREE.Vector3 
			? moveDir.clone() 
			: new THREE.Vector3(0, 0, -1);
			
		// Create velocity - direction should already be corrected by the caller
		particle.velocity.copy(oppositeDir)
			.multiplyScalar(0.2 + Math.random() * 0.3 * intensity) // Much faster particles for better visibility
			.add(new THREE.Vector3(
				(Math.random() - 0.5) * 0.08, // More controlled spread
				(Math.random() - 0.5) * 0.08,
				(Math.random() - 0.5) * 0.08
			));
		
		// Update colors based on intensity - brighter for higher intensity
		const colors = jet.geometry.attributes.color.array;
		const intensityBoost = Math.min(1.0, intensity * 0.8); // More intense color boost
		
		// More varied, intense colors that stand out more
		colors[particleIndex * 3] = 0.6 + Math.random() * 0.4 + intensityBoost * 0.5; // Much more red for brightness
		colors[particleIndex * 3 + 1] = 0.8 + Math.random() * 0.2; // Brighter green component
		colors[particleIndex * 3 + 2] = 1.0; // Maximum blue for brightness
		
		// Set initial size - randomly adjust to avoid uniformity - MUCH larger particles
		const sizes = jet.geometry.attributes.size.array;
		sizes[particleIndex] = (0.25 + Math.random() * 0.25) * (1.0 + intensity * 0.8); // Doubled size for visibility
		
		// Set initial opacity
		const opacities = jet.geometry.attributes.opacity.array;
		opacities[particleIndex] = 1.0; // Start fully visible
		
		// console.log("Emitting jet particle", particleIndex, jet.geometry.attributes.position.array);
		// Update geometry attribute flags
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
			const baseIndex = index * 3;
			
			// If particle is dead make it fully transparent and skip further processing
			if (particle.life <= 0) {
				opacities[index] = 0;
				return;
			}
			
			// Reduce lifetime - fade more gradually
			particle.life -= deltaTime * fadeMultiplier;
			
			// Update position based on velocity
			const x = positions[baseIndex];
			const y = positions[baseIndex + 1];
			const z = positions[baseIndex + 2];
			positions[baseIndex] = x + particle.velocity.x;
			positions[baseIndex + 1] = y + particle.velocity.y;
			positions[baseIndex + 2] = z + particle.velocity.z;
			
			// Slow down velocity over time for more natural movement - slower decay
			particle.velocity.multiplyScalar(0.99); // Slight drag
			
			// Fade out opacity and size based on remaining life
			const lifeRatio = particle.life / particle.maxLife;
			opacities[index] = Math.max(0.2, lifeRatio * lifeRatio * 1.2);
			sizes[index] = (0.12 + Math.random() * 0.16) * (0.7 + lifeRatio * 0.6);
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
	}
	
	/**
	 * Sync jets with their corresponding bolts and detect movement
	 * This ensures jets always follow bolts and fire when bolts move
	 * @param {boolean} forceUpdate - Force an update without checking for movement
	 */
	syncJetsWithBolts(forceUpdate = false) {
		// Skip if we don't have jets or bolts
		if (!this.jets || !this.jets.length || !this.cornerBolts || !this.cornerBolts.length) {
			console.log("No jets or bolts found, skipping sync");
			return;
		}
		console.log("Syncing jets with bolts", this.jets.length, this.cornerBolts.length);
		
		// For each jet, find its bolt and update position
		for (let i = 0; i < this.jets.length; i++) {
			const jet = this.jets[i];
			const bolt = this.cornerBolts[i]; // Direct indexing since they should match
			
			if (bolt && (i < this.cornerBolts.length)) {
				// Store previous position to detect movement
				const previousPosition = jet.basePosition.clone();
				
				// Update jet position to match bolt
				jet.basePosition.copy(bolt.position);
				
				// Only check for movement if not forcing an update
				if (!forceUpdate) {
					// Calculate movement and activate jets if significant
					const movement = new THREE.Vector3().subVectors(jet.basePosition, previousPosition);
					const movementMagnitude = movement.length();
					
					// Use a much lower threshold to detect even slight movements - was 0.01
					if (movementMagnitude > 0.001) {
						console.log(`Bolt ${i} moved by ${movementMagnitude.toFixed(4)}, activating jet`);
						const direction = movement.clone().normalize().multiplyScalar(-1);
						// Invert Y component to fix direction
						direction.y = -direction.y;
						// Intensity based on movement magnitude - minimum 0.5 to ensure visibility
						const intensity = Math.max(0.5, Math.min(2.0, movementMagnitude * 20));
						
						// Emit more particles for better visibility - always at least 10
						const particleCount = Math.max(10, Math.ceil(intensity * 15));
						for (let j = 0; j < particleCount; j++) {
							this.emitJetParticle(jet, direction, intensity);
						}
						
						// Update last movement time
						this.lastMovementTime = performance.now();
					}
				} else if (forceUpdate) {
					// On force update, ensure the position is correct AND emit a few particles
					console.log(`Initializing jet ${i} position to match bolt: ${bolt.position.x.toFixed(2)}, ${bolt.position.y.toFixed(2)}, ${bolt.position.z.toFixed(2)}`);
					
					// Always emit some particles on force update for better visibility
					const randomDir = new THREE.Vector3(
						(Math.random() - 0.5) * 0.1,
						(Math.random() - 0.5) * 0.1,
						-0.9 - Math.random() * 0.1
					);
					
					// Emit multiple particles
					for (let j = 0; j < 15; j++) {
						this.emitJetParticle(jet, randomDir, 0.8);
					}
					
					// Update last movement time
					this.lastMovementTime = performance.now();
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
} 