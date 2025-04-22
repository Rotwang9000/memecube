import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

/**
 * 3D LED Scoreboard for displaying token data in the sky
 * Always stays in a fixed screen position
 */
export class TokenScoreboard {
	constructor(scene, camera) {
		this.scene = scene;
		this.camera = camera;
		this.displayData = [];
		this.isVisible = true;
		this.sizeMode = 'normal'; // Three modes: 'normal', 'tall', 'hidden'
		this.updateInterval = 30000; // Update every 30 seconds
		this.lastUpdateTime = 0;
		this.isMoving = false;
		this.movementStartTime = 0;
		this.movementDuration = 1000; // Duration of flight animation in ms
		this.movementStartQuaternion = new THREE.Quaternion();
		this.targetQuaternion = new THREE.Quaternion();
		
		this.updateScreenPositionTimeout = null;
		
		// Get initial screen width for proper positioning
		const initialWidth = window.innerWidth || 1200;
		
		// Determine initial horizontal position based on screen width
		let initialXPosition = -0.6; // Default for wider screens
		
		if (initialWidth < 600) {
			// Center on very narrow screens (mobile)
			initialXPosition = 0;
		} else if (initialWidth < 750) {
			// Center on narrow screens (small tablets)
			initialXPosition = 0;
		} else if (initialWidth < 900) {
			// Less extreme left position for medium screens
			initialXPosition = -0.3;
		}
		
		// Default screen position (will adjust further based on screen width during _updateScreenPosition)
		this.screenPosition = { 
			x: initialXPosition, 
			y: -0.7 
		};
		
		console.log(`Initial screen width: ${initialWidth}px, setting x position to: ${initialXPosition}`);
		
		// Scoreboard dimensions (smaller size to fit better)
		this.width = 15;
		this.height = 8; // Default height when normal
		this.expandedHeight = 20; // Placeholder, will be computed dynamically
		this.dotSize = 0.15;  // Size of each LED dot
		this.dotSpacing = 0.2; // Spacing between dots
		this.dotRows = 38;    // Number of dot rows
		this.dotCols = 100;    // Number of dot columns
		
		// Token display settings
		this.maxTokensToShow = 30;
		this.scrollSpeed = 0.5;  // How fast the display scrolls
		this.scrollPosition = 0;
		
		// Jet parameters
		this.jets = [];
		this.lastPosition = new THREE.Vector3();
		this.movementThreshold = 0.05;
		this.jetFadeSpeed = 1.5; // Control how quickly jets fade
		this.lastMovementTime = 0;
		
		// LED colors
		this.colors = {
			red: new THREE.Color(0xff0000),
			green: new THREE.Color(0x00ff00),
			blue: new THREE.Color(0x0000ff),
			yellow: new THREE.Color(0xffff00),
			cyan: new THREE.Color(0x00ffff),
			magenta: new THREE.Color(0xff00ff),
			white: new THREE.Color(0xffffff),
			off: new THREE.Color(0x202020)
		};
		
		// Create the scoreboard mesh
		this.scoreboardGroup = new THREE.Group();
		this.jetsGroup = new THREE.Group();
		this.scoreboardGroup.add(this.jetsGroup);
		
		this.createScoreboardStructure();
		this.createLEDDisplay();
		
		// Create buttons for expand/collapse
		this.createButtons();
		
		// Create corner jets
		this.createCornerJets();
		
		// Add to scene
		this.scene.add(this.scoreboardGroup);
		
		console.log("Token scoreboard created");
		// Update position initially
		this._updateScreenPosition();
		this.lastPosition.copy(this.scoreboardGroup.position);
		
		// Add event listener for window resize
		window.addEventListener('resize', () => this.handleResize());
	}
	
	/**
	 * Handle window resize to reposition the scoreboard
	 */
	handleResize() {
		const actualPixelWidth = window.innerWidth || 1200;
		console.log(`Window resized, new width: ${actualPixelWidth}px - updating scoreboard position`);
		
		// Clear any existing timeout to prevent multiple quick updates
		if (this.updateScreenPositionTimeout) {
			clearTimeout(this.updateScreenPositionTimeout);
		}
		
		// Add a short delay to handle multiple resize events efficiently
		this.updateScreenPositionTimeout = setTimeout(() => {
			// Recalculate expanded height based on new viewport dimensions
			if (this.sizeMode === 'tall') {
				this.expandedHeight = this.computeExpandedHeight();
				this.targetHeight = this.expandedHeight;
				this.height = this.expandedHeight;
				
				// Update dimensions to account for new screen size
				this.updateScoreboardDimensions();
				this.updateLEDDisplaySize();
			}
			
			// Update position to center horizontally if needed
			this._updateScreenPosition();
			
			// Clear the timeout reference
			this.updateScreenPositionTimeout = null;
		}, 100); // Short delay to batch resize events
	}
	
	/**
	 * Update the scoreboard position to match the screen position
	 * Public method that delegates to private _updateScreenPosition
	 */
	updateScreenPosition() {
		// Skip updates during mode animations to prevent confusion
		if (this.isAnimatingMode) {
			console.log("Skipping screen position update during animation");
			return;
		}
		
		this._updateScreenPosition();
	}
	
	/**
	 * Create the physical structure of the scoreboard
	 */
	createScoreboardStructure() {
		// Create frame
		const frameGeometry = new THREE.BoxGeometry(
			this.width + 0.5, 
			this.height + 0.5, 
			0.3
		);
		const frameMaterial = new THREE.MeshStandardMaterial({
			color: 0x444444,
			metalness: 0.8,
			roughness: 0.2,
			opacity: 0.1, // 90% transparency

		});
		
		const frame = new THREE.Mesh(frameGeometry, frameMaterial);
		frame.position.z = -0.2;
		//this.scoreboardGroup.add(frame);
		
		// Create display background (completely black with high transparency)
		const displayGeometry = new THREE.BoxGeometry(this.width, this.height * 1.1, 0.1);
		const displayMaterial = new THREE.MeshBasicMaterial({
			color: 0x000000,
			transparent: true,
		});
		
		const display = new THREE.Mesh(displayGeometry, displayMaterial);
		display.position.z = -0.05;
		//this.scoreboardGroup.add(display);
		
		// Add a back panel to prevent seeing through the scoreboard
		const backPanelGeometry = new THREE.PlaneGeometry(this.width + 0.5, this.height + 0.5);
		const backPanelMaterial = new THREE.MeshBasicMaterial({
			color: 0x000000,
			side: THREE.BackSide,
			transparent: false,
			opacity: 0.1
		});
		
		const backPanel = new THREE.Mesh(backPanelGeometry, backPanelMaterial);
		backPanel.position.z = -0.25;
		//this.scoreboardGroup.add(backPanel);
		
		// Add some decorative elements
		this.addDecorativeElements();
	}
	
	/**
	 * Add decorative elements to make the scoreboard more interesting
	 */
	addDecorativeElements() {
		// Add corner bolts
		const boltGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.4, 6);
		const boltMaterial = new THREE.MeshStandardMaterial({
			color: 0x888888,
			metalness: 0.9,
			roughness: 0.1,
		});
		
		const cornerPositions = [
			[-this.width/2 - 0.1, this.height/2 + 0.1, 0],
			[this.width/2 + 2.1, this.height/2 + 0.1, 0],
			[-this.width/2 - 0.1, -this.height/2 - 0.1, 0],
			[this.width/2 + 2.1, -this.height/2 - 0.1, 0]
		];
		
		// Store bolts in an array for later animation
		this.cornerBolts = [];
		
