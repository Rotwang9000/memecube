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
		
		// Enable physically correct lighting for better metallic appearance
		this.renderer.physicallyCorrectLights = true;
		
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
		
		// Space background
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
		// Create stars
		const starsGeometry = new THREE.BufferGeometry();
		const starsMaterial = new THREE.PointsMaterial({
			color: 0xffffff,
			size: 0.2,
			transparent: true
		});
		
		const starsVertices = [];
		const starsCount = 2000;
		const starsRadius = 100;
		
		for (let i = 0; i < starsCount; i++) {
			const x = THREE.MathUtils.randFloatSpread(starsRadius * 2);
			const y = THREE.MathUtils.randFloatSpread(starsRadius * 2);
			const z = THREE.MathUtils.randFloatSpread(starsRadius * 2);
			
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
		}
		
		starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
		this.stars = new THREE.Points(starsGeometry, starsMaterial);
		this.scene.add(this.stars);
		
		// Create a subtle glow/fog in the background for a more space-like feel
		const particlesGeometry = new THREE.BufferGeometry();
		const particlesCnt = 500;
		const posArray = new Float32Array(particlesCnt * 3);
		
		for(let i = 0; i < particlesCnt * 3; i++) {
			// Create particles further out than stars
			posArray[i] = (Math.random() - 0.5) * 200;
		}
		
		particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
		
		const particlesMaterial = new THREE.PointsMaterial({
			size: 0.5,
			color: 0x0055aa,
			transparent: true,
			opacity: 0.2,
			blending: THREE.AdditiveBlending
		});
		
		const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
		this.scene.add(particlesMesh);
		this.particlesMesh = particlesMesh; // Store for animation
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
		// Rotate the stars slightly for a subtle space effect
		if (this.stars) {
			this.stars.rotation.y += 0.0001;
			this.stars.rotation.x += 0.00005;
		}
		
		// Animate the particle mesh for a subtle nebula-like effect
		if (this.particlesMesh) {
			this.particlesMesh.rotation.y -= 0.0002;
			this.particlesMesh.rotation.x -= 0.0001;
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
		this.scene.background = this.scene.background; // Keep existing background
	}
} 