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
		
		// Fixed screen position (left corner - moved more to the right and up)
		this.screenPosition = { x: -0.6, y: -0.7 }; // Adjusted from -0.8, -0.8
		
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
		console.log("Window resized, updating scoreboard position");
		this._updateScreenPosition();
	}
	
	/**
	 * Update the scoreboard position to match the screen position
	 * Public method that delegates to private _updateScreenPosition
	 */
	updateScreenPosition() {
		
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
		
		cornerPositions.forEach(pos => {
			const bolt = new THREE.Mesh(boltGeometry, boltMaterial);
			bolt.position.set(pos[0], pos[1], 0);
			bolt.rotation.x = Math.PI / 2;
			this.scoreboardGroup.add(bolt);
		});
		
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
	 * Create jet emitters at each corner
	 */
	createCornerJets() {
		// Create shared star texture
		const starTexture = this.createStarTexture();
		
		// Jet positions (4 corners)
		const jetPositions = [
			{ x: -this.width/2 - 0.2, y: this.height/2 + 0.2, z: 0 },
			{ x: this.width/2 + 2.2, y: this.height/2 + 0.2, z: 0 },
			{ x: -this.width/2 - 0.2, y: -this.height/2 - 0.2, z: 0 },
			{ x: this.width/2 + 2.2, y: -this.height/2 - 0.2, z: 0 }
		];
		
		// Create each jet
		jetPositions.forEach(pos => {
			// Create geometry for jet particles
			const particleCount = 100; // More particles for better effect
			const jetGeometry = new THREE.BufferGeometry();
			const positions = new Float32Array(particleCount * 3);
			const colors = new Float32Array(particleCount * 3);
			const sizes = new Float32Array(particleCount);
			const opacities = new Float32Array(particleCount); // Add opacity attribute
			
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
			
			// Store jet data for animation
			this.jets.push({
				system: jetSystem,
				geometry: jetGeometry,
				basePosition: new THREE.Vector3(pos.x, pos.y, pos.z),
				particles: Array(particleCount).fill().map(() => ({
					life: 0,
					maxLife: 0,
					velocity: new THREE.Vector3()
				}))
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
			opacity: 1.0,
			blending: THREE.AdditiveBlending,
			side: THREE.DoubleSide
		});
		
		const glow = new THREE.Mesh(glowGeometry, glowMaterial);
		glow.position.z = -0.29; // Just behind the dots on the far side
		this.ledGroup.add(glow);
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
		if (!this.camera) return this.expandedHeight || 20;
		const fovRadians = this.camera.fov * Math.PI / 180;
		const distance = 10; // Same distance used in _updateScreenPosition
		const fullHeight = 2 * Math.tan(fovRadians / 2) * distance;
		return fullHeight * 0.9; // Use 90% of visible height
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
		
		// Get camera quaternion for orientation
		const quaternion = this.camera.quaternion.clone();
		
		// Create camera-oriented coordinate system
		const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);
		const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
		const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
		
		// Adjust screen position based on size mode
		if (this.sizeMode === 'tall') {
			// Center vertically in tall mode
			this.screenPosition.y = 0; 
		} else {
			// Bottom left for normal and hidden modes
			this.screenPosition.y = -0.7; 
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
			this.animateMovement(targetPos, targetQuaternion);
			
			// Only activate non-top jets during general scoreboard movement
			this.activateJets(movement.clone(), true);
			this.lastPosition.copy(this.scoreboardGroup.position);
		} else {
			// Just set position directly for small adjustments
			this.scoreboardGroup.position.copy(targetPos);
			
			// Set rotation
			this.scoreboardGroup.quaternion.copy(targetQuaternion);
			
			// Add a rotation to fix the upside-down text
			this.scoreboardGroup.rotateZ(Math.PI);
			this.scoreboardGroup.rotateY(Math.PI); // Face the camera
			
			// Keep consistent scale
			const scale = 0.3;
			this.scoreboardGroup.scale.set(scale, scale, scale);
		}
		
		// Update visibility based on size mode
		this.scoreboardGroup.visible = true; // Always visible, but may be faded in hidden mode
	}
	
	/**
	 * Animate the scoreboard flying to a new position
	 * @param {THREE.Vector3} targetPos - Target position to move to
	 * @param {THREE.Quaternion} targetQuaternion - Target rotation
	 */
	animateMovement(targetPos, targetQuaternion) {
		// Set flag that we're currently moving
		this.isMoving = true;
		this.movementStartTime = performance.now();
		
		// Store starting position and rotation
		const startPosition = this.scoreboardGroup.position.clone();
		this.movementStartQuaternion.copy(this.scoreboardGroup.quaternion);
		this.targetQuaternion = targetQuaternion.clone();
		
		// Get movement direction vector for jet effects
		const moveDir = new THREE.Vector3().subVectors(targetPos, startPosition);
		
		// Properly rotate target quaternion for text orientation
		const rotZ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
		const rotY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
		this.targetQuaternion.multiply(rotZ).multiply(rotY);
		
		// Start time for jet effect timing
		const jetStartTime = performance.now();
		let lastJetTime = jetStartTime;
		
		// Animate top jets to top of window in tall mode
		if (this.sizeMode === 'tall' && this.jets.length >= 2) {
			const topJet1 = this.jets[0];
			const topJet2 = this.jets[1];
			const topHeight = this.height / 2 + 0.2;
			topJet1.basePosition.y = topHeight;
			topJet2.basePosition.y = topHeight;
		}
		
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
			
			// Set scale - consistent scale
			const scale = 0.3;
			this.scoreboardGroup.scale.set(scale, scale, scale);
			
			// Continuously emit jet particles during flight
			// But limit how often we spawn new particles to avoid overdoing it
			if (currentTime - lastJetTime > 100) { // Emit every 100ms
				// Calculate current velocity as a Vector3
				const currentVelocity = new THREE.Vector3().copy(moveDir).multiplyScalar(
					// More at beginning and end of animation
					(progress < 0.3 || progress > 0.7) ? 0.02 : 0.01
				);
				this.activateJets(currentVelocity, true);
				lastJetTime = currentTime;
			}
			
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
		
		// Animate the top jets for the tall mode - do this BEFORE changing height
		if ((this.sizeMode === 'tall' || previousMode === 'tall') && this.jets.length >= 4) {
			// Only move the top jets (index 0 and 1) to the top of the window
			this.animateTopJetsToWindowTop();
		}
		
		// Update height based on mode - AFTER we've started the jet animation
		if (this.sizeMode === 'tall') {
			this.height = this.computeExpandedHeight();
			console.log("Expanded height computed as:", this.height);
		} else if (this.sizeMode === 'normal') {
			this.height = 8;
		} else if (this.sizeMode === 'hidden') {
			this.height = 8; // Keep same size, but will be faded out
		}
		
		// Make opacity changes for hidden mode
		if (this.sizeMode === 'hidden') {
			// Fade out the scoreboard
			this.scoreboardGroup.traverse(obj => {
				if (obj.material && obj.material.opacity !== undefined) {
					obj.material.transparent = true;
					// Preserve original opacity or create a new one
					if (obj.userData.originalOpacity === undefined) {
						obj.userData.originalOpacity = obj.material.opacity;
					}
					obj.material.opacity = obj.userData.originalOpacity * 0.3;
				}
			});
		} else {
			// Restore original opacity
			this.scoreboardGroup.traverse(obj => {
				if (obj.material && obj.material.opacity !== undefined && obj.userData.originalOpacity !== undefined) {
					obj.material.opacity = obj.userData.originalOpacity;
				}
			});
		}
		
		// Update dimensions (frame, background, LED rows, jets, etc.)
		this.updateScoreboardDimensions();
		
		// Update display dot placement
		this.updateLEDDisplaySize();
		
		// Re-position the scoreboard in screen space
		this._updateScreenPosition();
	}
	
	/**
	 * Animate the top jets to fly to the top of the window when expanding
	 */
	animateTopJetsToWindowTop() {
		// Only the top jets need to move
		const topLeftJet = this.jets[0];
		const topRightJet = this.jets[1];
		
		// Make sure we have the jets
		if (!topLeftJet || !topRightJet) {
			console.error("Top jets not found for animation");
			return;
		}
		
		// Original positions to store for return journey
		if (!topLeftJet.userData) topLeftJet.userData = {};
		if (!topRightJet.userData) topRightJet.userData = {};
		
		// Store original positions if not already stored
		if (!topLeftJet.userData.originalY) {
			console.log("Storing original jet positions");
			topLeftJet.userData.originalY = topLeftJet.basePosition.y;
			topRightJet.userData.originalY = topRightJet.basePosition.y;
			topLeftJet.userData.originalX = topLeftJet.basePosition.x;
			topRightJet.userData.originalX = topRightJet.basePosition.x;
		}
		
		// Calculate view height to position jets at top edge
		const fov = this.camera.fov * Math.PI / 180;
		const distance = 10;
		const viewHeight = 2 * Math.tan(fov / 2) * distance;
		const viewWidth = viewHeight * this.camera.aspect;
		
		// Calculate target positions for a dramatic spread at the top
		// Target Y position for top jets (near top of screen)
		const topYPosition = viewHeight * 0.45; // Near top of screen
		
		// For X, keep the spacing proportional to screen width
		const leftXPosition = -viewWidth * 0.35; // Left side
		const rightXPosition = viewWidth * 0.35; // Right side
		
		// Animation duration
		const duration = 1200; // 1.2 seconds for a more dramatic effect
		const startTime = performance.now();
		
		// Starting positions
		const startY1 = topLeftJet.basePosition.y;
		const startY2 = topRightJet.basePosition.y;
		const startX1 = topLeftJet.basePosition.x;
		const startX2 = topRightJet.basePosition.x;
		
		// Target positions depend on the mode we're changing to
		const isTallMode = this.sizeMode === 'tall';
		
		// Target Y positions - either fly to top or return to original
		const targetY1 = isTallMode ? topYPosition : topLeftJet.userData.originalY;
		const targetY2 = isTallMode ? topYPosition : topRightJet.userData.originalY;
		
		// Target X positions - spread wider at top or return to original
		const targetX1 = isTallMode ? leftXPosition : topLeftJet.userData.originalX;
		const targetX2 = isTallMode ? rightXPosition : topRightJet.userData.originalX;
		
		console.log("Animating top jets from", startY1, "to", targetY1);
		
		// Create a more dramatic fly effect
		const animate = (timestamp) => {
			const elapsed = timestamp - startTime;
			const progress = Math.min(elapsed / duration, 1);
			
			// Use an easing function for smoother animation
			const easedProgress = this.easeInOutQuad(progress);
			
			// Update jet positions - both Y and X for a more dramatic effect
			topLeftJet.basePosition.y = startY1 + (targetY1 - startY1) * easedProgress;
			topRightJet.basePosition.y = startY2 + (targetY2 - startY2) * easedProgress;
			
			// If going to tall mode, also animate X positions for a wider spread
			if (isTallMode || this.sizeMode === 'normal') {
				topLeftJet.basePosition.x = startX1 + (targetX1 - startX1) * easedProgress;
				topRightJet.basePosition.x = startX2 + (targetX2 - startX2) * easedProgress;
			}
			
			// Emit particles to create a trail effect
			const dirY = isTallMode ? 1 : -1; // Up for tall, down for normal
			this.emitJetTrail(topLeftJet, new THREE.Vector3(isTallMode ? -0.5 : 0, dirY, 0));
			this.emitJetTrail(topRightJet, new THREE.Vector3(isTallMode ? 0.5 : 0, dirY, 0));
			
			// Continue animation if not complete
			if (progress < 1) {
				requestAnimationFrame(animate);
			} else {
				// When animation finishes, update bottom jets positions if in tall mode
				if (isTallMode && this.jets.length >= 4) {
					// Update bottom jets to stay at bottom of expanded scoreboard
					const bottomLeftJet = this.jets[2];
					const bottomRightJet = this.jets[3];
					
					if (bottomLeftJet && bottomRightJet) {
						// Store original positions if needed
						if (!bottomLeftJet.userData) bottomLeftJet.userData = {};
						if (!bottomRightJet.userData) bottomRightJet.userData = {};
						
						if (!bottomLeftJet.userData.originalY) {
							bottomLeftJet.userData.originalY = bottomLeftJet.basePosition.y;
							bottomRightJet.userData.originalY = bottomRightJet.basePosition.y;
						}
						
						// Position at bottom of expanded scoreboard
						bottomLeftJet.basePosition.y = -this.height/2 - 0.2;
						bottomRightJet.basePosition.y = -this.height/2 - 0.2;
					}
				}
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
		
		// Update button positions
		this.expandButton.position.set(-this.width/4, -this.height/2 - 1.2, 0.2);
		this.collapseButton.position.set(this.width/4, -this.height/2 - 1.2, 0.2);
		
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
	 * Update the display - called each frame
	 */
	update(deltaTime) {
		if (!this.isVisible) return;
		
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
} 