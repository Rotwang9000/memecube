import * as THREE from 'three';

/**
 * Handles button creation and interaction for the scoreboard
 */
export class ButtonManager {
	constructor(parentGroup) {
		this.parentGroup = parentGroup;
		this.expandButton = null;
		this.collapseButton = null;
		this.exitButton = null;
		this.expandPlanetMaterial = null;
		this.collapsePlanetMaterial = null;
		this.exitPlanetMaterial = null;
		
		// Social media buttons
		this.twitterButton = null;
		this.discordButton = null;
		this.urlButton = null;
		this.socialButtons = [];
		
		this.socialVisible = false;
		
		// Button container group
		this.buttonsGroup = null;
		
		this.createButtons();
		
		// Create a container group for all buttons
		this.createButtonsGroup();
	}
	
	/**
	 * Create visually attractive buttons with clear text
	 */
	createButtons() {
		// Create expand button (up arrow - visible initially)
		this.expandButton = new THREE.Group();
		this.expandButton.position.set(-2, 5, 1); // Start clearly above the board
		this.expandButton.userData = { isButton: true, action: 'expand' };
		this.expandButton.visible = true;
		this.parentGroup.add(this.expandButton);
		
		// Create collapse/back button (down arrow - visible initially)
		this.collapseButton = new THREE.Group();
		this.collapseButton.position.set(2, 5, 1); // Start clearly above the board
		this.collapseButton.userData = { isButton: true, action: 'collapse' };
		this.collapseButton.visible = true;
		this.parentGroup.add(this.collapseButton);
		
		// Create exit button (X icon - for exiting detail mode)
		this.exitButton = new THREE.Group();
		this.exitButton.position.set(4, 5, 1); // Start clearly above the board
		this.exitButton.userData = { isButton: true, action: 'exit' };
		this.exitButton.visible = false; // Hidden by default, shown only in detail mode
		this.parentGroup.add(this.exitButton);
		
		// Create planet-like button graphics
		const planetRadius = 0.8; // Increased from 0.6 for greater visibility
		const planetGeometry = new THREE.SphereGeometry(planetRadius, 32, 32);
		
		// Expand button as a green planet with up arrow
		this.expandPlanetMaterial = new THREE.MeshBasicMaterial({
			color: 0x00aa00,
			transparent: true,
			opacity: 0.9
		});
		const expandPlanet = new THREE.Mesh(planetGeometry, this.expandPlanetMaterial);
		expandPlanet.position.z = -1.2; // Moved forward to match social buttons
		expandPlanet.renderOrder = 15;  // Higher render order to match social buttons
		this.expandButton.add(expandPlanet);
		
		// Collapse button as a red planet with down arrow
		this.collapsePlanetMaterial = new THREE.MeshBasicMaterial({
			color: 0xaa0000,
			transparent: true,
			opacity: 0.9
		});
		const collapsePlanet = new THREE.Mesh(planetGeometry, this.collapsePlanetMaterial);
		collapsePlanet.position.z = -1.2; // Moved forward to match social buttons
		collapsePlanet.renderOrder = 15;  // Higher render order to match social buttons
		this.collapseButton.add(collapsePlanet);
		
		// Exit button as a white/grey planet with X
		this.exitPlanetMaterial = new THREE.MeshBasicMaterial({
			color: 0xdddddd,
			transparent: true,
			opacity: 0.9
		});
		const exitPlanet = new THREE.Mesh(planetGeometry, this.exitPlanetMaterial);
		exitPlanet.position.z = -1.2; // Moved forward to match social buttons
		exitPlanet.renderOrder = 15;  // Higher render order to match social buttons
		this.exitButton.add(exitPlanet);
		
		// Add glowing ring around planets
		const ringGeometry = new THREE.RingGeometry(planetRadius * 1.1, planetRadius * 1.3, 32);
		const ringMaterial = new THREE.MeshBasicMaterial({
			color: 0xaaaaaa,
			transparent: true,
			opacity: 0.5,
			side: THREE.DoubleSide
		});
		
		const expandRing = new THREE.Mesh(ringGeometry, ringMaterial.clone());
		expandRing.rotation.x = Math.PI / 2;
		expandRing.position.z = -1.15; // Adjusted to be slightly behind planet but still in front
		expandRing.renderOrder = 14;   // Lower than planet but still high
		this.expandButton.add(expandRing);
		
		const collapseRing = new THREE.Mesh(ringGeometry, ringMaterial.clone());
		collapseRing.rotation.x = Math.PI / 2;
		collapseRing.position.z = -1.15; // Adjusted to be slightly behind planet but still in front
		collapseRing.renderOrder = 14;   // Lower than planet but still high
		this.collapseButton.add(collapseRing);
		
		const exitRing = new THREE.Mesh(ringGeometry, ringMaterial.clone());
		exitRing.rotation.x = Math.PI / 2;
		exitRing.position.z = -1.15; // Adjusted to be slightly behind planet but still in front
		exitRing.renderOrder = 14;   // Lower than planet but still high
		this.exitButton.add(exitRing);
		
		// Create arrow indicators on planets - CRITICALLY IMPORTANT: Create with proper z-index and render order!
		console.log("Creating button indicators with proper z-index");
		this.createArrowIndicator(this.expandButton, 'up', 0x000000); // Black for contrast
		this.createArrowIndicator(this.collapseButton, 'down', 0x000000); // Black for contrast
		this.createXIndicator(this.exitButton, 0x000000); // Black for contrast
		
		// Create social media buttons
		this.createSocialButtons();
		
		// Ensure all buttons have indicators in front
		this.ensureButtonIndicatorsAreFrontal(this.expandButton);
		this.ensureButtonIndicatorsAreFrontal(this.collapseButton);
		this.ensureButtonIndicatorsAreFrontal(this.exitButton);
		
		// Log the button hierarchy to debug icon visibility
		console.log("Expand button children:", this.expandButton.children.length);
		console.log("Collapse button children:", this.collapseButton.children.length);
	}
	
