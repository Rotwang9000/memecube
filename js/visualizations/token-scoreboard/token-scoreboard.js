import * as THREE from 'three';
//new
import { LEDDisplay } from './led-display.js';
import { JetsManager } from '../common/jets.js';
import { ButtonManager } from './buttons.js';
import { SocialButtonManager } from './social-buttons.js'; // Import the new social button manager
import { AnimationManager } from './animations.js';
import { ScoreboardModeManager } from './scoreboard-mode-manager.js'; // Import the new mode manager
import { ScoreboardDisplayManager } from './scoreboard-display-manager.js'; // Import the new display manager
import { formatCompactNumber, formatPrice, formatChange, getChangeColor } from './utils.js'; // Token-specific utils
import { easeInOutQuad, calculateHorizontalSpreadFactor, calculateScaleFactor, clamp } from '../common/utils.js'; // Common utils
import { createScoreboardStructure, addDecorativeElements, animateCornerBolts, animateCornerBoltsToCorner, animateCornerBoltsToNormalPositions } from '../common/physical-structure.js';
import * as gsap from 'gsap';
import { fixBoltPositions, triggerJetEffect } from '../common/physical-effects.js';

/**
 * 3D LED Scoreboard for displaying token data in the sky
 * Always stays in a fixed screen position
 */
export class TokenScoreboard {
	constructor(scene, camera, dataProvider = null) {
		this.scene = scene;
		this.camera = camera;
		this.dataProvider = dataProvider;
		this.isVisible = true;
		this.sizeMode = 'hidden'; // Start in hidden mode, will be managed by modeManager after init
		this.updateInterval = 10000; // Update every 10 seconds
		this.lastUpdateTime = 0;
		this.isAnimatingMode = false;
		this.isPositioningFirst = false;
		
		// Store reference to TagManager from scene if available
		if (scene && scene.userData && scene.userData.tagManager) {
			console.log("Found TagManager in scene userData");
			this.tagManager = scene.userData.tagManager;
		} else if (window.memeCube && window.memeCube.tagsManager) {
			console.log("Using global memeCube.tagsManager");
			this.tagManager = window.memeCube.tagsManager.tagManager;
		} else {
			console.log("TagManager not found in scene or global scope");
			this.tagManager = null;
		}
		
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
		this.height = 12 // Default height when normal
		this.expandedHeight = 20; // Placeholder, will be computed dynamically
		this.targetHeight = this.sizeMode === 'tall' ? this.computeExpandedHeight() : (this.sizeMode === 'normal' ? 12 : 1);
		this.initialHeight = this.height;
		
		// Token display settings
		this.maxTokensToShow = 30;
		this.scrollSpeed = 0.7;  // How fast the display scrolls
		this.scrollPosition = 0;
		
		// Movement parameters
		this.lastPosition = new THREE.Vector3();
		this.movementThreshold = 0.05;
		
		// Create the scoreboard mesh
		this.scoreboardGroup = new THREE.Group();
		
		// Create the physical structure using the imported modules
		createScoreboardStructure(this.scoreboardGroup, this.width, this.height);
		this.cornerBolts = addDecorativeElements(this.scoreboardGroup, this.width , this.height * 1.1);
		
		// Create subsystems
		this.ledDisplay = new LEDDisplay(this.scoreboardGroup, this.width -1.2, this.height);
		this.buttonManager = new ButtonManager(this.scoreboardGroup);
		this.socialButtonManager = new SocialButtonManager(this.scoreboardGroup); // New dedicated social button manager
		this.animationManager = new AnimationManager();
		this.modeManager = new ScoreboardModeManager(this); // Instantiate the mode manager
		this.displayManager = new ScoreboardDisplayManager(this); // Instantiate display manager
		
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
		
		// Create the dedicated expand planet
		this.createExpandPlanet();
		
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
			this.buttonManager.updateButtonPositions(this.width, this.height, this.sizeMode, this.detailMode);
		}
		
		// Add event listener for window resize
		window.addEventListener('resize', () => this.handleResize());
		
		// Detail mode state
		this.detailMode = false;
		this.detailToken = null;
		this.detailRefreshInterval = 6000; // 6 seconds
		this.lastDetailRefresh = 0;
		this.isRefreshingDetail = false;
		this.previousDetailModeForHidden = null; // Store the last detailMode state when hidden
		this.lastDetailToken = null; // Track the last detail token to detect changes
		this.lastSocialButtonPositionTime = 0; // Time tracking for social button positioning
		this.socialButtonPositionInterval = 2000; // Update social button positions every 2 seconds
		// this.changeSizeMode('hidden'); // Now handled by modeManager or initial state
		this.modeManager.currentSizeMode = 'hidden'; // Ensure manager starts in hidden

		// Automatically resize to normal after a 1-second delay
		setTimeout(() => {
			console.log("Auto-resizing scoreboard to normal mode after delay");
			this.modeManager.changeSizeMode('normal'); // Use modeManager
		}, 7000);

		// this.lastModeChangeTime = 0; // This might become redundant if fully managed by modeManager
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
			
