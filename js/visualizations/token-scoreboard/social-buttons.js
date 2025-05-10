import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

/**
 * Specialized class for creating and managing highly visible social media buttons
 * Uses a completely different approach from standard buttons to ensure visibility
 */
export class SocialButtonManager {
	constructor(parentGroup) {
		this.parentGroup = parentGroup;
		this.twitterButton = null;
		this.discordButton = null;
		this.urlButton = null;
		this.dexscreenerButton = null; // Add Dexscreener button
		this.telegramButton = null; // Add Telegram button
		this.buttonList = [];
		this.activeToken = null; // Store the last active token for color state
		this.font = null;
		
		// Load font first
		this.loadFont().then(() => {
			// Create all buttons after font is loaded
			this.createButtons();
		}).catch(error => {
			console.error("Failed to load font:", error);
			// Create buttons with fallback letter symbols
			this.createButtons(true);
		});
	}
	
	/**
	 * Load font for text symbols
	 */
	async loadFont() {
		return new Promise((resolve, reject) => {
			const fontLoader = new FontLoader();
			fontLoader.load('/fonts/socialbuttons.json', (font) => {
				this.font = font;
				resolve(font);
			}, undefined, reject);
		});
	}
	
	/**
	 * Create all social media buttons with extremely visible approach
	 */
	createButtons(useFallback = false) {
		console.log("Creating highly visible social media buttons");
		
		// Twitter/X button
		this.twitterButton = this.createButton(
			'twitter',
			0x1DA1F2, // Twitter blue
			-7.5, 3, 0 // Moved further left
		);
		
		// Add X symbol to Twitter button
		if (useFallback || !this.font) {
			this.addFallbackSymbol(this.twitterButton, 'X');
		} else {
			this.addTextSymbol(this.twitterButton, '✖︎', 0xFFFFFF);
		}
		
		// Discord button
		this.discordButton = this.createButton(
			'discord',
			0x5865F2, // Discord purple
			-4.5, 3, 0 // Moved further left
		);
		
		// Add Discord symbol
		if (useFallback || !this.font) {
			this.addFallbackSymbol(this.discordButton, 'D');
		} else {
			this.addTextSymbol(this.discordButton, '👾', 0xFFFFFF);
		}
		
		// URL button
		this.urlButton = this.createButton(
			'url',
			0x00C853, // Green
			-1.5, 3, 0 // Moved further left
		);
		
		// Add URL symbol
		if (useFallback || !this.font) {
			this.addFallbackSymbol(this.urlButton, 'W');
		} else {
			this.addTextSymbol(this.urlButton, '🌐', 0xFFFFFF);
		}
		
		// Dexscreener button - NEW
		this.dexscreenerButton = this.createButton(
			'dexscreener',
			0xFF9800, // Orange for Dexscreener
			1.5, 3, 0 // Moved further left
		);
		
		// Add Dexscreener symbol
		if (useFallback || !this.font) {
			this.addFallbackSymbol(this.dexscreenerButton, '$');
		} else {
			this.addTextSymbol(this.dexscreenerButton, '🚀', 0xFFFFFF);
		}
		
		// Telegram button - NEW
		this.telegramButton = this.createButton(
			'telegram',
			0x0088CC, // Telegram blue
			4.5, 3, 0 // Positioned after Dexscreener
		);
		
		// Add Telegram symbol
		if (useFallback || !this.font) {
			this.addFallbackSymbol(this.telegramButton, 'T');
		} else {
			this.addTextSymbol(this.telegramButton, '📠', 0xFFFFFF);
		}
		
		// Store all buttons in an array for easier management
		this.buttonList = [this.twitterButton, this.discordButton, this.urlButton, this.dexscreenerButton, this.telegramButton];
		
		// Debug info
		console.log(`Created ${this.buttonList.length} social media buttons with extreme visibility settings`);
	}
	
