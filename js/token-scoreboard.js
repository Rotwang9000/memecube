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
		this.expanded = false;
		this.updateInterval = 30000; // Update every 30 seconds
		this.lastUpdateTime = 0;
		
		// Fixed screen position (left corner - moved more to the right and up)
		this.screenPosition = { x: -0.6, y: -0.7 }; // Adjusted from -0.8, -0.8
		
		// Scoreboard dimensions (smaller size to fit better)
		this.width = 15;
		this.height = 8;
		this.dotSize = 0.05;  // Size of each LED dot
		this.dotSpacing = 0.1; // Spacing between dots
		this.dotRows = 32;    // Number of dot rows
		this.dotCols = 64;    // Number of dot columns
		
		// Token display settings
		this.maxTokensToShow = 5;
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
			red: new THREE.Color(0xff3030),
			green: new THREE.Color(0x30ff30),
			blue: new THREE.Color(0x3030ff),
			yellow: new THREE.Color(0xffff30),
			cyan: new THREE.Color(0x30ffff),
			magenta: new THREE.Color(0xff30ff),
			white: new THREE.Color(0xffffff),
			off: new THREE.Color(0x202020)
		};
		
		// Create the scoreboard mesh
		this.scoreboardGroup = new THREE.Group();
		this.jetsGroup = new THREE.Group();
		this.scoreboardGroup.add(this.jetsGroup);
		
		this.createScoreboardStructure();
		this.createLEDDisplay();
		
		// Create back button (initially hidden)
		this.createBackButton();
		
		// Create corner jets
		this.createCornerJets();
		
		// Add to scene
		this.scene.add(this.scoreboardGroup);
		
		// Update position initially
		this.updateScreenPosition();
		this.lastPosition.copy(this.scoreboardGroup.position);
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
		});
		
		const frame = new THREE.Mesh(frameGeometry, frameMaterial);
		frame.position.z = -0.2;
		this.scoreboardGroup.add(frame);
		
		// Create display background (black)
		const displayGeometry = new THREE.BoxGeometry(this.width, this.height, 0.1);
		const displayMaterial = new THREE.MeshStandardMaterial({
			color: 0x000000,
			metalness: 0.5,
			roughness: 0.2,
			emissive: 0x111111,
		});
		
		const display = new THREE.Mesh(displayGeometry, displayMaterial);
		display.position.z = -0.05;
		this.scoreboardGroup.add(display);
		
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
			[this.width/2 + 0.1, this.height/2 + 0.1, 0],
			[-this.width/2 - 0.1, -this.height/2 - 0.1, 0],
			[this.width/2 + 0.1, -this.height/2 - 0.1, 0]
		];
		
		cornerPositions.forEach(pos => {
			const bolt = new THREE.Mesh(boltGeometry, boltMaterial);
			bolt.position.set(pos[0], pos[1], 0);
			bolt.rotation.x = Math.PI / 2;
			this.scoreboardGroup.add(bolt);
		});
		
		// Add a small "LIVE TOKENS" label at the bottom
		const labelGeometry = new THREE.PlaneGeometry(3, 0.6);
		const labelMaterial = new THREE.MeshStandardMaterial({
			color: 0x222266,
			metalness: 0.7,
			roughness: 0.3,
			emissive: 0x000033,
		});
		
		const label = new THREE.Mesh(labelGeometry, labelMaterial);
		label.position.set(0, -this.height/2 - 0.4, 0);
		this.scoreboardGroup.add(label);
		
		// Add text to the label
		const loader = new FontLoader();
		loader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', 
			// Success callback
			(font) => {
				const textGeometry = new TextGeometry('LIVE TOKENS', {
					font: font,
					size: 0.3,
					height: 0.02,
					curveSegments: 3,
					bevelEnabled: false
				});
				
				textGeometry.computeBoundingBox();
				const textWidth = textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x;
				
				const textMaterial = new THREE.MeshStandardMaterial({
					color: 0xffffff,
					emissive: 0x3333ff,
					emissiveIntensity: 0.5
				});
				
				const textMesh = new THREE.Mesh(textGeometry, textMaterial);
				textMesh.position.set(-textWidth/2, -0.15, 0.01);
				label.add(textMesh);
			},
			// Progress callback
			(xhr) => {
				console.log(`Font ${(xhr.loaded / xhr.total * 100)}% loaded`);
			},
			// Error callback
			(err) => {
				console.error('An error happened during font loading:', err);
			}
		);
	}
	
	/**
	 * Create back button for when scoreboard is expanded
	 */
	createBackButton() {
		const buttonMaterial = new THREE.MeshStandardMaterial({
			color: 0x3366ff,
			metalness: 0.7,
			roughness: 0.3,
			emissive: 0x001133,
		});
		
		const buttonGeometry = new THREE.BoxGeometry(2, 0.6, 0.1);
		this.backButton = new THREE.Mesh(buttonGeometry, buttonMaterial);
		this.backButton.position.set(0, -this.height/2 - 0.8, 0);
		this.backButton.visible = false; // Initially hidden
		this.backButton.userData = { isButton: true, action: 'back' };
		this.scoreboardGroup.add(this.backButton);
		
		// Add text to button
		const loader = new FontLoader();
		loader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', (font) => {
			const textGeometry = new TextGeometry('BACK', {
				font: font,
				size: 0.3,
				height: 0.05,
				curveSegments: 3,
				bevelEnabled: false
			});
			
			textGeometry.computeBoundingBox();
			const textWidth = textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x;
			
			const textMaterial = new THREE.MeshStandardMaterial({
				color: 0xffffff,
				emissive: 0xffffff,
				emissiveIntensity: 0.5
			});
			
			const textMesh = new THREE.Mesh(textGeometry, textMaterial);
			textMesh.position.set(-textWidth/2, -0.15, 0.06);
			this.backButton.add(textMesh);
		});
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
			{ x: this.width/2 + 0.2, y: this.height/2 + 0.2, z: 0 },
			{ x: -this.width/2 - 0.2, y: -this.height/2 - 0.2, z: 0 },
			{ x: this.width/2 + 0.2, y: -this.height/2 - 0.2, z: 0 }
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
	 */
	activateJets(movement) {
		// Normalize the movement direction
		const moveDir = movement.clone().normalize();
		
		// Record the time of last movement
		this.lastMovementTime = performance.now();
		
		// Go through each jet
		this.jets.forEach((jet, index) => {
			const cornerVector = jet.basePosition.clone().normalize();
			
			// Determine jet activation based on direction
			// Jets opposite to movement direction should fire
			const activation = -cornerVector.dot(moveDir);
			
			if (activation > 0.1) {
				// Emit new particles
				const particleCount = Math.ceil(activation * 10);
				for (let i = 0; i < particleCount; i++) {
					this.emitJetParticle(jet, moveDir, activation);
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
		
		// Set lifetime - make last longer for better fade
		particle.life = 2.0 + Math.random() * 1.0;
		particle.maxLife = particle.life;
		
		// Set initial position (at jet base with small random offset)
		const positions = jet.geometry.attributes.position.array;
		positions[particleIndex * 3] = jet.basePosition.x + (Math.random() - 0.5) * 0.1;
		positions[particleIndex * 3 + 1] = jet.basePosition.y + (Math.random() - 0.5) * 0.1;
		positions[particleIndex * 3 + 2] = jet.basePosition.z + (Math.random() - 0.5) * 0.1;
		
		// Set velocity - opposite to movement direction with randomness
		const oppositeDir = moveDir.clone().multiplyScalar(-1);
		particle.velocity.copy(oppositeDir)
			.multiplyScalar(0.05 + Math.random() * 0.08 * intensity)
			.add(new THREE.Vector3(
				(Math.random() - 0.5) * 0.02,
				(Math.random() - 0.5) * 0.02,
				(Math.random() - 0.5) * 0.02
			));
		
		// Update colors based on intensity
		const colors = jet.geometry.attributes.color.array;
		colors[particleIndex * 3] = 0.2 + Math.random() * 0.3;     // R
		colors[particleIndex * 3 + 1] = 0.5 + Math.random() * 0.5; // G
		colors[particleIndex * 3 + 2] = 0.8 + Math.random() * 0.2; // B
		
		// Set opacity to full
		const opacities = jet.geometry.attributes.opacity.array;
		opacities[particleIndex] = 1.0;
		
		// Mark attributes as needing update
		jet.geometry.attributes.position.needsUpdate = true;
		jet.geometry.attributes.color.needsUpdate = true;
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
		// Container for all LED dots
		this.ledGroup = new THREE.Group();
		this.scoreboardGroup.add(this.ledGroup);
		
		// Create dot instances for better performance
		// Significantly increased size for better visibility
		const dotGeometry = new THREE.CircleGeometry(0.12, 16); // More detailed circles
		
		// Create materials for each color state - significantly increased brightness
		this.dotMaterials = {};
		Object.entries(this.colors).forEach(([name, color]) => {
			// Make colors more vibrant
			const enhancedColor = color.clone().multiplyScalar(name === 'off' ? 1 : 2.0);
			
			this.dotMaterials[name] = new THREE.MeshBasicMaterial({
				color: enhancedColor,
				emissive: enhancedColor,
				emissiveIntensity: name === 'off' ? 0.1 : 3.0, // Significantly increased
				blending: THREE.AdditiveBlending
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
		);
		
		// Recalculate dot size based on spacing - make dots cover almost the entire space
		this.dotSize = this.dotSpacing * 0.95; // Increased from 0.9
		
		// Calculate start positions to center the display
		const startX = -totalWidth / 2 + this.dotSpacing / 2;
		const startY = -totalHeight / 2 + this.dotSpacing / 2;
		
		// Create all LED dots
		for (let row = 0; row < this.dotRows; row++) {
			for (let col = 0; col < this.dotCols; col++) {
				const dot = new THREE.Mesh(dotGeometry, this.dotMaterials.off);
				
				// Position the dot
				dot.position.x = startX + col * this.dotSpacing;
				dot.position.y = startY + row * this.dotSpacing;
				dot.position.z = 0.05; // Slightly in front of the display
				
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
		this.addLEDGlowEffect(totalWidth, totalHeight);
	}
	
	/**
	 * Add a subtle glow effect behind the LED display for better contrast
	 */
	addLEDGlowEffect(width, height) {
		const glowGeometry = new THREE.PlaneGeometry(width * 1.02, height * 1.02);
		const glowMaterial = new THREE.MeshBasicMaterial({
			color: 0x001133,
			transparent: true,
			opacity: 0.5,
			blending: THREE.AdditiveBlending
		});
		
		const glow = new THREE.Mesh(glowGeometry, glowMaterial);
		glow.position.z = -0.05; // Behind the dots
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
				dot.scale.set(this.dotSize * 1.15, this.dotSize * 1.15, 1);
			} else {
				dot.scale.set(this.dotSize, this.dotSize, 1);
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
		const textHeight = 5;
		
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
			currentCol += 5; // Increased from 4 for better readability
		}
		
		// Return the ending column position
		return currentCol;
	}
	
	/**
	 * Update the token data displayed on the scoreboard
	 * @param {Array} tokens - Array of token data objects
	 */
	updateTokenData(tokens) {
		this.displayData = tokens.slice(0, this.maxTokensToShow).map(token => {
			return {
				symbol: token.baseToken?.symbol || token.tokenAddress.substring(0, 6),
				price: token.priceUsd || "0",
				change: token.priceChange?.h24 || 0
			};
		});
		
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
		
		// Add separator
		currentCol += 2;
		
		// Format price (limit to sensible precision)
		let priceText = "";
		const price = parseFloat(token.price);
		if (price >= 100) {
			priceText = price.toFixed(2);
		} else if (price >= 1) {
			priceText = price.toFixed(4);
		} else if (price >= 0.01) {
			priceText = price.toFixed(6);
		} else {
			priceText = price.toExponential(2);
		}
		
		// Draw price in yellow
		currentCol = this.drawText('$' + priceText, row + 5, 2, 'yellow');
		
		// Draw change percentage
		const change = token.change;
		const changeColor = change >= 0 ? 'green' : 'red';
		const changeChar = change >= 0 ? '+' : '-';
		const changeText = changeChar + Math.abs(change).toFixed(2) + '%';
		
		this.drawText(changeText, row + 5, Math.floor(this.dotCols/2) + 5, changeColor);
	}
	
	/**
	 * Update the screen position of the scoreboard
	 */
	updateScreenPosition() {
		if (!this.camera) return;

		// Keep track of previous position for movement detection
		const prevPosition = this.scoreboardGroup.position.clone();
		
		// Calculate position directly based on field of view
		const fov = this.camera.fov * Math.PI / 180;
		const distance = 10; // Fixed distance from camera
		const height = 2 * Math.tan(fov / 2) * distance;
		const width = height * this.camera.aspect;
		
		// Get camera quaternion for orientation
		const quaternion = this.camera.quaternion;
		
		// Create camera-oriented coordinate system
		const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);
		const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
		const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
		
		// Position relative to camera
		const pos = this.camera.position.clone()
			.add(forward.clone().multiplyScalar(distance))
			.add(right.clone().multiplyScalar(this.screenPosition.x * width / 2))
			.add(up.clone().multiplyScalar(this.screenPosition.y * height / 2));
		
		// Set position
		this.scoreboardGroup.position.copy(pos);
		
		// Always face the camera directly to fix text orientation issues
		// This looks directly at the camera to ensure text is readable
		this.scoreboardGroup.lookAt(this.camera.position);
		
		// Correction for the lookAt method which causes text to be mirrored
		// Rotate 180 degrees around the up vector to correct orientation
		this.scoreboardGroup.rotateOnAxis(up, Math.PI);
		
		// Scale - smaller when not expanded
		const scale = this.expanded ? 0.7 : 0.3;
		this.scoreboardGroup.scale.set(scale, scale, scale);
		
		// Check if there was significant movement
		const movement = new THREE.Vector3().subVectors(this.scoreboardGroup.position, this.lastPosition);
		if (movement.length() > this.movementThreshold) {
			this.activateJets(movement);
			this.lastPosition.copy(this.scoreboardGroup.position);
		}
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
			
			// Check if the object or its parent has button data
			while (obj && !obj.userData?.isButton) {
				obj = obj.parent;
			}
			
			if (obj?.userData?.isButton) {
				if (obj.userData.action === 'back' && this.expanded) {
					this.toggleExpanded();
					return true;
				}
				
				if (obj.userData.action === 'expand') {
					// Get current camera position
					const currentCameraPos = new THREE.Vector3();
					currentCameraPos.copy(this.camera.position);
					
					// Get target position (slightly in front of scoreboard)
					const targetPosition = new THREE.Vector3();
					targetPosition.copy(this.scoreboardGroup.position);
					
					// Get direction from camera to scoreboard
					const direction = new THREE.Vector3();
					direction.subVectors(targetPosition, currentCameraPos).normalize();
					
					// Move camera position to be 8 units away from scoreboard in that direction
					targetPosition.sub(direction.multiplyScalar(8));
					
					// Smoothly move camera
					this.flyToPosition(this.camera, targetPosition, 1000);
					
					this.toggleExpanded();
					return true;
				}
			}
		}
		
		return false;
	}
	
	/**
	 * Fly the camera to a specified position
	 * @param {THREE.Camera} camera - The camera to move
	 * @param {THREE.Vector3} targetPosition - The position to fly to
	 * @param {number} duration - Duration of flight in milliseconds
	 */
	flyToPosition(camera, targetPosition, duration) {
		const startPosition = camera.position.clone();
		const startTime = performance.now();
		
		// Try to get controls to disable during animation
		const controls = window.memeCube?.controls;
		if (controls) {
			controls.disableControls();
		}
		
		const animate = (currentTime) => {
			const elapsed = currentTime - startTime;
			const progress = Math.min(elapsed / duration, 1);
			
			// Use ease-in-out function for smoother movement
			const t = progress < 0.5
				? 2 * progress * progress
				: 1 - Math.pow(-2 * progress + 2, 2) / 2;
			
			// Interpolate position
			camera.position.lerpVectors(startPosition, targetPosition, t);
			
			// Make sure camera is looking at the scoreboard
			camera.lookAt(this.scoreboardGroup.position);
			
			// Continue animation if not complete
			if (progress < 1) {
				requestAnimationFrame(animate);
			} else {
				// Re-enable controls when animation is complete
				if (controls) {
					controls.enableControls();
				}
			}
		};
		
		requestAnimationFrame(animate);
	}
	
	/**
	 * Toggle expanded state
	 */
	toggleExpanded() {
		this.expanded = !this.expanded;
		this.backButton.visible = this.expanded;
		return this.expanded;
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
		
		// Update screen position to follow camera
		this.updateScreenPosition();
		
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
		if (this.displayData.length === 0) {
			// Show "LOADING" text in bright white in the center
			this.drawText("LOADING DATA", Math.floor(this.dotRows/2) - 2, Math.floor(this.dotCols/2) - 20, 'white');
			
			// Add a line of dots below that cycles for animation
			const time = Date.now();
			const dotCount = Math.floor((time % 1500) / 300) + 1; // 1-5 dots cycling
			let dots = "";
			for (let i = 0; i < dotCount; i++) {
				dots += ".";
			}
			this.drawText(dots, Math.floor(this.dotRows/2) + 3, Math.floor(this.dotCols/2) - 3, 'cyan');
			return;
		}
		
		// Draw each token's info
		for (let i = 0; i < Math.min(this.displayData.length, 5); i++) {
			this.drawTokenInfo(i, i * 6 + 1);
		}
	}
} 