	/**
	 * Ensure indicators (arrows, X) appear in front of their planets
	 */
	ensureButtonIndicatorsAreFrontal(buttonGroup) {
		if (!buttonGroup) return;
		
		// Set all children after the first one (which is the planet) to be in front
		const children = buttonGroup.children;
		for (let i = 0; i < children.length; i++) {
			const child = children[i];
			if (i > 0) { // Skip the planet itself (first child)
				// Ensure indicator is in front by setting z position and render order
				if (child.position.z > -1.1) {
					child.position.z = -1.1; // Set to be in front of planet
				}
				
				if (child.renderOrder < 20) {
					child.renderOrder = 20; // Higher render order than planet
				}
				
				// Set depthTest to false to ensure visibility
				if (child.material) {
					child.material.depthTest = false;
				}
				
				// If it's a group (like arrow group), do the same for its children
				if (child.children && child.children.length > 0) {
					child.children.forEach(grandchild => {
						if (grandchild.position.z > -1.1) {
							grandchild.position.z = -1.1;
						}
						if (grandchild.renderOrder < 20) {
							grandchild.renderOrder = 20;
						}
						if (grandchild.material) {
							grandchild.material.depthTest = false;
						}
					});
				}
				
				console.log(`Adjusted indicator ${i} in button ${buttonGroup.userData?.action}, z=${child.position.z}, renderOrder=${child.renderOrder}`);
			}
		}
	}
	