	/**
	 * Create a basic button with a colored sphere background
	 */
	createButton(action, color, x, y, z) {
		// Create group to hold button parts
		const button = new THREE.Group();
		button.userData = { isButton: true, action };
		// Use provided z or default to 0.5 (local space, in front of parent origin)
		button.position.set(x, y, z !== undefined ? z : 0); 
		button.renderOrder = 2000; // Increased base render order for the button group
		
		// Create sphere background instead of circle
		const sphereGeometry = new THREE.SphereGeometry(0.7, 32, 32); // Sphere with reasonable segment count
		const sphereMaterial = new THREE.MeshBasicMaterial({
			color: color,
			transparent: false,
			depthTest: true, // Changed to true for proper depth handling
			depthWrite: false, // Ensuring visibility
			side: THREE.DoubleSide // Ensure visible from both sides
		});
		sphereMaterial.renderOrder = 2001; // Increase render order further

		const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
		sphere.renderOrder = 2001; // Increase render order further
		
		// Debug: Add a point light to make the button more visible
		const light = new THREE.PointLight(color, 1, 3);
		light.position.set(0, 0, 0.2);
		button.add(light);
		
		button.add(sphere);
		
		// Add button to parent group
		this.parentGroup.add(button);

		// Debug logging
		console.log(`Created button: ${action}, position: (${x}, ${y}, ${z}), parent:`, this.parentGroup);
		
		return button;
	}
	
	/**
	 * Add a text symbol to a button using TextGeometry
	 */
	addTextSymbol(button, text, color) {
		// Create a text geometry for the symbol
		const textGeometry = new TextGeometry(text, {
			font: this.font,
			size: 0.5,
			height: 0.05,
			curveSegments: 12,
			bevelEnabled: false
		});
		
		// Center the text
		textGeometry.computeBoundingBox();
		const centerOffset = new THREE.Vector3();
		textGeometry.boundingBox.getCenter(centerOffset);
		centerOffset.multiplyScalar(-1);
		
		// Bring it forward
		centerOffset.z = 0;
		
		// Create text mesh
		const textMaterial = new THREE.MeshBasicMaterial({
			color: color,
			transparent: false,
			depthTest: false, // Set to false to ensure symbols render on top
			depthWrite: false,
			side: THREE.DoubleSide
		});
		textMaterial.renderOrder = 20020; // Much higher render order to ensure it renders on top
		
		const textMesh = new THREE.Mesh(textGeometry, textMaterial);
		textMesh.renderOrder = 20020;
		textMesh.position.set(centerOffset.x + 0.12 , centerOffset.y , centerOffset.z);
		// Rotate to correct orientation (180 degrees around X axis if upside down)
		textMesh.rotation.x = Math.PI; // Flip if upside down
		
		// Create a group for the text (to make centering easier)
		const textGroup = new THREE.Group();
		textGroup.position.z = -0.1; // Positioned in front (remember Z is inverted)
		// textGroup.position.x = 0.4;
		textGroup.renderOrder = 20020;
		textGroup.add(textMesh);
		
		button.add(textGroup);
	}
	
	/**
	 * Add a fallback letter symbol when font loading fails
	 */
	addFallbackSymbol(button, letter) {
		// Create canvas for texture
		const canvas = document.createElement('canvas');
		const size = 128;
		canvas.width = size;
		canvas.height = size;
		const context = canvas.getContext('2d');
		
		// Draw letter
		context.fillStyle = '#FFFFFF';
		context.fillRect(0, 0, size, size);
		context.fillStyle = '#000000';
		context.font = 'bold 80px Arial, Helvetica, sans-serif';
		context.textAlign = 'center';
		context.textBaseline = 'middle';
		context.fillText(letter, size/2, size/2);
		
		// Create texture
		const texture = new THREE.CanvasTexture(canvas);
		
		// Create plane for the letter
		const geometry = new THREE.PlaneGeometry(0.5, 0.5);
		const material = new THREE.MeshBasicMaterial({
			map: texture,
			transparent: false,
			depthTest: false, // Set to false to ensure symbols render on top
			depthWrite: false,
			side: THREE.DoubleSide
		});
		material.renderOrder = 20020; // Much higher render order to ensure it renders on top
		
		const plane = new THREE.Mesh(geometry, material);
		plane.position.z = -0.1; // Positioned in front (remember Z is inverted)
		plane.renderOrder = 20020;
		// Rotate to correct orientation (180 degrees around X axis if upside down)
		plane.rotation.x = Math.PI; // Flip if upside down
		
		button.add(plane);
	}
	
	/**
	 * Main update method called by TokenScoreboard.
	 * Positions buttons and updates their colors based on the provided token.
	 * @param {Object | null} token - The current detail token, or null if not in detail mode.
	 * @param {number} scoreboardWidth - Current width of the scoreboard.
	 * @param {number} scoreboardHeight - Current height of the scoreboard.
	 */
	updateState(token, scoreboardWidth, scoreboardHeight) {
		this.activeToken = token; // Store for flashButtonRed logic
		this.positionButtonsAbove(scoreboardWidth, scoreboardHeight, 0);
		this.updateButtonColors(token);
	}
	
