import * as THREE from 'three';
//new
import { LEDDisplay } from './led-display.js';
import { JetsManager } from './jets.js';
import { ButtonManager } from './buttons.js';
import { AnimationManager } from './animations.js';
import { calculateHorizontalSpreadFactor, calculateScaleFactor, clamp, formatCompactNumber, formatPrice, formatChange, getChangeColor } from './utils.js';
import { createScoreboardStructure, addDecorativeElements } from './createScoreboardStructure.js';
import * as gsap from 'gsap';

/**
 * 3D LED Scoreboard for displaying token data in the sky
 * Always stays in a fixed screen position
 */
export class TokenScoreboard {
	constructor(scene, camera, dataProvider = null) {
		this.scene = scene;
		this.camera = camera;
		this.dataProvider = dataProvider;
		this.displayData = [];
		this.isVisible = true;
		this.sizeMode = 'hidden'; // Start in hidden mode
		this.updateInterval = 10000; // Update every 10 seconds
		this.lastUpdateTime = 0;
		this.isAnimatingMode = false;
		this.isPositioningFirst = false;
		
		this.updateScreenPositionTimeout = null;
		this.expandPlanet = null; // New dedicated expand planet
		
		// Camera movement tracking
		this.lastCameraPosition = new THREE.Vector3();
		this.lastCameraQuaternion = new THREE.Quaternion();
		if (camera) {
			this.lastCameraPosition.copy(camera.position);
			this.lastCameraQuaternion.copy(camera.quaternion);
		}
		this.cameraMoveTime = 0;
		this.cameraMovementTimeout = null;
		this.cameraMovementThreshold = 0.005; // More sensitive detection (was 0.01)
		this.cameraRotationThreshold = 0.005; // Detect small rotations too
		this.cameraRestTimer = 400; // Slightly faster repositioning (was 500ms)
		
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
		
		// Scoreboard dimensions
		this.width = 15;
		this.height = 8; // Default height when normal
		this.expandedHeight = 20; // Placeholder, will be computed dynamically
		this.targetHeight = this.sizeMode === 'tall' ? this.computeExpandedHeight() : (this.sizeMode === 'normal' ? 8 : 1);
		this.initialHeight = this.height;
		
		// Token display settings
		this.maxTokensToShow = 30;
		this.scrollSpeed = 0.5;  // How fast the display scrolls
		this.scrollPosition = 0;
		
		// Movement parameters
		this.lastPosition = new THREE.Vector3();
		this.movementThreshold = 0.05;
		
		// Create the scoreboard mesh
		this.scoreboardGroup = new THREE.Group();
		
		// Create the physical structure using the imported modules
		createScoreboardStructure(this.scoreboardGroup, this.width, this.height);
		this.cornerBolts = addDecorativeElements(this.scoreboardGroup, this.width , this.height);
		
		// Create subsystems
		this.ledDisplay = new LEDDisplay(this.scoreboardGroup, this.width -1.2, this.height);
		this.buttonManager = new ButtonManager(this.scoreboardGroup);
		this.animationManager = new AnimationManager();
		
		// Add to scene
		this.scene.add(this.scoreboardGroup);
		
		// Create corner jets after scoreboard structure is created
		this.jetsManager = new JetsManager(this.scoreboardGroup, this.cornerBolts);
		
		// Store jetsManager reference in scoreboardGroup userData for animations to access
		if (!this.scoreboardGroup.userData) this.scoreboardGroup.userData = {};
		this.scoreboardGroup.userData.jetsManager = this.jetsManager;
		
		console.log("Token scoreboard created");
		
		// Create coordinate axes helper for debugging
		//this.createCoordinateAxesHelper();
		
		// Store initial width to maintain during animations
		this.initialWidth = this.width;
		
		// Update position initially
		this._updateScreenPosition();
		this.lastPosition.copy(this.scoreboardGroup.position);
		
		// Initialize camera position tracking
		if (this.camera) {
			this.lastCameraPosition.copy(this.camera.position);
			this.lastCameraQuaternion.copy(this.camera.quaternion);
		}
		
		// Ensure buttons are positioned correctly on initialization
		if (this.buttonManager) {
			this.buttonManager.updateButtonPositions(this.width, this.height, this.sizeMode);
		}
		
		// Add event listener for window resize
		window.addEventListener('resize', () => this.handleResize());
		
		// Detail mode state
		this.detailMode = false;
		this.detailToken = null;
		this.detailRefreshInterval = 6000; // 6 seconds
		this.lastDetailRefresh = 0;
		this.isRefreshingDetail = false;
		this.changeSizeMode('hidden');

		// Automatically resize to normal after a 1-second delay
		setTimeout(() => {
			console.log("Auto-resizing scoreboard to normal mode after delay");
			this.changeSizeMode('normal');
		}, 7000);

		this.lastModeChangeTime = 0; // Timestamp of last size mode change to prevent double animations
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
		console.log("Updating screen position");
		if (!this.camera) return;

		// Skip update if we're animating a mode change or if an animation is already in progress
		if (this.isAnimatingMode || this.animationManager.isMoving) {
			console.log("Skipping position update - currently animating");
			return;
		}

		// Calculate the target position based on field of view
		const fov = this.camera.fov * Math.PI / 180;
		const distance = 10; // Fixed distance from camera
		const viewHeight = 2 * Math.tan(fov / 2) * distance;
		const viewWidth = viewHeight * this.camera.aspect;
		
		// Get actual pixel width for more accurate decisions
		const actualPixelWidth = window.innerWidth || 1200;
		console.log(`Actual screen width: ${actualPixelWidth}px, FOV width: ${viewWidth.toFixed(2)}`);
		
		// Hard pixel width thresholds for different screen sizes
		const isVeryNarrowScreen = actualPixelWidth < 600;  // Mobile phones
		const isNarrowScreen = actualPixelWidth < 750 && !isVeryNarrowScreen; // Small tablets
		const isMediumScreen = actualPixelWidth >= 750 && actualPixelWidth < 900; // Medium screens
		
		// Calculate appropriate scale based on screen width using utility function
		const scale = calculateScaleFactor(actualPixelWidth);
		if (isVeryNarrowScreen) {
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
			// Bottom for normal and hidden modes
			this.screenPosition.y = -0.55; // Raised slightly from -0.6 to keep more visible on screen
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
			const mediumOffset = -0.25; // Moved further left from -0.2
			this.screenPosition.x = mediumOffset;
			console.log(`Medium screen width (${actualPixelWidth}px), using moderate left position: ${mediumOffset}`);
		} else {
			// Standard left alignment on wider screens, but not as far left
			this.screenPosition.x = -0.5; // Moved further left from -0.4
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
			console.log(`Significant movement detected: ${movement.length().toFixed(3)} units - activating jets`);
			
			// Animate the movement
			const moveDir = this.animationManager.animateMovement(
				this.scoreboardGroup, 
				targetPos, 
				targetQuaternion, 
				scale
			);
			
			// Activate jets during movement
			if (this.jetsManager && this.sizeMode !== 'hidden') {
				// Trigger jets with full intensity
				this.jetsManager.activateJets(moveDir);
				
				// Set up periodic jet activations during movement for a more dramatic effect
				const jetInterval = setInterval(() => {
					if (this.animationManager.isMoving) {
						this.jetsManager.activateJets(moveDir, false);
					} else {
						clearInterval(jetInterval); // Stop when movement ends
						
						// One final jet effect when movement completes
						if (this.sizeMode !== 'hidden') {
							this.triggerJetEffect(0.7, this._burstFromOrigin);
						}
					}
				}, 150); // Activate jets every 150ms during movement
			}
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
		
		// Update visibility of scoreboard components based on size mode
		if (this.sizeMode === 'hidden') {
			// In hidden mode, keep the group visible but hide most components
			this.scoreboardGroup.visible = true;
			
			// Hide everything except the expand button
			this.scoreboardGroup.traverse(obj => {
				// Skip the group itself
				if (obj === this.scoreboardGroup) return;
				
				// Keep only the expand button visible
				if (this.buttonManager && 
					obj === this.buttonManager.expandButton || 
					(obj.parent && obj.parent === this.buttonManager.expandButton)) {
					obj.visible = true;
					
					// Ensure expand button is clearly visible
					if (obj.material) {
						obj.material.depthTest = false;
						obj.renderOrder = 100;
					}
					return;
				}
				
				// Hide everything else
				obj.visible = false;
			});
			
			// Position the expand button prominently in view
			if (this.buttonManager && this.buttonManager.expandButton) {
				this.buttonManager.expandButton.position.set(0, 0, -1.0);
				this.buttonManager.expandButton.visible = true;
			}
			
			// Show the dedicated expand planet in hidden mode
			if (this.expandPlanet) {
				this.expandPlanet.visible = true;
				
				// Position the expand planet in bottom left based on screen size
				const bottomLeftX = -viewWidth * 0.4;
				const bottomLeftY = -viewHeight * 0.35;
				
				// Calculate position in 3D space for bottom left
				const planetPos = this.camera.position.clone()
					.add(forward.clone().multiplyScalar(distance))
					.add(right.clone().multiplyScalar(bottomLeftX))
					.add(up.clone().multiplyScalar(bottomLeftY));
				
				// Set position for expand planet
				this.expandPlanet.position.copy(planetPos);
				
				// Set rotation to match camera
				this.expandPlanet.quaternion.copy(quaternion);
				
				// Scale based on screen size
				const planetScale = scale * 1.2; // Slightly larger than scoreboard scale
				this.expandPlanet.scale.set(planetScale, planetScale, planetScale);
			}
		} else {
			// For normal and tall modes, make sure everything is visible
			this.scoreboardGroup.visible = true;
			
			if (this.ledDisplay) {
				this.ledDisplay.ledGroup.visible = true;
			}
			
			// Hide the dedicated expand planet in non-hidden modes
			if (this.expandPlanet) {
				this.expandPlanet.visible = false;
			}
		}
	}
	
	/**
	 * Handle interaction with the scoreboard
	 * @param {THREE.Raycaster} raycaster - Raycaster for interaction
	 * @returns {boolean} Whether interaction occurred
	 */
	handleInteraction(raycaster) {
		if (!this.isVisible) return false;

		// Check for interaction with the dedicated expand planet first in hidden mode
		if (this.sizeMode === 'hidden' && this.expandPlanet && this.expandPlanet.visible) {
			const planetIntersects = raycaster.intersectObject(this.expandPlanet, true);
			if (planetIntersects.length > 0) {
				console.log("Expand planet clicked in hidden mode");
				this.changeSizeMode('normal');
				return true;
			}
		}

		// Find any intersections with scoreboard's interactive parts
		const intersects = raycaster.intersectObject(this.scoreboardGroup, true);
		if (intersects.length > 0) {
			// In hidden mode, we only want to handle expand button interactions
			if (this.sizeMode === 'hidden') {
				// Check if the intersection is with the expand button or any of its children
				const expandButtonIntersection = intersects.find(intersection => {
					const obj = intersection.object;
					
					// Check if the object is part of the expand button hierarchy
					let currentObj = obj;
					while (currentObj) {
						if (currentObj === this.buttonManager.expandButton) {
							return true;
						}
						currentObj = currentObj.parent;
					}
					
					return false;
				});
				
				if (expandButtonIntersection) {
					console.log("Expand button clicked in hidden mode");
					// In hidden mode, expand button always changes to normal mode
					this.changeSizeMode('normal');
					return true;
				}
				
				return false;
			}
			
			// Normal interaction handling for other modes
			return this.buttonManager.handleInteraction(raycaster, (action) => {
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
				} else if (action === 'exit') {
					// Exit detail mode
					if (this.detailMode) {
						console.log('Exiting token detail mode via exit button');
						this.exitTokenDetail();
						return true;
					}
				} else if (action === 'twitter') {
					// Open Twitter/X link if available
					this.handleSocialMediaClick('twitter');
					return true;
				} else if (action === 'discord') {
					// Open Discord link if available
					this.handleSocialMediaClick('discord');
					return true;
				} else if (action === 'url') {
					// Open project URL if available
					this.handleSocialMediaClick('url');
					return true;
				}
				return false;
			});
		}
		return false;
	}
	