	/**
	 * Create social media buttons as planets with icons
	 */
	createSocialButtons() {
		// Larger planet size for social buttons
		const socialPlanetRadius = 0.5; // Increased from 0.35
		const socialPlanetGeometry = new THREE.SphereGeometry(socialPlanetRadius, 24, 24);
		const socialRingGeometry = new THREE.RingGeometry(socialPlanetRadius * 1.1, socialPlanetRadius * 1.3, 24);
		
		// Twitter/X button (blue planet)
		this.twitterButton = new THREE.Group();
		this.twitterButton.userData = { isButton: true, action: 'twitter' };
		this.twitterButton.visible = false;
		this.parentGroup.add(this.twitterButton);
		
		const twitterPlanetMaterial = new THREE.MeshBasicMaterial({
			color: 0x1DA1F2, // Twitter blue
			transparent: true,
			opacity: 0.9
		});
		
		const twitterPlanet = new THREE.Mesh(socialPlanetGeometry, twitterPlanetMaterial);
		twitterPlanet.position.z = -1.2; // Moved forward significantly to be in front
		twitterPlanet.renderOrder = 15; // Higher render order to ensure visibility
		this.twitterButton.add(twitterPlanet);
		
		// Add ring
		const twitterRing = new THREE.Mesh(socialRingGeometry, new THREE.MeshBasicMaterial({
			color: 0xaaaaaa,
			transparent: true,
			opacity: 0.5,
			side: THREE.DoubleSide
		}));
		twitterRing.rotation.x = Math.PI / 2;
		twitterRing.position.z = -1.15; // Slightly behind planet but still in front
		twitterRing.renderOrder = 14;
		this.twitterButton.add(twitterRing);
		
		// Add X/Twitter logo
		this.createTwitterIcon(this.twitterButton, 0x000000); // Black for contrast
		
		// Discord button (purple planet)
		this.discordButton = new THREE.Group();
		this.discordButton.userData = { isButton: true, action: 'discord' };
		this.discordButton.visible = false;
		this.parentGroup.add(this.discordButton);
		
		const discordPlanetMaterial = new THREE.MeshBasicMaterial({
			color: 0x5865F2, // Discord purple
			transparent: true,
			opacity: 0.9
		});
		
		const discordPlanet = new THREE.Mesh(socialPlanetGeometry, discordPlanetMaterial);
		discordPlanet.position.z = -1.2;
		discordPlanet.renderOrder = 15;
		this.discordButton.add(discordPlanet);
		
		// Add ring
		const discordRing = new THREE.Mesh(socialRingGeometry, new THREE.MeshBasicMaterial({
			color: 0xaaaaaa,
			transparent: true,
			opacity: 0.5,
			side: THREE.DoubleSide
		}));
		discordRing.rotation.x = Math.PI / 2;
		discordRing.position.z = -1.15;
		discordRing.renderOrder = 14;
		this.discordButton.add(discordRing);
		
		// Add Discord logo
		this.createDiscordIcon(this.discordButton, 0x000000); // Black for contrast
		
		// URL button (green planet)
		this.urlButton = new THREE.Group();
		this.urlButton.userData = { isButton: true, action: 'url' };
		this.urlButton.visible = false;
		this.parentGroup.add(this.urlButton);
		
		const urlPlanetMaterial = new THREE.MeshBasicMaterial({
			color: 0x00C853, // Green
			transparent: true,
			opacity: 0.9
		});
		
		const urlPlanet = new THREE.Mesh(socialPlanetGeometry, urlPlanetMaterial);
		urlPlanet.position.z = -1.2;
		urlPlanet.renderOrder = 15;
		this.urlButton.add(urlPlanet);
		
		// Add ring
		const urlRing = new THREE.Mesh(socialRingGeometry, new THREE.MeshBasicMaterial({
			color: 0xaaaaaa,
			transparent: true,
			opacity: 0.5,
			side: THREE.DoubleSide
		}));
		urlRing.rotation.x = Math.PI / 2;
		urlRing.position.z = -1.15;
		urlRing.renderOrder = 14;
		this.urlButton.add(urlRing);
		
		// Add URL/link icon
		this.createLinkIcon(this.urlButton, 0x000000); // Black for contrast
		
		// Store social buttons in an array for easy access
		this.socialButtons = [this.twitterButton, this.discordButton, this.urlButton];
	}
	