	/**
	 * Position buttons above the scoreboard
	 */
	positionButtonsAbove(width, height, zPos = 0) { // Accept zPos, default to 0.5



		// Position buttons closer to the scoreboard
		const topOffset = 2.0; // Reduced from 4.0 to bring buttons closer
		const topY = height/2 + topOffset; 
		const spacing = 3.0; 
		
		// Make buttons substantially larger
		const buttonScale = 1.5; // Reduced from 1.8 to make buttons smaller
		
		const totalWidth = (this.buttonList.length) * spacing;
		const startX = -totalWidth / 2; 
		
		// console.log(`Positioning social buttons: width=${width}, height=${height}, topY=${topY}, startX=${startX}, zPos=${zPos}`);
		
		this.buttonList.forEach((button, index) => {
			if (!button) return;
			
			const x = startX + (index * spacing);
			
			// Force extreme position to guarantee visibility
			button.position.set(x, topY, zPos);
			button.scale.set(buttonScale, buttonScale, buttonScale);
			button.visible = true;
			button.renderOrder = 9000 + index * 10; // Extremely high to overcome any potential sorting issues
			
			// Ensure all nested objects inherit extreme visibility settings
			button.traverse(obj => {
				// Make sure all symbols are positioned properly relative to button
				if (obj.parent && obj.parent !== button && obj.parent.parent === button) {
					// This is a symbol element (X, Discord logo, URL symbol)
					obj.position.z = -0.1 // Position further in front of sphere (remember Z is inverted)
				}
				
				if (obj.type === 'Mesh') {
					if (obj.material) {
						obj.material.depthTest = obj.geometry.type === 'SphereGeometry' ? true : false;
						obj.material.depthWrite = false;
						obj.material.transparent = true;
						obj.material.opacity = 1.0;
						obj.material.side = THREE.DoubleSide;
					}
					// Ensure symbol meshes render on top of the sphere
					if (obj.parent && obj.parent.parent === button && obj.geometry.type !== 'SphereGeometry') {
						obj.renderOrder = 9010 + index * 10; // Higher than the button sphere
					} else {
						obj.renderOrder = 9001 + index * 10; // Standard for button elements
					}
				}
				obj.visible = true; // Force visibility
			});
			
			// Ensure symbol groups are positioned correctly in front of the sphere
			for (let i = 1; i < button.children.length; i++) {
				const symbolGroup = button.children[i];
				if (symbolGroup && symbolGroup.type === 'Group') {
					symbolGroup.position.z = -0.2; // Position further in front of sphere (remember Z is inverted)
					symbolGroup.traverse(obj => {
						if (obj.material) {
							obj.renderOrder = 9010 + index * 10; // Even higher render order
						}
					});
				}
			}
			
			// Log the button state
			console.log(`Button ${index} (${button.userData.action}): position=(${button.position.x}, ${button.position.y}, ${button.position.z}), visible=${button.visible}, renderOrder=${button.renderOrder}`);
		});
	}
	
