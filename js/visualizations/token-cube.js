import * as THREE from 'three';
import { Utils } from './utils.js';

/**
 * TokenCube - Visualizes tokens from DexScreener in a 3D cube
 * Tokens fly in, sized by market cap, and periodically update
 */
export class TokenCube {
	constructor(scene, camera) {
		this.scene = scene;
		this.camera = camera;
		this.tokens = [];
		this.tokenMeshes = {};
		this.cubeSize = 20; // Size of the visualization cube
		this.utils = new Utils();
		
		// Token update settings
		this.updateInterval = 6000; // Update every 6 seconds
		this.lastUpdateTime = 0;
		
		// Animation settings
		this.animationDuration = 2000; // ms
		this.animatingTokens = [];
		
		// Token size settings
		this.minTokenSize = 0.5;
		this.maxTokenSize = 3.0;
		
		// Create container group
		this.cubeGroup = new THREE.Group();
		this.scene.add(this.cubeGroup);
		
		// Create cube wireframe for reference
		this.createCubeWireframe();
	}
	
	/**
	 * Create a wireframe cube to define the token space
	 */
	createCubeWireframe() {
		const geometry = new THREE.BoxGeometry(this.cubeSize, this.cubeSize, this.cubeSize);
		const material = new THREE.LineBasicMaterial({ 
			color: 0x3366aa, 
			transparent: true, 
			opacity: 0.2 
		});
		const wireframe = new THREE.LineSegments(
			new THREE.WireframeGeometry(geometry),
			material
		);
		this.cubeGroup.add(wireframe);
		this.wireframe = wireframe;
	}
	
	/**
	 * Update tokens with new data from DexScreener
	 * @param {Array} tokenData - Array of token data objects
	 */
	updateTokens(tokenData) {
		if (!tokenData || !Array.isArray(tokenData)) return;
		
		const currentTime = Date.now();
		this.lastUpdateTime = currentTime;
		
		// Find tokens to add and remove
		const currentTokenSymbols = new Set(this.tokens.map(token => token.symbol));
		const newTokenSymbols = new Set(tokenData.map(token => token.baseToken?.symbol));
		
		// Tokens to add (in the new data but not in our current tokens)
		const tokensToAdd = tokenData.filter(token => 
			token.baseToken?.symbol && !currentTokenSymbols.has(token.baseToken.symbol)
		);
		
		// Tokens to remove (in our current tokens but not in the new data)
		const tokensToRemove = this.tokens.filter(token => 
			!newTokenSymbols.has(token.symbol)
		);
		
		// Tokens to update (present in both sets)
		const tokensToUpdate = this.tokens.filter(token => 
			newTokenSymbols.has(token.symbol)
		);
		
		// Add new tokens
		tokensToAdd.forEach(token => this.addToken(token));
		
		// Remove tokens no longer in the list
		tokensToRemove.forEach(token => this.removeToken(token));
		
		// Update existing tokens
		tokensToUpdate.forEach(token => {
			const newData = tokenData.find(t => 
				t.baseToken?.symbol === token.symbol
			);
			if (newData) {
				this.updateToken(token, newData);
			}
		});
	}
	