			// Force social button position update on resize
			this.updateSocialButtonPositionsIfNeeded(true);
			
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
		// console.log(`Actual screen width: ${actualPixelWidth}px, FOV width: ${viewWidth.toFixed(2)}`);
		
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
			// console.log(isVeryNarrowScreen ? 
			// 	`Very narrow screen (${actualPixelWidth}px), centering and scaling` : 
			// 	`Narrow screen (${actualPixelWidth}px), centering horizontally`);
		} else if (isMediumScreen) {
			// For medium-width screens (750-900px), use a less extreme left position
			const mediumOffset = -0.25; // Moved further left from -0.2
			this.screenPosition.x = mediumOffset;
			// console.log(`Medium screen width (${actualPixelWidth}px), using moderate left position: ${mediumOffset}`);
		} else {
			// Standard left alignment on wider screens, but not as far left
			this.screenPosition.x = -0.5; // Moved further left from -0.4
			// console.log(`Normal screen width (${actualPixelWidth}px), positioning to the left`);
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
				
				// CRITICAL FIX: In detail mode, also keep social buttons and exit button visible
				if (this.detailMode && this.buttonManager) {
					// Keep exit button visible
					if (obj === this.buttonManager.exitButton || 
						(obj.parent && obj.parent === this.buttonManager.exitButton)) {
						obj.visible = true;
						return;
					}
					
					// Keep social buttons visible (use SocialButtonManager to check)
					if (this.socialButtonManager && this.socialButtonManager.isButtonObject(obj)) {
						obj.visible = true;
						return;
					}
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

	updateSocialButtonColors(token) {
		if (this.socialButtonManager) {
			// Force grey buttons if not in detail mode
			if (!this.detailMode) {
				console.log("Not in detail mode - forcing all social buttons to grey");
				// Pass empty object to make sure all buttons are grey
				this.socialButtonManager.updateButtonColors({});
			} else if (token) {
				console.log("Detail mode with token - updating social button colors");
				this.socialButtonManager.updateButtonColors(token);
			} else {
				console.log("Detail mode with no token - setting social buttons to grey");
				this.socialButtonManager.updateButtonColors({});
			}
		}
	}
	/**
	 * Handle user interaction with the scoreboard
	 * @param {THREE.Raycaster} raycaster - The raycaster for detecting intersections
	 */
	handleInteraction(raycaster) {
		// Check for button clicks first - they have priority
		if (this.buttonManager) {
			const buttonClicked = this.buttonManager.handleInteraction(raycaster, (action) => {
				console.log(`Button action received: ${action}, current mode: ${this.sizeMode}`);
				if (action === 'expand') {
					// Expand should only work from normal or hidden
					if (this.sizeMode === 'normal') {
						this.changeSizeMode('tall');
					} else if (this.sizeMode === 'hidden') {
						this.changeSizeMode('normal');
					}
				} else if (action === 'collapse') {
					// Collapse should go tall -> normal, or normal -> hidden
					if (this.sizeMode === 'tall') {
						this.changeSizeMode('normal'); // FIXED: Tall mode collapse goes to normal
					} else if (this.sizeMode === 'normal') {
						this.changeSizeMode('hidden'); 
					}
				} else if (action === 'exit') {
					// Exit always works if in detail mode
					if (this.detailMode) {
						this.exitTokenDetail();
					}
				}
			});
			if (buttonClicked) return true; // Stop if a button was clicked
		}
		
		// NEW: Check for social button clicks using the dedicated social button manager
		if (this.socialButtonManager) {
			const socialButtonClicked = this.socialButtonManager.isButtonObject(raycaster.intersectObject(this.scene, true)[0]?.object);
			if (socialButtonClicked) {
				const buttonObject = raycaster.intersectObject(this.scene, true)[0].object;
				const action = buttonObject.userData?.action || buttonObject.parent?.userData?.action;
				if (action) {
					this.handleSocialMediaClick(action);
					return true;
				}
			}
		}
		
		// Check if in detail mode and clicked on empty space
		if (this.detailMode) {
			const intersects = raycaster.intersectObject(this.scoreboardGroup, true);
			if (intersects.length === 0) {
				// Clicked on empty space while in detail mode - exit detail mode
				console.log("Clicked on empty space, exiting token detail mode");
				this.exitTokenDetail();
				return true;
			}
		}
		
		// NEW: Check if a click happened on or near the LED display
		if (!this.detailMode && this.ledDisplay && this.displayManager) {
			// Create or update a larger hit area for the LED display
			if (!this.ledHitPlane) {
				const hitPlaneGeometry = new THREE.PlaneGeometry(this.width * 1.2, this.height * 1.2);
				const hitPlaneMaterial = new THREE.MeshBasicMaterial({
					color: 0x000000,
					transparent: true,
					opacity: 0.0,
					side: THREE.DoubleSide
				});
				this.ledHitPlane = new THREE.Mesh(hitPlaneGeometry, hitPlaneMaterial);
				this.ledHitPlane.position.set(0, 0, -0.1); // Slightly behind the LEDs
				this.ledHitPlane.userData = {
					isLEDHitPlane: true
				};
				this.ledDisplay.ledGroup.add(this.ledHitPlane);
			}
			
			const intersects = raycaster.intersectObject(this.scoreboardGroup, true);
			if (intersects.length > 0) {
				// Check if we hit the LED display or its hit plane
				let ledHit = false;
				let ledHitObject = null;
				let hitPosition = null;
				
				// Look for the LED display or hit plane in the intersects
				for (const hit of intersects) {
					// Check if hit.object is part of the LED display, has isLED flag, or is the hit plane
					if (hit.object.parent === this.ledDisplay.ledGroup || 
						hit.object.userData?.isLED === true || 
						hit.object.userData?.isLEDHitPlane === true) {
						ledHit = true;
						ledHitObject = hit.object;
						hitPosition = hit.point;
						break;
					}
				}
				
				if (ledHit && ledHitObject) {
					// If we hit the plane or an LED, calculate the approximate row and column
					if (!ledHitObject.userData || (!ledHitObject.userData.row && !ledHitObject.userData.isLEDHitPlane)) {
						console.log("LED hit area clicked but has no userData");
						return false;
					}
					
					let row, col;
					if (ledHitObject.userData.isLEDHitPlane) {
						// Convert world position to local LED display coordinates
						const localPos = this.ledDisplay.ledGroup.worldToLocal(hitPosition.clone());
						const totalWidth = this.width * 0.98;
						const totalHeight = this.height * 0.95;
						const startX = -totalWidth / 2 + this.ledDisplay.dotSpacing / 2 - 1.2;
						const startY = -totalHeight / 1.88;
						
						// Calculate approximate row and column based on position
						col = Math.floor((localPos.x - startX) / (this.ledDisplay.dotSpacing * 0.9));
						row = Math.floor((localPos.y - startY) / (this.ledDisplay.dotSpacing * 0.88));
						
						// Clamp to valid range
						row = Math.max(0, Math.min(row, this.ledDisplay.dotRows - 1));
						col = Math.max(0, Math.min(col, this.ledDisplay.dotCols - 1));
						console.log(`LED hit plane clicked at approximate row ${row}, col ${col}`);
					} else {
						row = ledHitObject.userData.row;
						col = ledHitObject.userData.col;
						console.log(`LED dot clicked at row ${row}, col ${col}`);
					}
					
					if (row !== undefined && col !== undefined) {
						// Check if this position corresponds to a token
						const clickedToken = this.displayManager.findTokenAtPosition(row, col);
						if (clickedToken) {
							console.log(`Clicked on token: ${clickedToken.baseToken?.symbol || 'Unknown'}`);
							
							// Highlight the token in the tag cube if we have access to it
							if (this.tagManager) {
								const address = clickedToken.tokenAddress;
								if (address) {
									console.log(`Highlighting token with address: ${address}`);
									this.tagManager.highlightToken(address);
								}
							} else if (this.scene && this.scene.userData && this.scene.userData.tagManager) {
								const address = clickedToken.tokenAddress;
								if (address) {
									console.log(`Highlighting token with address: ${address}`);
									this.scene.userData.tagManager.highlightToken(address);
								}
							}
							
							// Show token detail view
							this.showTokenDetail(clickedToken);
							return true;
						} else {
							console.log("No token found at click position");
						}
					} else {
						console.log("LED hit but row/col undefined");
					}
				}
			}
		}
		
		// Normal token selection logic when not in detail mode
		if (!this.detailMode && this.visible) {
			const intersects = raycaster.intersectObject(this.scoreboardGroup, true);
			if (intersects.length > 0) {
				const clickedObject = intersects[0].object;
				
				// Check if clicked on a token row
				const tokenIndex = this._findTokenIndexFromObject(clickedObject);
				if (tokenIndex >= 0 && tokenIndex < this.tokens.length) {
					const clickedToken = this.tokens[tokenIndex];
					console.log(`Clicked token: ${clickedToken.symbol}`);
					this.showTokenDetail(clickedToken);
					return true;
				}
			}
		}
			
		// Check if clicked on dedicated expand planet in hidden mode
		if (this.sizeMode === 'hidden' && this.expandPlanet) {
			const intersects = raycaster.intersectObject(this.expandPlanet.userData.expandSphere, true);
			if (intersects.length > 0) {
				console.log("Clicked dedicated expand planet, changing to normal mode");
				this.changeSizeMode('normal');
				return true;
			}
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
		let hasLink = false;
		
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
				hasLink = true; // We can always create a Twitter search link with the symbol
				console.log(`No Twitter link found, creating search link for symbol ${symbol}`);
			} else {
				hasLink = !!url;
			}
		} else if (platform === 'discord') {
			url = this.detailToken.socialLinks?.discord || 
				this.detailToken.links?.discord;
			hasLink = !!url;
		} else if (platform === 'url') {
			// For URL, try several possible fields
			url = this.detailToken.website || 
				this.detailToken.socialLinks?.website || 
				this.detailToken.links?.website ||
				this.detailToken.explorer;
			
			// // If we have an address but no website, create an explorer link
			// if (!url && this.detailToken.tokenAddress) {
			// 	// Use chain-appropriate explorer
			// 	const chainId = this.detailToken.chainId;
				
			// 	if (chainId === 1) { // Ethereum mainnet
			// 		url = `https://etherscan.io/token/${this.detailToken.tokenAddress}`;
			// 	} else if (chainId === 56) { // Binance Smart Chain
			// 		url = `https://bscscan.com/token/${this.detailToken.tokenAddress}`;
			// 	} else if (chainId === 42161) { // Arbitrum
			// 		url = `https://arbiscan.io/token/${this.detailToken.tokenAddress}`;
			// 	} else if (chainId === 10) { // Optimism
			// 		url = `https://optimistic.etherscan.io/token/${this.detailToken.tokenAddress}`;
			// 	} else if (chainId === 137) { // Polygon
			// 		url = `https://polygonscan.com/token/${this.detailToken.tokenAddress}`;
			// 	} else if (chainId === 8453) { // Base
			// 		url = `https://basescan.org/token/${this.detailToken.tokenAddress}`;
			// 	} else {
			// 		// Generic fallback to Etherscan
			// 		url = `https://etherscan.io/token/${this.detailToken.tokenAddress}`;
			// 	}
			// 	hasLink = true; // We created an explorer link
			// 	console.log(`No website link found, creating explorer link for address ${this.detailToken.tokenAddress}`);
			// } else {
				
			// }

			hasLink = !!url;
		} else if (platform === 'dexscreener') {
			// For Dexscreener, we need the token address
			if (this.detailToken.tokenAddress) {
				const chainId = this.detailToken.chainId || 1; // Default to Ethereum if not specified
				
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
				
				url = `https://dexscreener.com/${chainName}/${this.detailToken.tokenAddress}`;
				hasLink = true;
				console.log(`Creating Dexscreener link for token address ${this.detailToken.tokenAddress}`);
			} else {
				hasLink = false;
			}
		}
		
		// Open the URL if found
		if (url) {
			console.log(`Opening ${platform} link: ${url}`);
			window.open(url, '_blank');
		} else {
			console.log(`No ${platform} link available for this token`);
			
			// Flash the button red to indicate no link
			this._flashSocialButtonNoLink(platform);
		}
	}
	
	/**
	 * Flash a social button red to indicate no link is available
	 * @param {string} platform - The social media platform ('twitter', 'discord', 'url')
	 * @private
	 */
	_flashSocialButtonNoLink(platform) {
		// NEW: Use dedicated social button manager
		if (!this.socialButtonManager) return;
		
		// Determine which button to flash
		let button = null;
		if (platform === 'twitter') button = this.socialButtonManager.twitterButton;
		else if (platform === 'discord') button = this.socialButtonManager.discordButton;
		else if (platform === 'url') button = this.socialButtonManager.urlButton;
		else if (platform === 'dexscreener') button = this.socialButtonManager.dexscreenerButton;
		
		if (!button) return;
		
		// Create informative console message based on platform
		let message = '';
		if (platform === 'twitter') {
			message = `No Twitter/X link found for ${this.detailToken.baseToken?.symbol || 'token'}`;
			if (this.detailToken.baseToken?.symbol) {
				message += `. You can manually search for $${this.detailToken.baseToken.symbol} on Twitter.`;
			}
		} else if (platform === 'discord') {
			message = `No Discord link found for ${this.detailToken.baseToken?.symbol || 'token'}`;
		} else if (platform === 'url') {
			message = `No website or explorer link found for ${this.detailToken.baseToken?.symbol || 'token'}`;
			if (this.detailToken.tokenAddress) {
				message += `. You can manually search for address ${this.detailToken.tokenAddress.substring(0, 10)}... on a blockchain explorer.`;
			}
		} else if (platform === 'dexscreener') {
			message = `No token address found for ${this.detailToken.baseToken?.symbol || 'token'} to create Dexscreener link`;
		}
		
		console.log(message);
		
		// Flash red by temporarily setting button color to red
		this.socialButtonManager.flashButtonRed(platform); 
		
		// Return to default color after a short delay
		setTimeout(() => {
			// Reset to grey (inactive)
			this.socialButtonManager.setButtonColor(button, 0x888888);
		}, 300);
	}
	
	/**
	 * Change the size mode of the scoreboard
	 * @param {string} mode - The new size mode ('normal', 'tall', 'hidden')
	 */
	changeSizeMode(mode) {
		this.modeManager.changeSizeMode(mode);
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
						topRightBolt.userData.originalPosition?.z || -0.2
					);
				}
				
				if (topLeftBolt) {
					topLeftBolt.userData.targetTallPosition = new THREE.Vector3(
						-viewWidth * horizontalSpreadFactor, // Negative X = left side
						viewHeight * 0.48,
						topLeftBolt.userData.originalPosition?.z || -0.2
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
				animateCornerBolts(
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
					animateCornerBolts(
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
				animateCornerBolts(
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
	 * Trigger a jet effect for visual feedback
	 * @param {number} intensity - Intensity factor for the jet effect (0.0-1.0+)
	 * @param {boolean} isBurstEffect - Whether to create a star-like burst pattern
	 */
	triggerJetEffect(intensity = 1.0, isBurstEffect = false) {
		// Use the common implementation from physical-effects.js
		return triggerJetEffect({
			jetsManager: this.jetsManager,
			cornerBolts: this.cornerBolts,
			intensity,
			isBurstEffect
		});
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
					bolt.position.set(halfWidth + 0.45, yPos, -0.2);
					bolt.visible = true;
					
					if (bolt.userData.plate) {
						bolt.userData.plate.position.set(halfWidth + 0.45, yPos, -0.1);
						bolt.userData.plate.visible = true;
					}
				});
				
				// Position left side bolts (green)
				leftBolts.forEach(bolt => {
					const isTopRow = bolt.position.y > 0;
					const yPos = isTopRow ? (halfHeight + 0.1) : (-halfHeight - 0.1);
					bolt.position.set(-halfWidth - 0.45, yPos, -0.2);
					bolt.visible = true;
					
					if (bolt.userData.plate) {
						bolt.userData.plate.position.set(-halfWidth - 0.45, yPos, -0.1);
						bolt.userData.plate.visible = true;
					}
				});
			}
			
			// Make display structure visible
			if (this.scoreboardGroup?.userData) {
				const displayMesh = this.scoreboardGroup.userData.displayMesh;
				
				if (displayMesh) displayMesh.visible = true;
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
				this.buttonManager.updateButtonPositions(this.width, this.height, this.sizeMode, this.detailMode);
				
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
				
				// Hide all other buttons except needed for detail mode
				if (this.buttonManager.collapseButton) {
					this.buttonManager.collapseButton.visible = false;
				}
				if (this.buttonManager.exitButton && !this.detailMode) {
					this.buttonManager.exitButton.visible = false;
				} else if (this.buttonManager.exitButton && this.detailMode) {
					// Make sure exit button is visible in detail mode
					this.buttonManager.exitButton.visible = true;
				}
				

			} else {
				// For normal and tall modes, use the standard button positioning
				this.buttonManager.updateButtonPositions(this.width, this.height, this.sizeMode, this.detailMode);
			
			}
			if (this.socialButtonManager) {
				this.socialButtonManager.positionButtonsAbove(this.width, this.height, 0);

				this.updateSocialButtonColors(this.detailToken);
			}

			
			// Special handling for hidden mode - with exception for detail mode
			if (this.sizeMode === 'hidden') {
				// Hide every bolt and its plate completely
				if (this.cornerBolts) {
					this.cornerBolts.forEach(bolt => {
						bolt.visible = false;
						if (bolt.userData?.plate) bolt.userData.plate.visible = false;
					});
				}
				
				// If NOT in detail mode, ensure only the dedicated expand button remains visible
				if (!this.detailMode) {
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
						
						// Keep social buttons visible
						if (this.socialButtonManager && this.socialButtonManager.buttonList.some(btn => 
							obj === btn || (obj.parent && obj.parent === btn))) {
							obj.visible = true;
							return;
						}
						
						// Hide everything else
						obj.visible = false;
					});
				} else {
					// In detail mode, also keep exit button and social buttons visible
					this.scoreboardGroup.traverse(obj => {
						// Keep the root group visible
						if (obj === this.scoreboardGroup) return;
						
						// Keep expand button hierarchy visible
						if (this.buttonManager && (
							obj === this.buttonManager.expandButton ||
							(obj.parent && obj.parent === this.buttonManager.expandButton) ||
							obj === this.buttonManager.exitButton ||
							(obj.parent && obj.parent === this.buttonManager.exitButton))) {
							obj.visible = true;
							return;
						}
						
						// Keep social buttons visible
						if (this.socialButtonManager && this.socialButtonManager.buttonList.some(btn => 
							obj === btn || (obj.parent && obj.parent === btn))) {
							obj.visible = true;
							return;
						}
						
						// Hide everything else
						obj.visible = false;
					});
				}
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
					bolt.position.set(halfWidth + 0.45, yPos, -0.2);
					bolt.visible = true;
					
					// Check if position changed significantly
					if (Math.abs(originalX - bolt.position.x) > 0.001 || 
					    Math.abs(originalY - bolt.position.y) > 0.001) {
						boltPositionsChanged = true;
					}
					
					// Update plate position if it exists
					if (bolt.userData.plate) {
						bolt.userData.plate.position.set(halfWidth + 0.45, yPos, -0.1);
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
					bolt.position.set(-halfWidth - 0.45, yPos, -0.2);
					bolt.visible = true;
					
					// Check if position changed significantly
					if (Math.abs(originalX - bolt.position.x) > 0.001 || 
					    Math.abs(originalY - bolt.position.y) > 0.001) {
						boltPositionsChanged = true;
					}
					
					// Update plate position if it exists
					if (bolt.userData.plate) {
						bolt.userData.plate.position.set(-halfWidth - 0.45, yPos, -0.1);
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
				
				// Hide all other buttons except needed for detail mode
				if (this.buttonManager.collapseButton) {
					this.buttonManager.collapseButton.visible = false;
				}
				
				// Only hide exit button if not in detail mode
				if (this.buttonManager.exitButton && !this.detailMode) {
					this.buttonManager.exitButton.visible = false;
				} else if (this.buttonManager.exitButton && this.detailMode) {
					// Make sure exit button is visible in detail mode
					this.buttonManager.exitButton.visible = true;
				}
				

				this.socialButtonManager.positionButtonsAbove(this.width, this.height, 0); 
				
			} else {
				// For normal and tall modes, use the standard button positioning
				this.buttonManager.updateButtonPositions(this.width, this.height, this.sizeMode, this.detailMode);
			
			}

			
			// Special handling for hidden mode - with exception for detail mode
			if (this.sizeMode === 'hidden' && !this.detailMode) {
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
			} else {
				// For normal and tall modes, use the standard button positioning
				this.buttonManager.updateButtonPositions(this.width, this.height, this.sizeMode, this.detailMode);
				
				// CRITICAL FIX: In detail mode, reposition social buttons above scoreboard
				if (this.socialButtonManager) {
					this.socialButtonManager.positionButtonsAbove(this.width, this.height, 0);
				}
			}
		}
		
		// Hide/show background elements based on mode
		if (this.scoreboardGroup?.userData) {
			const displayMesh = this.scoreboardGroup.userData.displayMesh;
			
			if (this.sizeMode === 'hidden') {
				// Hide display in hidden mode
				if (displayMesh) {
					displayMesh.visible = false;
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
		if (this.displayManager) {
			// Check if we're in detail mode - if so, find and update the current token
			if (this.detailMode && this.detailToken) {
				// Try to find the updated version of the currently displayed token
				const updatedDetailToken = tokens.find(t => {
					// Match by address if available
					if (t.tokenAddress && this.detailToken.tokenAddress) {
						return t.tokenAddress.toLowerCase() === this.detailToken.tokenAddress.toLowerCase();
					}
					// Match by symbol as fallback
					const detailSymbol = this.detailToken.baseToken?.symbol || this.detailToken.symbol || '';
					const tokenSymbol = t.baseToken?.symbol || t.symbol || '';
					return detailSymbol === tokenSymbol;
				});
				
				// If we found an updated version of the current token, update it in place
				if (updatedDetailToken) {
					console.log("Updating detail token with refreshed data");
					
					// Store previous token for comparison
					const previousToken = this.detailToken;
					
					// Update token data
					this.detailToken = {
						...this.detailToken,
						priceUsd: updatedDetailToken.priceUsd || this.detailToken.priceUsd,
						priceChange: updatedDetailToken.priceChange || this.detailToken.priceChange,
						marketCap: updatedDetailToken.marketCap || this.detailToken.marketCap,
						fdv: updatedDetailToken.fdv || this.detailToken.fdv,
						volume: updatedDetailToken.volume || this.detailToken.volume,
						liquidity: updatedDetailToken.liquidity || this.detailToken.liquidity,
						txns: updatedDetailToken.txns || this.detailToken.txns
					};
					
					// If token data has changed, update social button colors
					const hasTokenChanged = 
						previousToken.priceUsd !== this.detailToken.priceUsd || 
						previousToken.priceChange !== this.detailToken.priceChange;
					
					if (hasTokenChanged && this.socialButtonManager) {
						this.updateSocialButtonColors(this.detailToken);
						this.lastDetailToken = this.detailToken;
					}
				}
			}
			
			// Update token data in display manager, which will preserve scroll position
			this.displayManager.updateTokenData(tokens);
		}
	}
	
	/**
	 * Show detailed scoreboard for a single token
	 * @param {Object} token Token data
	 */
	showTokenDetail(token) {
		if (!token) {
			console.log("Cannot show token detail: token is undefined");
			return;
		}
		
		console.log("Showing detail for token:", token.name || token.symbol);
		
		this.detailMode = true;
		this.detailToken = token;
		this.lastDetailRefresh = Date.now(); // For _refreshDetailTokenData
		
		if (this.displayManager) {
			this.displayManager.showTokenDetail(); // Uses this.detailToken from TokenScoreboard
		}
		
		// Find and highlight the token in the tag cube if we have access to TagManager
		const tokenAddress = token.tokenAddress || (token.baseToken && token.baseToken.address);
		if (tokenAddress) {
			console.log(`Highlighting token with address: ${tokenAddress} in tag cube`);
			
			// Try different ways to access TagManager
			if (this.tagManager) {
				// We already have a reference to TagManager
				this.tagManager.highlightToken(tokenAddress);
			} else if (this.scene && this.scene.userData && this.scene.userData.tagManager) {
				// Use the TagManager stored in scene userData
				this.scene.userData.tagManager.highlightToken(tokenAddress);
			} else if (window.memeCube && window.memeCube.tagsManager && window.memeCube.tagsManager.tagManager) {
				// Use the global TagManager
				window.memeCube.tagsManager.tagManager.highlightToken(tokenAddress);
			} else {
				console.log("Could not find TagManager to highlight token in tag cube");
			}
		}
		
		if (this.buttonManager) {
			this.buttonManager.setExitButtonVisibility(true);
		}
		
		if (this.socialButtonManager && this.sizeMode !== 'hidden') {
			// Update social buttons with the new token
			this.socialButtonManager.updateState(this.detailToken, this.width, this.height);
			this.updateSocialButtonColors(this.detailToken);
			this.updateSocialButtonPositionsIfNeeded(true); // Force update positions
			this.lastDetailToken = this.detailToken; // Store reference to detect changes
		}
		
		console.log(`Token detail mode activated for ${token.symbol || token.name || 'unknown'}`);
	}
	
	/**
	 * Exit detail mode back to scrolling list
	 */
	exitTokenDetail() {
		console.log("Exiting token detail mode");
		this.detailMode = false;
		this.detailToken = null;
		this.lastDetailToken = null; // Clear the reference
		
		if (this.displayManager) {
			this.displayManager.exitTokenDetail();
		}
		
		if (this.buttonManager) {
			this.buttonManager.setExitButtonVisibility(false);
		}
		
		if (this.socialButtonManager && this.sizeMode !== 'hidden') {
			this.socialButtonManager.updateState(null, this.width, this.height);
			this.updateSocialButtonColors(null); // Reset colors when exiting detail mode
			this.updateSocialButtonPositionsIfNeeded(true); // Force update positions
		}
	}
	
	/**
	 * Toggle visibility of the scoreboard
	 */
	toggleVisibility() {
		this.isVisible = !this.isVisible;
		this.scoreboardGroup.visible = this.isVisible;
		
		// Also toggle visibility of the expand planet when toggling scoreboard visibility
		if (this.expandPlanet) {
			this.expandPlanet.visible = this.isVisible && this.sizeMode === 'hidden';
		}
		
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
		
		
		// Delegate display updates to the display manager
		if (this.displayManager) {
			this.displayManager.update(deltaTime); // This will handle its own refresh logic now
		}

		// Handle display modes - PLANET ONLY HERE (mostly managed by modeManager now)
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
			
			// Handle button states if detailMode changes while hidden
			if (this.buttonManager) {
				if (this.detailMode !== this.previousDetailModeForHidden) {
					console.log("TokenScoreboard: DetailMode changed in Hidden. Updating button states.");
					// Visibility for expand button (always on in hidden mode)
					if (this.buttonManager.expandButton) {
						this.buttonManager.expandButton.visible = true;
						// Positioning of expandButton (e.g., centered) is handled by finalizeSizeModeChange
					}
					// Collapse button should be hidden in 'hidden' mode
					if (this.buttonManager.collapseButton) {
						this.buttonManager.collapseButton.visible = false;
					}
					// Exit button visibility depends on detailMode
					if (this.buttonManager.exitButton) {
						this.buttonManager.exitButton.visible = this.detailMode;
					}
					// Update social button states based on detailMode
					if (this.socialButtonManager) {
						this.socialButtonManager.updateState(this.detailMode ? this.detailToken : null, this.width, this.height);
						
						// Ensure social buttons are visible if in detail mode, otherwise hidden
						this.socialButtonManager.buttonList.forEach(button => {
							if (button) {
								button.visible = this.detailMode;
							}
						});
					}
					this.previousDetailModeForHidden = this.detailMode;
				}
				// The explicit calls to updateButtonPositions and updateButtonColors per frame are removed.
				// Their one-time setup for 'hidden' mode is handled in finalizeSizeModeChange.
				// Visibility for expandButton and collapseButton is now more targeted above.
			}
			
			return; // Skip the rest of the update in hidden mode
		} else {
			// Hide the expand planet in non-hidden modes
			if (this.expandPlanet) {
				this.expandPlanet.visible = false;
			}

			// Reset previousDetailModeForHidden when not in hidden mode,
			// so the check triggers correctly on next entry to hidden mode.
			if (this.previousDetailModeForHidden !== null) {
				this.previousDetailModeForHidden = null;
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
		
		
		// Update social button manager state if it exists and not animating mode
		if (this.socialButtonManager && !this.isAnimatingMode) {
			// Only update positions periodically rather than every frame
			this.updateSocialButtonPositionsIfNeeded();
			
			// Only update colors if the detail token has changed
			if (this.detailToken !== this.lastDetailToken) {
				this.updateSocialButtonColors(this.detailToken);
				this.lastDetailToken = this.detailToken;
			}
			
			// Show social buttons only in detail mode, since they're now part of scoreboard group
			this.socialButtonManager.buttonList.forEach(button => {
				if (button) {
					button.visible = this.detailMode;
					button.traverse(obj => {
						if (obj.material) {
							obj.material.depthTest = false;
							obj.material.depthWrite = false;
							obj.renderOrder = 3000; // Very high render order
						}
					});
				}
			});
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
		if (this.socialButtonManager) this.socialButtonManager.dispose(); // Clean up social button manager
		
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
	 * Position the expandPlanet consistently in the bottom left corner
	 * Called every frame in hidden mode to ensure consistent positioning
	 * @private
	 */
	_positionExpandPlanetBottomRight() {
		if (!this.expandPlanet || !this.camera) return;
		
		// Get camera orientation vectors to compute bottom left position
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
		
		// Position the expand planet at the bottom LEFT of the screen (not right)
		// Use fixed offsets that won't change with viewWidth/Height to avoid jitter
		const bottomY = -viewHeight * 0.4; // Lower position - never changes
		const leftX = -viewWidth * 0.4;    // Left side instead of right
		
		// Calculate position in 3D space for bottom left
		const planetPos = this.camera.position.clone()
			.add(forward.clone().multiplyScalar(distance))
			.add(right.clone().multiplyScalar(leftX))
			.add(up.clone().multiplyScalar(bottomY));
		
		// Set position for expand planet
		this.expandPlanet.position.copy(planetPos);
		
		// Look directly at the camera position
		this.expandPlanet.lookAt(this.camera.position);
		
		// Add rotations to make the plus sign face forward
		this.expandPlanet.rotateOnAxis(new THREE.Vector3(0, 1, 0), Math.PI);
		
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
				transparent: false, // FIXED: Make opaque for visibility
				opacity: 1.0
			});
			const segment = new THREE.Mesh(geometry, material);
			segment.position.z = 0.9; // FIXED: Position more in front of sphere for better visibility
			segment.renderOrder = 3500; // FIXED: Even higher render order to ensure visibility
			return segment;
		};
		
		const horizontalSegment = createPlusSegment(true);
		const verticalSegment = createPlusSegment(false);
		
		// Add segments to sphere
		sphere.add(horizontalSegment);
		sphere.add(verticalSegment);
		
		// Add a glowing ring around the planet
		const ringGeometry = new THREE.RingGeometry(0.9, 1.1, 32);
		const ringMaterial = new THREE.MeshBasicMaterial({
			color: 0xaaffaa, // Light green for glow
			transparent: true,
			opacity: 0.7,
			side: THREE.DoubleSide,
			depthTest: false
		});
		
		const expandRing = new THREE.Mesh(ringGeometry, ringMaterial);
		expandRing.rotation.x = Math.PI / 2; // Rotate to be perpendicular to camera
		expandRing.position.z = 0; // Same plane as sphere
		expandRing.renderOrder = 2999; // Just below sphere render order
		sphere.add(expandRing); // Add to sphere so they move together
		
		// Add sphere to expand planet group
		this.expandPlanet.add(sphere);
		
		// Set the initial position - will be updated consistently in _positionExpandPlanetBottomLeft
		// Position immediately in bottom left using helper method if camera is available
		if (this.camera) {
			this._positionExpandPlanetBottomRight();
		} else {
			// Default fallback position (bottom left)
			this.expandPlanet.position.set(-5, -7, -10);
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
		
		console.log("Created dedicated expand planet for hidden mode, positioned at bottom left");
	}

	/**
	 * Fix bolt positions directly when animation has issues
	 * Call this whenever bolts get misplaced during transitions
	 */
	fixBoltPositions() {
		// Use the common implementation from physical-effects.js
		return fixBoltPositions({
			cornerBolts: this.cornerBolts,
			width: this.width,
			height: this.height,
			jetsManager: this.jetsManager,
			sizeMode: this.sizeMode
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

	/**
	 * Draw the scrolling token list on the LED display
	 * Called each frame when in normal mode (not detail mode)
	 * @private
	 */
	_drawScrollingTokenList() {
		// Skip if no display or no tokens
		if (!this.ledDisplay) return;
		
		// If we have no display data, show a message
		if (!this.displayData || this.displayData.length === 0) {
			this.ledDisplay.drawText('LOADING TOKEN DATA...', 2, 2, 'cyan');
			return;
		}
		
		// Reference to tokens for easier readability
		this.tokens = this.displayData;
		
		// Update scroll position for animation
		this.scrollPosition += this.scrollSpeed;
		if (this.scrollPosition >= (this.tokens.length - maxVisible * 0.5) * 12) {
			this.scrollPosition = 0;
		}
		
		// Calculate visible token range - show up to 6 tokens at once
		const maxVisible = this.ledDisplay.dotRows >= 30 ? 5 : (this.ledDisplay.dotRows >= 20 ? 3 : 2);
		const startIdx = Math.floor(this.scrollPosition / 12);
		let visibleTokens = 0;
		
		// Draw each visible token
		for (let i = 0; i < maxVisible + 2; i++) {
			const idx = (startIdx + i) % this.tokens.length;
			const token = this.tokens[idx];
			if (!token) continue;
			
			// Calculate row position based on index and scroll position
			const rowOffsetFraction = (this.scrollPosition % 12) / 12;
			const rowStart = Math.floor(i * 12 - rowOffsetFraction * 12) + 2;
			
			// Skip if token would be completely off-screen
			if (rowStart < -12 || rowStart >= this.ledDisplay.dotRows) continue;
			
			// Draw using ledDisplay's drawTokenInfo method if available
			if (typeof this.ledDisplay.drawTokenInfo === 'function') {
				this.ledDisplay.drawTokenInfo(token, rowStart);
			} else {
				// Otherwise implement a simple display
				// Show symbol in cyan, price in yellow, and change in red/green
				const symbol = token.symbol || 'UNKN';
				const price = formatPrice(token.price || 0);
				const change = token.change !== undefined ? token.change : 0;
				const changeColor = getChangeColor(change);
				
				// Draw symbol
				this.ledDisplay.drawText(symbol, rowStart, 2, 'cyan');
				
				// Draw price
				this.ledDisplay.drawText('$' + price, rowStart + 6, 2, 'yellow');
				
				// Draw change percentage
				const changeText = (change >= 0 ? '+' : '') + change.toFixed(2) + '%';
				this.ledDisplay.drawText(changeText, rowStart + 6, 50, changeColor);
			}
			
			visibleTokens++;
		}
		
		// If no tokens could be drawn, show a message
		if (visibleTokens === 0) {
			this.ledDisplay.drawText('NO TOKEN DATA', 2, 10, 'red');
		}
	}

	/**
	 * Update social button positions only if needed (determined by interval)
	 * @param {boolean} force Force update regardless of timer
	 */
	updateSocialButtonPositionsIfNeeded(force = false) {
		if (!this.socialButtonManager) return;
		
		const currentTime = Date.now();
		const timeSinceLastUpdate = currentTime - this.lastSocialButtonPositionTime;
		
		// Update positions if forced or interval has passed
		if (force || timeSinceLastUpdate > this.socialButtonPositionInterval) {
			this.socialButtonManager.positionButtonsAbove(this.width, this.height, 0);
			this.lastSocialButtonPositionTime = currentTime;
		}
	}
} // This closes the class TokenScoreboard