	/**
	 * Update button colors based on token link availability or default if no token.
	 * @param {Object | null} token - The token data, or null.
	 */
	updateButtonColors(token) {
		this.activeToken = token; // Keep track of the token used for coloring

		// Debug logging to track token values
		console.log("updateButtonColors called with token:", token ? "Present" : "Null", 
			"Keys:", token ? Object.keys(token).length : 0);

		// First set all buttons to grey as default
		this.setButtonColor(this.twitterButton, 0x888888);
		this.setButtonColor(this.discordButton, 0x888888);
		this.setButtonColor(this.urlButton, 0x888888);
		this.setButtonColor(this.dexscreenerButton, 0x888888);
		this.setButtonColor(this.telegramButton, 0x888888);
		
		// Clear URLs
		this.twitterUrl = null;
		this.discordUrl = null;
		this.websiteUrl = null;
		this.dexscreenerUrl = null;

		// Only update colors if we have a valid token with data
		if (token && Object.keys(token).length > 0) {
			// In detail mode with a valid token
			console.log("Valid token detected in updateButtonColors");
			
			const hasTwitter = !!(token.socialLinks?.twitter || 
							token.socialLinks?.x || 
							token.links?.twitter || 
							token.links?.x ||
							token.baseToken?.symbol);
			
			this.setButtonColor(this.twitterButton, 
				hasTwitter ? 0x1DA1F2 : 0x888888); // Blue if active, grey if not
			
			// Discord button
			const hasDiscord = !!(token.socialLinks?.discord || 
							token.links?.discord);
			
			this.setButtonColor(this.discordButton,
				hasDiscord ? 0x5865F2 : 0x888888); // Purple if active, grey if not
			
			// URL button
			const hasUrl = !!(token.website || 
						token.socialLinks?.website || 
						token.links?.website ||
						token.explorer);
			
			this.setButtonColor(this.urlButton,
				hasUrl ? 0x00C853 : 0x888888); // Green if active, grey if not
				
			// Dexscreener button
			const hasDexscreenerLink = !!(token.tokenAddress);
			
			this.setButtonColor(this.dexscreenerButton,
				hasDexscreenerLink ? 0xFF9800 : 0x888888); // Orange if active, grey if not
			
			// Telegram button
			const hasTelegramLink = !!(token.socialLinks?.telegram || 
							token.links?.telegram);
			
			this.setButtonColor(this.telegramButton,
				hasTelegramLink ? 0x0088CC : 0x888888); // Blue if active, grey if not
			
			// Store relevant URLs for each button for easy access when clicked
			this.twitterUrl = this.getTwitterUrl(token);
			this.discordUrl = this.getDiscordUrl(token);
			this.websiteUrl = this.getWebsiteUrl(token);
			this.dexscreenerUrl = this.getDexscreenerUrl(token);
			
			// Log button state for debugging
			console.log("Button colors updated:", {
				twitter: hasTwitter ? "BLUE" : "GREY",
				discord: hasDiscord ? "PURPLE" : "GREY",
				url: hasUrl ? "GREEN" : "GREY",
				dexscreener: hasDexscreenerLink ? "ORANGE" : "GREY",
				telegram: hasTelegramLink ? "BLUE" : "GREY"
			});
		} else {
			// Log that all buttons remain grey
			console.log("No valid token - all buttons set to GREY");
		}
	}
	
	/**
	 * Get the Twitter/X URL for the token
	 * @private
	 */
	getTwitterUrl(token) {
		if (!token) return null;
		
		// Check for direct Twitter/X links
		if (token.socialLinks?.twitter) return token.socialLinks.twitter;
		if (token.socialLinks?.x) return token.socialLinks.x;
		if (token.links?.twitter) return token.links.twitter;
		if (token.links?.x) return token.links.x;
		
		// If no direct link but we have symbol, create a search URL
		if (token.baseToken?.symbol) {
			return `https://twitter.com/search?q=%24${encodeURIComponent(token.baseToken.symbol)}`;
		}
		
		return null;
	}
	
	/**
	 * Get the Discord URL for the token
	 * @private
	 */
	getDiscordUrl(token) {
		if (!token) return null;
		
		if (token.socialLinks?.discord) return token.socialLinks.discord;
		if (token.links?.discord) return token.links.discord;
		
		return null;
	}
	
	/**
	 * Get the Website URL for the token
	 * @private
	 */
	getWebsiteUrl(token) {
		if (!token) return null;
		
		// Check for direct website links
		if (token.website) return token.website;
		if (token.socialLinks?.website) return token.socialLinks.website;
		if (token.links?.website) return token.links.website;
		
		// Fall back to explorer if available
		if (token.explorer) return token.explorer;
		
		// // Last resort: if we have token address, create a generic explorer link
		// if (token.tokenAddress) {
		// 	// Since we don't know which blockchain, we'll use Etherscan as default
		// 	// This could be improved with chain detection logic
		// 	return `https://etherscan.io/token/${token.tokenAddress}`;
		// }
		
		return null;
	}
	
	/**
	 * Get the Dexscreener URL for the token
	 * @private
	 */
	getDexscreenerUrl(token) {
		if (!token || !token.tokenAddress) return null;
		
		// Different base URL depending on chain
		const chainId = token.chainId || 1; // Default to Ethereum if not specified
		
		// Format: https://dexscreener.com/ethereum/0x...
		let chainName = 'ethereum'; // Default
		
		// Map chain IDs to Dexscreener URL paths
		switch (chainId) {
			case 1: 
				chainName = 'ethereum'; 
				break;
			case 56: 
				chainName = 'bsc'; 
				break;
			case 42161: 
				chainName = 'arbitrum'; 
				break;
			case 10: 
				chainName = 'optimism'; 
				break;
			case 137: 
				chainName = 'polygon'; 
				break;
			case 8453: 
				chainName = 'base'; 
				break;
			case 43114: 
				chainName = 'avalanche'; 
				break;
		}
		
		return `https://dexscreener.com/${chainName}/${token.tokenAddress}`;
	}
	