	/**
	 * Add a new token to the visualization
	 * @param {Object} tokenData - Token data from DexScreener
	 */
	addToken(tokenData) {
		if (!tokenData.baseToken?.symbol) return;
		
		const symbol = tokenData.baseToken.symbol;
		const marketCap = tokenData.marketCap || 1000000; // Default if not available
		
		// Create token object
		const token = {
			symbol,
			name: tokenData.baseToken.name || symbol,
			marketCap,
			size: this.calculateTokenSize(marketCap),
			color: this.utils.getRandomVibrantColor(0.5, 0.8),
			chainId: tokenData.chainId || 'unknown',
			position: new THREE.Vector3(0, 0, 0), // Will be set later
			targetPosition: this.getRandomPositionInCube(),
			added: Date.now(),
			animating: true,
			entering: true,
			exiting: false
		};
		
		// Create 3D mesh for the token
		const geometry = new THREE.SphereGeometry(token.size, 32, 16);
		const material = new THREE.MeshStandardMaterial({
			color: token.color,
			metalness: 0.8,
			roughness: 0.2,
			emissive: token.color,
			emissiveIntensity: 0.3
		});
		
		const mesh = new THREE.Mesh(geometry, material);
		
		// Set initial position (outside the cube)
		const direction = new THREE.Vector3(
			Math.random() - 0.5,
			Math.random() - 0.5,
			Math.random() - 0.5
		).normalize();
		
		const distance = this.cubeSize * 2; // Start from outside the cube
		mesh.position.copy(direction.multiplyScalar(distance));
		token.position = mesh.position.clone();
		
		// Add mesh to scene
		this.cubeGroup.add(mesh);
		
		// Store references
		this.tokenMeshes[symbol] = mesh;
		this.tokens.push(token);
		this.animatingTokens.push(token);
		
		return token;
	}
	
	/**
	 * Update an existing token with new data
	 * @param {Object} token - Existing token object
	 * @param {Object} newData - New token data
	 */
	updateToken(token, newData) {
		if (!token || !newData) return;
		
		const newMarketCap = newData.marketCap || token.marketCap;
		const newSize = this.calculateTokenSize(newMarketCap);
		
		// If size changed significantly, animate to new size
		if (Math.abs(newSize - token.size) / token.size > 0.1) {
			token.targetSize = newSize;
			token.initialSize = token.size;
			token.sizeAnimationStart = Date.now();
			token.animating = true;
			
			if (!this.animatingTokens.includes(token)) {
				this.animatingTokens.push(token);
			}
		}
		
		// Update market cap
		token.marketCap = newMarketCap;
		
		// Get a new position if it's been a while since this token moved
		if (Date.now() - token.lastPositionChange > 30000) {
			token.targetPosition = this.getRandomPositionInCube();
			token.initialPosition = token.position.clone();
			token.positionAnimationStart = Date.now();
			token.animating = true;
			token.lastPositionChange = Date.now();
			
			if (!this.animatingTokens.includes(token)) {
				this.animatingTokens.push(token);
			}
		}
	}
	
	/**
	 * Remove a token from the visualization
	 * @param {Object} token - Token to remove
	 */
	removeToken(token) {
		if (!token) return;
		
		const { symbol } = token;
		const mesh = this.tokenMeshes[symbol];
		
		if (mesh) {
			// Mark token as exiting for animation
			token.exiting = true;
			token.entering = false;
			token.exitStart = Date.now();
			
			// Set exit direction (away from center)
			const direction = mesh.position.clone().normalize();
			const exitDistance = this.cubeSize * 2;
			token.targetPosition = direction.multiplyScalar(exitDistance);
			token.initialPosition = token.position.clone();
			token.animating = true;
			
			if (!this.animatingTokens.includes(token)) {
				this.animatingTokens.push(token);
			}
			
			// Schedule actual removal after animation
			setTimeout(() => {
				this.cubeGroup.remove(mesh);
				delete this.tokenMeshes[symbol];
				
				// Remove from tokens array
				const index = this.tokens.findIndex(t => t.symbol === symbol);
				if (index !== -1) {
					this.tokens.splice(index, 1);
				}
				
				// Remove from animating tokens
				const animIndex = this.animatingTokens.findIndex(t => t.symbol === symbol);
				if (animIndex !== -1) {
					this.animatingTokens.splice(animIndex, 1);
				}
			}, this.animationDuration);
		}
	}
	
