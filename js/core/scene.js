import * as THREE from 'three';

/**
 * Main scene setup for the application
 */
export class Scene {
	constructor(canvas) {
		// Scene setup
		this.canvas = canvas;
		this.scene = new THREE.Scene();
		
		// Renderer setup
		this.renderer = new THREE.WebGLRenderer({
			canvas: this.canvas,
			antialias: true,
			alpha: true
		});
		this.renderer.setPixelRatio(window.devicePixelRatio);
		this.renderer.setSize(window.innerWidth, window.innerHeight);
		this.renderer.setClearColor(0x000000, 1);
		
		// Enable high dynamic range
		this.renderer.outputEncoding = THREE.sRGBEncoding;
		this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.renderer.toneMappingExposure = 1.0;
		
		// Update to modern lighting model (replacing deprecated physicallyCorrectLights)
		this.renderer.useLegacyLights = false;
		
		// Camera setup
		this.camera = new THREE.PerspectiveCamera(
			60, 
			window.innerWidth / window.innerHeight, 
			0.1, 
			1000
		);
		this.camera.position.set(0, 0, 30);
		this.camera.lookAt(0, 0, 0);
		
		// Lighting
		this.setupLighting();
		
		// Load environment map for reflections
		this.setupEnvironmentMap();
		
		// Create immersive space background
		this.createSpaceBackground();
		
		// Handle window resize
		window.addEventListener('resize', this.handleResize.bind(this));
	}
	
	setupLighting() {
		// Ambient light for overall scene illumination
		const ambientLight = new THREE.AmbientLight(0x404040, 0.7);
		this.scene.add(ambientLight);
		
		// Directional lights from multiple directions for better visibility of 3D text
		const directions = [
			{ position: new THREE.Vector3(10, 10, 10), color: 0xffffff, intensity: 0.8 },
			{ position: new THREE.Vector3(-10, -10, -10), color: 0x8888ff, intensity: 0.5 },
			{ position: new THREE.Vector3(-10, 10, -10), color: 0xffcc77, intensity: 0.5 },
			{ position: new THREE.Vector3(10, -10, 10), color: 0x77ccff, intensity: 0.5 }
		];
		
		directions.forEach(dir => {
			const light = new THREE.DirectionalLight(dir.color, dir.intensity);
			light.position.copy(dir.position);
			this.scene.add(light);
		});
		
		// Add point light in the center for inner illumination
		const centerLight = new THREE.PointLight(0xffffff, 0.5, 50);
		centerLight.position.set(0, 0, 0);
		this.scene.add(centerLight);
	}
	
	createSpaceBackground() {
		// Create stars with different sizes and colors
		this.createStarLayers();
		
		// Create nebula effect with particle clouds
		this.createNebulaEffect();
	}
	
	createStarLayers() {
		// Create multiple layers of stars with different properties
		const starLayers = [
			{ count: 2500, radius: 150, size: 0.15, color: 0xffffff, opacity: 0.8 },
			{ count: 1500, radius: 120, size: 0.3, color: 0xccccff, opacity: 0.9 },
			{ count: 800, radius: 100, size: 0.4, color: 0xffffcc, opacity: 1.0 },
			{ count: 300, radius: 80, size: 0.5, color: 0xffcccc, opacity: 1.0 }
		];
		
		this.starLayers = [];
		
		starLayers.forEach(layer => {
			const starsGeometry = new THREE.BufferGeometry();
			
			// Create star material with custom shader for twinkling effect
			const starsMaterial = new THREE.PointsMaterial({
				size: layer.size,
				color: layer.color,
				transparent: true,
				opacity: layer.opacity,
				blending: THREE.AdditiveBlending,
				map: this.createStarTexture(),
				depthWrite: false
			});
			
			const starsVertices = [];
			const starsColors = [];
			
			// Create random color variations
			const baseColor = new THREE.Color(layer.color);
			
			for (let i = 0; i < layer.count; i++) {
				// Create random position in spherical space
				const x = THREE.MathUtils.randFloatSpread(layer.radius * 2);
				const y = THREE.MathUtils.randFloatSpread(layer.radius * 2);
				const z = THREE.MathUtils.randFloatSpread(layer.radius * 2);
				
				// Keep a minimum distance from the center to avoid stars intersecting with the cube
				const distance = Math.sqrt(x*x + y*y + z*z);
				if (distance < 15) {
					// Move star further out
					const direction = new THREE.Vector3(x, y, z).normalize();
					const newDistance = 15 + Math.random() * 10;
					const newPos = direction.multiplyScalar(newDistance);
					starsVertices.push(newPos.x, newPos.y, newPos.z);
				} else {
					starsVertices.push(x, y, z);
				}
				
				// Add slight color variation
				const colorVar = new THREE.Color(baseColor);
				colorVar.r += (Math.random() - 0.5) * 0.2;
				colorVar.g += (Math.random() - 0.5) * 0.2;
				colorVar.b += (Math.random() - 0.5) * 0.2;
				starsColors.push(colorVar.r, colorVar.g, colorVar.b);
			}
			
			starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
			starsGeometry.setAttribute('color', new THREE.Float32BufferAttribute(starsColors, 3));
			
			// Update material to use vertex colors
			starsMaterial.vertexColors = true;
			
			const stars = new THREE.Points(starsGeometry, starsMaterial);
			this.scene.add(stars);
			this.starLayers.push(stars);
		});
	}
	