	/**
	 * Set a button's background color
	 */
	setButtonColor(button, color) {

		if (!button){
			console.log("Button not found (sphere)");
			return;
		}
		
		// Find the sphere background (first child)
		const sphere = button.children.find(child => child.type === 'Mesh' && child.geometry.type === 'SphereGeometry');
		
		console.log("Sphere found", sphere, button);
		if (!sphere){
			console.log("Sphere not found");
			return;
		}
		if(!sphere.material){
			console.log("Sphere material not found", sphere, button);
			return;
		}
		if (sphere && sphere.material) {
			console.log("Setting sphere color to:", color);
			sphere.material.color.setHex(color);
		}
	}
	
	/**
	 * Clean up resources
	 */
	dispose() {
		this.buttonList.forEach(button => {
			if (button) {
				button.traverse(obj => {
					if (obj.geometry) obj.geometry.dispose();
					if (obj.material) obj.material.dispose();
				});
				
				if (button.parent) {
					button.parent.remove(button);
				}
			}
		});
		
		this.buttonList = [];
		this.twitterButton = null;
		this.discordButton = null;
		this.urlButton = null;
		this.dexscreenerButton = null;
		this.telegramButton = null;
	}
	
	/**
	 * Check if an object is one of our buttons
	 */
	isButtonObject(obj) {
		if (!obj) return false;
		
		// Check if object is one of our buttons or inside one
		return this.buttonList.some(button => 
			obj === button || 
			(obj.parent && this.isParentOneOfOurButtons(obj.parent)));
	}
	
	/**
	 * Helper to check if parent is one of our buttons
	 */
	isParentOneOfOurButtons(parent) {
		if (!parent) return false;
		
		// Check if parent is one of our buttons
		if (this.buttonList.includes(parent)) return true;
		
		// Check parent's parent recursively
		return this.isParentOneOfOurButtons(parent.parent);
	}

	/**
	 * Flash a social button red to indicate no link is available or action failed.
	 * @param {string} platform - The social media platform ('twitter', 'discord', 'url')
	 */
	flashButtonRed(platform) {
		let buttonToFlash = null;
		switch (platform) {
			case 'twitter':
				buttonToFlash = this.twitterButton;
				break;
			case 'discord':
				buttonToFlash = this.discordButton;
				break;
			case 'url':
				buttonToFlash = this.urlButton;
				break;
			case 'dexscreener':
				buttonToFlash = this.dexscreenerButton;
				break;
			case 'telegram':
				buttonToFlash = this.telegramButton;
				break;
		}

		if (!buttonToFlash) return;

		const originalColor = new THREE.Color();
		const sphere = buttonToFlash.children.find(child => child.type === 'Mesh' && child.geometry.type === 'SphereGeometry');
		if (sphere && sphere.material) {
			originalColor.copy(sphere.material.color);
			sphere.material.color.setHex(0xFF0000); // Flash red
		}

		setTimeout(() => {
			if (sphere && sphere.material) {
				// Revert color - this will be correctly set by the next updateButtonColors call
				// For simplicity, we just revert to grey here, or rely on updateButtonColors.
				// Re-evaluate based on activeToken to set the correct color.
				if (this.activeToken) {
					let hasLink = false;
					let defaultColor = 0x888888; // Default to grey

					if (platform === 'twitter') {
						hasLink = !!(this.activeToken.socialLinks?.twitter || this.activeToken.socialLinks?.x || this.activeToken.links?.twitter || this.activeToken.links?.x || this.activeToken.baseToken?.symbol);
						defaultColor = 0x1DA1F2;
					} else if (platform === 'discord') {
						hasLink = !!(this.activeToken.socialLinks?.discord || this.activeToken.links?.discord);
						defaultColor = 0x5865F2;
					} else if (platform === 'url') {
						hasLink = !!(this.activeToken.website || this.activeToken.socialLinks?.website || this.activeToken.links?.website || this.activeToken.explorer || this.activeToken.tokenAddress);
						defaultColor = 0x00C853;
					} else if (platform === 'dexscreener') {
						hasLink = !!(this.activeToken.tokenAddress);
						defaultColor = 0xFF9800;
					} else if (platform === 'telegram') {
						hasLink = !!(this.activeToken.socialLinks?.telegram || this.activeToken.links?.telegram);
						defaultColor = 0x0088CC;
					}
					sphere.material.color.setHex(hasLink ? defaultColor : 0x888888);
				} else {
					// If no active token, set to grey
					sphere.material.color.setHex(0x888888);
				}
			}
		}, 300);
	}
} 