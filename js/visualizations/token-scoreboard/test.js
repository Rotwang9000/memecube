import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TokenScoreboard } from './token-scoreboard.js';

// Sample data including social links for testing
const sampleTokens = [
	{
		baseToken: { symbol: 'DOGE' },
		priceUsd: '0.1234',
		priceChange: { h24: 5.67, h1: 1.2, m5: 0.3 },
		marketCap: 12345678900,
		fdv: 15345678900,
		links: {
			twitter: 'https://twitter.com/dogecoin',
			discord: 'https://discord.gg/dogecoin',
			website: 'https://dogecoin.com'
		},
		txns: {
			h24: {
				buys: 1234,
				sells: 987
			}
		},
		liquidity: {
			usd: 45678900
		},
		volume: {
			h24: 23456789
		}
	},
	{
		baseToken: { symbol: 'PEPE' },
		priceUsd: '0.00001234',
		priceChange: { h24: -2.34, h1: -0.5, m5: 0.1 },
		marketCap: 987654321,
		fdv: 1087654321,
		links: {
			twitter: 'https://twitter.com/pepecoin',
			website: 'https://pepe.io'
		}
	},
	{
		baseToken: { symbol: 'SHIB' },
		priceUsd: '0.00002678',
		priceChange: { h24: 1.23, h1: 0.45, m5: -0.2 },
		marketCap: 5678901234,
		fdv: 6789012345,
		links: {
			discord: 'https://discord.gg/shib',
			website: 'https://shibatoken.com'
		}
	}
];

// Simple data provider for testing
class TestDataProvider {
	constructor() {
		this.tokens = sampleTokens;
	}
	
	async refreshData() {
		// Simulate a refresh - do nothing in test
		console.log('Refreshing data...');
		return true;
	}
	
	async getCurrentPageTokens() {
		return this.tokens;
	}
}

// Set up the scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);  // Pure black background

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 10;

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// OrbitControls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Add some background stars
function addStars() {
	const starsGeometry = new THREE.BufferGeometry();
	const starsMaterial = new THREE.PointsMaterial({
		color: 0xffffff,
		size: 0.05
	});
	
	const starsVertices = [];
	for (let i = 0; i < 1000; i++) {
		const x = (Math.random() - 0.5) * 100;
		const y = (Math.random() - 0.5) * 100;
		const z = (Math.random() - 0.5) * 100;
		starsVertices.push(x, y, z);
	}
	
	starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
	const stars = new THREE.Points(starsGeometry, starsMaterial);
	scene.add(stars);
}

addStars();

// Add basic lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

// Create the scoreboard
const dataProvider = new TestDataProvider();
const scoreboard = new TokenScoreboard(scene, camera, dataProvider);
scoreboard.updateTokenData(sampleTokens);

// Add raycaster for interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Handler for mouse clicks
window.addEventListener('click', (event) => {
	// Convert mouse position to normalized device coordinates
	mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
	mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
	
	// Update the raycaster
	raycaster.setFromCamera(mouse, camera);
	
	// Check for intersections with the scoreboard
	scoreboard.handleInteraction(raycaster);
});

// Resize handler
window.addEventListener('resize', () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
});

// Show detail view of first token by default
scoreboard.showTokenDetail(sampleTokens[0]);

// Animation loop
function animate() {
	requestAnimationFrame(animate);
	
	// Update controls
	controls.update();
	
	// Update scoreboard
	scoreboard.update(0.016); // ~60fps
	
	renderer.render(scene, camera);
}

animate(); 