	createStarTexture() {
		// Create a custom texture for stars with a soft glow
		const canvas = document.createElement('canvas');
		canvas.width = 32;
		canvas.height = 32;
		
		const ctx = canvas.getContext('2d');
		const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
		gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
		gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
		gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
		gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
		
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, 32, 32);
		
		const texture = new THREE.CanvasTexture(canvas);
		texture.needsUpdate = true;
		return texture;
	}
	
	createNebulaEffect() {
		// Create nebula effect with colored particle clouds
		const nebulaColors = [
			new THREE.Color(0x3333ff).multiplyScalar(0.5), // Blue
			new THREE.Color(0xff3366).multiplyScalar(0.5), // Pink/Red
			new THREE.Color(0x33ccff).multiplyScalar(0.5)  // Cyan
		];
		
		this.nebulaClouds = [];
		
		nebulaColors.forEach((color, index) => {
			const particlesGeometry = new THREE.BufferGeometry();
			const particlesCnt = 800;
			const posArray = new Float32Array(particlesCnt * 3);
			
			// Distribute particles in a shell-like layer to create depth
			const shellRadius = 80 + index * 20;
			const shellThickness = 30;
			
			for(let i = 0; i < particlesCnt; i++) {
				// Create particles in a spherical shell with some random distribution
				const phi = Math.random() * Math.PI * 2;
				const theta = Math.random() * Math.PI;
				const r = shellRadius + (Math.random() - 0.5) * shellThickness;
				
				// Convert spherical to cartesian coordinates
				const x = r * Math.sin(theta) * Math.cos(phi);
				const y = r * Math.sin(theta) * Math.sin(phi);
				const z = r * Math.cos(theta);
				
				posArray[i * 3] = x;
				posArray[i * 3 + 1] = y;
				posArray[i * 3 + 2] = z;
			}
			
			particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
			
			const particlesMaterial = new THREE.PointsMaterial({
				size: 3.0,
				color: color,
				transparent: true,
				opacity: 0.15,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
				map: this.createNebulaTexture()
			});
			
			const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
			this.scene.add(particlesMesh);
			this.nebulaClouds.push(particlesMesh);
		});
	}
	
	createNebulaTexture() {
		// Create a soft, cloudy texture for nebula particles
		const canvas = document.createElement('canvas');
		canvas.width = 64;
		canvas.height = 64;
		
		const ctx = canvas.getContext('2d');
		const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
		gradient.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
		gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.3)');
		gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
		gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
		
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, 64, 64);
		
		const texture = new THREE.CanvasTexture(canvas);
		texture.needsUpdate = true;
		return texture;
	}
	
	updateCameraDistance(distance) {
		// Update camera position based on provided distance
		const direction = this.camera.position.clone().normalize();
		this.camera.position.copy(direction.multiplyScalar(distance));
		
		// Ensure the far clip plane is updated accordingly
		this.camera.far = Math.max(1000, distance * 5);
		this.camera.updateProjectionMatrix();
	}
	
	handleResize() {
		// Update camera
		this.camera.aspect = window.innerWidth / window.innerHeight;
		this.camera.updateProjectionMatrix();
		
		// Update renderer
		this.renderer.setSize(window.innerWidth, window.innerHeight);
	}
	
	update() {
		// Frame counter to skip updates of background elements
		if (!this.frameCounter) {
			this.frameCounter = 0;
			this.lastAnimationUpdate = 0;
		}
		this.frameCounter++;
		
		// Only update animations every few frames to improve performance
		const shouldUpdateAnimations = this.frameCounter % 10 === 0;
		
		// Animate star layers for twinkling effect - but only on some frames
		if (shouldUpdateAnimations && this.starLayers) {
			const now = Date.now();
			// Only update if enough time has passed (throttle to 20fps for background)
			if (now - this.lastAnimationUpdate > 50) {
				this.starLayers.forEach((stars, index) => {
					// Reduce animation speed by 50% to improve performance
					const speed = 0.00005 * (index + 1);
					stars.rotation.y += speed;
					stars.rotation.x += speed * 0.5;
				});
				
				// Animate nebula clouds for subtle movement
				if (this.nebulaClouds) {
					this.nebulaClouds.forEach((cloud, index) => {
						// Reduce animation speed by 50% 
						cloud.rotation.y -= 0.0001 * (index * 0.5 + 1);
						cloud.rotation.x -= 0.00005 * (index * 0.5 + 1);
					});
				}
				
				this.lastAnimationUpdate = now;
			}
		}
		
		// Render the scene
		this.renderer.render(this.scene, this.camera);
	}
	
	/**
	 * Set up environment map for metallic reflections
	 */
	setupEnvironmentMap() {
		// Create a simple environment map for reflections
		// This creates a cube texture with a gradient from top to bottom
		const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256);
		cubeRenderTarget.texture.type = THREE.HalfFloatType;
		
		// Create a cube camera for environment map rendering
		const cubeCamera = new THREE.CubeCamera(0.1, 1000, cubeRenderTarget);
		
		// Create a gradient scene for the environment
		const envScene = new THREE.Scene();
		
		// Add a gradient background
		const topColor = new THREE.Color(0x6495ED); // Cornflower blue
		const bottomColor = new THREE.Color(0x000033); // Dark blue
		
		const envGeometry = new THREE.SphereGeometry(100, 64, 64);
		const envMaterial = new THREE.ShaderMaterial({
			uniforms: {
				topColor: { value: topColor },
				bottomColor: { value: bottomColor }
			},
			vertexShader: `
				varying vec3 vWorldPosition;
				void main() {
					vec4 worldPosition = modelMatrix * vec4(position, 1.0);
					vWorldPosition = worldPosition.xyz;
					gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
				}
			`,
			fragmentShader: `
				uniform vec3 topColor;
				uniform vec3 bottomColor;
				varying vec3 vWorldPosition;
				void main() {
					float h = normalize(vWorldPosition).y * 0.5 + 0.5;
					gl_FragColor = vec4(mix(bottomColor, topColor, h), 1.0);
				}
			`,
			side: THREE.BackSide
		});
		
		const envMesh = new THREE.Mesh(envGeometry, envMaterial);
		envScene.add(envMesh);
		
		// Add some gradient stars for more interesting reflections
		const starsGeometry = new THREE.BufferGeometry();
		const starsCount = 500;
		const starsPositions = [];
		
		for (let i = 0; i < starsCount; i++) {
			const x = THREE.MathUtils.randFloatSpread(180);
			const y = THREE.MathUtils.randFloatSpread(180);
			const z = THREE.MathUtils.randFloatSpread(180);
			starsPositions.push(x, y, z);
		}
		
		starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsPositions, 3));
		
		const starsMaterial = new THREE.PointsMaterial({
			color: 0xffffff,
			size: 2,
			transparent: true,
			opacity: 0.8,
			blending: THREE.AdditiveBlending
		});
		
		const stars = new THREE.Points(starsGeometry, starsMaterial);
		envScene.add(stars);
		
		// Position cube camera and render the environment
		cubeCamera.position.set(0, 0, 0);
		cubeCamera.update(this.renderer, envScene);
		
		// Set the environment map for the scene
		this.scene.environment = cubeRenderTarget.texture;
	}
} 