	/**
	 * Calculate token size based on market cap
	 * @param {number} marketCap - Token market cap
	 * @returns {number} - Calculated size
	 */
	calculateTokenSize(marketCap) {
		// Use a logarithmic scale for better visualization
		if (!marketCap || marketCap <= 0) return this.minTokenSize;
		
		const log10 = Math.log10(marketCap);
		const minLog = Math.log10(100000); // $100K minimum
		const maxLog = Math.log10(10000000000); // $10B maximum
		
		// Normalize the log value to 0-1 range
		const normalizedSize = (log10 - minLog) / (maxLog - minLog);
		
		// Clamp between 0 and 1
		const clampedSize = Math.max(0, Math.min(1, normalizedSize));
		
		// Map to size range
		return this.minTokenSize + clampedSize * (this.maxTokenSize - this.minTokenSize);
	}
	
	/**
	 * Get a random position within the token cube
	 * @returns {THREE.Vector3} - Random position vector
	 */
	getRandomPositionInCube() {
		const halfSize = this.cubeSize / 2;
		return new THREE.Vector3(
			THREE.MathUtils.randFloatSpread(this.cubeSize) * 0.8,
			THREE.MathUtils.randFloatSpread(this.cubeSize) * 0.8,
			THREE.MathUtils.randFloatSpread(this.cubeSize) * 0.8
		);
	}
	
	/**
	 * Update all token animations
	 * @param {number} deltaTime - Time since last update in seconds
	 */
	update(deltaTime) {
		const currentTime = Date.now();
		
		// Update token animations
		for (let i = this.animatingTokens.length - 1; i >= 0; i--) {
			const token = this.animatingTokens[i];
			const mesh = this.tokenMeshes[token.symbol];
			
			if (!mesh) {
				this.animatingTokens.splice(i, 1);
				continue;
			}
			
			let stillAnimating = false;
			
			// Position animation
			if (token.initialPosition && token.targetPosition) {
				const elapsed = currentTime - (token.positionAnimationStart || token.added || token.exitStart);
				const duration = token.exiting ? this.animationDuration * 0.7 : this.animationDuration;
				let progress = Math.min(elapsed / duration, 1);
				
				// Apply easing
				progress = this.easeAnimation(progress);
				
				// Interpolate position
				if (progress < 1) {
					mesh.position.lerpVectors(token.initialPosition, token.targetPosition, progress);
					token.position = mesh.position.clone();
					stillAnimating = true;
				} else {
					mesh.position.copy(token.targetPosition);
					token.position = token.targetPosition.clone();
					token.initialPosition = null;
				}
			}
			
			// Size animation
			if (token.initialSize !== undefined && token.targetSize !== undefined) {
				const elapsed = currentTime - token.sizeAnimationStart;
				const duration = this.animationDuration;
				let progress = Math.min(elapsed / duration, 1);
				
				// Apply easing
				progress = this.easeAnimation(progress);
				
				// Interpolate size
				if (progress < 1) {
					const newSize = token.initialSize + (token.targetSize - token.initialSize) * progress;
					mesh.scale.set(newSize / token.size, newSize / token.size, newSize / token.size);
					stillAnimating = true;
				} else {
					// Update actual size and reset scale
					token.size = token.targetSize;
					mesh.scale.set(1, 1, 1);
					
					// Recreate geometry with new size
					mesh.geometry.dispose();
					mesh.geometry = new THREE.SphereGeometry(token.size, 32, 16);
					
					token.initialSize = undefined;
					token.targetSize = undefined;
				}
			}
			
			// Remove from animating list if done
			if (!stillAnimating) {
				token.animating = false;
				this.animatingTokens.splice(i, 1);
			}
		}
		
		// Make the cube rotate slowly
		if (this.wireframe) {
			this.wireframe.rotation.y += deltaTime * 0.05;
			this.wireframe.rotation.x += deltaTime * 0.03;
		}
	}
	
	/**
	 * Easing function for smoother animations
	 * @param {number} t - Progress value (0-1)
	 * @returns {number} - Eased value
	 */
	easeAnimation(t) {
		// Cubic ease out
		return 1 - Math.pow(1 - t, 3);
	}
} 