	/**
	 * Handle social media button clicks
	 * @param {string} platform - The social media platform ('twitter', 'discord', 'url')
	 */
	handleSocialMediaClick(platform) {
		if (!this.detailToken) {
			console.log(`No token selected for ${platform} link`);
			return;
		}
		
		let url = null;
		
		// Get the appropriate URL based on platform
		if (platform === 'twitter') {
			url = this.detailToken.socialLinks?.twitter || 
				this.detailToken.socialLinks?.x || 
				this.detailToken.links?.twitter || 
				this.detailToken.links?.x;
			
			// If no direct Twitter link, try to create one if we have a symbol
			if (!url && this.detailToken.baseToken?.symbol) {
				const symbol = this.detailToken.baseToken.symbol;
				url = `https://twitter.com/search?q=%24${symbol}`;
			}
		} else if (platform === 'discord') {
			url = this.detailToken.socialLinks?.discord || 
				this.detailToken.links?.discord;
		} else if (platform === 'url') {
			// For URL, try several possible fields
			url = this.detailToken.website || 
				this.detailToken.socialLinks?.website || 
				this.detailToken.links?.website ||
				this.detailToken.explorer;
				
			// If we have an address but no website, create an explorer link
			if (!url && this.detailToken.tokenAddress) {
				// Use chain-appropriate explorer
				const chainId = this.detailToken.chainId;
				
				if (chainId === 1) { // Ethereum mainnet
					url = `https://etherscan.io/token/${this.detailToken.tokenAddress}`;
				} else if (chainId === 56) { // Binance Smart Chain
					url = `https://bscscan.com/token/${this.detailToken.tokenAddress}`;
				} else if (chainId === 42161) { // Arbitrum
					url = `https://arbiscan.io/token/${this.detailToken.tokenAddress}`;
				} else if (chainId === 10) { // Optimism
					url = `https://optimistic.etherscan.io/token/${this.detailToken.tokenAddress}`;
				} else if (chainId === 137) { // Polygon
					url = `https://polygonscan.com/token/${this.detailToken.tokenAddress}`;
				} else if (chainId === 8453) { // Base
					url = `https://basescan.org/token/${this.detailToken.tokenAddress}`;
				} else {
					// Generic fallback to Etherscan
					url = `https://etherscan.io/token/${this.detailToken.tokenAddress}`;
				}
			}
		}
		
		// Open the URL if found
		if (url) {
			console.log(`Opening ${platform} link: ${url}`);
			window.open(url, '_blank');
		} else {
			console.log(`No ${platform} link available for this token`);
		}
	}
	
	/**
	 * Change the size mode of the scoreboard
	 * @param {string} mode - The new size mode ('normal', 'tall', 'hidden')
	 */
	changeSizeMode(mode) {
		// Prevent rapid or duplicate size mode changes within 1 second
		const now = performance.now();
		if (now - (this.lastModeChangeTime || 0) < 1000) {
			console.log(`Ignoring size mode change to ${mode} – called too soon after previous change.`);
			return;
		}
		this.lastModeChangeTime = now;
		
		console.log(`Changing size mode to: ${mode}`);
		if (this.sizeMode === mode) return;
		
		// Always fix bolt positions before starting any mode transition
		// This ensures we start from a good state
		this.fixBoltPositions();
		
		// Store the previous mode to handle transitions correctly
		const previousMode = this.sizeMode;
		this.sizeMode = mode;
		
		// ENHANCED BURST EFFECT: Configure burst origin for more dramatic appearance
		// Make it active for hidden/small -> normal/tall mode changes
		this._burstFromOrigin = (previousMode === 'hidden' || previousMode === 'small') && 
			(mode === 'normal' || mode === 'tall');
		
		// Calculate a better burst origin position if we're doing a burst effect
		if (this._burstFromOrigin) {
			// Create a center point slightly toward the camera for better visibility
			this._burstOriginPoint = new THREE.Vector3(0, 0, -0.5);
			
			// Pre-position bolts at burst origin if we're doing a burst effect
			// This creates a more dramatic start to the animation
			if (this.cornerBolts) {
				this.cornerBolts.forEach(bolt => {
					// Make bolt visible first
					bolt.visible = true;
					if (bolt.userData.plate) {
						bolt.userData.plate.visible = true;
					}
					
					// Position at burst origin
					bolt.position.copy(this._burstOriginPoint);
					
					// If plates exist, position them too
					if (bolt.userData.plate) {
						bolt.userData.plate.position.copy(this._burstOriginPoint);
						// Offset plate slightly behind the bolt
						bolt.userData.plate.position.z += 0.1;
					}
				});
				
				// Force sync jets with the burst origin position
				if (this.jetsManager) {
					this.jetsManager.syncJetsWithBolts(true);
					
					// Pre-emit some particles to make the burst more visible
					this.triggerJetEffect(1.5, true); // Enable burst effect
				}
			}
		}
		
		// Explicitly ensure LED display visibility when changing from hidden to normal/tall
		if (previousMode === 'hidden' && (mode === 'normal' || mode === 'tall')) {
			if (this.ledDisplay && this.ledDisplay.ledGroup) {
				console.log('Explicitly setting LED display to visible for normal/tall mode');
				this.ledDisplay.ledGroup.visible = true;
			} else {
				console.warn('LED display or ledGroup not found when trying to make visible');
			}
			
			// Extra debug check for buttons
			if (this.buttonManager) {
				console.log('Button manager exists, checking buttons:');
				console.log('- expandButton:', !!this.buttonManager.expandButton);
				console.log('- collapseButton:', !!this.buttonManager.collapseButton);
				
				if (this.buttonManager.expandButton) {
					this.buttonManager.expandButton.visible = true;
					console.log('Set expandButton.visible = true');
				}
				if (this.buttonManager.collapseButton) {
					this.buttonManager.collapseButton.visible = true;
					console.log('Set collapseButton.visible = true');
				}
			} else {
				console.warn('Button manager not found when trying to show buttons');
			}
		}
		
		// For transitions to hidden mode, ensure the expand planet is properly positioned
		if (mode === 'hidden') {
			if (this.expandPlanet) {
				this.expandPlanet.visible = true;
				this._positionExpandPlanetBottomRight();
			}
			// Make absolutely sure all bolts and their plates are hidden
			if (this.cornerBolts) {
				this.cornerBolts.forEach(bolt => {
					bolt.visible = false;
					if (bolt.userData?.plate) bolt.userData.plate.visible = false;
				});
			}
		}
		
		this.updateScoreboardDimensions();
		
		// Ensure buttons are updated dynamically, especially when coming from hidden mode
		if (mode === 'normal' && this.buttonManager) {
			this.buttonManager.updateButtonPositions(this.width, this.height, mode);
			this.buttonManager.updateButtonColors(mode);
			// Reset material properties to ensure visibility settings are correct
			[this.buttonManager.expandButton, this.buttonManager.collapseButton, this.buttonManager.urlButton].forEach(button => {
				if (button) {
					button.traverse(obj => {
						if (obj.material) {
							obj.material.depthTest = true; // Reset to default
							obj.material.renderOrder = 15; // Reset to standard button render order
						}
					});
				}
			});
		}
		
		// Fix bolt positions again before starting animation
		if (!this._burstFromOrigin) {
			this.fixBoltPositions();
		}
		
		// Animate the change in scoreboard dimensions
		this.positionAndExpandScoreboard();
		
		// Save the mode to local storage to persist across sessions
		try {
			localStorage.setItem('scoreboardSizeMode', mode);
			console.log(`Saved size mode ${mode} to local storage`);
		} catch (e) {
			console.error('Failed to save size mode to local storage:', e);
		}
	}
	