	/**
	 * Create Twitter/X icon for button
	 */
	createTwitterIcon(buttonGroup, color) {
		// Simple X shape for Twitter/X
		const xSize = 0.3; // Increased size
		
		// Create thicker X for better visibility
		const line1 = new THREE.Mesh(
			new THREE.PlaneGeometry(xSize * 2 * 0.3, xSize * 2), // 50% thicker
			new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide })
		);
		line1.position.z = -1.1; // Ensure icon is in front of planet
		line1.rotation.z = Math.PI / 4;
		line1.renderOrder = 20; // Much higher render order to be on top
		buttonGroup.add(line1);
		
		const line2 = new THREE.Mesh(
			new THREE.PlaneGeometry(xSize * 2 * 0.3, xSize * 2), // 50% thicker
			new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide })
		);
		line2.position.z = -1.1; // Ensure icon is in front of planet
		line2.rotation.z = -Math.PI / 4;
		line2.renderOrder = 20; // Much higher render order to be on top
		buttonGroup.add(line2);
	}
	
	/**
	 * Create a Discord logo for the button
	 */
	createDiscordIcon(buttonGroup, color) {
		// Simplified Discord logo (D shape)
		const logoGroup = new THREE.Group();
		
		// Create a Circle for the rounded part of the D
		const circleGeometry = new THREE.CircleGeometry(0.22, 16);
		const circleMaterial = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
		const circle = new THREE.Mesh(circleGeometry, circleMaterial);
		circle.position.set(0.05, 0, -1.1); // Move to front
		circle.renderOrder = 20; // Higher render order
		logoGroup.add(circle);
		
		// Create a rectangle for the vertical part
		const rectGeometry = new THREE.PlaneGeometry(0.08, 0.44);
		const rectMaterial = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
		const rect = new THREE.Mesh(rectGeometry, rectMaterial);
		rect.position.set(-0.15, 0, -1.1); // Move to front
		rect.renderOrder = 20; // Higher render order
		logoGroup.add(rect);
		
		// Small detail cutout for discord logo (eyes)
		const detailGeometry = new THREE.CircleGeometry(0.12, 16);
		const detailMaterial = new THREE.MeshBasicMaterial({ 
			color: buttonGroup.children[0]?.material?.color || 0x5865F2, 
			side: THREE.DoubleSide
		});
		
		const detail = new THREE.Mesh(detailGeometry, detailMaterial);
		detail.position.set(0.05, 0, -1.05); // Slightly behind the main circle
		detail.scale.set(0.8, 0.8, 1); // Scale to make it smaller
		detail.renderOrder = 19; // Just below the main shape
		logoGroup.add(detail);
		
		// Add the logo group to the button
		buttonGroup.add(logoGroup);
	}
	
	/**
	 * Create a link/chain icon for the URL button
	 */
	createLinkIcon(buttonGroup, color) {
		// Create a simple chain link icon
		const chainGroup = new THREE.Group();
		
		// Create first link (circle with gap)
		const link1 = new THREE.RingGeometry(0.15, 0.22, 16, 1, 0, Math.PI * 1.4);
		const linkMaterial = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
		const linkMesh1 = new THREE.Mesh(link1, linkMaterial);
		linkMesh1.position.z = -1.1; // Move to front
		linkMesh1.position.x = -0.1;
		linkMesh1.rotation.z = Math.PI / 4;
		linkMesh1.renderOrder = 20; // Higher render order
		chainGroup.add(linkMesh1);
		
		// Create second link (circle with gap)
		const link2 = new THREE.RingGeometry(0.15, 0.22, 16, 1, 0, Math.PI * 1.4);
		const linkMesh2 = new THREE.Mesh(link2, linkMaterial);
		linkMesh2.position.z = -1.1; // Move to front
		linkMesh2.position.x = 0.1;
		linkMesh2.rotation.z = -Math.PI / 4;
		linkMesh2.renderOrder = 20; // Higher render order
		chainGroup.add(linkMesh2);
		
		// Add straight connecting lines
		const line1 = new THREE.Mesh(
			new THREE.PlaneGeometry(0.1, 0.05),
			linkMaterial
		);
		line1.position.set(-0.05, 0.1, -1.1); // Move to front
		line1.renderOrder = 20; // Higher render order
		chainGroup.add(line1);
		
		const line2 = new THREE.Mesh(
			new THREE.PlaneGeometry(0.1, 0.05),
			linkMaterial
		);
		line2.position.set(-0.05, -0.1, -1.1); // Move to front
		line2.renderOrder = 20; // Higher render order
		chainGroup.add(line2);
		
		// Add the link icon to the button
		buttonGroup.add(chainGroup);
	}
	
	/**
	 * Create arrow indicator for buttons
	 */
	createArrowIndicator(buttonGroup, direction, color) {
		// Create a simple arrow shape
		const arrowGroup = new THREE.Group();
		
		// Common parameters for improved visibility
		const arrowWidth = 1.2;  // Increased from 0.5
		const arrowHeight = 1.2; // Increased from 0.5
		const lineWidth = 0.15;  // Increased from 0.08
		
		// Create base rendering parameters
		const arrowMaterial = new THREE.MeshBasicMaterial({ 
			color: color,
			side: THREE.DoubleSide
		});
		
		// Position for arrow components
		const zPos = -1.1; // Adjusted to be in front of planet
		const renderOrder = 20; // Same render order as other icons
		
		if (direction === 'up') {
			// Up arrow - triangle at top with stem
			const triangleShape = new THREE.Shape();
			triangleShape.moveTo(-arrowWidth/2, -arrowHeight*0.2);
			triangleShape.lineTo(0, -arrowHeight*0.5);
			triangleShape.lineTo(arrowWidth/2, -arrowHeight*0.2);
			triangleShape.lineTo(-arrowWidth/2, -arrowHeight*0.2);
			
			const triangleGeometry = new THREE.ShapeGeometry(triangleShape);
			const triangleMesh = new THREE.Mesh(triangleGeometry, arrowMaterial);
			triangleMesh.position.z = zPos;
			triangleMesh.position.y = 0.2; // Move up slightly to centralise
			triangleMesh.position.x = 0.1; // Slight adjustment to the right for better centering
			triangleMesh.renderOrder = renderOrder;
			arrowGroup.add(triangleMesh);
			
			// Stem
			const stemGeometry = new THREE.PlaneGeometry(lineWidth, arrowHeight*0.65);
			const stemMesh = new THREE.Mesh(stemGeometry, arrowMaterial);
			stemMesh.position.set(0.1, arrowHeight*0.5, zPos); // Adjusted to move up and slight right
			stemMesh.renderOrder = renderOrder;
			arrowGroup.add(stemMesh);
		} else {
			// Down arrow - triangle at bottom with stem
			const triangleShape = new THREE.Shape();
			triangleShape.moveTo(-arrowWidth/2, arrowHeight*0.2);
			triangleShape.lineTo(0, arrowHeight*0.5);
			triangleShape.lineTo(arrowWidth/2, arrowHeight*0.2);
			triangleShape.lineTo(-arrowWidth/2, arrowHeight*0.2);
			
			const triangleGeometry = new THREE.ShapeGeometry(triangleShape);
			const triangleMesh = new THREE.Mesh(triangleGeometry, arrowMaterial);
			triangleMesh.position.z = zPos;
			triangleMesh.position.y = -0.2; // Move down slightly to centralise
			triangleMesh.position.x = 0.1; // Slight adjustment to the right for better centering
			triangleMesh.renderOrder = renderOrder;
			arrowGroup.add(triangleMesh);
			
			// Stem
			const stemGeometry = new THREE.PlaneGeometry(lineWidth, arrowHeight*0.65);
			const stemMesh = new THREE.Mesh(stemGeometry, arrowMaterial);
			stemMesh.position.set(0.1, -arrowHeight*0.5, zPos); // Adjusted to move down and slight right
			stemMesh.renderOrder = renderOrder;
			arrowGroup.add(stemMesh);
		}
		
		buttonGroup.add(arrowGroup);
	}
	
	/**
	 * Create X indicator for exit button
	 */
	createXIndicator(buttonGroup, color) {
		// Create a simple X shape for the exit button
		const xGroup = new THREE.Group();
		
		// Size parameters
		const xSize = 0.6;    // Increased from 0.36
		const lineWidth = 0.2; // Increased from 0.1
		
		// Position for X components
		const zPos = -1.1; // Same z-position as other icons
		const renderOrder = 20; // Same render order as other icons
		
		// Material
		const xMaterial = new THREE.MeshBasicMaterial({ 
			color: color,
			side: THREE.DoubleSide 
		});
		
		// First diagonal line (top-left to bottom-right)
		const line1Geometry = new THREE.PlaneGeometry(lineWidth, xSize);
		const line1 = new THREE.Mesh(line1Geometry, xMaterial);
		line1.position.z = zPos;
		line1.rotation.z = Math.PI / 4; // 45 degrees
		line1.renderOrder = renderOrder;
		xGroup.add(line1);
		
		// Second diagonal line (top-right to bottom-left)
		const line2Geometry = new THREE.PlaneGeometry(lineWidth, xSize);
		const line2 = new THREE.Mesh(line2Geometry, xMaterial);
		line2.position.z = zPos;
		line2.rotation.z = -Math.PI / 4; // -45 degrees
		line2.renderOrder = renderOrder;
		xGroup.add(line2);
		
		buttonGroup.add(xGroup);
	}
	
	/**
	 * Update button positions based on scoreboard dimensions and mode
	 * 
	 * @param {number} width - Scoreboard width
	 * @param {number} height - Scoreboard height
	 * @param {string} sizeMode - Current size mode ('normal', 'tall', 'hidden')
	 */
	updateButtonPositions(width, height, sizeMode) {
		console.log(`Updating button positions: mode=${sizeMode}, width=${width}, height=${height}`);
		
		// Ensure buttons are always positioned outside the scoreboard area
		const topOffset = 2.0; // Increased distance above the scoreboard
		const buttonSpacing = 1.5; // Space between buttons
		const socialButtonSpacing = 1.5; // Increased from 1.0
		
		// Set Z to be always in front
		const buttonZ = 1.0; // Increased z-value to ensure visibility
		
		if (sizeMode === 'hidden') {
			// In hidden mode, position buttons more prominently since they're all that's visible
			// Position expand button prominently in view
			this.expandButton.position.set(
				2.0,     // Centered horizontally
				-1.0,    // Slightly below center
				-1.0     // In front of other elements
			);
			
			// Position collapse button nearby but distinct
			this.collapseButton.position.set(
				0.0,     // Centered horizontally
				-1.0,    // Same level as expand
				-1.0     // In front
			);
			
			// Position URL button as a visible planet
			if (this.urlButton) {
				this.urlButton.position.set(4.0, -1.0, -1.0);
				this.urlButton.visible = true;
			}
			
			// CRITICAL: Make buttons more visible in hidden mode by adjusting materials
			[this.expandButton, this.collapseButton, this.urlButton].forEach(button => {
				if (!button) return;
				button.traverse(obj => {
					if (obj.material) {
						obj.material.depthTest = false;
						obj.renderOrder = 100;
					}
				});
			});
			
			// CRITICAL: ALWAYS keep both buttons visible in hidden mode
			this.expandButton.visible = true;
			this.collapseButton.visible = true;
			
			console.log("Hidden mode: Buttons positioned prominently");
		} else {
			// Position expand/collapse at top corners, clearly above the scoreboard
			const topY = height/2 + topOffset;
			this.expandButton.position.set(-width/2 - buttonSpacing, topY, buttonZ);
			this.collapseButton.position.set(-width/2 + buttonSpacing, topY, buttonZ);
			
			// Ensure buttons are visible
			this.expandButton.visible = true;
			this.collapseButton.visible = true;
			
			console.log(`Normal/tall mode: Buttons positioned at y=${topY}`);
		}
		
		// Always position exit button at top right corner
		this.exitButton.position.set(width/2, height/2 + topOffset, buttonZ);
		
		// Position social media buttons at the bottom center
		// IMPORTANT: Only visible in detail mode or when socialVisible is true
		if (this.socialButtons.length > 0) {
			const totalWidth = (this.socialButtons.length - 1) * socialButtonSpacing;
			const startX = -totalWidth / 2;
			
			// Position each social button evenly spaced along the bottom
			this.socialButtons.forEach((button, index) => {
				if (sizeMode === 'hidden') {
					// In hidden mode, position social buttons in a horizontal line near the main buttons
					button.position.set(
						-4.0 + index * socialButtonSpacing * 1.5, // Spread out more
						-3.0, // Below main buttons
						-1.0  // In front
					);
				} else {
					// Normal positioning for other modes
					button.position.set(
						startX + index * socialButtonSpacing,
						-height/2 - topOffset, // Below scoreboard
						buttonZ
					);
				}
				
				// Make visible based on socialVisible flag
				button.visible = this.socialVisible || sizeMode === 'hidden';
				
				// Ensure material opacity is correct
				if (button.visible) {
					button.traverse(obj => {
						if (obj.material && obj.material.opacity !== undefined) {
							obj.material.opacity = 0.9;
							
							// In hidden mode, make sure materials are visible
							if (sizeMode === 'hidden') {
								obj.material.depthTest = false;
								obj.renderOrder = 100;
							}
						}
					});
				}
			});
			
			console.log(`Social buttons positioned: visible=${this.socialVisible}`);
		}
		
		// Double check positions are valid
		console.log(`Button positions after update:
			- Expand: ${JSON.stringify(this.expandButton.position.toArray())}
			- Collapse: ${JSON.stringify(this.collapseButton.position.toArray())}
			- Exit: ${JSON.stringify(this.exitButton.position.toArray())}
			- Socials visible: ${this.socialVisible}
		`);
		
		// If we have a buttons group, make sure it's positioned appropriately 
		// and always visible regardless of mode
		if (this.buttonsGroup) {
			this.buttonsGroup.visible = true;
			
			// Make sure depthTest is disabled for all button materials in hidden mode
			if (sizeMode === 'hidden') {
				this.buttonsGroup.traverse(obj => {
					if (obj.material) {
						obj.material.depthTest = false;
						obj.renderOrder = 100;
					}
				});
			}
		}
	}
	
	/**
	 * Set visibility of the exit button (for detail mode)
	 * 
	 * @param {boolean} visible - Whether the exit button should be visible
	 */
	setExitButtonVisibility(visible) {
		if (this.exitButton) {
			this.exitButton.visible = visible;
		}
	}
	
	/**
	 * Update button colors based on current size mode
	 * 
	 * @param {string} sizeMode - Current size mode ('normal', 'tall', 'hidden')
	 */
	updateButtonColors(sizeMode) {
		if (sizeMode === 'tall') {
			// Grey out up arrow as we're fully expanded
			this.expandPlanetMaterial.color.setHex(0x555555);
			this.collapsePlanetMaterial.color.setHex(0xaa0000); // Active down arrow
		} else if (sizeMode === 'normal') {
			// Both buttons active
			this.expandPlanetMaterial.color.setHex(0x00aa00);
			this.collapsePlanetMaterial.color.setHex(0xaa0000);
		} else if (sizeMode === 'hidden') {
			// Grey out down arrow as we're fully hidden
			this.expandPlanetMaterial.color.setHex(0x00aa00); // Active up arrow
			this.collapsePlanetMaterial.color.setHex(0x555555);
		}
	}
	
	/**
	 * Handle button interactions
	 * 
	 * @param {THREE.Raycaster} raycaster - Raycaster for detecting intersections
	 * @param {Function} onButtonClick - Callback function when a button is clicked
	 * @returns {boolean} Whether an interaction occurred
	 */
	handleInteraction(raycaster, onButtonClick) {
		// Include exit button in interaction objects when visible
		const interactionObjects = [];
		
		// Always include expand button, even in hidden mode
		if (this.expandButton && this.expandButton.visible) {
			interactionObjects.push(this.expandButton);
		}
		
		// Include collapse button if not in hidden mode
		if (this.collapseButton && this.collapseButton.visible) {
			interactionObjects.push(this.collapseButton);
		}
		
		// Include exit button when in detail mode
		if (this.exitButton && this.exitButton.visible) {
			interactionObjects.push(this.exitButton);
		}
		
		// Include visible social media buttons
		this.socialButtons.forEach(button => {
			if (button && button.visible) {
				interactionObjects.push(button);
			}
		});
		
		const intersects = raycaster.intersectObjects(interactionObjects, true);
		
		if (intersects.length > 0) {
			let obj = intersects[0].object;
			
			// Traverse up to find button
			let buttonGroup = obj;
			while (buttonGroup && !buttonGroup.userData?.isButton) {
				buttonGroup = buttonGroup.parent;
			}
			
			if (buttonGroup?.userData?.isButton) {
				const action = buttonGroup.userData.action;
				if (onButtonClick) {
					onButtonClick(action);
					return true;
				}
			}
		}
		
		return false;
	}
	
	/**
	 * Clean up resources
	 */
	dispose() {
		// Clean up button resources
		const allButtons = [
			this.expandButton, 
			this.collapseButton, 
			this.exitButton,
			...this.socialButtons
		];
		
		allButtons.forEach(button => {
			if (button) {
				button.traverse(obj => {
					if (obj.geometry) obj.geometry.dispose();
					if (obj.material) obj.material.dispose();
				});
			}
		});
	}
	
	/**
	 * Control social button visibility (called from TokenScoreboard detail mode)
	 * @param {boolean} visible - Whether social buttons should be visible
	 * @param {string} sizeMode - Current size mode (optional)
	 */
	setSocialButtonsVisibility(visible, sizeMode) {
		this.socialVisible = visible;
		
		// In hidden mode, social buttons should always be visible regardless of the passed visibility
		const isHiddenMode = sizeMode === 'hidden';
		
		this.socialButtons.forEach(btn => {
			if (btn) {
				// In hidden mode, always show social buttons
				btn.visible = isHiddenMode ? true : visible;
				
				// Make sure materials are properly visible
				if (btn.visible) {
					btn.traverse(obj => {
						if (obj.material) {
							obj.material.opacity = 0.9;
							
							// In hidden mode, ensure materials are always visible
							if (isHiddenMode) {
								obj.material.depthTest = false;
								obj.renderOrder = 100;
							}
						}
					});
				}
			}
		});
		
		console.log(`Social buttons visibility set to ${visible}, hidden mode: ${isHiddenMode}`);
	}
	
	/**
	 * Check if an object is part of a button
	 * @param {THREE.Object3D} obj - The object to check
	 * @returns {boolean} True if the object is part of a button
	 */
	isButtonObject(obj) {
		if (!obj) return false;
		
		// Check if the object is one of our buttons or inside one
		const isDirectButton = obj === this.expandButton || 
							  obj === this.collapseButton || 
							  obj === this.exitButton ||
							  obj === this.twitterButton ||
							  obj === this.discordButton ||
							  obj === this.urlButton;
							  
		if (isDirectButton) return true;
		
		// Check if object has button userData
		if (obj.userData?.isButton) return true;
		
		// Check if parent is a button
		if (obj.parent) {
			if (obj.parent.userData?.isButton) return true;
			
			// Check if parent is one of our button groups
			if (obj.parent === this.expandButton || 
				obj.parent === this.collapseButton || 
				obj.parent === this.exitButton ||
				obj.parent === this.twitterButton ||
				obj.parent === this.discordButton ||
				obj.parent === this.urlButton) {
				return true;
			}
		}
		
		return false;
	}
	
	/**
	 * Create a button container group for all buttons
	 * Should be called after creating buttons but before positioning them
	 */
	createButtonsGroup() {
		// Create a group to contain all buttons for easier management
		this.buttonsGroup = new THREE.Group();
		this.buttonsGroup.name = 'ScoreboardButtons';
		
		// Move buttons to the group
		if (this.expandButton) {
			this.parentGroup.remove(this.expandButton);
			this.buttonsGroup.add(this.expandButton);
		}
		
		if (this.collapseButton) {
			this.parentGroup.remove(this.collapseButton);
			this.buttonsGroup.add(this.collapseButton);
		}
		
		if (this.exitButton) {
			this.parentGroup.remove(this.exitButton);
			this.buttonsGroup.add(this.exitButton);
		}
		
		// Add social buttons to the group
		this.socialButtons.forEach(button => {
			this.parentGroup.remove(button);
			this.buttonsGroup.add(button);
		});
		
		// Add the button group to the parent
		this.parentGroup.add(this.buttonsGroup);
		
		// Set userData to identify this as a button container
		this.buttonsGroup.userData = { isButtonsContainer: true };
		
		console.log("Created buttons group to contain all scoreboard buttons");
	}
} 