		cornerPositions.forEach((pos, index) => {
			const bolt = new THREE.Mesh(boltGeometry, boltMaterial);
			bolt.position.set(pos[0], pos[1], 0);
			bolt.rotation.x = Math.PI / 2;
			bolt.userData = { 
				isCornerBolt: true,
				originalPosition: new THREE.Vector3(pos[0], pos[1], 0),
				cornerIndex: index
			};
			this.cornerBolts.push(bolt);
			this.scoreboardGroup.add(bolt);
		});
	}
	
	/**
	 * Create corner jets - these are the particle emitters attached to each bolt
	 */
	createCornerJets() {
		// Create shared star texture
		const starTexture = this.createStarTexture();
		
		// Create each jet for each bolt
		this.cornerBolts.forEach((bolt, boltIndex) => {
			// Create geometry for jet particles
			const particleCount = 100; // More particles for better effect
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
				
				// Random blue to cyan color
				colors[i * 3] = 0.2 + Math.random() * 0.3;     // R
				colors[i * 3 + 1] = 0.5 + Math.random() * 0.5; // G
				colors[i * 3 + 2] = 0.8 + Math.random() * 0.2; // B
				
				// Random sizes - smaller for finer look
				sizes[i] = 0.03 + Math.random() * 0.05;
				
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
						gl_PointSize = size * (300.0 / -mvPosition.z);
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
				transparent: true,
				vertexColors: true
			});
			
			// Create the jet particle system
			const jetSystem = new THREE.Points(jetGeometry, jetMaterial);
			
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
		});
	}
	
	/**
	 * Create a star-shaped texture for particles
	 */
	createStarTexture() {
		const canvas = document.createElement('canvas');
		canvas.width = 64;
		canvas.height = 64;
		const ctx = canvas.getContext('2d');
		
		// Clear canvas
		ctx.clearRect(0, 0, 64, 64);
		
		// Draw sharp star (more points for finer detail)
		ctx.fillStyle = 'white';
		ctx.beginPath();
		
		// Draw a more pointed 8-point star
		const outerRadius = 30;
		const innerRadius = 10;
		const centerX = 32;
		const centerY = 32;
		
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
		
		// Draw glow
		const gradient = ctx.createRadialGradient(centerX, centerY, innerRadius, centerX, centerY, outerRadius + 10);
		gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
		gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.4)');
		gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.2)');
		gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
		
		ctx.globalCompositeOperation = 'screen';
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, 64, 64);
		
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
		
		// Go through each jet
		this.jets.forEach((jet, index) => {
			// Skip top jets if requested (used during tall mode transition)
			if (skipTopJets && this.sizeMode === 'tall' && (index === 0 || index === 1)) {
				return;
			}
			
			const cornerVector = jet.basePosition.clone().normalize();
			
			// Determine jet activation based on direction
			// Jets opposite to movement direction should fire
			const activation = -cornerVector.dot(moveDir);
			
			if (activation > 0.1) {
				// Emit new particles - more during animation
				const particleCount = Math.ceil(activation * (isAnimated ? 20 : 10));
				for (let i = 0; i < particleCount; i++) {
					this.emitJetParticle(jet, moveDir.clone().multiplyScalar(-1), activation * (isAnimated ? 1.5 : 1.0));
				}
			}
			
			// Update existing particles
			this.updateJetParticles(jet, 1/60);
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
		particle.life = 2.0 + Math.random() * 1.0 + (intensity > 1.0 ? 1.0 : 0);
		particle.maxLife = particle.life;
		
		// Set initial position (at jet base with small random offset)
		const positions = jet.geometry.attributes.position.array;
		positions[particleIndex * 3] = jet.basePosition.x + (Math.random() - 0.5) * 0.1;
		positions[particleIndex * 3 + 1] = jet.basePosition.y + (Math.random() - 0.5) * 0.1;
		positions[particleIndex * 3 + 2] = jet.basePosition.z + (Math.random() - 0.5) * 0.1;
		
		// Set velocity - opposite to movement direction with randomness
		// Ensure moveDir is a Vector3
		const oppositeDir = moveDir instanceof THREE.Vector3 
			? moveDir.clone() 
			: new THREE.Vector3(0, 0, -1);
			
		particle.velocity.copy(oppositeDir)
			.multiplyScalar(0.05 + Math.random() * 0.08 * intensity)
			.add(new THREE.Vector3(
				(Math.random() - 0.5) * 0.02,
				(Math.random() - 0.5) * 0.02,
				(Math.random() - 0.5) * 0.02
			));
		
		// Update colors based on intensity - brighter for higher intensity
		const colors = jet.geometry.attributes.color.array;
		const intensityBoost = Math.min(1.0, intensity * 0.7);
		colors[particleIndex * 3] = 0.2 + Math.random() * 0.3 + intensityBoost * 0.3;     // R - more red for higher intensity
		colors[particleIndex * 3 + 1] = 0.5 + Math.random() * 0.5;                        // G
		colors[particleIndex * 3 + 2] = 0.8 + Math.random() * 0.2 - intensityBoost * 0.2; // B - less blue for higher intensity
		
		// Set size based on intensity
		const sizes = jet.geometry.attributes.size.array;
		sizes[particleIndex] = (0.03 + Math.random() * 0.05) * (1.0 + intensityBoost);
		
		// Set opacity to full
		const opacities = jet.geometry.attributes.opacity.array;
		opacities[particleIndex] = 1.0;
		
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
		const fadeMultiplier = timeSinceMovement > 0.3 ? this.jetFadeSpeed * (1 + timeSinceMovement * 2) : 1;
		
		// Update each particle
		jet.particles.forEach((particle, index) => {
			if (particle.life <= 0) return;
			
			// Reduce lifetime - fade more quickly if no movement
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
				
				// Slow down velocity over time for more natural movement
				particle.velocity.multiplyScalar(0.98);
				
				// Fade out color and size based on remaining life
				const lifeRatio = particle.life / particle.maxLife;
				opacities[index] = lifeRatio * lifeRatio; // Quadratic fade for more natural appearance
				sizes[index] = (0.03 + Math.random() * 0.05) * (0.5 + lifeRatio * 0.5);
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
	 * Create LED dot matrix display
	 */
	createLEDDisplay() {
		// Container for all LED dots - position on the opposite side of the board
		this.ledGroup = new THREE.Group();
		this.scoreboardGroup.add(this.ledGroup);
		
		// Create dot instances for better performance
		// Significantly increased size for better visibility
		const dotGeometry = new THREE.CircleGeometry(0.12, 16); // More detailed circles
		
		// Create materials for each color state with extreme brightness
		this.dotMaterials = {};
		Object.entries(this.colors).forEach(([name, color]) => {
			// Make colors extremely vibrant
			const enhancedColor = color.clone().multiplyScalar(name === 'off' ? 1 : 1);
			
			this.dotMaterials[name] = new THREE.MeshBasicMaterial({
				color: enhancedColor,
				transparent: false,
				opacity: name === 'off' ? 0.05 : 1.0,
				blending: THREE.AdditiveBlending,
				side: THREE.DoubleSide // Make dots visible from both sides
			});
		});
		
		// Initialize 2D array to store dot meshes
		this.dots = Array(this.dotRows).fill().map(() => Array(this.dotCols).fill(null));
		
		// Fill the entire display area (use almost the entire width/height)
		const totalWidth = this.width * 0.98;
		const totalHeight = this.height * 0.95;
		
		// Adjust dot spacing to fill the display area more completely
		this.dotSpacing = Math.min(
			totalWidth / this.dotCols,
			totalHeight / this.dotRows
		) * 1.3;
		
		// Recalculate dot size based on spacing - make dots cover almost the entire space
		this.dotSize = this.dotSpacing * 1.4; // Increased from 0.9
		
		// Calculate start positions to center the display
		const startX = -totalWidth / 2 + this.dotSpacing / 2;
		const startY = -totalHeight / 2 + this.dotSpacing / 2;
		
		// Create all LED dots - position on the opposite side (negative z)
		for (let row = 0; row < this.dotRows; row++) {
			for (let col = 0; col < this.dotCols; col++) {
				const dot = new THREE.Mesh(dotGeometry, this.dotMaterials.off);
				
				// Position the dot
				dot.position.x = startX + col * this.dotSpacing;
				dot.position.y = startY + row * this.dotSpacing;
				
				// Position dots on the far side of the board
				dot.position.z = -0.3; 
				
				// Flip the dots to face the opposite direction
				dot.rotation.y = Math.PI;
				
				// Update dot scale to match new size
				dot.scale.set(this.dotSize, this.dotSize, 1);
				
				// Store the dot in our 2D array
				this.dots[row][col] = dot;
				
				// Add to group
				this.ledGroup.add(dot);
			}
		}
		
		// Center the LED group in the scoreboard
		this.ledGroup.position.set(0, 0, 0);
		
		// Add a glow effect behind the LED display
		//this.addLEDGlowEffect(totalWidth, totalHeight);
	}
	
	/**
	 * Add a subtle glow effect behind the LED display for better contrast
	 */
	addLEDGlowEffect(width, height) {
		const glowGeometry = new THREE.PlaneGeometry(width * 1.02, height * 1.02);
		const glowMaterial = new THREE.MeshBasicMaterial({
			color: 0x003366,
			transparent: true,
			opacity: 0.5,
			blending: THREE.AdditiveBlending,
			side: THREE.DoubleSide
		});
		
		const glow = new THREE.Mesh(glowGeometry, glowMaterial);
		glow.position.z = -0.29; // Just behind the dots on the far side
		this.ledGroup.add(glow);
		
		// Add a blurred background effect
		const blurGeometry = new THREE.PlaneGeometry(width * 1.05, height * 1.05);
		const blurMaterial = new THREE.MeshBasicMaterial({
			color: 0x001122,
			transparent: true,
			opacity: 0.3,
			blending: THREE.AdditiveBlending,
			side: THREE.DoubleSide
		});
		
		// Create a blurred effect using a custom shader if possible, otherwise use basic material
		const blurEffect = new THREE.Mesh(blurGeometry, blurMaterial);
		blurEffect.position.z = -0.31; // Slightly further back than the glow
		this.ledGroup.add(blurEffect);
	}
	
	/**
	 * Set the color of an individual LED dot
	 * @param {number} row - Row index
	 * @param {number} col - Column index
	 * @param {string} colorName - Name of the color to set
	 */
	setDotColor(row, col, colorName) {
		if (row < 0 || row >= this.dotRows || col < 0 || col >= this.dotCols) {
			return;
		}
		
		const dot = this.dots[row][col];
		if (dot) {
			// Add more intense effect for active dots by scaling them slightly
			if (colorName !== 'off') {
				dot.scale.set(this.dotSize * 1.2, this.dotSize * 1.2, 1);
			} else {
				dot.scale.set(this.dotSize * 0.8, this.dotSize * 0.8, 1);
			}
			
			dot.material = this.dotMaterials[colorName] || this.dotMaterials.off;
		}
	}
	
	/**
	 * Draw text on the LED display
	 * @param {string} text - Text to display
	 * @param {number} row - Starting row
	 * @param {number} col - Starting column
	 * @param {string} color - Color name for the text
	 */
	drawText(text, row, col, color) {
		// Simple 5x3 font for basic characters but with better spacing
		const font = {
			'0': [
				[1,1,1],
				[1,0,1],
				[1,0,1],
				[1,0,1],
				[1,1,1]
			],
			'1': [
				[0,1,0],
				[1,1,0],
				[0,1,0],
				[0,1,0],
				[1,1,1]
			],
			'2': [
				[1,1,1],
				[0,0,1],
				[1,1,1],
				[1,0,0],
				[1,1,1]
			],
			'3': [
				[1,1,1],
				[0,0,1],
				[0,1,1],
				[0,0,1],
				[1,1,1]
			],
			'4': [
				[1,0,1],
				[1,0,1],
				[1,1,1],
				[0,0,1],
				[0,0,1]
			],
			'5': [
				[1,1,1],
				[1,0,0],
				[1,1,1],
				[0,0,1],
				[1,1,1]
			],
			'6': [
				[1,1,1],
				[1,0,0],
				[1,1,1],
				[1,0,1],
				[1,1,1]
			],
			'7': [
				[1,1,1],
				[0,0,1],
				[0,1,0],
				[0,1,0],
				[0,1,0]
			],
			'8': [
				[1,1,1],
				[1,0,1],
				[1,1,1],
				[1,0,1],
				[1,1,1]
			],
			'9': [
				[1,1,1],
				[1,0,1],
				[1,1,1],
				[0,0,1],
				[1,1,1]
			],
			'$': [
				[0,1,0],
				[1,1,1],
				[1,0,0],
				[1,1,1],
				[0,1,0]
			],
			'+': [
				[0,0,0],
				[0,1,0],
				[1,1,1],
				[0,1,0],
				[0,0,0]
			],
			'-': [
				[0,0,0],
				[0,0,0],
				[1,1,1],
				[0,0,0],
				[0,0,0]
			],
			'.': [
				[0,0,0],
				[0,0,0],
				[0,0,0],
				[0,0,0],
				[0,1,0]
			],
			' ': [
				[0,0,0],
				[0,0,0],
				[0,0,0],
				[0,0,0],
				[0,0,0]
			],
			'%': [
				[1,0,1],
				[0,0,1],
				[0,1,0],
				[1,0,0],
				[1,0,1]
			],
			'A': [
				[0,1,0],
				[1,0,1],
				[1,1,1],
				[1,0,1],
				[1,0,1]
			],
			'B': [
				[1,1,0],
				[1,0,1],
				[1,1,0],
				[1,0,1],
				[1,1,0]
			],
			'C': [
				[0,1,1],
				[1,0,0],
				[1,0,0],
				[1,0,0],
				[0,1,1]
			],
			'D': [
				[1,1,0],
				[1,0,1],
				[1,0,1],
				[1,0,1],
				[1,1,0]
			],
			'E': [
				[1,1,1],
				[1,0,0],
				[1,1,0],
				[1,0,0],
				[1,1,1]
			],
			'F': [
				[1,1,1],
				[1,0,0],
				[1,1,0],
				[1,0,0],
				[1,0,0]
			],
			'G': [
				[0,1,1],
				[1,0,0],
				[1,0,1],
				[1,0,1],
				[0,1,1]
			],
			'H': [
				[1,0,1],
				[1,0,1],
				[1,1,1],
				[1,0,1],
				[1,0,1]
			],
			'I': [
				[1,1,1],
				[0,1,0],
				[0,1,0],
				[0,1,0],
				[1,1,1]
			],
			'K': [
				[1,0,1],
				[1,0,1],
				[1,1,0],
				[1,0,1],
				[1,0,1]
			],
			'L': [
				[1,0,0],
				[1,0,0],
				[1,0,0],
				[1,0,0],
				[1,1,1]
			],
			'M': [
				[1,0,1],
				[1,1,1],
				[1,0,1],
				[1,0,1],
				[1,0,1]
			],
			'N': [
				[1,0,1],
				[1,1,1],
				[1,1,1],
				[1,0,1],
				[1,0,1]
			],
			'O': [
				[0,1,0],
				[1,0,1],
				[1,0,1],
				[1,0,1],
				[0,1,0]
			],
			'P': [
				[1,1,0],
				[1,0,1],
				[1,1,0],
				[1,0,0],
				[1,0,0]
			],
			'R': [
				[1,1,0],
				[1,0,1],
				[1,1,0],
				[1,0,1],
				[1,0,1]
			],
			'S': [
				[0,1,1],
				[1,0,0],
				[0,1,0],
				[0,0,1],
				[1,1,0]
			],
			'T': [
				[1,1,1],
				[0,1,0],
				[0,1,0],
				[0,1,0],
				[0,1,0]
			],
			'U': [
				[1,0,1],
				[1,0,1],
				[1,0,1],
				[1,0,1],
				[1,1,1]
			],
			'V': [
				[1,0,1],
				[1,0,1],
				[1,0,1],
				[0,1,0],
				[0,1,0]
			],
			'W': [
				[1,0,1],
				[1,0,1],
				[1,0,1],
				[1,1,1],
				[1,0,1]
			],
			'X': [
				[1,0,1],
				[1,0,1],
				[0,1,0],
				[1,0,1],
				[1,0,1]
			],
			'Y': [
				[1,0,1],
				[1,0,1],
				[0,1,0],
				[0,1,0],
				[0,1,0]
			],
			'Z': [
				[1,1,1],
				[0,0,1],
				[0,1,0],
				[1,0,0],
				[1,1,1]
			]
		};
		
		let currentCol = col;
		
		// Clear a rectangular area around the text
		const textWidth = text.length * 5;
		const textHeight = 4;
		
		for (let y = 0; y < textHeight; y++) {
			for (let x = 0; x < textWidth + 1; x++) {
				this.setDotColor(row + y, col + x, 'off');
			}
		}
		
		// For each character in the text
		for (let i = 0; i < text.length; i++) {
			const char = text[i].toUpperCase();
			const charPattern = font[char] || font[' ']; // Default to space if char not found
			
			// Draw the character with extra space around it for better readability
			for (let y = 0; y < charPattern.length; y++) {
				for (let x = 0; x < charPattern[y].length; x++) {
					if (charPattern[y][x]) {
						this.setDotColor(row + y, currentCol + x, color);
					}
				}
			}
			
			// Move to next character position with extra space
			currentCol += 4; // Increased from 4 for better readability
		}
		
		// Return the ending column position
		return currentCol;
	}
	
	/**
	 * Update the token data displayed on the scoreboard
	 * @param {Array} tokens - Array of token data objects
	 */
	updateTokenData(tokens) {
		// Provide sample data if no tokens are provided or array is empty
		if (!tokens || tokens.length === 0) {
			console.log("TokenScoreboard: No token data provided, using sample data");
			tokens = [
				{
					baseToken: { symbol: 'DOGE' },
					priceUsd: '0.1234',
					priceChange: { h24: 5.67 }
				},
				{
					baseToken: { symbol: 'PEPE' },
					priceUsd: '0.00001234',
					priceChange: { h24: -2.34 }
				},
				{
					baseToken: { symbol: 'SHIB' },
					priceUsd: '0.00002678',
					priceChange: { h24: 1.23 }
				}
			];
		}
		
		// Map and clean the data to ensure we have all required properties
		this.displayData = tokens.slice(0, this.maxTokensToShow).map(token => {
			const symbol = token.baseToken?.symbol || 
				(token.tokenAddress ? token.tokenAddress.substring(0, 6) : 'UNKN');
				
			// Make sure price is a string or number and not null/undefined
			let price = token.priceUsd;
			if (price === undefined || price === null) {
				price = "0";
			}
			
			// Make sure change is a number and not null/undefined
			let change = token.priceChange?.h24;
			if (change === undefined || change === null) {
				change = 0;
			} else if (typeof change === 'string') {
				change = parseFloat(change) || 0;
			}
			
			return {
				symbol: symbol,
				price: price,
				change: change
			};
		});
		
		console.log("TokenScoreboard: Updated display data", this.displayData);
		
		// Reset scroll position
		this.scrollPosition = 0;
	}
	
	/**
	 * Draw a token's information on the display
	 * @param {number} index - Index of token in the display data array
	 * @param {number} row - Starting row on the display
	 */
	drawTokenInfo(index, row) {
		if (index >= this.displayData.length) return;
		
		const token = this.displayData[index];
		
		// Draw token symbol
		let currentCol = 2;
		currentCol = this.drawText('$' + token.symbol, row, currentCol, 'cyan');
		
		// Add separator - increase the gap between elements
		currentCol += 4;
		
		// Format price (limit to sensible precision)
		let priceText = "";
		const price = parseFloat(token.price);
		if (isNaN(price)) {
			priceText = "N/A";
		} else if (price >= 100) {
			priceText = price.toFixed(2);
		} else if (price >= 1) {
			priceText = price.toFixed(4);
		} else if (price >= 0.01) {
			priceText = price.toFixed(6);
		} else {
			// For very small numbers, use more precision or scientific notation
			if (price < 0.0000001) {
				priceText = price.toExponential(2);
			} else {
				priceText = price.toFixed(8);
			}
		}
		
		// Draw price in yellow - increase vertical spacing between symbol and price
		currentCol = this.drawText('$' + priceText, row + 6, 2, 'yellow');
		
		// Draw change percentage
		const change = parseFloat(token.change);
		const changeColor = !isNaN(change) && change >= 0 ? 'green' : 'red';
		const changeChar = !isNaN(change) && change >= 0 ? '+' : '-';
		const changeValue = !isNaN(change) ? Math.abs(change).toFixed(2) : '0.00';
		const changeText = changeChar + changeValue + '%';
		
		// Calculate the right-aligned position
		const changeTextWidth = changeText.length * 4; // Approximate width of the text
		const rightAlignedCol = this.dotCols - changeTextWidth - 12; // 2 spaces from the right edge
		
		this.drawText(changeText, row + 6, rightAlignedCol, changeColor);
	}
	
	/**
	 * Compute the scoreboard height required to fill ~90% of the viewport vertically
	 */
	computeExpandedHeight() {
		if (!this.camera) {
			console.log("No camera found, returning default expanded height", this.expandedHeight);
			return this.expandedHeight || 20;
		}
		const fovRadians = this.camera.fov * Math.PI / 180;
		const distance = 10; // Same distance used in _updateScreenPosition
		const fullHeight = 2 * Math.tan(fovRadians / 2) * distance;
		return fullHeight * 2.5; // Adjusted to make the height larger, filling more of the viewport
	}

	/**
	 * Update the screen position of the scoreboard
	 */
	_updateScreenPosition() {
		console.log("Actually Updating screen position");
		if (!this.camera) return;

		// Calculate the target position based on field of view
		const fov = this.camera.fov * Math.PI / 180;
		const distance = 10; // Fixed distance from camera
		const viewHeight = 2 * Math.tan(fov / 2) * distance;
		const viewWidth = viewHeight * this.camera.aspect;
		
		// Get actual pixel width for more accurate decisions
		const actualPixelWidth = window.innerWidth || 1200;
		console.log(`Actual screen width: ${actualPixelWidth}px, FOV width: ${viewWidth.toFixed(2)}`);
		
		// Hard pixel width thresholds for different screen sizes
		// These should be more reliable than the FOV calculations
		const isVeryNarrowScreen = actualPixelWidth < 600;  // Mobile phones
		const isNarrowScreen = actualPixelWidth < 750 && !isVeryNarrowScreen; // Small tablets
		const isMediumScreen = actualPixelWidth >= 750 && actualPixelWidth < 900; // Medium screens
		
		// Calculate width of the scoreboard and its bolts
		const scoreboardWidth = this.width; // The width of the scoreboard
		
		// Calculate appropriate scale based on screen width
		let scale = 0.3; // Default scale
		if (isVeryNarrowScreen) {
			// Use pixel width-based scaling for very narrow screens
			const narrowRatio = actualPixelWidth / 600; // Use 600px as reference width
			scale = 0.3 * narrowRatio;
			scale = Math.max(0.18, Math.min(0.3, scale)); // Clamp between 0.18 and 0.3
			console.log(`Very narrow screen detected (${actualPixelWidth}px), scaling down to ${scale.toFixed(2)}`);
		}
		
		// Get camera quaternion for orientation
		const quaternion = this.camera.quaternion.clone();
		
		// Create camera-oriented coordinate system
		const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);
		const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
		const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
		
		// Adjust screen position based on size mode or positioning phase
		if (this.isPositioningFirst) {
			// During first phase of tall mode animation, center vertically
			this.screenPosition.y = 0;
			console.log("Positioning first: centered vertically");
		} else if (this.sizeMode === 'tall') {
			// Center vertically in tall mode
			this.screenPosition.y = 0; 
		} else {
			// Bottom left for normal and hidden modes
			this.screenPosition.y = -0.7; 
		}
		
		// Handle horizontal positioning based on screen width
		if (isVeryNarrowScreen || isNarrowScreen) {
			// Center horizontally on narrow screens
			this.screenPosition.x = 0;
			console.log(isVeryNarrowScreen ? 
				`Very narrow screen (${actualPixelWidth}px), centering and scaling` : 
				`Narrow screen (${actualPixelWidth}px), centering horizontally`);
		} else if (isMediumScreen) {
			// For medium-width screens (750-900px), use a less extreme left position
			// to avoid getting cut off on the left edge
			const mediumOffset = -0.3; // Less to the left than the default -0.6
			this.screenPosition.x = mediumOffset;
			console.log(`Medium screen width (${actualPixelWidth}px), using moderate left position: ${mediumOffset}`);
		} else {
			// Standard left alignment on wider screens
			this.screenPosition.x = -0.6; // Default position
			console.log(`Normal screen width (${actualPixelWidth}px), positioning to the left`);
		}
		
		// Calculate target position relative to camera
		const targetPos = this.camera.position.clone()
			.add(forward.clone().multiplyScalar(distance))
			.add(right.clone().multiplyScalar(this.screenPosition.x * viewWidth / 2))
			.add(up.clone().multiplyScalar(this.screenPosition.y * viewHeight / 2));
		
		// Store target quaternion for rotation
		const targetQuaternion = this.camera.quaternion.clone();
		
		// Check if there was significant movement
		const movement = new THREE.Vector3().subVectors(targetPos, this.scoreboardGroup.position);
		const significantMovement = movement.length() > this.movementThreshold;
		
		if (significantMovement) {
			// Animate the movement
			this.animateMovement(targetPos, targetQuaternion, scale);
		} else {
			// Just set position directly for small adjustments
			this.scoreboardGroup.position.copy(targetPos);
			
			// Set rotation
			this.scoreboardGroup.quaternion.copy(targetQuaternion);
			
			// Add a rotation to fix the upside-down text
			this.scoreboardGroup.rotateZ(Math.PI);
			this.scoreboardGroup.rotateY(Math.PI); // Face the camera
			
			// Set scale based on screen width
			this.scoreboardGroup.scale.set(scale, scale, scale);
		}
		
		// Update visibility based on size mode
		this.scoreboardGroup.visible = true; // Always visible, but may be faded in hidden mode
	}
	
	/**
	 * Animate the scoreboard flying to a new position
	 * @param {THREE.Vector3} targetPos - Target position to move to
	 * @param {THREE.Quaternion} targetQuaternion - Target rotation
	 * @param {number} scale - Scale to apply to the scoreboard
	 */
	animateMovement(targetPos, targetQuaternion, scale = 0.3) {
		// Set flag that we're currently moving
		this.isMoving = true;
		this.movementStartTime = performance.now();
		
		// Store starting position and rotation
		const startPosition = this.scoreboardGroup.position.clone();
		this.movementStartQuaternion.copy(this.scoreboardGroup.quaternion);
		this.targetQuaternion = targetQuaternion.clone();
		
		// Store starting and target scale
		const startScale = this.scoreboardGroup.scale.x;
		const targetScale = scale;
		
		// Get movement direction vector for jet effects
		const moveDir = new THREE.Vector3().subVectors(targetPos, startPosition);
		
		// Properly rotate target quaternion for text orientation
		const rotZ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
		const rotY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
		this.targetQuaternion.multiply(rotZ).multiply(rotY);
		
		// Set up animation
		const animate = (currentTime) => {
			if (!this.isMoving) return;
			
			const elapsed = currentTime - this.movementStartTime;
			const progress = Math.min(elapsed / this.movementDuration, 1);
			
			// Use ease-in-out function for smoother movement
			const t = progress < 0.5
				? 2 * progress * progress
				: 1 - Math.pow(-2 * progress + 2, 2) / 2;
			
			// Interpolate position
			this.scoreboardGroup.position.lerpVectors(startPosition, targetPos, t);
			
			// Interpolate rotation
			this.scoreboardGroup.quaternion.slerpQuaternions(
				this.movementStartQuaternion,
				this.targetQuaternion,
				t
			);
			
			// Interpolate scale
			const currentScale = startScale + (targetScale - startScale) * t;
			this.scoreboardGroup.scale.set(currentScale, currentScale, currentScale);
			
			// Continue animation if not complete
			if (progress < 1) {
				requestAnimationFrame(animate);
			} else {
				this.isMoving = false;
				this.lastPosition.copy(this.scoreboardGroup.position);
			}
		};
		
		// Start animation
		requestAnimationFrame(animate);
	}
	
	/**
	 * Handle interaction with the scoreboard
	 * @param {THREE.Raycaster} raycaster - Raycaster for interaction
	 * @returns {boolean} Whether interaction occurred
	 */
	handleInteraction(raycaster) {
		const intersects = raycaster.intersectObjects(this.scoreboardGroup.children, true);
		
		if (intersects.length > 0) {
			let obj = intersects[0].object;
			
			// Traverse up to find button
			let buttonGroup = obj;
			while (buttonGroup && !buttonGroup.userData?.isButton) {
				buttonGroup = buttonGroup.parent;
			}
			
			if (buttonGroup?.userData?.isButton) {
				const action = buttonGroup.userData.action;
				console.log("Button clicked:", action);
				
				if (action === 'expand') {
					if (this.sizeMode === 'normal') {
					this.changeSizeMode('tall');
					return true;
					} else if (this.sizeMode === 'hidden') {
					this.changeSizeMode('normal');
					return true;
					}
				} else if (action === 'collapse') {
					if (this.sizeMode === 'tall') {
						this.changeSizeMode('normal');
						return true;
					} else if (this.sizeMode === 'normal') {
					this.changeSizeMode('hidden');
					return true;
					}
				}
			}
		}
		
		return false;
	}
	
	/**
	 * Change the size mode of the scoreboard
	 * @param {string} mode - The new size mode ('normal', 'tall', 'hidden')
	 */
	changeSizeMode(mode) {
		const previousMode = this.sizeMode;
		this.sizeMode = mode;
		console.log("Changing scoreboard size mode from", previousMode, "to:", this.sizeMode);
		
		// Update button visibility and colors
		if (this.sizeMode === 'tall') {
			// Grey out up arrow as we're fully expanded
			this.expandPlanetMaterial.color.setHex(0x555555);
			this.collapsePlanetMaterial.color.setHex(0xaa0000); // Active down arrow
		} else if (this.sizeMode === 'normal') {
			// Both buttons active
			this.expandPlanetMaterial.color.setHex(0x00aa00);
			this.collapsePlanetMaterial.color.setHex(0xaa0000);
		} else if (this.sizeMode === 'hidden') {
			// Grey out down arrow as we're fully hidden
			this.expandPlanetMaterial.color.setHex(0x00aa00); // Active up arrow
			this.collapsePlanetMaterial.color.setHex(0x555555);
		}
		
		// Set target height based on mode
		this.targetHeight = this.sizeMode === 'tall' ? this.computeExpandedHeight() : (this.sizeMode === 'normal' ? 8 : 0);
		this.startHeight = this.height;
		console.log("Target height set to:", this.targetHeight);
		
		// Store initial width to maintain during animations
		this.initialWidth = this.width;
		
		// Make sure we reset any corner bolt positions if they've been moved
		if (this.cornerBolts && this.cornerBolts.length >= 4) {
			if (previousMode === 'hidden') {
				// If coming from hidden mode, restore original X positions
				this.cornerBolts.forEach(bolt => {
					if (bolt.userData.originalPosition) {
						bolt.position.x = bolt.userData.originalPosition.x;
					}
				});
			}
		}
		
		// Set a flag to prevent screen position updates during animation
		this.isAnimatingMode = true;
		
		// Use different animations based on the transition
		if (this.sizeMode === 'tall' && previousMode === 'normal') {
			// When going tall from normal: first position, then expand height
			this.positionAndExpandScoreboard();
		} else if (this.sizeMode === 'normal' && previousMode === 'tall') {
			// Going from tall to normal: shrink height and reposition simultaneously
			this.animateCornerBolts(() => {
				this.finalizeSizeModeChange();
			});
		} else if (this.sizeMode === 'hidden' && previousMode === 'normal') {
			// Move all bolts to bottom left corner when going to hidden mode
			this.animateCornerBoltsToCorner(() => {
				this.finalizeSizeModeChange();
			});
		} else if (this.sizeMode === 'normal' && previousMode === 'hidden') {
			// Move bolts back to normal corners when coming from hidden mode
			this.animateCornerBoltsToNormalPositions(() => {
				this.finalizeSizeModeChange();
			});
		} else {
			// No animation needed, finalize immediately
			this.finalizeSizeModeChange();
		}
	}
	
	/**
	 * Two-phase animation for going to tall mode:
	 * 1. First reposition to center of screen
	 * 2. Then expand height and position top bolts
	 */
	positionAndExpandScoreboard() {
		console.log("Starting two-phase animation: positioning first, then expanding height");
		
		// Temporary flag to indicate we're in position-first mode
		this.isPositioningFirst = true;
		
		// Step 1: Update screen position to center without changing height
		// This will make the scoreboard fly to center position first
		this._updateScreenPosition();
		
		// Set up a listener to detect when movement animation is complete
		const checkMovementComplete = () => {
			if (!this.isMoving) {
				// Movement is complete, now expand height
				console.log("Repositioning complete, now expanding height");
				this.isPositioningFirst = false;
				
				// Start the corner bolts animation to expand height
				this.animateCornerBolts(() => {
					// Complete the size mode change after animation
					this.finalizeSizeModeChange();
				});
			} else {
				// Still moving, check again soon
				requestAnimationFrame(checkMovementComplete);
			}
		};
		
		// Start checking if we're moving
		if (this.isMoving) {
			// Already moving, wait for it to complete
			checkMovementComplete();
		} else {
			// Not moving, maybe no animation was needed, go straight to height animation
			this.isPositioningFirst = false;
			this.animateCornerBolts(() => {
				this.finalizeSizeModeChange();
			});
		}
	}
	
	/**
	 * Finalize the size mode change after animations
	 * This ensures screen position updates happen at the right time
	 */
	finalizeSizeModeChange() {
		// Make opacity changes for hidden mode - but don't touch the LED matrix
		// (that's handled in the animation)
		// if (this.sizeMode === 'hidden') {
		// 	// Fade out the scoreboard structure (not the LED matrix)
		// 	this.scoreboardGroup.traverse(obj => {
		// 		// Skip the LED group
		// 		if (obj === this.ledGroup || obj.parent === this.ledGroup) {
		// 			return;
		// 		}
				
		// 		if (obj.material && obj.material.opacity !== undefined) {
		// 			obj.material.transparent = true;
		// 			// Preserve original opacity or create a new one
		// 			if (obj.userData.originalOpacity === undefined) {
		// 				obj.userData.originalOpacity = obj.material.opacity;
		// 			}
		// 			obj.material.opacity = obj.userData.originalOpacity * 0.3;
		// 		}
		// 	});
		// } else {
		// 	// Restore original opacity (except for LED matrix which is handled in animations)
		// 	this.scoreboardGroup.traverse(obj => {
		// 		// Skip the LED group
		// 		if (obj === this.ledGroup || obj.parent === this.ledGroup) {
		// 			return;
		// 		}
				
		// 		if (obj.material && obj.material.opacity !== undefined && obj.userData.originalOpacity !== undefined) {
		// 			obj.material.opacity = obj.userData.originalOpacity;
		// 		}
		// 	});
		// }
		
		// Update dimensions (frame, background, LED rows, jets, etc.)
		this.updateScoreboardDimensions();
		
		// Update display dot placement
		this.updateLEDDisplaySize();
		
		// Clear animation flag
		this.isAnimatingMode = false;
		
		// Now it's safe to update screen position
		this._updateScreenPosition();
		
		console.log("Size mode change finalized");
	}
	
	/**
	 * Completely rewritten animation for tall mode
	 * Only moves top bolts to top of screen, bottom bolts remain fixed
	 * @param {Function} onComplete - Callback function to run when animation completes
	 */
	animateCornerBolts(onComplete) {
		console.log("Animating top corner bolts to top of screen, keeping bottom bolts fixed");

		// Only animate if bolts exist
		if (!this.cornerBolts || this.cornerBolts.length < 4) {
			console.error("Corner bolts not found for animation");
			if (onComplete) onComplete();
			return;
		}
		
		// Explicitly define which bolts are which to avoid confusion
		const topLeftBolt = this.cornerBolts[0];
		const topRightBolt = this.cornerBolts[1];
		const bottomLeftBolt = this.cornerBolts[2]; 
		const bottomRightBolt = this.cornerBolts[3];
		
		// Calculate screen dimensions for positioning
		const fov = this.camera.fov * Math.PI / 180;
		const distance = 10;
		const viewHeight = 2 * Math.tan(fov / 2) * distance;
		const viewWidth = viewHeight * this.camera.aspect;
		
		// Target positions depend on the mode we're changing to
		const isTallMode = this.sizeMode === 'tall';
		const isAlreadyCentered = !this.isPositioningFirst && isTallMode;
		
		// Use the same pixel-width based approach that we use in _updateScreenPosition
		const actualPixelWidth = window.innerWidth || 1200;
		console.log(`animateCornerBolts: actual screen width: ${actualPixelWidth}px`);
		
		// Hard pixel width thresholds for different screen sizes
		const isVeryNarrowScreen = actualPixelWidth < 600;  // Mobile phones
		const isNarrowScreen = actualPixelWidth < 750 && !isVeryNarrowScreen; // Small tablets
		const isMediumScreen = actualPixelWidth >= 750 && actualPixelWidth < 900; // Medium screens
		
		// Adjust horizontal spread factor based on screen width
		let horizontalSpreadFactor = 0.35; // Default: use 35% of the screen width from center
		
		if (isVeryNarrowScreen) {
			// For very narrow screens, calculate a more aggressive reduction
			// Scale based on actual pixel width
			const narrowRatio = actualPixelWidth / 600; // 600px as reference
			horizontalSpreadFactor = 0.35 * narrowRatio * 0.9;
			
			// Ensure the spread is not too small (at least 15% of view width)
			horizontalSpreadFactor = Math.max(0.15, horizontalSpreadFactor);
			
			console.log(`Very narrow screen detected (${actualPixelWidth}px), reducing bolt spread to ${horizontalSpreadFactor.toFixed(2)}`);
		} 
		else if (isNarrowScreen) {
			// Use a smaller spread on narrow screens
			const narrowRatio = actualPixelWidth / 750; // 750px as reference
			horizontalSpreadFactor = 0.35 * (0.8 + narrowRatio * 0.2); // Scale between 0.28-0.35
			
			console.log(`Narrow screen detected (${actualPixelWidth}px), reducing bolt spread to ${horizontalSpreadFactor.toFixed(2)}`);
		}
		else if (isMediumScreen) {
			// For medium screens, use a slightly reduced spread
			// This helps when the scoreboard is positioned with a less extreme left offset
			horizontalSpreadFactor = 0.32; // Slightly smaller than default 0.35
			
			console.log(`Medium screen detected (${actualPixelWidth}px), using moderate bolt spread: ${horizontalSpreadFactor.toFixed(2)}`);
		}
		
		// Animation parameters - faster if we're already centered
		const duration = isAlreadyCentered ? 800 : 1200;
		const startTime = performance.now();
		
		// Store starting values
		const startHeight = this.height;
		const startPosTopLeft = topLeftBolt.position.clone();
		const startPosTopRight = topRightBolt.position.clone();
		const startPosBottomLeft = bottomLeftBolt.position.clone();
		const startPosBottomRight = bottomRightBolt.position.clone();
		
		// Calculate target positions for top bolts
		// In tall mode: fly to top of screen with wide spread
		// In normal mode: return to original positions
		const targetTopLeftPos = isTallMode 
			? new THREE.Vector3(-viewWidth * horizontalSpreadFactor, viewHeight * 0.48, 0)
			: topLeftBolt.userData.originalPosition.clone();
		
		const targetTopRightPos = isTallMode 
			? new THREE.Vector3(viewWidth * horizontalSpreadFactor, viewHeight * 0.48, 0)
			: topRightBolt.userData.originalPosition.clone();
		
		console.log("Animating top bolts to", isTallMode ? "top of screen" : "original positions");
		
		// Pre-calculate the positions for bottom bolts at different heights
		// to ensure they maintain the same width
		const getBottomBoltPositions = (currentHeight) => {
			const leftX = -this.width/2 - 0.1;
			const rightX = this.width/2 + 2.1;
			const y = -currentHeight/2 - 0.1;
			return {
				left: new THREE.Vector3(leftX, y, 0),
				right: new THREE.Vector3(rightX, y, 0)
			};
		};
		
		// Animation function
		const animate = (timestamp) => {
			const elapsed = timestamp - startTime;
			const progress = Math.min(elapsed / duration, 1);
			const easedProgress = this.easeInOutQuad(progress);
			
			// Update height with proper easing
			const newHeight = startHeight + (this.targetHeight - startHeight) * easedProgress;
			this.height = newHeight;
			
			// Calculate current bottom bolt positions to maintain width
			const bottomPositions = getBottomBoltPositions(newHeight);
			
			// If already centered and in tall mode, use more vertical movement for top bolts
			if (isAlreadyCentered) {
				// Primarily vertical movement since we're already centered
				const topLeftY = startPosTopLeft.y + (targetTopLeftPos.y - startPosTopLeft.y) * easedProgress;
				const topRightY = startPosTopRight.y + (targetTopRightPos.y - startPosTopRight.y) * easedProgress;
				
				topLeftBolt.position.y = topLeftY;
				topRightBolt.position.y = topRightY;
				
				// Adjust X position slightly for better spread
				// Use a stronger horizontal spread for non-narrow screens
				const xSpreadFactor = isNarrowScreen || isVeryNarrowScreen ? 
					easedProgress * 0.6 : // Less horizontal spread for narrow screens 
					easedProgress * 0.8;  // Normal horizontal spread
					
				topLeftBolt.position.x = startPosTopLeft.x + (targetTopLeftPos.x - startPosTopLeft.x) * xSpreadFactor;
				topRightBolt.position.x = startPosTopRight.x + (targetTopRightPos.x - startPosTopRight.x) * xSpreadFactor;
			} else {
				// Standard animation: interpolate full position
				topLeftBolt.position.lerpVectors(startPosTopLeft, targetTopLeftPos, easedProgress);
				topRightBolt.position.lerpVectors(startPosTopRight, targetTopRightPos, easedProgress);
			}
			
			// Position bottom bolts - keeping width constant but updating Y for new height
			bottomLeftBolt.position.x = bottomPositions.left.x;
			bottomLeftBolt.position.y = bottomPositions.left.y;
			bottomRightBolt.position.x = bottomPositions.right.x;
			bottomRightBolt.position.y = bottomPositions.right.y;
			
			// Jets will automatically track with bolts through syncJetsWithBolts in update()
			
			// Update button positions and scoreboard dimensions
			this.updateButtonPositions();
			this.updateScoreboardDimensions();
			this.updateLEDDisplaySize();
			
			// Continue animation if not complete
			if (progress < 1) {
				requestAnimationFrame(animate);
			} else {
				// Ensure final positions are exactly as intended
				topLeftBolt.position.copy(targetTopLeftPos);
				topRightBolt.position.copy(targetTopRightPos);
				
				const finalBottomPositions = getBottomBoltPositions(this.height);
				bottomLeftBolt.position.copy(finalBottomPositions.left);
				bottomRightBolt.position.copy(finalBottomPositions.right);
				
				// Call the completion callback
				if (onComplete) onComplete();
			}
		};
		
		// Start animation
		requestAnimationFrame(animate);
	}
	
	/**
	 * Animate all bolts to bottom left corner for hidden mode
	 * @param {Function} onComplete - Callback function to run when animation completes
	 */
	animateCornerBoltsToCorner(onComplete) {
		// Only animate if bolts exist
		if (!this.cornerBolts || this.cornerBolts.length < 4) {
			console.error("Corner bolts not found for animation");
			if (onComplete) onComplete();
			return;
		}
		
		// Animation duration
		const duration = 1000;
		const startTime = performance.now();
		
		// Store starting positions and height
		const startHeight = this.height;
		const startPositions = this.cornerBolts.map(bolt => bolt.position.clone());
		
		// Create animation
		const animate = (timestamp) => {
			const elapsed = timestamp - startTime;
			const progress = Math.min(elapsed / duration, 1);
			
			// Use easing function
			const easedProgress = this.easeInOutQuad(progress);
			
			// Update height first
			const newHeight = startHeight + (this.targetHeight - startHeight) * easedProgress;
			this.height = newHeight;
			
			// Calculate current bottom left corner - ALWAYS at the bottom
			const targetX = -this.width/2 - 0.5;
			const targetY = -this.height/2 - 0.5; // This will change as height changes
			
			console.log(`Animation frame - target position: (${targetX}, ${targetY}), height: ${this.height}`);
			
			// Fade out the dot matrix as we transition to hidden mode
			if (this.ledGroup) {
				this.ledGroup.traverse(obj => {
					if (obj.material && obj.material.opacity !== undefined) {
						// Preserve original opacity if not already stored
						if (obj.userData.originalOpacity === undefined) {
							obj.userData.originalOpacity = obj.material.opacity;
						}
						// Fade to 10% of original opacity
						obj.material.transparent = true;
						obj.material.opacity = obj.userData.originalOpacity * (1 - easedProgress * 0.9);
					}
				});
			}
			
			// Update all bolt positions - move to bottom left
			this.cornerBolts.forEach((bolt, index) => {
				const startPos = startPositions[index];
				
				// Move towards bottom left corner - explicitly calculating positions in this frame
				bolt.position.x = startPos.x + (targetX - startPos.x) * easedProgress;
				bolt.position.y = startPos.y + (targetY - startPos.y) * easedProgress;
			});
			
			// Update scoreboard dimensions and button positions
			this.updateButtonPositions();
			this.updateScoreboardDimensions();
			this.updateLEDDisplaySize();
			
			// Continue animation if not complete
			if (progress < 1) {
				requestAnimationFrame(animate);
			} else {
				// Final target position based on final height
				const finalTargetX = -this.width/2 - 0.5;
				const finalTargetY = -this.height/2 - 0.5;
				
				console.log(`Animation complete - final position: (${finalTargetX}, ${finalTargetY}), height: ${this.height}`);
				
				// Ensure all bolts are exactly at the target position
				this.cornerBolts.forEach(bolt => {
					bolt.position.set(finalTargetX, finalTargetY, 0);
				});
				
				// Call the completion callback
				if (onComplete) onComplete();
			}
		};
		
		// Start animation
		requestAnimationFrame(animate);
	}
	
	/**
	 * Animate bolts back to normal corner positions
	 * @param {Function} onComplete - Callback function to run when animation completes
	 */
	animateCornerBoltsToNormalPositions(onComplete) {
		// Only animate if bolts exist
		if (!this.cornerBolts || this.cornerBolts.length < 4) {
			console.error("Corner bolts not found for animation");
			if (onComplete) onComplete();
			return;
		}
		
		// Animation duration
		const duration = 1000;
		const startTime = performance.now();
		
		// Store starting positions
		const startPositions = this.cornerBolts.map(bolt => bolt.position.clone());
		
		// Create animation
		const animate = (timestamp) => {
			const elapsed = timestamp - startTime;
			const progress = Math.min(elapsed / duration, 1);
			
			// Use easing function
			const easedProgress = this.easeInOutQuad(progress);
			
			// Restore the dot matrix opacity as we leave hidden mode
			if (this.ledGroup) {
				this.ledGroup.traverse(obj => {
					if (obj.material && obj.material.opacity !== undefined && obj.userData.originalOpacity !== undefined) {
						obj.material.transparent = true;
						// Fade back to original opacity
						obj.material.opacity = obj.userData.originalOpacity * easedProgress + 
							obj.userData.originalOpacity * 0.1 * (1 - easedProgress);
					}
				});
			}
			
			// Simultaneously update height
			this.height = this.startHeight + (this.targetHeight - this.startHeight) * easedProgress;
			
			// Update all bolt positions
			this.cornerBolts.forEach((bolt, index) => {
				const startPos = startPositions[index];
				const targetPos = bolt.userData.originalPosition.clone();
				
				// For bottom bolts, adjust target Y to match current height
				if (index === 2 || index === 3) { // Bottom bolts
					targetPos.y = -this.height/2 - 0.1;
				}
				
				// Move towards original position
				bolt.position.x = startPos.x + (targetPos.x - startPos.x) * easedProgress;
				bolt.position.y = startPos.y + (targetPos.y - startPos.y) * easedProgress;
			});
			
			// Update dimensions and button positions
			this.updateScoreboardDimensions();
			this.updateLEDDisplaySize();
			this.updateButtonPositions();
			
			// Continue animation if not complete
			if (progress < 1) {
				requestAnimationFrame(animate);
			} else {
				// Fix bottom bolt Y positions to match final height
				this.cornerBolts.forEach((bolt, index) => {
					if (index === 2 || index === 3) { // Bottom bolts
						bolt.position.y = -this.height/2 - 0.1;
					}
				});
				
				// Call the completion callback
				if (onComplete) onComplete();
			}
		};
		
		// Start animation
		requestAnimationFrame(animate);
	}
	
	/**
	 * Emit a trail of particles from a jet during movement
	 */
	emitJetTrail(jet, direction) {
		// Emit multiple particles for a richer effect
		for (let i = 0; i < 3; i++) {
			this.emitJetParticle(jet, direction, 1.5);
		}
	}
	
	/**
	 * Easing function for smoother animations
	 */
	easeInOutQuad(t) {
		return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
	}
	
	/**
	 * Update scoreboard dimensions based on current height / state
	 */
	updateScoreboardDimensions() {
		console.log("Updating scoreboard height to:", this.height);
		
		// Update frame geometry
		const frame = this.scoreboardGroup.children.find(child => child.geometry instanceof THREE.BoxGeometry);
		if (frame) {
			frame.geometry = new THREE.BoxGeometry(this.width + 0.5, this.height + 0.5, 0.3);
		}
		
		// Update display background
		const display = this.scoreboardGroup.children.find(child => child.geometry instanceof THREE.BoxGeometry && child !== frame);
		if (display) {
			display.geometry = new THREE.BoxGeometry(this.width, this.height * 1.1, 0.1);
		}
		
		// Update back panel
		const backPanel = this.scoreboardGroup.children.find(child => child.geometry instanceof THREE.PlaneGeometry);
		if (backPanel) {
			backPanel.geometry = new THREE.PlaneGeometry(this.width + 0.5, this.height + 0.5);
		}
		
		// Update button positions by calling the dedicated method
		this.updateButtonPositions();
		
		// Dynamically calculate dot rows to fill the available height while keeping spacing constant
		const baseSpacing = (this.width * 0.98 / this.dotCols) * 1.3; // Width-limited spacing (constant)
		this.dotRows = Math.max(1, Math.floor((this.height * 0.95) / baseSpacing));
		console.log("Dot rows recalculated:", this.dotRows);
		
		// Re-create LED display to match new row count
		if (this.ledGroup) {
			this.scoreboardGroup.remove(this.ledGroup);
			this.ledGroup.traverse(obj => {
				if (obj.geometry) obj.geometry.dispose?.();
				if (obj.material) obj.material.dispose?.();
			});
			this.ledGroup = null;
		}
		this.createLEDDisplay();
	}
	
	/**
	 * Update LED display size based on current height
	 */
	updateLEDDisplaySize() {
		if (!this.ledGroup) return;
		
		// Recalculate the total height for LED placement
		const totalHeight = this.height * 0.95;
		
		// Adjust dot spacing to fill the display area
		const adjustedDotSpacing = Math.min(
			this.width * 0.98 / this.dotCols,
			totalHeight / this.dotRows
		) * 1.3;
		
		// Calculate start positions to center the display
		const startX = -(this.width * 0.98) / 2 + adjustedDotSpacing / 2;
		const startY = -totalHeight / 2 + adjustedDotSpacing / 2;
		
		// Update dot positions based on new height
		for (let row = 0; row < this.dotRows; row++) {
			for (let col = 0; col < this.dotCols; col++) {
				const dot = this.dots[row][col];
				if (dot) {
					dot.position.x = startX + col * adjustedDotSpacing;
					dot.position.y = startY + row * adjustedDotSpacing;
				}
			}
		}
		
		// Center the LED group in the scoreboard
		this.ledGroup.position.set(0, 0, 0);
	}
	
	/**
	 * Toggle visibility of the scoreboard
	 */
	toggleVisibility() {
		this.isVisible = !this.isVisible;
		this.scoreboardGroup.visible = this.isVisible;
	}
	
	/**
	 * Sync jets with their corresponding bolts and detect movement
	 * This ensures jets always follow bolts and fire when bolts move
	 */
	syncJetsWithBolts() {
		// Skip if we don't have jets or bolts
		if (!this.jets || !this.jets.length || !this.cornerBolts || !this.cornerBolts.length) {
			return;
		}
		
		// For each jet, find its bolt and update position
		this.jets.forEach((jet, index) => {
			const bolt = this.cornerBolts.find(b => b.userData.cornerIndex === index);
			if (bolt) {
				// Store previous position to detect movement
				const previousPosition = jet.basePosition.clone();
				
				// Update jet position to match bolt
				jet.basePosition.copy(bolt.position);
				
				// Calculate movement and activate jets if significant
				const movement = new THREE.Vector3().subVectors(jet.basePosition, previousPosition);
				const movementMagnitude = movement.length();
				
				// If movement is significant, emit particles
				if (movementMagnitude > 0.01) {
					const direction = movement.clone().normalize().multiplyScalar(-1);
					// Intensity based on movement magnitude
					const intensity = Math.min(1.5, movementMagnitude * 10);
					
					// Emit more particles for larger movements
					const particleCount = Math.ceil(intensity * 5);
					for (let i = 0; i < particleCount; i++) {
						this.emitJetParticle(jet, direction, intensity);
					}
					
					// Update last movement time
					this.lastMovementTime = performance.now();
				}
			}
		});
	}
	
	/**
	 * Update the display - called each frame
	 */
	update(deltaTime) {
		if (!this.isVisible) return;
		
		// First sync jets with bolts and detect movement
		this.syncJetsWithBolts();
		
		// Force more consistent fading by always updating jets
		this.jets.forEach(jet => {
			this.updateJetParticles(jet, deltaTime || 1/60);
		});
		
		// Clear display first
		for (let row = 0; row < this.dotRows; row++) {
			for (let col = 0; col < this.dotCols; col++) {
				this.setDotColor(row, col, 'off');
			}
		}
		
		// If no data yet, show loading message
		if (!this.displayData || this.displayData.length === 0) {
			// Show "LOADING" text in bright white in the center
			this.drawText("LOADING DATA", Math.floor(this.dotRows/2) - 2, Math.floor(this.dotCols/2) - 20, 'white');
			
			// Add a line of dots below that cycles for animation
			const time = Date.now();
			const dotCount = Math.floor((time % 1500) / 300) + 1; // 1-5 dots cycling
			let dots = "";
			for (let i = 0; i < dotCount; i++) {
				dots += ".";
			}
			this.drawText(dots, Math.floor(this.dotRows/2) * 1.2 + 3, Math.floor(this.dotCols/2) * 1.2 - 3, 'cyan');
			
			// Try to use the sample data if we've been loading too long (over 3 seconds)
			if (!this._loadAttempted && time - this.lastUpdateTime > 3000) {
				this.updateTokenData([]);  // This will use the sample data
				this._loadAttempted = true;
			}
			return;
		}
		
		// Calculate total content height (in rows)
		const totalContentHeight = this.displayData.length * 12; // Each token takes 12 rows
		const scrollGap = 10; // Gap in rows before content loops again
		const totalScrollHeight = totalContentHeight + scrollGap;
		
		// Check if content exceeds display height
		if (totalContentHeight > this.dotRows) {
			// Update scroll position for vertical scrolling
			this.scrollPosition += this.scrollSpeed * deltaTime * 60; // Adjust speed based on deltaTime
			
			// Reset scroll position to loop content after gap
			if (this.scrollPosition >= totalScrollHeight) {
				this.scrollPosition = 0;
			}
			
			// Draw tokens with vertical offset based on scroll position
			for (let i = 0; i < this.displayData.length; i++) {
				let rowOffset = i * 12 - Math.floor(this.scrollPosition);
				if (rowOffset < -12) {
					// If the token is above the visible area, try to wrap it to the bottom after the gap
					rowOffset += totalScrollHeight;
				}
				if (rowOffset >= -12 && rowOffset < this.dotRows) {
					this.drawTokenInfo(i, rowOffset);
				}
			}
		} else {
			// Draw all tokens dynamically based on available space
			const tokenSpacing = Math.floor(this.dotRows / this.displayData.length);
			for (let i = 0; i < this.displayData.length; i++) {
				if (i * tokenSpacing < this.dotRows) {
					this.drawTokenInfo(i, i * tokenSpacing);
				}
			}
		}
	}
	
	/**
	 * Create visually attractive buttons with clear text
	 */
	createButtons() {
		// Create expand button (up arrow - visible initially)
		this.expandButton = new THREE.Group();
		this.expandButton.position.set(-this.width/4, -this.height/2 - 1.2, 0.2);
		this.expandButton.userData = { isButton: true, action: 'expand' };
		this.expandButton.visible = true;
		this.scoreboardGroup.add(this.expandButton);
		
		// Create collapse/back button (down arrow - visible initially)
		this.collapseButton = new THREE.Group();
		this.collapseButton.position.set(this.width/4, -this.height/2 - 1.2, 0.2);
		this.collapseButton.userData = { isButton: true, action: 'collapse' };
		this.collapseButton.visible = true;
		this.scoreboardGroup.add(this.collapseButton);
		
		// Create planet-like button graphics
		const planetRadius = 0.5;
		const planetGeometry = new THREE.SphereGeometry(planetRadius, 32, 32);
		
		// Expand button as a green planet with up arrow
		this.expandPlanetMaterial = new THREE.MeshBasicMaterial({
			color: 0x00aa00,
			transparent: true,
			opacity: 0.9
		});
		const expandPlanet = new THREE.Mesh(planetGeometry, this.expandPlanetMaterial);
		this.expandButton.add(expandPlanet);
		
		// Collapse button as a red planet with down arrow
		this.collapsePlanetMaterial = new THREE.MeshBasicMaterial({
			color: 0xaa0000,
			transparent: true,
			opacity: 0.9
		});
		const collapsePlanet = new THREE.Mesh(planetGeometry, this.collapsePlanetMaterial);
		this.collapseButton.add(collapsePlanet);
		
		// Add glowing ring around planets
		const ringGeometry = new THREE.RingGeometry(planetRadius * 1.1, planetRadius * 1.3, 32);
		const ringMaterial = new THREE.MeshBasicMaterial({
			color: 0xaaaaaa,
			transparent: true,
			opacity: 0.5,
			side: THREE.DoubleSide
		});
		const expandRing = new THREE.Mesh(ringGeometry, ringMaterial);
		expandRing.rotation.x = Math.PI / 2;
		expandRing.position.z = 0.1;
		this.expandButton.add(expandRing);
		
		const collapseRing = new THREE.Mesh(ringGeometry, ringMaterial);
		collapseRing.rotation.x = Math.PI / 2;
		collapseRing.position.z = 0.1;
		this.collapseButton.add(collapseRing);
		
		// Create arrow indicators on planets
		this.createArrowIndicator(this.expandButton, 'up', 0xffffff);
		this.createArrowIndicator(this.collapseButton, 'down', 0xffffff);
		
		console.log("Buttons created - Expand visible:", this.expandButton.visible, "Collapse visible:", this.collapseButton.visible);
	}
	
	/**
	 * Create arrow indicator on planet buttons
	 */
	createArrowIndicator(buttonGroup, direction, color) {
		const arrowSize = 0.3;
		const arrowGeometry = new THREE.BufferGeometry();
		const positions = new Float32Array([
			-arrowSize, 0, 0.1,
			arrowSize, 0, 0.1,
			0, direction === 'up' ? arrowSize * 1.5 : -arrowSize * 1.5, 0.1
		]);
		arrowGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		const arrowMaterial = new THREE.MeshBasicMaterial({
			color: color,
			transparent: true,
			opacity: 0.9
		});
		const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
		buttonGroup.add(arrow);
	}
	
	/**
	 * Determine button positioning based on size mode
	 */
	updateButtonPositions() {
		// Determine button positioning based on size mode
		if (this.sizeMode === 'hidden') {
			// In hidden mode, move buttons further down and closer together
			const buttonOffset = Math.max(1.5, this.height/2 + 1.5); // Ensure they're visible even when height is 0
			this.expandButton.position.set(-1.0, -buttonOffset, 0.2);
			this.collapseButton.position.set(1.0, -buttonOffset, 0.2);
		} else {
			// Normal positioning for other modes
			this.expandButton.position.set(-this.width/4, -this.height/2 - 1.2, 0.2);
			this.collapseButton.position.set(this.width/4, -this.height/2 - 1.2, 0.2);
		}
	}
} 