	/**
	 * Two-phase animation for going to tall mode:
	 * 1. First reposition to center of screen
	 * 2. Then expand height and position top bolts
	 */
	positionAndExpandScoreboard() {
		console.log("Starting two-phase animation: positioning first, then expanding height");
		
		// CRITICAL: Prevent double animations by early-returning if already animating
		if (this.isAnimatingMode) {
			console.log("Animation already in progress, ignoring additional animation request");
			return;
		}
		
		// Set animation flag to prevent position updates during animation
		this.isAnimatingMode = true;
		
		// Force activate jets immediately before animation starts (pre-animation effect)
		if (this.jetsManager && this.sizeMode !== 'hidden') {
			this.jetsManager.syncJetsWithBolts(true); // Force update with particle emission
			this.triggerJetEffect(1.0); // Maximum intensity to make jets very noticeable
		}
		
		// Clear LED display during animation to reduce visual noise
		if (this.ledDisplay) {
			this.ledDisplay.clear();
		}
		
		// Define the starting and target heights for animation
		this.startHeight = this.height;
		if (this.sizeMode === 'tall') {
			this.targetHeight = this.computeExpandedHeight();
		} else if (this.sizeMode === 'normal') {
			this.targetHeight = 8; // Default normal height
		} else {
			this.targetHeight = 1; // Hidden mode height
		}
		
		// Set fov-dependent target positions for top bolts
		if (this.cornerBolts && this.cornerBolts.length >= 4) {
			if (this.camera) {
				const fov = this.camera.fov * Math.PI / 180;
				const distance = 10;
				const viewHeight = 2 * Math.tan(fov / 2) * distance;
				const viewWidth = viewHeight * this.camera.aspect;
				
				// Get actual pixel width for more accurate decisions
				const actualPixelWidth = window.innerWidth || 1200;
				
				// Calculate appropriate horizontal spread using utility function
				const horizontalSpreadFactor = calculateHorizontalSpreadFactor(actualPixelWidth);
				
				// Find bolts by their side property rather than by index
				const rightBolts = this.cornerBolts.filter(bolt => bolt.userData.isRightSide);
				const leftBolts = this.cornerBolts.filter(bolt => !bolt.userData.isRightSide);
				
				// Get top bolts from each side
				const topRightBolt = rightBolts.find(bolt => bolt.position.y > 0) || rightBolts[0];
				const topLeftBolt = leftBolts.find(bolt => bolt.position.y > 0) || leftBolts[0];
				
				// Set target positions for tall mode
				if (topRightBolt) {
					topRightBolt.userData.targetTallPosition = new THREE.Vector3(
						viewWidth * horizontalSpreadFactor, // Positive X = right side
						viewHeight * 0.48,
						topRightBolt.userData.originalPosition?.z || -1.0
					);
				}
				
				if (topLeftBolt) {
					topLeftBolt.userData.targetTallPosition = new THREE.Vector3(
						-viewWidth * horizontalSpreadFactor, // Negative X = left side
						viewHeight * 0.48,
						topLeftBolt.userData.originalPosition?.z || -1.0
					);
				}
				
				console.log("Set target tall positions for bolts:", 
					`Right=${topRightBolt?.userData.targetTallPosition?.x.toFixed(2)}, `,
					`Left=${topLeftBolt?.userData.targetTallPosition?.x.toFixed(2)}`);
			}
		}
		
		// Special handling for hidden to normal transition
		const isHiddenToNormal = this.sizeMode === 'normal' && this.startHeight <= 1;
		
		// Temporary flag to indicate we're in position-first mode
		this.isPositioningFirst = true;
		
		// Step 1: Update screen position without changing height yet
		this._updateScreenPosition();
		
		// For hidden to normal, use a special starting position that's better for animation
		if (isHiddenToNormal) {
			// Ensure bolts are visible for the transition
			this.cornerBolts?.forEach(bolt => {
				bolt.visible = true;
				if (bolt.userData.plate) {
					bolt.userData.plate.visible = true;
				}
			});
			
			// Make sure the LED display is visible for normal mode
			if (this.ledDisplay && this.ledDisplay.ledGroup) {
				this.ledDisplay.ledGroup.visible = true;
			}
			
			// Make the structure visible
			if (this.scoreboardGroup.userData.displayMesh) {
				this.scoreboardGroup.userData.displayMesh.visible = true;
			}
			if (this.scoreboardGroup.userData.backPanelMesh) {
				this.scoreboardGroup.userData.backPanelMesh.visible = true;
			}
			
			// Force sync jets with bolts after position update
			if (this.jetsManager) {
				this.jetsManager.syncJetsWithBolts(true); // Force update
			}
		}
		
		// Hide all bolts immediately when going to hidden mode
		if (this.sizeMode === 'hidden') {
			this.cornerBolts?.forEach(bolt => {
				bolt.visible = false;
				if (bolt.userData.plate) {
					bolt.userData.plate.visible = false;
				}
			});
		}
		
		// Set up a listener to detect when movement animation is complete
		const checkMovementComplete = () => {
			if (!this.animationManager.isMoving) {
				// Movement is complete, now expand height
				console.log("Repositioning complete, now expanding height");
				this.isPositioningFirst = false;
				
				// Trigger initial jet effect on movement completion to make jets noticeable
				if (this.jetsManager && this.sizeMode !== 'hidden') {
					// Force sync jets with bolts after position update
					this.jetsManager.syncJetsWithBolts(true); // Force update to ensure proper positioning
					this.triggerJetEffect(0.8, this._burstFromOrigin);
				}
				
				// Start the corner bolts animation to expand height
				this.animationManager.animateCornerBolts(
					this.cornerBolts,
					this.sizeMode === 'tall', // True if tall mode
					this.startHeight,
					this.targetHeight,
					(newHeight, progress) => {
						// Update height and dimensions during animation
						this.height = newHeight;
						this.updateScoreboardDimensions();
						
						// Update LED display height during animation
						if (this.ledDisplay) {
							this.ledDisplay.height = newHeight;
						}
						
						// Force jets to sync with bolt positions during animation
						if (this.jetsManager && this.sizeMode !== 'hidden') {
							// Force sync at more frequent intervals and every time progress changes
							this.jetsManager.syncJetsWithBolts(true);
							
							// Periodically trigger jet effects
							if (Math.random() < 0.08) { // Increased chance from 0.1 to 0.08
								this.triggerJetEffect(0.7);
							}
						}
					},
					() => this.finalizeSizeModeChange(),
					{ burstFromOrigin: !!this._burstFromOrigin, burstOrigin: this._burstOriginPoint || new THREE.Vector3(0, 0, -1.0) }
				);
			} else {
				// Still moving, check again soon
				requestAnimationFrame(checkMovementComplete);
				
				// Sync jets with bolts during position movement too
				if (this.jetsManager && this.sizeMode !== 'hidden') {
					this.jetsManager.syncJetsWithBolts();
				}
			}
		};
		
		// Start checking if we're moving
		if (this.animationManager.isMoving) {
			// Already moving, wait for it to complete
			console.log("Animation in progress, waiting for completion");
			checkMovementComplete();
		} else {
			// Not moving, maybe no animation was needed, go straight to height animation
			console.log("No movement animation needed, going straight to height animation");
			this.isPositioningFirst = false;
			
			// Force sync jets with bolts before animation
			if (this.jetsManager && this.sizeMode !== 'hidden') {
				this.jetsManager.syncJetsWithBolts(true); // Force update
			}
			
			// Special case for hidden -> normal transition
			if (isHiddenToNormal) {
				// Add a brief delay for smoother visual transition
				setTimeout(() => {
					// Set initial height to make sure animation works properly
					this.height = 1; // Start from 1 high
					
					// Trigger a jet effect before starting the animation for visual feedback
					if (this.jetsManager) {
						this.triggerJetEffect(0.9, this._burstFromOrigin);
					}
					
					// Start the height animation
					this.animationManager.animateCornerBolts(
						this.cornerBolts,
						false, // Not tall mode
						this.height,
						this.targetHeight,
						(newHeight, progress) => {
							// Update height and dimensions during animation
							this.height = newHeight;
							this.updateScoreboardDimensions();
							
							// Update LED display height
							if (this.ledDisplay) {
								this.ledDisplay.height = newHeight;
							}
							
							// Force jets to sync with bolt positions during animation
							if (this.jetsManager) {
								// Force sync every animation frame to ensure perfect sync
								this.jetsManager.syncJetsWithBolts(true);
							}
							
							// Fade in the LED display
							if (this.ledDisplay && this.ledDisplay.ledGroup) {
								this.ledDisplay.ledGroup.visible = true;
								// Gradually increase opacity during animation
								this.ledDisplay.ledGroup.traverse(obj => {
									if (obj.material && obj.material.opacity !== undefined) {
										obj.material.opacity = Math.min(1.0, progress * 2);
									}
								});
							}
							
							// Periodically trigger jet effects for visual feedback
							if (this.jetsManager && Math.random() < 0.15) {
								this.triggerJetEffect(0.6 * progress, this._burstFromOrigin);
							}
						},
						() => {
							console.log("Height animation complete, finalizing hidden->normal transition");
							this.finalizeSizeModeChange();
						},
						{ burstFromOrigin: !!this._burstFromOrigin, burstOrigin: this._burstOriginPoint || new THREE.Vector3(0, 0, -1.0) }
					);
				}, 100); // Short delay for visual effect
			} else {
				// Normal animation for other transitions
				this.animationManager.animateCornerBolts(
					this.cornerBolts,
					this.sizeMode === 'tall', // True if tall mode
					this.startHeight || this.height,
					this.targetHeight,
					(newHeight, progress) => {
						// Update height and dimensions during animation
						this.height = newHeight;
						this.updateScoreboardDimensions();
						
						// Update LED display height
						if (this.ledDisplay) {
							this.ledDisplay.height = newHeight;
						}
						
						// Force jets to sync with bolt positions during animation
						if (this.jetsManager && this.sizeMode !== 'hidden') {
							// Force sync EVERY frame during animation for perfect synchronization
							this.jetsManager.syncJetsWithBolts(true);
						}
						
						// Periodically trigger jet effects
						if (this.jetsManager && this.sizeMode !== 'hidden' && Math.random() < 0.1) {
							this.triggerJetEffect(0.5, this._burstFromOrigin);
						}
					},
					() => {
						// Finalize size mode change after animation completes
						console.log("Height animation complete, finalizing size mode change");
						this.finalizeSizeModeChange();
					},
					{ burstFromOrigin: !!this._burstFromOrigin, burstOrigin: this._burstOriginPoint || new THREE.Vector3(0, 0, -1.0) }
				);
			}
		}
	}
	
	/**
	 * Trigger a visual jet effect from the bolts
	 * @param {number} intensity - Optional intensity multiplier (0.0-1.0)
	 * @param {boolean} isBurstEffect - Whether this is part of a burst effect animation
	 */
	triggerJetEffect(intensity = 1.0, isBurstEffect = false) {
		if (!this.jetsManager || !this.cornerBolts || this.cornerBolts.length < 4) return;
		
		console.log(`Triggering jet effect with intensity ${intensity}${isBurstEffect ? ' (burst effect)' : ''}`);
		
		// First force sync jets with bolts to ensure proper positioning
		this.jetsManager.syncJetsWithBolts(true);
		
		// Create random movement vectors for each corner
		this.cornerBolts.forEach((bolt, index) => {
			// Skip if bolt isn't visible
			if (!bolt.visible) {
				console.log("Bolt is not visible, skipping jet effect");
				return;
			}
			
			// Find the matching jet for this bolt
			const jet = this.jetsManager.jets[index];
			if (!jet) {
				console.log(`No matching jet found for bolt ${index}`);
				return;
			}
			
			// CRITICAL FIX: Ensure jet base position matches bolt position
			// Use direct position access as both objects are in the same coordinate space
			jet.basePosition.copy(bolt.position);
			
			// For burst effects, create more dramatic particle distribution
			if (isBurstEffect) {
				// Create multiple directional bursts for a star-like pattern
				for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
					const spread = 0.3 + Math.random() * 0.2;
					
					// Create directional burst with slight z-back component
					const burstDir = new THREE.Vector3(
						Math.cos(angle) * spread,
						Math.sin(angle) * spread,
						-0.7 * intensity
					).normalize();
					
					// Emit particles along this direction
					const particleCount = Math.ceil(10 * intensity);
					for (let i = 0; i < particleCount; i++) {
						this.jetsManager.emitJetParticle(jet, burstDir, intensity * 2.0);
					}
				}
				
				// Add additional particles in random directions
				for (let i = 0; i < 30 * intensity; i++) {
					const randomDir = new THREE.Vector3(
						(Math.random() - 0.5) * 2,
						(Math.random() - 0.5) * 2,
						-0.8 * intensity
					).normalize();
					
					this.jetsManager.emitJetParticle(jet, randomDir, intensity * 1.5);
				}
			} 
			else {
				// Standard particle emission pattern for normal effects
				// Create a random movement direction with strong backwards component
				const moveDir = new THREE.Vector3(
					(Math.random() - 0.5) * 0.4,   // Wider horizontal spread
					(Math.random() - 0.5) * 0.4,   // Wider vertical spread
					(Math.random() - 0.5) * 0.2 - 0.8 * intensity // Strong backward Z component
				);
				
				// Emit particles directly - more particles for higher visibility
				const particleCount = Math.ceil(30 * intensity); // Increased from 20
				for (let i = 0; i < particleCount; i++) {
					this.jetsManager.emitJetParticle(jet, moveDir, intensity * 2.0); // Double intensity
				}
			}
		});
		
