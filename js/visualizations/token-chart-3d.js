import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
// Import CatmullRomCurve3 directly from THREE instead of as a separate module
// THREE.CatmullRomCurve3 is available directly from the THREE namespace

/**
 * Token Chart Visualization
 * Displays token price data as a curved line formed by stars
 * Fixed position on screen regardless of camera movement
 */
export class TokenChart3D {
	constructor(scene, camera) {
		this.scene = scene;
		this.camera = camera;
		
		// Groups for organization
		this.mainGroup = new THREE.Group();
		this.starsGroup = new THREE.Group();
		this.uiGroup = new THREE.Group();
		this.jetsGroup = new THREE.Group();
		this.chartGroup = new THREE.Group();
		this.isVisible = true;
		this.expanded = false;
		
		// Fixed screen position 
		this.screenPosition = { x: 0.8, y: 0.8 }; // Top right corner
		
		// Chart parameters
		this.chartWidth = 10;
		this.chartHeight = 6;
		this.chartDepth = 2;
		this.maxDataPoints = 25; // Number of data points to show
		this.currentChartData = null;
		
		// Chart emitter jet
		this.emitterJet = null;
		this.emitterSpeed = 0.4;
		this.emitterProgress = 0;
		this.isEmitting = false;
		this.currentStarIndex = 0;
		this.chartCurve = null;
		this.chartPoints = [];
		
		// Star parameters
		this.maxStars = 2000;
		this.starSize = 0.05;
		this.stars = [];
		this.starsGeometry = null;
		this.starsColors = null;
		this.starsSystem = null;
		
		// Jet parameters
		this.jets = [];
		this.lastPosition = new THREE.Vector3();
		this.movementThreshold = 0.05;
		this.jetFadeSpeed = 0.5; // Control how quickly jets fade
		this.lastMovementTime = 0;
		
		// Materials
		this.materials = {
			upStar: new THREE.MeshBasicMaterial({
				color: 0x00ff88,
				transparent: true,
				opacity: 0.8,
				blending: THREE.AdditiveBlending
			}),
			downStar: new THREE.MeshBasicMaterial({
				color: 0xff5555,
				transparent: true,
				opacity: 0.8,
				blending: THREE.AdditiveBlending
			}),
			neutralStar: new THREE.MeshBasicMaterial({
				color: 0xffffff,
				transparent: true,
				opacity: 0.5,
				blending: THREE.AdditiveBlending
			}),
			title: new THREE.MeshBasicMaterial({
				color: 0xffffff,
				transparent: true,
				opacity: 0.9
			}),
			button: new THREE.MeshBasicMaterial({
				color: 0x3366ff,
				transparent: true,
				opacity: 0.8
			}),
			buttonHover: new THREE.MeshBasicMaterial({
				color: 0x44aaff,
				transparent: true,
				opacity: 0.9
			}),
			emitter: new THREE.MeshBasicMaterial({
				color: 0x44ffff,
				transparent: true,
				opacity: 0.9,
				blending: THREE.AdditiveBlending
			}),
			axisLine: new THREE.LineBasicMaterial({
				color: 0x555588,
				transparent: true,
				opacity: 0.5
			})
		};
		
		// Add groups to main group
		this.mainGroup.add(this.chartGroup);
		this.mainGroup.add(this.starsGroup);
		this.mainGroup.add(this.uiGroup);
		this.mainGroup.add(this.jetsGroup);
		
		// Initialize the chart
		this.createChartStructure();
		this.createStarsSystem();
		this.createUI();
		this.createCornerJets();
		
		// Add to scene
		this.scene.add(this.mainGroup);
		
		// Update position initially
		this.updateScreenPosition();
		this.lastPosition.copy(this.mainGroup.position);
		
		// Simulate some sample data for initial display
		this.generateSampleData();
	}
	
