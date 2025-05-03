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
				child.position.z = -1.0; // Set to be in front of planet
					child.renderOrder = 20; // Higher render order than planet
				
				// Set depthTest to false to ensure visibility
				if (child.material) {
					child.material.depthTest = false;
				}
				
				// If it's a group (like arrow group), do the same for its children
				if (child.children && child.children.length > 0) {
					child.children.forEach(grandchild => {
						grandchild.position.z = -1.0;
							grandchild.renderOrder = 20;
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
		
		// Improved material for visibility
		const iconMaterial = new THREE.MeshBasicMaterial({ 
			color: 0x000000, 
			side: THREE.DoubleSide,
			depthTest: false,
			transparent: true,
			opacity: 1.0
		});
		
		// Z position and render order for visibility
		const zPos = -0.9; // Clearly in front
		const renderOrder = 50; // Higher render order
		
		// Create thicker X for better visibility
		const line1 = new THREE.Mesh(
			new THREE.PlaneGeometry(xSize * 2 * 0.3, xSize * 2), // 50% thicker
			iconMaterial
		);
		line1.position.z = zPos;
		line1.rotation.z = Math.PI / 4;
		line1.renderOrder = renderOrder;
		buttonGroup.add(line1);
		
		const line2 = new THREE.Mesh(
			new THREE.PlaneGeometry(xSize * 2 * 0.3, xSize * 2), // 50% thicker
			iconMaterial
		);
		line2.position.z = zPos;
		line2.rotation.z = -Math.PI / 4;
		line2.renderOrder = renderOrder;
		buttonGroup.add(line2);
	}
	
	/**
	 * Create a Discord logo for the button
	 */
	createDiscordIcon(buttonGroup, color) {
		// Simplified Discord logo (D shape)
		const logoGroup = new THREE.Group();
		
		// Z position and render order for visibility
		const zPos = -0.9; // Clearly in front
		const renderOrder = 50; // Higher render order
		
		// Improved material for visibility
		const iconMaterial = new THREE.MeshBasicMaterial({ 
			color, 
			side: THREE.DoubleSide,
			depthTest: false,
			transparent: true,
			opacity: 1.0
		});
		
		// Create a Circle for the rounded part of the D
		const circleGeometry = new THREE.CircleGeometry(0.22, 16);
		const circle = new THREE.Mesh(circleGeometry, iconMaterial);
		circle.position.set(0.05, 0, zPos);
		circle.renderOrder = renderOrder;
		logoGroup.add(circle);
		
		// Create a rectangle for the vertical part
		const rectGeometry = new THREE.PlaneGeometry(0.08, 0.44);
		const rect = new THREE.Mesh(rectGeometry, iconMaterial);
		rect.position.set(-0.15, 0, zPos);
		rect.renderOrder = renderOrder;
		logoGroup.add(rect);
		
		// Small detail cutout for discord logo (eyes)
		const detailGeometry = new THREE.CircleGeometry(0.12, 16);
		const detailMaterial = new THREE.MeshBasicMaterial({ 
			color: buttonGroup.children[0]?.material?.color || 0x5865F2, 
			side: THREE.DoubleSide,
			depthTest: false,
			transparent: true,
			opacity: 1.0
		});
		
		const detail = new THREE.Mesh(detailGeometry, detailMaterial);
		detail.position.set(0.05, 0, zPos + 0.01); // Slightly behind the main circle
		detail.scale.set(0.8, 0.8, 1); // Scale to make it smaller
		detail.renderOrder = renderOrder - 1; // Just below the main shape
		logoGroup.add(detail);
		
		// Position the entire logo group to be in front of the planet
		logoGroup.position.z = zPos;
		logoGroup.renderOrder = renderOrder;
		
		// Add the logo group to the button
		buttonGroup.add(logoGroup);
	}
	
	/**
	 * Create a link/chain icon for the URL button
	 */
	createLinkIcon(buttonGroup, color) {
		// Create a simple chain link icon
		const chainGroup = new THREE.Group();
		
		// Z position and render order for visibility
		const zPos = -0.9; // Clearly in front
		const renderOrder = 50; // Higher render order
		
		// Improved material for visibility
		const linkMaterial = new THREE.MeshBasicMaterial({ 
			color, 
			side: THREE.DoubleSide,
			depthTest: false,
			transparent: true,
			opacity: 1.0
		});
		
		// Create first link (circle with gap)
		const link1 = new THREE.RingGeometry(0.15, 0.22, 16, 1, 0, Math.PI * 1.4);
		const linkMesh1 = new THREE.Mesh(link1, linkMaterial);
		linkMesh1.position.z = zPos;
		linkMesh1.position.x = -0.1;
		linkMesh1.rotation.z = Math.PI / 4;
		linkMesh1.renderOrder = renderOrder;
		chainGroup.add(linkMesh1);
		
		// Create second link (circle with gap)
		const link2 = new THREE.RingGeometry(0.15, 0.22, 16, 1, 0, Math.PI * 1.4);
		const linkMesh2 = new THREE.Mesh(link2, linkMaterial);
		linkMesh2.position.z = zPos;
		linkMesh2.position.x = 0.1;
		linkMesh2.rotation.z = -Math.PI / 4;
		linkMesh2.renderOrder = renderOrder;
		chainGroup.add(linkMesh2);
		
		// Add straight connecting lines
		const line1 = new THREE.Mesh(
			new THREE.PlaneGeometry(0.1, 0.05),
			linkMaterial
		);
		line1.position.set(-0.05, 0.1, zPos);
		line1.renderOrder = renderOrder;
		chainGroup.add(line1);
		
		const line2 = new THREE.Mesh(
			new THREE.PlaneGeometry(0.1, 0.05),
			linkMaterial
		);
		line2.position.set(-0.05, -0.1, zPos);
		line2.renderOrder = renderOrder;
		chainGroup.add(line2);
		
		// Position the entire chain group to be in front of the planet
		chainGroup.position.z = zPos;
		chainGroup.renderOrder = renderOrder;
		
		// Add the link icon to the button
		buttonGroup.add(chainGroup);
	}
	
	/**
	 * Create arrow indicator for buttons
	 */
	createArrowIndicator(buttonGroup, direction, color) {
		// Create a simple arrow shape (just the arrowhead, no stalk)
		const arrowGroup = new THREE.Group();
		
		// Common parameters for improved visibility
		const arrowWidth = 0.4;  // Width of the arrow head
		const arrowHeight = 0.4; // Height of the arrow head
		
		// Create base rendering parameters
		const arrowMaterial = new THREE.MeshBasicMaterial({ 
			color: color,
			side: THREE.DoubleSide,
			depthTest: false,
			transparent: true,
			opacity: 1.0
		});
		
		// Position for arrow components
		const zPos = -0.8; // Adjusted to be clearly in front of planet
		const renderOrder = 100; // Even higher render order to absolutely ensure visibility
		
		if (direction === 'up') {
			// Up arrow - just the triangle pointing upward
			const triangleShape = new THREE.Shape();
			triangleShape.moveTo(-arrowWidth/2, arrowHeight/2);
			triangleShape.lineTo(0, -arrowHeight/2);
			triangleShape.lineTo(arrowWidth/2, arrowHeight/2);
			triangleShape.lineTo(-arrowWidth/2, arrowHeight/2);
			
			const triangleGeometry = new THREE.ShapeGeometry(triangleShape);
			const triangleMesh = new THREE.Mesh(triangleGeometry, arrowMaterial);
			triangleMesh.position.z = zPos;
			triangleMesh.renderOrder = renderOrder;
			arrowGroup.add(triangleMesh);
		} else if (direction === 'down') {
			// Down arrow - just the triangle pointing downward
			const triangleShape = new THREE.Shape();
			triangleShape.moveTo(-arrowWidth/2, -arrowHeight/2);
			triangleShape.lineTo(0, arrowHeight/2);
			triangleShape.lineTo(arrowWidth/2, -arrowHeight/2);
			triangleShape.lineTo(-arrowWidth/2, -arrowHeight/2);
			
			const triangleGeometry = new THREE.ShapeGeometry(triangleShape);
			const triangleMesh = new THREE.Mesh(triangleGeometry, arrowMaterial);
			triangleMesh.position.z = zPos;
			triangleMesh.renderOrder = renderOrder;
			arrowGroup.add(triangleMesh);
		}
		
		// Position the entire arrow group to be in front of the planet
		arrowGroup.position.z = -0.8;
		arrowGroup.renderOrder = renderOrder;
		
		// Set arrow group material properties for visibility
		arrowGroup.traverse(obj => {
			if (obj.material) {
				obj.material.depthTest = false;
				obj.material.transparent = true;
				obj.material.opacity = 1.0;
			}
		});
		
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
		const zPos = -0.9; // Improved z-position to be clearly in front
		const renderOrder = 50; // Higher render order to ensure visibility
		
		// Material
		const xMaterial = new THREE.MeshBasicMaterial({ 
			color: color,
			side: THREE.DoubleSide,
			depthTest: false,
			transparent: true,
			opacity: 1.0
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
		
		// Position the entire X group to be in front of the planet
		xGroup.position.z = -0.9;
		xGroup.renderOrder = renderOrder;
		
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
		const buttonSpacing = 3.0; // Increased space between buttons for better visibility
		const socialButtonSpacing = 1.5; // Increased from 1.0
		
		// Set Z to be always in front
		const buttonZ = -1.0; // Negative Z to bring buttons forward
		
		if (sizeMode === 'hidden') {
			// In hidden mode, position buttons at the bottom, next to each other
			// Position expand button to the left of collapse button
			const bottomY = -7.0; // Fixed position at the bottom of the screen
			
			this.expandButton.position.set(
				-1.5,   // Left position
				bottomY, // Fixed bottom position
				-1.0    // In front of other elements
			);
			
			// Position collapse button right next to expand button
			this.collapseButton.position.set(
				1.5,    // Right position
				bottomY, // Same bottom position
				-1.0    // In front
			);
			
			// Position URL button as a visible planet nearby
			if (this.urlButton) {
				this.urlButton.position.set(4.0, bottomY, -1.0);
				this.urlButton.visible = true;
			}
			
			// CRITICAL: Force all buttons to be visible in hidden mode
			this.expandButton.visible = true;
			this.collapseButton.visible = true;
			
			// CRITICAL: Make buttons more visible in hidden mode by adjusting materials
			[this.expandButton, this.collapseButton, this.urlButton].forEach(button => {
				if (!button) return;
				button.traverse(obj => {
					if (obj.material) {
						obj.material.depthTest = false;
						obj.renderOrder = 100;
						// Ensure opacity is set to fully visible
						if (obj.material.transparent) {
							obj.material.opacity = 1.0;
						}
					}
				});
			});
			
			// CRITICAL: Ensure the arrows are properly positioned in front of planets
			this.ensureButtonIndicatorsAreFrontal(this.expandButton);
			this.ensureButtonIndicatorsAreFrontal(this.collapseButton);
			
			console.log("Hidden mode: Buttons positioned at bottom, next to each other");
		} else {
			// Position expand/collapse at top left and right for clarity
			const topY = height/2 + topOffset;
			
			// Put expand button at top left, clearly visible
			this.expandButton.position.set(-width/2 - 2, topY, buttonZ);
			
			// Put collapse button at top right, clearly visible
			this.collapseButton.position.set(width/2 + 2, topY, buttonZ);
			
			// Ensure buttons are visible and depth settings are correct
			[this.expandButton, this.collapseButton].forEach(button => {
				if (!button) return;
				
				button.visible = true;
				console.log(`Setting ${button.userData?.action} button to visible`);
				
				// Make sure all materials are set for visibility
				button.traverse(obj => {
					if (obj.material) {
						obj.material.depthTest = false;
						obj.renderOrder = 100;
					}
				});
			});
			
			// Ensure arrows are visible
			this.ensureButtonIndicatorsAreFrontal(this.expandButton);
			this.ensureButtonIndicatorsAreFrontal(this.collapseButton);
			
			console.log(`Normal/tall mode: Buttons positioned at top left/right at y=${topY}`);
		}
		
		// Always position exit button at top right corner
		this.exitButton.position.set(width/2, height/2 + topOffset, buttonZ);
		
		// Position social media buttons at the bottom 
		if (this.socialButtons.length > 0) {
			const totalWidth = (this.socialButtons.length - 1) * socialButtonSpacing;
			const startX = -totalWidth / 2;
			
			// Position each social button evenly spaced along the bottom
			this.socialButtons.forEach((button, index) => {
				if (sizeMode === 'hidden') {
					// In hidden mode, position social buttons in a horizontal line near the main buttons
					// Position them lower than the main buttons
					const bottomY = -9.0; // Even lower than the main buttons
					
					button.position.set(
						-3.0 + index * socialButtonSpacing * 1.5, // Spread out more
						bottomY, // Lower position
						-1.0    // In front
					);
					
					// Always visible in hidden mode
					button.visible = true;
				} else {
					// Normal positioning for other modes
					button.position.set(
						startX + index * socialButtonSpacing,
						-height/2 - topOffset, // Below scoreboard
						buttonZ
					);
					
					// In normal modes, visibility depends on socialVisible flag
					button.visible = this.socialVisible;
				}
				
				// Ensure material opacity is correct
				if (button.visible) {
					button.traverse(obj => {
						if (obj.material) {
							// In hidden mode, make sure materials are fully visible
							if (sizeMode === 'hidden') {
								obj.material.depthTest = false;
								obj.renderOrder = 100;
								if (obj.material.transparent) {
									obj.material.opacity = 1.0;
								}
							} else {
								if (obj.material.transparent) {
									obj.material.opacity = 0.9;
								}
							}
						}
					});
				}
			});
			
			console.log(`Social buttons positioned: visible=${this.socialVisible || sizeMode === 'hidden'}`);
		}
		
		// Double check positions are valid
		console.log(`Button positions after update:
			- Expand: ${JSON.stringify(this.expandButton.position.toArray())} visible=${this.expandButton.visible}
			- Collapse: ${JSON.stringify(this.collapseButton.position.toArray())} visible=${this.collapseButton.visible}
			- Exit: ${JSON.stringify(this.exitButton.position.toArray())} visible=${this.exitButton.visible}
			- Socials visible: ${this.socialVisible || sizeMode === 'hidden'}
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
						if (obj.material.transparent) {
							obj.material.opacity = 1.0;
						}
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
		console.log(`Updating button colors for mode: ${sizeMode}`);
		
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
			this.expandPlanetMaterial.color.setHex(0x00aa00); // Active up arrow (bright green)
			this.collapsePlanetMaterial.color.setHex(0x555555); // Inactive down arrow (grey)
			
			// CRITICAL: Make sure the expand button is fully visible with bright color
			if (this.expandButton) {
				this.expandButton.visible = true;
				
				// Make all children visible and ensure material opacity
				this.expandButton.traverse(obj => {
					if (obj.material) {
						obj.material.depthTest = false;
						obj.renderOrder = 100;
						if (obj.material.transparent) {
							obj.material.opacity = 1.0;
						}
					}
				});
			}
		}
		
		// Double check button visibility
		if (this.expandButton && this.collapseButton) {
			console.log(`After color update: 
				- Expand visible: ${this.expandButton.visible}, color: ${this.expandPlanetMaterial.color.getHexString()}
				- Collapse visible: ${this.collapseButton.visible}, color: ${this.collapsePlanetMaterial.color.getHexString()}
			`);
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
							// In hidden mode, ensure materials are always fully visible
							if (isHiddenMode) {
								obj.material.depthTest = false;
								obj.renderOrder = 100;
								if (obj.material.transparent) {
									obj.material.opacity = 1.0;
								}
							} else {
								if (obj.material.transparent) {
									obj.material.opacity = 0.9;
								}
							}
						}
					});
				}
			}
		});
		
		console.log(`Social buttons visibility set to ${visible}, hidden mode: ${isHiddenMode}, actual visibility: ${isHiddenMode || visible}`);
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