		// Update last movement time to prevent immediate fade
		if (this.jetsManager) {
			this.jetsManager.lastMovementTime = performance.now();
		}
		
		// Schedule multiple echo effects for better visibility and longer duration
		if (intensity > 0.3) {
			// Create 3 echo effects with decreasing intensity and ensure sync on each echo
			for (let i = 1; i <= 3; i++) {
				setTimeout(() => {
					// Re-sync jets and bolts before each echo effect
					this.jetsManager.syncJetsWithBolts(true);
					
					// Create the echo effect
					this.cornerBolts.forEach((bolt, index) => {
						if (!bolt.visible) return;
						
						const jet = this.jetsManager.jets[index];
						if (!jet) return;
						
						// CRITICAL FIX: Ensure jet base position matches bolt position
						jet.basePosition.copy(bolt.position);
						
						// Create echo direction vector
						const echoDir = new THREE.Vector3(
							(Math.random() - 0.5) * 0.3,
							(Math.random() - 0.5) * 0.3,
							-0.6 * (1 - i * 0.2) * intensity
						);
						
						// Emit fewer particles for echo effects
						const echoCount = Math.ceil(15 * intensity * (1 - i * 0.2));
						for (let j = 0; j < echoCount; j++) {
							this.jetsManager.emitJetParticle(jet, echoDir, intensity * (1 - i * 0.2));
						}
					});
					
					// Update last movement time to prevent fade
					this.jetsManager.lastMovementTime = performance.now();
				}, i * 150); // Spread out over time
			}
		}
	}
	
	/**
	 * Finalize the size mode change after animations
	 * This ensures screen position updates happen at the right time
	 */
	finalizeSizeModeChange() {
		// Update dimensions (frame, background, LED rows, jets, etc.)
		this.updateScoreboardDimensions();
		
		// Fix bolt positions at the end of animation as a final safeguard
		this.fixBoltPositions();
		
		// Make sure cornerBolts have correct isRightSide properties
		if (this.cornerBolts && this.cornerBolts.length >= 4) {
			// Find right and left bolts
			const rightBolts = this.cornerBolts.filter(bolt => bolt.userData.isRightSide);
			const leftBolts = this.cornerBolts.filter(bolt => !bolt.userData.isRightSide);
			
			console.log(`Checking bolts: ${rightBolts.length} right bolts, ${leftBolts.length} left bolts`);
			
			// Make sure bolt colors match their side
			rightBolts.forEach(bolt => {
				if (bolt.material) {
					bolt.material.color.set(0xDAA520); // Gold for right
					bolt.material.emissive.set(0xDAA520);
				}
			});
			
			leftBolts.forEach(bolt => {
				if (bolt.material) {
					bolt.material.color.set(0x00ff00); // Green for left
					bolt.material.emissive.set(0x00ff00);
				}
			});
		}
		
		// Completely recreate the LED display to prevent duplicate issues when switching modes
		if (this.ledDisplay) {
			// Make sure the LED display has the current dimensions
			this.ledDisplay.width = this.width;
			this.ledDisplay.height = this.height;
			
			console.log(`Recreating LED display for height=${this.height} mode=${this.sizeMode}`);
			this.ledDisplay.recreateDisplay();
			
			// Double-check that display dimensions match current scoreboard dimensions
			if (Math.abs(this.ledDisplay.height - this.height) > 0.1) {
				console.warn("LED display height mismatch - fixing", 
					this.ledDisplay.height, "!=", this.height);
				this.ledDisplay.height = this.height;
				this.ledDisplay.recreateDisplay();
			}
			
			// Ensure LED display visibility matches size mode
			if (this.ledDisplay.ledGroup) {
				this.ledDisplay.ledGroup.visible = this.sizeMode !== 'hidden';
				
				// Reset opacity for all LEDs
				this.ledDisplay.ledGroup.traverse(obj => {
					if (obj.material && obj.material.opacity !== undefined) {
						obj.material.opacity = 1.0;
					}
				});
			}
		}
		
		// Clear animation flag
		this.isAnimatingMode = false;
		
		// Now it's safe to update screen position
		this._updateScreenPosition();
		
		// When changing to normal/tall mode, ensure everything is visible
		if (this.sizeMode !== 'hidden') {
			// Make bolts visible with the correct left/right positioning
			if (this.cornerBolts && this.cornerBolts.length >= 4) {
				const rightBolts = this.cornerBolts.filter(bolt => bolt.userData.isRightSide);
				const leftBolts = this.cornerBolts.filter(bolt => !bolt.userData.isRightSide);
				
				const halfWidth = this.width / 2;
				const halfHeight = this.height / 2;
				
				// Position right side bolts (gold)
				rightBolts.forEach(bolt => {
					const isTopRow = bolt.position.y > 0;
					const yPos = isTopRow ? (halfHeight + 0.1) : (-halfHeight - 0.1);
					bolt.position.set(halfWidth + 0.45, yPos, -1.0);
					bolt.visible = true;
					
					if (bolt.userData.plate) {
						bolt.userData.plate.position.set(halfWidth + 0.45, yPos, -0.9);
						bolt.userData.plate.visible = true;
					}
				});
				
				// Position left side bolts (green)
				leftBolts.forEach(bolt => {
					const isTopRow = bolt.position.y > 0;
					const yPos = isTopRow ? (halfHeight + 0.1) : (-halfHeight - 0.1);
					bolt.position.set(-halfWidth - 0.45, yPos, -1.0);
					bolt.visible = true;
					
					if (bolt.userData.plate) {
						bolt.userData.plate.position.set(-halfWidth - 0.45, yPos, -0.9);
						bolt.userData.plate.visible = true;
					}
				});
			}
			
			// Make display structure visible
			if (this.scoreboardGroup?.userData) {
				const displayMesh = this.scoreboardGroup.userData.displayMesh;
				const backMesh = this.scoreboardGroup.userData.backPanelMesh;
				
				if (displayMesh) displayMesh.visible = true;
				if (backMesh) backMesh.visible = true;
			}
			
			// Make jets visible
			if (this.jetsManager && this.jetsManager.jets) {
				this.jetsManager.jets.forEach(jet => {
					if (jet) jet.visible = true;
				});
			}
			
			// Make buttons visible and positioned correctly
			if (this.buttonManager) {
				// Update button positions
				this.buttonManager.updateButtonPositions(this.width, this.height, this.sizeMode);
				
				// Ensure appropriate buttons are visible
				if (this.buttonManager.expandButton) {
					this.buttonManager.expandButton.visible = true;
					console.log("Setting expand button visible: true");
					
					// Force the arrow indicator to be visible
					this.buttonManager.expandButton.children.forEach((child, i) => {
						child.visible = true;
						console.log(`Setting expand button child ${i} visible`);
						
						// Force render order and depth settings to ensure visibility
						if (child.material) {
							child.material.depthTest = false;
							child.renderOrder = 100;
						}
						
						// If this is a group (like arrow group), ensure its children are visible
						if (child.children && child.children.length > 0) {
							child.children.forEach(grandchild => {
								grandchild.visible = true;
								if (grandchild.material) {
									grandchild.material.depthTest = false;
									grandchild.renderOrder = 100;
								}
							});
						}
					});
				}
				
				if (this.buttonManager.collapseButton) {
					this.buttonManager.collapseButton.visible = true;
					console.log("Setting collapse button visible: true");
					
					// Force the arrow indicator to be visible
					this.buttonManager.collapseButton.children.forEach((child, i) => {
						child.visible = true;
						console.log(`Setting collapse button child ${i} visible`);
						
						// Force render order and depth settings to ensure visibility
						if (child.material) {
							child.material.depthTest = false;
							child.renderOrder = 100;
						}
						
						// If this is a group (like arrow group), ensure its children are visible
						if (child.children && child.children.length > 0) {
							child.children.forEach(grandchild => {
								grandchild.visible = true;
								if (grandchild.material) {
									grandchild.material.depthTest = false;
									grandchild.renderOrder = 100;
								}
							});
						}
					});
				}
				
				// Force visibility update with immediate position correction
				this.buttonManager.updateButtonColors(this.sizeMode);
			}
		}
		
		// Trigger a final jet effect for visual feedback if not in hidden mode
		if (this.jetsManager && this.sizeMode !== 'hidden') {
			// Create a dramatic final effect using the burst parameter if this was a burst animation
			const wasBurstAnimation = !!this._burstFromOrigin;
			
			// Force sync jets with bolts first
			this.jetsManager.syncJetsWithBolts(true);
			
			// Create a final burst with full intensity to cap off the animation
			this.triggerJetEffect(wasBurstAnimation ? 1.2 : 0.8, wasBurstAnimation);
			
			// If this was a burst animation, add an extra echo effect after a short delay
			if (wasBurstAnimation) {
				setTimeout(() => {
					// One last echo effect
					if (this.jetsManager) {
						this.jetsManager.syncJetsWithBolts(true);
						this.triggerJetEffect(0.7, true);
					}
				}, 200);
			}
			
			// Clear the burst flag now that animation is complete
			this._burstFromOrigin = false;
			this._burstOriginPoint = null;
		}
		
		// Always update button positions after mode change
		if (this.buttonManager) {
			// In hidden mode, position the expand button centrally
			if (this.sizeMode === 'hidden') {
				if (this.buttonManager.expandButton) {
					this.buttonManager.expandButton.position.set(0, 0, -1.0);
					this.buttonManager.expandButton.visible = true;
					
					// Make sure the expand button is clearly visible
					this.buttonManager.expandButton.traverse(obj => {
						if (obj.material) {
							obj.material.depthTest = false;
							obj.renderOrder = 100;
						}
					});
				}
				
				// Hide all other buttons
				if (this.buttonManager.collapseButton) {
					this.buttonManager.collapseButton.visible = false;
				}
				if (this.buttonManager.exitButton) {
					this.buttonManager.exitButton.visible = false;
				}
				this.buttonManager.socialButtons.forEach(btn => {
					if (btn) btn.visible = false;
				});
			} else {
				// For normal and tall modes, use the standard button positioning
				this.buttonManager.updateButtonPositions(this.width, this.height, this.sizeMode);
			}
			
			// Special handling for hidden mode - ensure only expand button is visible
			if (this.sizeMode === 'hidden') {
				// Hide every bolt and its plate completely
				if (this.cornerBolts) {
					this.cornerBolts.forEach(bolt => {
						bolt.visible = false;
						if (bolt.userData?.plate) bolt.userData.plate.visible = false;
					});
				}
				
				// Ensure only the dedicated expand button remains visible
				this.scoreboardGroup.traverse(obj => {
					// Keep the root group visible
					if (obj === this.scoreboardGroup) return;
					
					// Keep expand button hierarchy visible
					if (this.buttonManager && (
						obj === this.buttonManager.expandButton ||
						(obj.parent && obj.parent === this.buttonManager.expandButton))) {
						obj.visible = true;
						return;
					}
					
					// Hide everything else
					obj.visible = false;
				});
			}
		}
		
		console.log("Size mode change finalized");
	}
	
	/**
	 * Update scoreboard dimensions based on current height / state
	 */
	updateScoreboardDimensions() {
		console.log("Updating scoreboard height to:", this.height);
		
		// Ensure width remains consistent
		if (this.initialWidth) {
			this.width = this.initialWidth;
		}
		
		// Store original bolt positions if not yet saved
		if (this.cornerBolts && this.cornerBolts.length >= 4 && !this._originalBoltPositions) {
			this._originalBoltPositions = this.cornerBolts.map(bolt => ({
				x: bolt.position.x,
				y: bolt.position.y,
				z: bolt.position.z,
				isRightSide: bolt.userData.isRightSide
			}));
			console.log("Original bolt positions saved for future reference");
		}
		
		// Track whether any bolt position has changed
		let boltPositionsChanged = false;
		let startingPositions = [];
		
		// Store starting positions of bolts for comparison
		if (this.cornerBolts && this.cornerBolts.length >= 4) {
			startingPositions = this.cornerBolts.map(bolt => bolt.position.clone());
		}
		
		// Update bolt positions - CRITICAL: Use consistent left/right positioning
		if (this.cornerBolts && this.cornerBolts.length >= 4) {
			const halfWidth = this.width / 2;
			const halfHeight = this.height / 2;
			
			// Find bolts by their side property rather than by index
			const rightBolts = this.cornerBolts.filter(bolt => bolt.userData.isRightSide);
			const leftBolts = this.cornerBolts.filter(bolt => !bolt.userData.isRightSide);
			
			if (this.sizeMode === 'hidden') {
				// Hide ALL bolts in hidden mode
				this.cornerBolts.forEach(bolt => {
					bolt.visible = false;
					if (bolt.userData.plate) {
						bolt.userData.plate.visible = false;
					}
				});
				
				console.log("Hidden mode: All bolts hidden");
			} else {
				// For normal & tall modes - position all bolts properly based on isRightSide
				
				// Position right side bolts (gold)
				rightBolts.forEach(bolt => {
					const isTopRow = bolt.position.y > 0 || 
					                (this.sizeMode !== 'tall' && bolt === rightBolts[0]);
					
					// Calculate Y position based on whether it's a top or bottom bolt
					const yPos = isTopRow ? (halfHeight + 0.1) : (-halfHeight - 0.1);
					
					// Store original position for comparison
					const originalX = bolt.position.x;
					const originalY = bolt.position.y;
					
					// Set the position - always on right side (positive X)
					bolt.position.set(halfWidth + 0.45, yPos, -1.0);
					bolt.visible = true;
					
					// Check if position changed significantly
					if (Math.abs(originalX - bolt.position.x) > 0.001 || 
					    Math.abs(originalY - bolt.position.y) > 0.001) {
						boltPositionsChanged = true;
					}
					
					// Update plate position if it exists
					if (bolt.userData.plate) {
						bolt.userData.plate.position.set(halfWidth + 0.45, yPos, -0.9);
						bolt.userData.plate.visible = true;
					}
					
					// Set gold color for right side
					if (bolt.material) {
						bolt.material.color.set(0xDAA520); // Gold 
						bolt.material.emissive.set(0xDAA520);
					}
				});
				
				// Position left side bolts (green)
				leftBolts.forEach(bolt => {
					const isTopRow = bolt.position.y > 0 || 
					               (this.sizeMode !== 'tall' && bolt === leftBolts[0]);
					
					// Calculate Y position based on whether it's a top or bottom bolt
					const yPos = isTopRow ? (halfHeight + 0.1) : (-halfHeight - 0.1);
					
					// Store original position for comparison
					const originalX = bolt.position.x;
					const originalY = bolt.position.y;
					
					// Set the position - always on left side (negative X)
					bolt.position.set(-halfWidth - 0.45, yPos, -1.0);
					bolt.visible = true;
					
					// Check if position changed significantly
					if (Math.abs(originalX - bolt.position.x) > 0.001 || 
					    Math.abs(originalY - bolt.position.y) > 0.001) {
						boltPositionsChanged = true;
					}
					
					// Update plate position if it exists
					if (bolt.userData.plate) {
						bolt.userData.plate.position.set(-halfWidth - 0.45, yPos, -0.9);
						bolt.userData.plate.visible = true;
					}
					
					// Set green color for left side
					if (bolt.material) {
						bolt.material.color.set(0x00ff00); // Green
						bolt.material.emissive.set(0x00ff00);
					}
				});
				
				console.log("Normal/tall mode: Positioned all bolts at corners based on isRightSide property");
			}
			
			// Log bolt positions for debugging
			console.log("Bolt positions after update:");
			this.cornerBolts.forEach((bolt, i) => {
				console.log(`Bolt ${i}: x=${bolt.position.x.toFixed(2)}, y=${bolt.position.y.toFixed(2)}, isRightSide=${bolt.userData.isRightSide}, visible=${bolt.visible}`);
			});
			
			// Always sync jets after bolt move, with force update if positions changed
			if (this.jetsManager) {
				this.jetsManager.syncJetsWithBolts(boltPositionsChanged);
				
				// If bolt positions changed significantly, trigger a jet effect
				if (boltPositionsChanged && this.sizeMode !== 'hidden') {
					console.log("Bolt positions changed - triggering jet effect");
					this.triggerJetEffect(0.7); // Moderate intensity for position changes
				}
			}
		}
		
		// Always update button positions after dimension change
		if (this.buttonManager) {
			// In hidden mode, position the expand button centrally
			if (this.sizeMode === 'hidden') {
				if (this.buttonManager.expandButton) {
					this.buttonManager.expandButton.position.set(0, 0, -1.0);
					this.buttonManager.expandButton.visible = true;
					
					// Make sure the expand button is clearly visible
					this.buttonManager.expandButton.traverse(obj => {
						if (obj.material) {
							obj.material.depthTest = false;
							obj.renderOrder = 100;
						}
					});
				}
				
				// Hide all other buttons
				if (this.buttonManager.collapseButton) {
					this.buttonManager.collapseButton.visible = false;
				}
				if (this.buttonManager.exitButton) {
					this.buttonManager.exitButton.visible = false;
				}
				this.buttonManager.socialButtons.forEach(btn => {
					if (btn) btn.visible = false;
				});
			} else {
				// For normal and tall modes, use the standard button positioning
				this.buttonManager.updateButtonPositions(this.width, this.height, this.sizeMode);
			}
			
			// Special handling for hidden mode - ensure only expand button is visible
			if (this.sizeMode === 'hidden') {
				// Hide all scoreboard elements except the expand button
				this.scoreboardGroup.traverse(obj => {
					// Skip the group itself
					if (obj === this.scoreboardGroup) return;
					
					// Skip expand button
					if (this.buttonManager && (
						obj === this.buttonManager.expandButton || 
						(obj.parent && obj.parent === this.buttonManager.expandButton))) {
						obj.visible = true;
						return;
					}
					
					// Hide everything else
					obj.visible = false;
				});
			}
		}
		
		// Hide LEDDisplay in hidden mode, update dimensions otherwise
		if (this.ledDisplay) {
			if (this.sizeMode === 'hidden') {
				// Hide LED display entirely in hidden mode
				if (this.ledDisplay.ledGroup) {
					this.ledDisplay.ledGroup.visible = false;
				}
			} else if (!this.isAnimatingMode) {
				// Calculate previous and new dot rows to detect major changes
				const previousDotRows = this.ledDisplay.dotRows;
				
				// Dynamically calculate dot rows to fill the available height while keeping spacing constant
				const baseSpacing = (this.width * 0.98 / this.ledDisplay.dotCols) * 1.3; // Width-limited spacing (constant)
				const newDotRows = Math.max(1, Math.floor((this.height * 0.95) / baseSpacing));
				
				// Log if there's a significant change in dot rows
				if (Math.abs(newDotRows - previousDotRows) > 10) {
					console.log(`Significant change in LED matrix size: ${previousDotRows} -> ${newDotRows} rows`);
				}
				
				// Update the dotRows property
				this.ledDisplay.dotRows = newDotRows;
				
				// Update the display dimensions
				this.ledDisplay.updateDisplaySize(this.width, this.height);
				
				// Ensure LED display is visible
				if (this.ledDisplay.ledGroup) {
					this.ledDisplay.ledGroup.visible = true;
				}
			} else {
				console.log("Skipping LED display update during animation - will recreate at the end");
			}
		}
		
		// Hide/show background elements based on mode
		if (this.scoreboardGroup?.userData) {
			const displayMesh = this.scoreboardGroup.userData.displayMesh;
			const backMesh = this.scoreboardGroup.userData.backPanelMesh;
			
			if (this.sizeMode === 'hidden') {
				// Hide display and back panel in hidden mode
				if (displayMesh) {
					displayMesh.visible = false;
				}
				if (backMesh) {
					backMesh.visible = false;
				}
				
				// Hide jets in hidden mode
				if (this.jetsManager && this.jetsManager.jets) {
					this.jetsManager.jets.forEach(jet => {
						if (jet) jet.visible = false;
					});
				}
			} else {
				// Show and update scaling for normal and tall modes
				if (displayMesh) {
					displayMesh.visible = true;
					// Calculate scale factor relative to initial height
					const scaleY = this.height / this.initialHeight;
					// Guard against NaN or zero
					if (isFinite(scaleY) && scaleY > 0) {
						displayMesh.scale.y = scaleY;
					}
					if (displayMesh.material) {
						displayMesh.material.opacity = 0.3;
					}
				}
				
				if (backMesh) {
					backMesh.visible = true;
					const scaleY = this.height / this.initialHeight;
					if (isFinite(scaleY) && scaleY > 0) {
						backMesh.scale.y = scaleY;
					}
					if (backMesh.material) {
						backMesh.material.opacity = 0.1;
					}
				}
				
				// Show jets in normal/tall modes
				if (this.jetsManager && this.jetsManager.jets) {
					this.jetsManager.jets.forEach(jet => {
						if (jet) jet.visible = true;
					});
				}
			}
		}
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
	 * Show detailed scoreboard for a single token
	 * @param {Object} token Token data
	 */
	showTokenDetail(token) {
		if (!token) return;
		console.log("Showing token detail for:", token.baseToken?.symbol || token.symbol);
		
		// Ensure token has all required fields initialized
		this.detailToken = {
			// Default/fallback values for required fields
			baseToken: { symbol: token.baseToken?.symbol || token.symbol || 'UNKN' },
			symbol: token.symbol || token.baseToken?.symbol || 'UNKN',
			tokenAddress: token.tokenAddress || null,
			chainId: token.chainId || 1, // Default to Ethereum
			priceUsd: token.priceUsd || 0,
			priceNative: token.priceNative || 0,
			marketCap: token.marketCap || 0,
			fdv: token.fdv || 0,
			volume: token.volume || { h24: 0 },
			liquidity: token.liquidity || { usd: 0 },
			priceChange: token.priceChange || { m5: 0, h1: 0, h24: 0 },
			txns: token.txns || { h24: { buys: 0, sells: 0 } },
			socialLinks: token.socialLinks || {},
			links: token.links || {},
			// Then merge with the actual token data, overriding defaults
			...token
		};
		
		this.detailMode = true;
		this.lastDetailRefresh = 0; // force immediate refresh
		
		// Show the exit button
		if (this.buttonManager) {
			this.buttonManager.setExitButtonVisibility(true);
			
			// Make social media buttons visible for detail mode
			this.buttonManager.setSocialButtonsVisibility(true, this.sizeMode);
		}
		
		// Increase target height slightly if in normal mode
		if (this.sizeMode === 'normal') {
			this.changeSizeMode('normal');
		}
		
		// Force an immediate refresh to get latest data
		setTimeout(() => {
			if (this.detailMode) {
				console.log("Triggering immediate token detail refresh");
				this._refreshDetailTokenData();
			}
		}, 100);
	}
	
	/**
	 * Exit detail mode back to scrolling list
	 */
	exitTokenDetail() {
		this.detailMode = false;
		this.detailToken = null;
		
		// Hide the exit button
		if (this.buttonManager) {
			this.buttonManager.setExitButtonVisibility(false);
			
			// Hide social media buttons when exiting detail mode
			// Keep them visible in hidden mode though
			this.buttonManager.setSocialButtonsVisibility(false, this.sizeMode);
		}
	}
	
	/**
	 * Internal: refresh detail token data from provider
	 */
	async _refreshDetailTokenData() {
		if (!this.dataProvider || !this.detailToken) return;
		
		const now = Date.now();
		if (now - this.lastDetailRefresh < this.detailRefreshInterval || this.isRefreshingDetail) return;
		
		this.isRefreshingDetail = true;
		try {
			console.log("Refreshing detail token data");
			// Debug info about the token we're trying to update
			console.log("Current detail token:", {
				symbol: this.detailToken.baseToken?.symbol,
				chainId: this.detailToken.chainId,
				address: this.detailToken.tokenAddress,
				dataProvider: !!this.dataProvider
			});
			
			// Attempt cache first (dataProvider may implement getCachedTokenPair)
			// For now just call refreshData to update
			await this.dataProvider.refreshData();
			
			// Get updated version from provider
			const tokens = await this.dataProvider.getCurrentPageTokens();
			if (!tokens || tokens.length === 0) {
				console.log("No tokens returned from provider");
				return;
			}
			
			console.log(`Got ${tokens.length} tokens from provider, looking for match`);
			
			// Try to find an exact match first (address + chain)
			let updated = tokens.find(t => {
				return (t.tokenAddress && this.detailToken.tokenAddress && t.tokenAddress.toLowerCase() === this.detailToken.tokenAddress.toLowerCase()) &&
					   (t.chainId == this.detailToken.chainId);
			});
			
			// If no exact match by address+chain, try address only
			if (!updated) {
				updated = tokens.find(t => {
					return this.detailToken.tokenAddress && t.tokenAddress && t.tokenAddress.toLowerCase() === this.detailToken.tokenAddress.toLowerCase();
				});
			}
			
			// If still not found, try matching by symbol ignoring chain
			if (!updated) {
				updated = tokens.find(t => {
					const targetSym = (this.detailToken.baseToken?.symbol || this.detailToken.symbol || '').toUpperCase();
					const sym = (t.baseToken?.symbol || t.symbol || '').toUpperCase();
					return sym === targetSym;
				});
			}
			
			if (updated) {
				console.log("Found updated token data:", updated.baseToken?.symbol);
				// Create a new object merging the original with the updates
				// Original data takes precedence for null properties in the update
				this.detailToken = { 
					...updated, 
					...this.detailToken,
					// Force these specific properties to update from new data
					priceUsd: updated.priceUsd || this.detailToken.priceUsd,
					priceChange: updated.priceChange || this.detailToken.priceChange,
					marketCap: updated.marketCap || this.detailToken.marketCap,
					fdv: updated.fdv || this.detailToken.fdv,
					volume: updated.volume || this.detailToken.volume,
					liquidity: updated.liquidity || this.detailToken.liquidity,
					txns: updated.txns || this.detailToken.txns
				};
			} else {
				console.log("Could not find matching token for update, trying alternative methods");
				
				// Try directly querying by address if available
				if (this.detailToken.tokenAddress && this.dataProvider.getTokenDetails) {
					try {
						const tokenDetails = await this.dataProvider.getTokenDetails(
							this.detailToken.tokenAddress, 
							this.detailToken.chainId
						);
						
						if (tokenDetails) {
							console.log("Retrieved token details directly:", tokenDetails.baseToken?.symbol);
							this.detailToken = { ...this.detailToken, ...tokenDetails };
						}
					} catch (err) {
						console.warn("Failed to get token details directly:", err);
					}
				}
			}
			
			this.lastDetailRefresh = Date.now();
		} catch (err) {
			console.error('Scoreboard detail refresh error', err);
		} finally {
			this.isRefreshingDetail = false;
		}
	}
	
	/**
	 * Internal: draw detail token information on LED display
	 */
	_drawDetailToken() {
		if (!this.ledDisplay || !this.detailToken) return;

		const { ledDisplay: d } = this;

		// Show properly formatted symbol with fallbacks
		const symbol = (this.detailToken.baseToken?.symbol || this.detailToken.symbol || this.detailToken.name || 'UNKN');
		let row = 2;
		// Draw symbol centred horizontally if space allows, else left aligned
		let colStart = 2;
		if (d.dotCols > symbol.length * 4 + 4) {
			colStart = Math.floor((d.dotCols - symbol.length * 4) / 2);
		}
		d.drawText(symbol, row, colStart, 'cyan');

		row += 6;
		const priceTxt = formatPrice(this.detailToken.priceUsd || this.detailToken.priceNative || 0);
		d.drawText('P:$' + priceTxt, row, 2, 'yellow');

		row += 6;
		const mcText = this.detailToken.marketCap ? formatCompactNumber(this.detailToken.marketCap) : 'N/A';
		const fdvText = this.detailToken.fdv ? formatCompactNumber(this.detailToken.fdv) : 'N/A';
		d.drawText('MC:' + mcText + ' FDV:' + fdvText, row, 2, 'white');

		row += 6;
		// Price changes - split into two rows
		const pc = this.detailToken.priceChange || {};
		const change5m = pc.m5 !== undefined ? pc.m5 : null;
		const change1h = pc.h1 !== undefined ? pc.h1 : null;
		const change24h = pc.h24 !== undefined ? pc.h24 : null;

		// First row: headers
		d.drawText('5m', row, 0, 'white');
		//draw a yellow centre dot
		d.drawText(':', row, 25, 'yellow');
		d.drawText('1h', row, 30, 'white');
		//draw a yellow centre dot
		d.drawText(':', row, 55, 'yellow');
		d.drawText('24h', row, 60, 'white');
		
		// Second row: percentages with N/A fallback
		row += 6;
		d.drawText(change5m !== null ? formatChange(change5m, true) : 'N/A', row, 0, 
			change5m !== null ? getChangeColor(change5m) : 'white');
		//draw a yellow centre dot
		d.drawText(':', row, 25, 'yellow');
		d.drawText(change1h !== null ? formatChange(change1h, true) : 'N/A', row, 30, 
			change1h !== null ? getChangeColor(change1h) : 'white');
		//draw a yellow centre dot
		d.drawText(':', row, 55, 'yellow');
		d.drawText(change24h !== null ? formatChange(change24h, true) : 'N/A', row, 60, 
			change24h !== null ? getChangeColor(change24h) : 'white');

		// Adjust row spacing
		row += 7;

		// If we have transaction data and there's room (tall mode or enough rows)
		if (this.sizeMode === 'tall' || d.dotRows >= 36) {
			// Draw transaction data if available
			if (this.detailToken.txns?.h24) {
				const txns = this.detailToken.txns.h24;
				const buyTxns = formatCompactNumber(txns.buys ?? 0);
				const sellTxns = formatCompactNumber(txns.sells ?? 0);
				
				// Draw buys in green, sells in red
				d.drawText('B:', row, 0, 'green');
				d.drawText(buyTxns.toString(), row, 12, 'white');
				
				d.drawText('S:', row, 40, 'red');
				d.drawText(sellTxns.toString(), row, 52, 'white');
				
				// Buy/sell ratio
				const ratio = sellTxns > 0 ? (buyTxns / sellTxns).toFixed(2) : '';
				d.drawText(ratio, row, 80, (ratio > 1 && ratio !== '') ? 'green' : 'red');
				if(ratio !== '') {
					d.drawText('%', row, 92, 'white');
				}
			} else {
				// No transaction data
				d.drawText('TXS: NO DATA', row, 2, 'white');
				row += 6;
			}
			row += 6;
			
			// Show liquidity if available
			if (this.detailToken.liquidity?.usd) {
				const liq = formatCompactNumber(this.detailToken.liquidity.usd);
				d.drawText('LIQ: $' + liq, row, 5, 'cyan');
			} else {
				d.drawText('LIQ: N/A', row, 5, 'white');
			}
			row += 6;
			
			// Show volume if available
			if (this.detailToken.volume?.h24) {
				const vol = formatCompactNumber(this.detailToken.volume.h24);
				d.drawText('VOL: $' + vol, row, 5, 'yellow');
			} else {
				d.drawText('VOL: N/A', row, 5, 'white');
			}
			
			// Show chain ID and age information if available
			row += 6;
			const chainMap = {
				1: 'ETH',
				56: 'BSC',
				137: 'POLY',
				42161: 'ARB',
				10: 'OP',
				8453: 'BASE',
			};
			
			const chainName = chainMap[this.detailToken.chainId] || `CH:${this.detailToken.chainId || 'N/A'}`;
			d.drawText(chainName, row, 2, 'green');
			
			// Show address or link info
			if (this.detailToken.tokenAddress) {
				//split the address into 3 lines of 10 characters each
				const addrLines = this.detailToken.tokenAddress.match(/.{1,10}/g);
				for (let i = 0; i < addrLines.length; i++) {
					d.drawText(addrLines[i], row, 20 + i * 12, 'yellow');
				}
			}
		}
	}
	
	/**
	 * Toggle visibility of the scoreboard
	 */
	toggleVisibility() {
		this.isVisible = !this.isVisible;
		this.scoreboardGroup.visible = this.isVisible;
		
		// Trigger a jet effect when becoming visible again
		if (this.isVisible && this.jetsManager) {
			this.triggerJetEffect(0.8);
		}
	}
	
	/**
	 * Update - called each frame
	 */
	update(deltaTime) {
		if (!this.isVisible) return;
		
		// Ensure jets are always updated regardless of mode
		if (this.jetsManager) {
			this.jetsManager.update(deltaTime || 1/60);
		}
		
		// Check for camera movement and trigger repositioning when it stops
		if (this.camera && !this.isAnimatingMode) {
			const currentPos = this.camera.position.clone();
			const currentQuat = this.camera.quaternion.clone();
			
			// Check if camera has moved
			const positionDelta = currentPos.distanceTo(this.lastCameraPosition);
			const quaternionDelta = 1 - currentQuat.dot(this.lastCameraQuaternion);
			
			if (positionDelta > this.cameraMovementThreshold || quaternionDelta > this.cameraRotationThreshold) {
				// Camera is moving
				this.cameraMoveTime = performance.now();
				
				// Store new position/rotation
				this.lastCameraPosition.copy(currentPos);
				this.lastCameraQuaternion.copy(currentQuat);
				
				// Clear any pending reposition timeout
				if (this.cameraMovementTimeout) {
					clearTimeout(this.cameraMovementTimeout);
					this.cameraMovementTimeout = null;
				}
				
				// Set timeout to reposition after movement stops
				this.cameraMovementTimeout = setTimeout(() => {
					console.log("Camera stopped moving - repositioning scoreboard");
					this.updatePositionAfterCameraMovement();
					this.cameraMovementTimeout = null;
				}, this.cameraRestTimer);
			}
		}
		
		// Update the coordinate axes helper position
		this.updateCoordinateAxesHelper();
		
		// Handle display modes - HANDLE PLANET ONLY HERE, NOT IN _updateScreenPosition
		if (this.sizeMode === 'hidden') {
			// For hidden mode, make sure only the expand button is visible
			
			// CRITICAL: Make sure the dedicated expand planet is visible and consistently in bottom right
			if (this.expandPlanet) {
				this.expandPlanet.visible = true;
				
				// Force position update every frame to prevent any position changes
				this._positionExpandPlanetBottomRight();
				
				// Ensure all materials are set to be always visible
				this.expandPlanet.traverse(obj => {
					if (obj.material) {
						obj.material.depthTest = false;
						obj.renderOrder = 2000; // Very high render order
						if (obj.material.transparent) {
							obj.material.opacity = 1.0; // Full opacity
						}
					}
				});
			}
			
			// Make sure the button manager's buttons are also visible
			if (this.buttonManager) {
				this.buttonManager.updateButtonPositions(this.width, this.height, this.sizeMode);
				this.buttonManager.updateButtonColors(this.sizeMode);
				
				// Ensure expand button is visible
				if (this.buttonManager.expandButton) {
					this.buttonManager.expandButton.visible = true;
				}
				if (this.buttonManager.collapseButton) {
					this.buttonManager.collapseButton.visible = true;
				}
				
				// Force social buttons to be visible in hidden mode
				this.buttonManager.setSocialButtonsVisibility(true, this.sizeMode);
			}
			
			return; // Skip the rest of the update in hidden mode
		} else {
			// Hide the expand planet in non-hidden modes
			if (this.expandPlanet) {
				this.expandPlanet.visible = false;
			}
			
			// No more per-frame bolt position fixing - it fights with animations
			// Bolt positions are now only fixed at the end of animations
		}
		
		// Normal update for visible modes
		
		// First sync jets with bolts and detect movement
		if (this.jetsManager) {
			this.jetsManager.syncJetsWithBolts();
		}
		
		// Skip LED display updates during mode transitions/animations
		if (this.isAnimatingMode) {
			return; // Don't update LED display during resize animations
		}
		
		// Clear display first
		if (this.ledDisplay) {
			this.ledDisplay.clear();

			// Detail mode
			if (this.detailMode && this.detailToken) {
				// Calculate elapsed time since last refresh
				const now = Date.now();
				const elapsedSinceRefresh = now - this.lastDetailRefresh;
				
				// Add a small refresh indicator if we're due for refresh or refreshing
				const isRefreshDue = elapsedSinceRefresh >= this.detailRefreshInterval;
				
				// Attempt to refresh data when interval has passed
				if (isRefreshDue && !this.isRefreshingDetail) {
					console.log(`Time since last refresh: ${elapsedSinceRefresh}ms, refreshing now`);
					this._refreshDetailTokenData();
				}
				
				// Force redraw with latest data
				this._drawDetailToken();
				
				// Show a small refresh indicator when actively refreshing
				if (this.isRefreshingDetail || isRefreshDue) {
					// Draw a small spinning indicator in the top right corner
					const time = Date.now();
					const animationFrame = Math.floor((time % 1000) / 250); // 0-3 animation frames
					const refreshChar = ['⟳', '⟲', '⟳', '⟲'][animationFrame]; 
					this.ledDisplay.drawText(refreshChar, 2, this.ledDisplay.dotCols - 6, 'cyan');
				}
				
				return; // skip list rendering
			}
			
			// If no data yet, show loading message
			if (!this.displayData || this.displayData.length === 0) {
				// Show "LOADING" text in bright white in the center
				this.ledDisplay.drawText("LOADING DATA", Math.floor(this.ledDisplay.dotRows/2) - 2, Math.floor(this.ledDisplay.dotCols/2) - 20, 'white');
				
				// Add a line of dots below that cycles for animation
				const time = Date.now();
				const dotCount = Math.floor((time % 1500) / 300) + 1; // 1-5 dots cycling
				let dots = "";
				for (let i = 0; i < dotCount; i++) {
					dots += ".";
				}
				this.ledDisplay.drawText(dots, Math.floor(this.ledDisplay.dotRows/2) * 1.2 + 3, Math.floor(this.ledDisplay.dotCols/2) * 1.2 - 3, 'cyan');
				
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
			if (totalContentHeight > this.ledDisplay.dotRows) {
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
					if (rowOffset >= -12 && rowOffset < this.ledDisplay.dotRows) {
						this.ledDisplay.drawTokenInfo(this.displayData[i], rowOffset);
					}
				}
			} else {
				// Draw all tokens dynamically based on available space
				const tokenSpacing = Math.floor(this.ledDisplay.dotRows / this.displayData.length);
				for (let i = 0; i < this.displayData.length; i++) {
					if (i * tokenSpacing < this.ledDisplay.dotRows) {
						this.ledDisplay.drawTokenInfo(this.displayData[i], i * tokenSpacing);
					}
				}
			}
		}
	}
	
	/**
	 * Clean up resources when scoreboard is destroyed
	 */
	dispose() {
		// Clean up event listeners
		window.removeEventListener('resize', this.handleResize);
		
		// Clean up subsystems
		if (this.ledDisplay) this.ledDisplay.dispose();
		if (this.jetsManager) this.jetsManager.dispose();
		if (this.buttonManager) this.buttonManager.dispose();
		
		// Remove the dedicated expand planet
		if (this.expandPlanet) {
			this.expandPlanet.traverse(obj => {
				if (obj.geometry) obj.geometry.dispose();
				if (obj.material) obj.material.dispose();
			});
			this.scene.remove(this.expandPlanet);
			this.expandPlanet = null;
		}
		
		// Clean up the decorative plates
		if (this.cornerBolts) {
			this.cornerBolts.forEach(bolt => {
				if (bolt.userData.plate) {
					// Dispose of the plate's geometry and material
					if (bolt.userData.plate.geometry) bolt.userData.plate.geometry.dispose();
					if (bolt.userData.plate.material) bolt.userData.plate.material.dispose();
					
					// Remove the plate from the scene
					if (this.scoreboardGroup) this.scoreboardGroup.remove(bolt.userData.plate);
					
					// Clear reference
					bolt.userData.plate = null;
				}
			});
		}
		
		// Clean up meshes and materials
		this.scoreboardGroup.traverse(obj => {
			if (obj.geometry) obj.geometry.dispose();
			if (obj.material) obj.material.dispose();
		});
		
		// Remove from scene
		if (this.scene) this.scene.remove(this.scoreboardGroup);
		
		// Remove axes helper if it exists
		if (this.axesHelper) {
			this.axesHelper.traverse(obj => {
				if (obj.geometry) obj.geometry.dispose();
				if (obj.material) obj.material.dispose();
			});
			this.scene.remove(this.axesHelper);
		}
		
		// Clear references
		this.cornerBolts = null;
		this.ledDisplay = null;
		this.jetsManager = null;
		this.buttonManager = null;
		this.axesHelper = null;
	}
	
	/**
	 * Create a coordinate axes helper to show X, Y, Z directions
	 */
	createCoordinateAxesHelper() {
		// Create a small axes helper to visualize coordinate system
		const axesHelper = new THREE.Group();
		
		// Size of the axes
		const axisLength = 2.0;
		const axisWidth = 0.1;
		
		// Create X axis (RED)
		const xAxisGeometry = new THREE.BoxGeometry(axisLength, axisWidth, axisWidth);
		const xAxisMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red
		const xAxis = new THREE.Mesh(xAxisGeometry, xAxisMaterial);
		xAxis.position.x = axisLength / 2;
		
		// Create Y axis (GREEN)
		const yAxisGeometry = new THREE.BoxGeometry(axisWidth, axisLength, axisWidth);
		const yAxisMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); // Green
		const yAxis = new THREE.Mesh(yAxisGeometry, yAxisMaterial);
		yAxis.position.y = axisLength / 2;
		
		// Create Z axis (BLUE)
		const zAxisGeometry = new THREE.BoxGeometry(axisWidth, axisWidth, axisLength);
		const zAxisMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff }); // Blue
		const zAxis = new THREE.Mesh(zAxisGeometry, zAxisMaterial);
		zAxis.position.z = axisLength / 2;
		
		// Add text labels for axes
		this._createAxisLabel(axesHelper, 'X', axisLength + 0.2, 0, 0, 0xff0000);
		this._createAxisLabel(axesHelper, 'Y', 0, axisLength + 0.2, 0, 0x00ff00);
		this._createAxisLabel(axesHelper, 'Z', 0, 0, axisLength + 0.2, 0x0000ff);
		
		// Add positive and negative indicators
		this._createAxisLabel(axesHelper, '+', axisLength, 0, 0, 0xff0000);
		this._createAxisLabel(axesHelper, '+', 0, axisLength, 0, 0x00ff00);
		this._createAxisLabel(axesHelper, '+', 0, 0, axisLength, 0x0000ff);
		this._createAxisLabel(axesHelper, '-', -axisLength / 2, 0, 0, 0xff0000);
		this._createAxisLabel(axesHelper, '-', 0, -axisLength / 2, 0, 0x00ff00);
		this._createAxisLabel(axesHelper, '-', 0, 0, -axisLength / 2, 0x0000ff);
		
		// Add axes to the helper group
		axesHelper.add(xAxis);
		axesHelper.add(yAxis);
		axesHelper.add(zAxis);
		
		// Position at the top left corner of screen, negative z brings forward
		axesHelper.position.set(-10, 5, -5);
		axesHelper.scale.set(0.8, 0.8, 0.8);
		
		// Always keep visible
		axesHelper.renderOrder = 100;
		axesHelper.traverse(obj => {
			if (obj.material) {
				obj.material.depthTest = false;
			}
		});
		
		// Add to the scene directly (not to scoreboard group)
		this.scene.add(axesHelper);
		
		// Store a reference to the helper
		this.axesHelper = axesHelper;
		
		console.log("Created coordinate axes helper");
	}
	
	/**
	 * Helper method to create axis labels
	 */
	_createAxisLabel(parent, text, x, y, z, color) {
		// Create a Canvas for the text
		const canvas = document.createElement('canvas');
		canvas.width = 64;
		canvas.height = 64;
		const ctx = canvas.getContext('2d');
		
		// Draw text
		ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
		ctx.font = 'bold 48px Arial';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(text, canvas.width / 2, canvas.height / 2);
		
		// Create texture and material
		const texture = new THREE.CanvasTexture(canvas);
		const material = new THREE.SpriteMaterial({ 
			map: texture,
			transparent: true,
			depthTest: false
		});
		
		// Create sprite
		const sprite = new THREE.Sprite(material);
		sprite.position.set(x, y, z);
		sprite.scale.set(0.5, 0.5, 0.5);
		
		parent.add(sprite);
	}
	
	/**
	 * Update the coordinate axes to follow the camera
	 */
	updateCoordinateAxesHelper() {
		if (!this.axesHelper || !this.camera) return;
		
		// Calculate position directly based on field of view
		const fov = this.camera.fov * Math.PI / 180;
		const distance = 10; // Fixed distance from camera
		const height = 2 * Math.tan(fov / 2) * distance;
		const width = height * this.camera.aspect;
		
		// Position in top left corner
		const x = -width * 0.35;
		const y = height * 0.35;
		
		// Get camera quaternion for orientation
		const quaternion = this.camera.quaternion.clone();
		
		// Create camera-oriented coordinate system
		const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);
		const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
		const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
		
		// Calculate position in 3D space
		const pos = this.camera.position.clone()
			.add(forward.clone().multiplyScalar(distance))
			.add(right.clone().multiplyScalar(x))
			.add(up.clone().multiplyScalar(y));
		
		// Set position
		this.axesHelper.position.copy(pos);
		
		// Set rotation to match camera orientation
		this.axesHelper.quaternion.copy(quaternion);
	}

	/**
	 * Create a dedicated expand planet that's only visible in hidden mode
	 */
	createExpandPlanet() {
		// Remove any existing expand planet
		if (this.expandPlanet) {
			this.scene.remove(this.expandPlanet);
		}

		// Create a group for the expand planet
		this.expandPlanet = new THREE.Group();
		
		// Create a sphere for the expand button with brighter color
		const sphereGeometry = new THREE.SphereGeometry(0.8, 32, 32); // More segments for smoother appearance
		const sphereMaterial = new THREE.MeshBasicMaterial({
			color: 0x00ff00, // Bright green
			transparent: true,
			opacity: 1.0, // Full opacity
			depthTest: false // Always render on top
		});
		const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
		sphere.renderOrder = 3000; // Extremely high render order
		
		// Create a more visible pulsing effect
		const pulse = gsap.timeline({repeat: -1, yoyo: true});
		pulse.to(sphere.scale, {
			x: 1.3,
			y: 1.3,
			z: 1.3,
			duration: 0.8, // Faster pulse
			ease: "sine.inOut"
		});
		
		// Add a plus sign to indicate expand functionality
		const createPlusSegment = (isHorizontal) => {
			const width = isHorizontal ? 1.0 : 0.25; // Larger segments
			const height = isHorizontal ? 0.25 : 1.0;
			const geometry = new THREE.BoxGeometry(width, height, 0.1);
			const material = new THREE.MeshBasicMaterial({
				color: 0xffffff, // White
				depthTest: false,
				transparent: true,
				opacity: 1.0
			});
			const segment = new THREE.Mesh(geometry, material);
			segment.position.z = 0.6; // Position more in front of sphere
			segment.renderOrder = 3001; // Extremely high render order
			return segment;
		};
		
		const horizontalSegment = createPlusSegment(true);
		const verticalSegment = createPlusSegment(false);
		
		// Add segments to sphere
		sphere.add(horizontalSegment);
		sphere.add(verticalSegment);
		
		// Add sphere to expand planet group
		this.expandPlanet.add(sphere);
		
		// Set the initial position - will be updated consistently in _positionExpandPlanetBottomLeft
		// Position immediately in bottom right (not left!) using helper method if camera is available
		if (this.camera) {
			this._positionExpandPlanetBottomRight();
		} else {
			// Default fallback position (bottom right)
			this.expandPlanet.position.set(5, -7, -10);
			this.expandPlanet.scale.set(0.4, 0.4, 0.4); // Fixed scale
		}
		
		// Set extremely high render order to guarantee visibility
		this.expandPlanet.renderOrder = 3000;
		this.expandPlanet.traverse(obj => {
			if (obj.material) {
				obj.material.depthTest = false;
				if (obj.material.transparent) {
					obj.material.opacity = 1.0;
				}
			}
		});
		
		// Add to scene
		this.scene.add(this.expandPlanet);
		
		// Hide initially - will be shown only in hidden mode
		this.expandPlanet.visible = false;
		
		// Store a reference to the sphere for hit detection
		this.expandPlanet.userData.expandSphere = sphere;
		
		console.log("Created dedicated expand planet for hidden mode, positioned at bottom right");
	}

	/**
	 * Position the expandPlanet consistently in the bottom right corner
	 * Called every frame in hidden mode to ensure consistent positioning
	 * @private
	 */
	_positionExpandPlanetBottomRight() {
		if (!this.expandPlanet || !this.camera) return;
		
		// Get camera orientation vectors to compute bottom right position
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
		
		// Position the expand planet at the bottom RIGHT of the screen (not left)
		// Use fixed offsets that won't change with viewWidth/Height to avoid jitter
		const bottomY = -viewHeight * 0.4; // Lower position - never changes
		const rightX = viewWidth * 0.4;    // Right side - never changes
		
		// Calculate position in 3D space for bottom right
		const planetPos = this.camera.position.clone()
			.add(forward.clone().multiplyScalar(distance))
			.add(right.clone().multiplyScalar(rightX))
			.add(up.clone().multiplyScalar(bottomY));
		
		// Set position for expand planet - with a small fixed offset to ensure stability
		this.expandPlanet.position.copy(planetPos);
		
		// Set rotation to match camera
		this.expandPlanet.quaternion.copy(quaternion);
		
		// Make sure scale is consistent - never changes during animation
		const scale = 0.4; // Fixed scale - never changes with window size
		this.expandPlanet.scale.set(scale, scale, scale);
		
		// Ensure planet is always visible with high render order and no depth test
		this.expandPlanet.traverse(obj => {
			if (obj.material) {
				obj.material.depthTest = false;
				obj.renderOrder = 2000;
				if (obj.material.transparent) {
					obj.material.opacity = 1.0;
				}
			}
		});
	}

	/**
	 * Fix bolt positions directly when animation has issues
	 * Call this whenever bolts get misplaced during transitions
	 */
	fixBoltPositions() {
		if (!this.cornerBolts || this.cornerBolts.length < 4) return;
		
		const halfWidth = this.width / 2;
		const halfHeight = this.height / 2;
		
		// Find bolts by their side property
		const rightBolts = this.cornerBolts.filter(bolt => bolt.userData.isRightSide);
		const leftBolts = this.cornerBolts.filter(bolt => !bolt.userData.isRightSide);
		
		// Track position changes for animation effects
		let significantChange = false;
		
		// Process top/bottom for both sides
		rightBolts.forEach(bolt => {
			// Determine if this is a top or bottom bolt based on current position
			const isTopBolt = bolt.position.y > 0;
			const yPos = isTopBolt ? (halfHeight + 0.1) : (-halfHeight - 0.1);
			
			// Store original position for comparison
			const originalX = bolt.position.x;
			const originalY = bolt.position.y;
			
			// Set position explicitly - always on right side
			bolt.position.set(halfWidth + 0.45, yPos, -1.0);
			bolt.visible = true;
			
			// Check if position changed significantly
			if (Math.abs(originalX - bolt.position.x) > 0.001 || 
				Math.abs(originalY - bolt.position.y) > 0.001) {
				significantChange = true;
			}
			
			// Update plate position if it exists
			if (bolt.userData.plate) {
				bolt.userData.plate.position.set(halfWidth + 0.45, yPos, -0.9);
				bolt.userData.plate.visible = true;
			}
			
			// Ensure color is set correctly
			if (bolt.material) {
				bolt.material.color.set(0xDAA520); // Gold for right
				bolt.material.emissive.set(0xDAA520);
			}
		});
		
		leftBolts.forEach(bolt => {
			// Determine if this is a top or bottom bolt based on current position
			const isTopBolt = bolt.position.y > 0;
			const yPos = isTopBolt ? (halfHeight + 0.1) : (-halfHeight - 0.1);
			
			// Store original position for comparison
			const originalX = bolt.position.x;
			const originalY = bolt.position.y;
			
			// Set position explicitly - always on left side
			bolt.position.set(-halfWidth - 0.45, yPos, -1.0);
			bolt.visible = true;
			
			// Check if position changed significantly
			if (Math.abs(originalX - bolt.position.x) > 0.001 || 
				Math.abs(originalY - bolt.position.y) > 0.001) {
				significantChange = true;
			}
			
			// Update plate position if it exists
			if (bolt.userData.plate) {
				bolt.userData.plate.position.set(-halfWidth - 0.45, yPos, -0.9);
				bolt.userData.plate.visible = true;
			}
			
			// Ensure color is set correctly
			if (bolt.material) {
				bolt.material.color.set(0x00ff00); // Green for left
				bolt.material.emissive.set(0x00ff00);
			}
		});
		
		// Always force sync jets after bolt positions are fixed
		if (this.jetsManager) {
			// Use forced sync when positions were changed significantly
			this.jetsManager.syncJetsWithBolts(significantChange);
			
			// If positions changed significantly and we're not in hidden mode, trigger jet effect
			if (significantChange && this.sizeMode !== 'hidden') {
				console.log("Significant bolt position change detected - triggering jet effect");
				this.triggerJetEffect(0.8); // Increased from 0.7 for more visibility
				
				// Additional sync after a short delay to ensure particles follow the bolts
				setTimeout(() => {
					if (this.jetsManager) {
						this.jetsManager.syncJetsWithBolts(true);
					}
				}, 50);
			}
		}
		
		// Log bolt positions for debugging
		console.log("Bolt positions after fixBoltPositions:");
		this.cornerBolts.forEach((bolt, i) => {
			console.log(`Bolt ${i}: x=${bolt.position.x.toFixed(2)}, y=${bolt.position.y.toFixed(2)}, isRightSide=${bolt.userData.isRightSide}, visible=${bolt.visible}`);
		});
	}

	/**
	 * Force a position update after camera movement
	 * Used when orbit controls stop moving
	 */
	updatePositionAfterCameraMovement() {
		if (this.isAnimatingMode) return;
		
		console.log("Updating scoreboard position after camera movement");
		
		// Force a full reposition even if not "significant" movement
		const currentPosition = this.scoreboardGroup.position.clone();
		
		// Temporarily reduce movement threshold to ensure update happens
		const originalThreshold = this.movementThreshold;
		this.movementThreshold = -1; // Force update by setting threshold negative
		
		// Update position
		this._updateScreenPosition();
		
		// Restore original threshold
		this.movementThreshold = originalThreshold;
		
		// Trigger jets effect if position actually changed
		if (currentPosition.distanceTo(this.scoreboardGroup.position) > 0.01) {
			if (this.jetsManager && this.sizeMode !== 'hidden') {
				this.triggerJetEffect(1.0); // Full intensity (was 0.7)
			}
		}
	}
} 