	/**
	 * Creates a star-shaped texture for particles
	 */
	createStarTexture() {
		const canvas = document.createElement('canvas');
		canvas.width = 64;  // Increased resolution
		canvas.height = 64; // Increased resolution
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
	 * Create the chart structure with axes and grid
	 */
	createChartStructure() {
		// Create chart box outline
		const boxGeometry = new THREE.BoxGeometry(this.chartWidth, this.chartHeight, this.chartDepth);
		const edgesGeometry = new THREE.EdgesGeometry(boxGeometry);
		const outlineMaterial = new THREE.LineBasicMaterial({ 
			color: 0x6666aa,
			transparent: true,
			opacity: 0.9,
			linewidth: 2
		});
		
		const boxOutline = new THREE.LineSegments(edgesGeometry, outlineMaterial);
		
		// Create chart axes
		const axesHelper = new THREE.Group();
		
		// X-axis (time)
		const xAxisGeometry = new THREE.BufferGeometry();
		xAxisGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
			-this.chartWidth/2, -this.chartHeight/2, 0,
			this.chartWidth/2, -this.chartHeight/2, 0
		], 3));
		const xAxis = new THREE.Line(xAxisGeometry, this.materials.axisLine);
		axesHelper.add(xAxis);
		
		// Y-axis (price)
		const yAxisGeometry = new THREE.BufferGeometry();
		yAxisGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
			-this.chartWidth/2, -this.chartHeight/2, 0,
			-this.chartWidth/2, this.chartHeight/2, 0
		], 3));
		const yAxis = new THREE.Line(yAxisGeometry, this.materials.axisLine);
		axesHelper.add(yAxis);
		
		// Add grid lines for Y-axis (price levels)
		const gridLinesCount = 5;
		for (let i = 1; i < gridLinesCount; i++) {
			const y = -this.chartHeight/2 + (this.chartHeight / gridLinesCount) * i;
			const gridGeometry = new THREE.BufferGeometry();
			gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
				-this.chartWidth/2, y, 0,
				this.chartWidth/2, y, 0
			], 3));
			
			const gridLine = new THREE.Line(gridGeometry, new THREE.LineBasicMaterial({
				color: 0x4444aa,
				transparent: true,
				opacity: 0.4
			}));
			
			axesHelper.add(gridLine);
		}
		
		// Add a semi-transparent background panel for better visibility
		const bgPanelGeometry = new THREE.PlaneGeometry(this.chartWidth, this.chartHeight);
		const bgPanelMaterial = new THREE.MeshBasicMaterial({
			color: 0x000033,
			transparent: true,
			opacity: 0.3,
			side: THREE.DoubleSide
		});
		const bgPanel = new THREE.Mesh(bgPanelGeometry, bgPanelMaterial);
		bgPanel.position.z = -0.1;
		
		// Create emitter jet (the thing that will draw the chart)
		const emitterGeometry = new THREE.ConeGeometry(0.2, 0.4, 8);
		this.emitterJet = new THREE.Mesh(emitterGeometry, this.materials.emitter);
		this.emitterJet.rotation.z = Math.PI / 2; // Point along x-axis
		
		// Add light glow effect to emitter
		const glowGeometry = new THREE.SphereGeometry(0.25, 16, 16);
		const glowMaterial = new THREE.MeshBasicMaterial({
			color: 0x44ffff,
			transparent: true,
			opacity: 0.5,
			blending: THREE.AdditiveBlending
		});
		const glow = new THREE.Mesh(glowGeometry, glowMaterial);
		this.emitterJet.add(glow);
		
		// Add to chart group
		this.chartGroup.add(bgPanel);
		this.chartGroup.add(boxOutline);
		this.chartGroup.add(axesHelper);
		this.chartGroup.add(this.emitterJet);
		
		// Position chart in front of the camera
		this.chartGroup.position.z = -1;
	}
	
	/**
	 * Create the stars system to draw the chart line
	 */
	createStarsSystem() {
		// Create geometry
		this.starsGeometry = new THREE.BufferGeometry();
		
		// Create attributes
		const positions = new Float32Array(this.maxStars * 3);
		const colors = new Float32Array(this.maxStars * 3);
		const sizes = new Float32Array(this.maxStars);
		const opacities = new Float32Array(this.maxStars);
		
		// Initialize all stars as invisible
		for (let i = 0; i < this.maxStars; i++) {
			positions[i * 3] = 0;
			positions[i * 3 + 1] = 0;
			positions[i * 3 + 2] = 0;
			
			colors[i * 3] = 1.0;     // R
			colors[i * 3 + 1] = 1.0;  // G
			colors[i * 3 + 2] = 1.0;  // B
			
			sizes[i] = this.starSize;
			opacities[i] = 0; // Start invisible
		}
		
		// Set attributes
		this.starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		this.starsGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
		this.starsGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
		this.starsGeometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));
		
		// Create shader material for the stars
		const starsMaterial = new THREE.ShaderMaterial({
			uniforms: {
				pointTexture: { value: this.createStarTexture() }
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
		
		// Create the point system
		this.starsSystem = new THREE.Points(this.starsGeometry, starsMaterial);
		this.starsGroup.add(this.starsSystem);
	}
	
	/**
	 * Create UI elements (title and buttons)
	 */
	createUI() {
		// Title bar with token name
		const titleBarGeometry = new THREE.PlaneGeometry(4, 0.8);
		this.titleBar = new THREE.Mesh(titleBarGeometry, this.materials.title);
		this.titleBar.position.set(0, this.chartHeight / 2 + 1, 0);
		this.uiGroup.add(this.titleBar);
		
		// Back button (initially hidden)
		const backBtnGeometry = new THREE.PlaneGeometry(1.5, 0.6);
		this.backButton = new THREE.Mesh(backBtnGeometry, this.materials.button);
		this.backButton.position.set(0, -this.chartHeight / 2 - 1, 0);
		this.backButton.visible = false;
		this.backButton.userData = { isButton: true, action: 'back' };
		this.uiGroup.add(this.backButton);
		
		// Load font for labels
		const loader = new FontLoader();
		loader.load('https://threejs.org/examples/fonts/helvetiker_bold.typeface.json', (font) => {
			// Add token title
			this.addChartTitle('PRICE CHART', font);
			
			// Add back button text
			const backTextGeometry = new TextGeometry('BACK', {
				font: font,
				size: 0.2,
				height: 0.02,
				curveSegments: 3,
				bevelEnabled: false
			});
			
			const textMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
			const backTextMesh = new THREE.Mesh(backTextGeometry, textMaterial);
			backTextGeometry.computeBoundingBox();
			const textWidth = backTextGeometry.boundingBox.max.x - backTextGeometry.boundingBox.min.x;
			backTextMesh.position.set(-textWidth/2, -0.1, 0.01);
			this.backButton.add(backTextMesh);
		});
	}
	
	/**
	 * Create jet emitters at each corner
	 */
	createCornerJets() {
		// Create shared star texture for all jets
		const starTexture = this.createStarTexture();
		
		// Jet positions (4 corners)
		const jetPositions = [
			{ x: -this.chartWidth/2 - 0.2, y: this.chartHeight/2 + 0.2, z: 0 },
			{ x: this.chartWidth/2 + 0.2, y: this.chartHeight/2 + 0.2, z: 0 },
			{ x: -this.chartWidth/2 - 0.2, y: -this.chartHeight/2 - 0.2, z: 0 },
			{ x: this.chartWidth/2 + 0.2, y: -this.chartHeight/2 - 0.2, z: 0 }
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
					pointTexture: { value: starTexture }
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
	 * Add title text to the chart
	 */
	addChartTitle(tokenSymbol, font) {
		// Remove old title if exists
		if (this.titleText) {
			this.titleBar.remove(this.titleText);
		}
		
		// If font is not provided yet, store the symbol for later
		if (!font) {
			this.pendingTitleSymbol = tokenSymbol;
			return;
		}
		
		const textGeometry = new TextGeometry(tokenSymbol, {
			font: font,
			size: 0.3,
			height: 0.05,
			curveSegments: 4,
			bevelEnabled: false
		});
		
		textGeometry.computeBoundingBox();
		const textWidth = textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x;
		
		const textMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
		this.titleText = new THREE.Mesh(textGeometry, textMaterial);
		this.titleText.position.set(-textWidth/2, -0.15, 0.01);
		this.titleBar.add(this.titleText);
	}
	
	/**
	 * Generate sample data for initial display
	 */
	generateSampleData() {
		const data = [];
		let lastPrice = 100 + Math.random() * 100;
		
		for (let i = 0; i < this.maxDataPoints; i++) {
			// Random price change following a slightly random walk
			const change = (Math.random() - 0.48) * 10;
			lastPrice += change;
			lastPrice = Math.max(10, lastPrice); // Ensure price stays positive
			
			// Random volume
			const volume = 10000 + Math.random() * 50000;
			
			data.push({
				price: lastPrice,
				volume: volume,
				change: change,
				timestamp: Date.now() - (this.maxDataPoints - i) * 3600000 // Hourly data points
			});
		}
		
		this.updateChartData({
			tokenSymbol: 'DEMO',
			priceData: data
		});
	}
	
	/**
	 * Update the chart with new data
	 * @param {Object} chartData - Object containing token symbol and price data
	 */
	updateChartData(chartData) {
		this.currentChartData = chartData;
		
		// If no data, don't proceed
		if (!chartData || !chartData.priceData || chartData.priceData.length === 0) {
			return;
		}
		
		// Update chart title
		this.updateChartTitle(chartData.tokenSymbol);
		
		// Generate chart curve based on price data
		this.generateChartCurve(chartData.priceData);
		
		// Start emitting stars to draw the chart
		this.startChartEmitter();
	}
	
	/**
	 * Generate a smooth curve for the chart based on price data
	 */
	generateChartCurve(priceData) {
		// Find min and max prices for scaling
		let minPrice = Infinity;
		let maxPrice = -Infinity;
		
		priceData.forEach(data => {
			minPrice = Math.min(minPrice, data.price);
			maxPrice = Math.max(maxPrice, data.price);
		});
		
		// Add a small buffer to min/max
		const buffer = (maxPrice - minPrice) * 0.1;
		minPrice -= buffer;
		maxPrice += buffer;
		
		// Create curve points
		const points = [];
		
		priceData.forEach((data, index) => {
			// Normalize x position across chart width
			const x = -this.chartWidth/2 + (index / (priceData.length - 1)) * this.chartWidth;
			
			// Normalize y position based on price
			const normalizedPrice = (data.price - minPrice) / (maxPrice - minPrice);
			const y = -this.chartHeight/2 + normalizedPrice * this.chartHeight;
			
			// Add slight z variance for 3D effect
			const z = 0;
			
			points.push(new THREE.Vector3(x, y, z));
		});
		
		// Save the chart points
		this.chartPoints = points;
		
		// Create a smooth curve through the points
		this.chartCurve = new THREE.CatmullRomCurve3(points);
		
		// Reset emitter to start of curve
		this.emitterProgress = 0;
		
		// Calculate if each segment is up or down
		this.segmentDirections = [];
		for (let i = 1; i < points.length; i++) {
			this.segmentDirections.push(points[i].y > points[i-1].y ? 'up' : 'down');
		}
		
		// Position emitter at start of curve
		const startPoint = this.chartCurve.getPoint(0);
		this.emitterJet.position.copy(startPoint);
		
		// Reset stars array
		this.currentStarIndex = 0;
		this.stars = [];
	}
	
	/**
	 * Start the chart emitter to draw the curve with stars
	 */
	startChartEmitter() {
		this.isEmitting = true;
		this.emitterProgress = 0;
		
		// Clear existing star trails
		const positions = this.starsGeometry.attributes.position.array;
		const opacities = this.starsGeometry.attributes.opacity.array;
		
		for (let i = 0; i < this.maxStars; i++) {
			opacities[i] = 0;
		}
		
		this.starsGeometry.attributes.opacity.needsUpdate = true;
	}
	
	/**
	 * Update the chart emitter position and emit stars
	 */
	updateChartEmitter(deltaTime) {
		if (!this.isEmitting || !this.chartCurve) return;
		
		// Move emitter along curve
		this.emitterProgress += deltaTime * this.emitterSpeed;
		
		// If we reached the end, stop emitting
		if (this.emitterProgress >= 1) {
			this.emitterProgress = 1;
			this.isEmitting = false;
		}
		
		// Get current position on curve
		const position = this.chartCurve.getPoint(this.emitterProgress);
		
		// Update emitter position
		this.emitterJet.position.copy(position);
		
		// Calculate tangent for rotation
		if (this.emitterProgress < 1) {
			const tangent = this.chartCurve.getTangent(this.emitterProgress);
			this.emitterJet.lookAt(this.emitterJet.position.clone().add(tangent));
		}
		
		// Find which segment we're in
		const segment = Math.floor(this.emitterProgress * (this.chartPoints.length - 1));
		const segmentDirection = segment >= 0 && segment < this.segmentDirections.length 
			? this.segmentDirections[segment] 
			: 'neutral';
		
		// Emit stars
		this.emitChartStar(position, segmentDirection);
	}
	
	/**
	 * Emit a star at the given position
	 */
	emitChartStar(position, direction) {
		// Update properties
		const positions = this.starsGeometry.attributes.position.array;
		const colors = this.starsGeometry.attributes.color.array;
		const sizes = this.starsGeometry.attributes.size.array;
		const opacities = this.starsGeometry.attributes.opacity.array;
		
		// Get current index to update
		const i = this.currentStarIndex;
		const i3 = i * 3;
		
		// Set position with small random offset
		positions[i3] = position.x + (Math.random() - 0.5) * 0.05;
		positions[i3 + 1] = position.y + (Math.random() - 0.5) * 0.05;
		positions[i3 + 2] = position.z + (Math.random() - 0.5) * 0.05;
		
		// Set color based on direction - make colors more vibrant
		if (direction === 'up') {
			colors[i3] = 0.0;    // R
			colors[i3 + 1] = 1.0; // G
			colors[i3 + 2] = 0.5; // B - increased blue component for visibility
		} else if (direction === 'down') {
			colors[i3] = 1.0;    // R
			colors[i3 + 1] = 0.2; // G - reduced green component
			colors[i3 + 2] = 0.2; // B - reduced blue component
		} else {
			colors[i3] = 1.0;    // R
			colors[i3 + 1] = 1.0; // G
			colors[i3 + 2] = 1.0; // B
		}
		
		// Set size with some variance - make stars larger
		sizes[i] = this.starSize * (1.2 + Math.random() * 0.5);
		
		// Make visible with higher opacity
		opacities[i] = 0.9 + Math.random() * 0.1;
		
		// Mark for update
		this.starsGeometry.attributes.position.needsUpdate = true;
		this.starsGeometry.attributes.color.needsUpdate = true;
		this.starsGeometry.attributes.size.needsUpdate = true;
		this.starsGeometry.attributes.opacity.needsUpdate = true;
		
		// Move to next star index, wrapping around if needed
		this.currentStarIndex = (this.currentStarIndex + 1) % this.maxStars;
	}
	
	/**
	 * Update chart title with token symbol
	 */
	updateChartTitle(tokenSymbol) {
		// Store the symbol to add when font loads
		this.pendingTitleSymbol = `$${tokenSymbol} PRICE CHART`;
		
		// If title mesh already exists, update it
		if (this.titleText) {
			const loader = new FontLoader();
			loader.load('https://threejs.org/examples/fonts/helvetiker_bold.typeface.json', (font) => {
				this.addChartTitle(this.pendingTitleSymbol, font);
			});
		}
	}
	
	/**
	 * Update the screen position of the visualization
	 */
	updateScreenPosition() {
		if (!this.camera) return;
		
		// Keep track of previous position for movement detection
		const prevPosition = this.mainGroup.position.clone();
		
		// Calculate position directly based on field of view
		const fov = this.camera.fov * Math.PI / 180;
		const distance = 10; // Fixed distance from camera
		const height = 2 * Math.tan(fov / 2) * distance;
		const width = height * this.camera.aspect;
		
		// Get camera quaternion for orientation
		const quaternion = this.camera.quaternion;
		
		// Create camera-oriented coordinate system
		// We need to be more explicit about creating a proper view-aligned coordinate system
		const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);
		const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
		const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
		
		// Position relative to camera
		const pos = this.camera.position.clone()
			.add(forward.clone().multiplyScalar(distance))
			.add(right.clone().multiplyScalar(this.screenPosition.x * width / 2))
			.add(up.clone().multiplyScalar(this.screenPosition.y * height / 2));
		
		// Set position
		this.mainGroup.position.copy(pos);
		
		// Always face the camera
		this.mainGroup.quaternion.copy(quaternion);
		
		// Scale - smaller when not expanded
		const scale = this.expanded ? 0.7 : 0.3;
		this.mainGroup.scale.set(scale, scale, scale);
		
		// Check if there was significant movement
		const movement = new THREE.Vector3().subVectors(this.mainGroup.position, this.lastPosition);
		if (movement.length() > this.movementThreshold) {
			this.activateJets(movement);
			this.lastPosition.copy(this.mainGroup.position);
		}
	}
	
	/**
	 * Handle interaction with the visualization
	 * @param {THREE.Raycaster} raycaster - Raycaster for interaction
	 * @returns {boolean} Whether interaction occurred
	 */
	handleInteraction(raycaster) {
		const intersects = raycaster.intersectObjects([this.titleBar, this.backButton], true);
		
		if (intersects.length > 0) {
			const obj = intersects[0].object;
			
			// Handle back button
			if (obj === this.backButton && this.expanded) {
				this.toggleExpanded();
				return true;
			}
			
			// Handle title bar (expand/collapse)
			if (obj === this.titleBar || obj.parent === this.titleBar) {
				// Get current camera position
				const currentCameraPos = new THREE.Vector3();
				currentCameraPos.copy(this.camera.position);
				
				// Get target position (slightly in front of chart)
				const targetPosition = new THREE.Vector3();
				targetPosition.copy(this.mainGroup.position);
				
				// Get direction from camera to chart
				const direction = new THREE.Vector3();
				direction.subVectors(targetPosition, currentCameraPos).normalize();
				
				// Move camera position to be 5 units away from chart in that direction
				targetPosition.sub(direction.multiplyScalar(5));
				
				// Smoothly move camera (simulate with setTimeout chain)
				this.flyToPosition(this.camera, targetPosition, 1000);
				
				this.toggleExpanded();
				return true;
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
			
			// Make sure camera is looking at the chart
			camera.lookAt(this.mainGroup.position);
			
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
		
		// When expanded, restart the chart animation
		if (this.expanded && this.chartCurve) {
			this.startChartEmitter();
		}
		
		return this.expanded;
	}
	
	/**
	 * Toggle visibility of the visualization
	 */
	toggleVisibility() {
		this.isVisible = !this.isVisible;
		this.mainGroup.visible = this.isVisible;
		return this.isVisible;
	}
	
	/**
	 * Update the visualization - called each frame
	 */
	update(deltaTime) {
		if (!this.isVisible) return;
		
		// Update screen position to follow camera
		this.updateScreenPosition();
		
		// Update the chart emitter
		this.updateChartEmitter(deltaTime || 1/60);
		
		// Force more consistent fading by always updating jets
		this.jets.forEach(jet => {
			// Always update jets to ensure proper fading
			this.updateJetParticles(jet, deltaTime || 1/60);
		});
		
		// Fade out older stars slightly
		if (this.starsGeometry && this.starsGeometry.attributes.opacity) {
			const opacities = this.starsGeometry.attributes.opacity.array;
			for (let i = 0; i < this.maxStars; i++) {
				if (opacities[i] > 0) {
					opacities[i] = Math.max(0, opacities[i] - 0.005);
				}
			}
			this.starsGeometry.attributes.opacity.needsUpdate = true;
		}
	}
} 