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
		// Create expand button (down arrow - now correct)
		this.expandButton = new THREE.Group();
		this.expandButton.position.set(0, 5, -1.0); // Start position, will be updated
		this.expandButton.userData = { isButton: true, action: 'expand' };
		this.expandButton.visible = true;
		this.parentGroup.add(this.expandButton);
		
		// Create collapse/back button (up arrow - now correct)
		this.collapseButton = new THREE.Group();
		this.collapseButton.position.set(0, 5, -1.0); // Start position, will be updated
		this.collapseButton.userData = { isButton: true, action: 'collapse' };
		this.collapseButton.visible = true;
		this.parentGroup.add(this.collapseButton);
		
		// Create exit button (X icon - for exiting detail mode)
		this.exitButton = new THREE.Group();
		this.exitButton.position.set(0, 5, -1.0); // Start position, will be updated
		this.exitButton.userData = { isButton: true, action: 'exit' };
		this.exitButton.visible = false; // Hidden by default, shown only in detail mode
		this.parentGroup.add(this.exitButton);
		
		// Create planet-like button graphics
		const planetRadius = 0.8; // Increased from 0.6 for greater visibility
		const planetGeometry = new THREE.SphereGeometry(planetRadius, 32, 32);
		
		// Expand button as a green planet with down arrow
		this.expandPlanetMaterial = new THREE.MeshBasicMaterial({
			color: 0x00aa00,
			transparent: false, // CRITICAL: Must be opaque
			depthTest: true, // FIXED: Enable depth test to prevent ring visibility through planet
			depthWrite: true // FIXED: Enable depth write to ensure proper rendering
		});
		const expandPlanet = new THREE.Mesh(planetGeometry, this.expandPlanetMaterial);
		expandPlanet.position.z = 0; // FIXED: Position at 0 for proper alignment with ring
		expandPlanet.renderOrder = 500;  // FIXED: Reduced render order
		this.expandButton.add(expandPlanet);
		
		// Collapse button as a red planet with up arrow
		this.collapsePlanetMaterial = new THREE.MeshBasicMaterial({
			color: 0xaa0000,
			transparent: false, // CRITICAL: Must be opaque
			depthTest: true, // FIXED: Enable depth test to prevent ring visibility through planet
			depthWrite: true // FIXED: Enable depth write to ensure proper rendering
		});
		const collapsePlanet = new THREE.Mesh(planetGeometry, this.collapsePlanetMaterial);
		collapsePlanet.position.z = 0; // FIXED: Position at 0 for proper alignment with ring
		collapsePlanet.renderOrder = 500;  // FIXED: Reduced render order
		this.collapseButton.add(collapsePlanet);
		
		// Exit button as a white/grey planet with X
		this.exitPlanetMaterial = new THREE.MeshBasicMaterial({
			color: 0xdddddd,
			transparent: false, // CRITICAL: Must be opaque
			depthTest: true, // FIXED: Enable depth test to prevent ring visibility through planet
			depthWrite: true // FIXED: Enable depth write to ensure proper rendering
		});
		const exitPlanet = new THREE.Mesh(planetGeometry, this.exitPlanetMaterial);
		exitPlanet.position.z = 0; // FIXED: Position at 0 for proper alignment with ring
		exitPlanet.renderOrder = 500;  // FIXED: Reduced render order
		this.exitButton.add(exitPlanet);
		
		// Add glowing ring around planets
		const ringGeometry = new THREE.RingGeometry(planetRadius * 1.1, planetRadius * 1.3, 32);
		const ringMaterial = new THREE.MeshBasicMaterial({
			color: 0xaaaaaa,
			transparent: true,
			opacity: 0.8, // INCREASED opacity for better visibility
			side: THREE.FrontSide, // FIXED: Only show front side
			depthTest: true, // FIXED: Enable depth test for proper rendering
			depthWrite: false // CRITICAL: Must not write to depth buffer
		});
		
		const expandRing = new THREE.Mesh(ringGeometry, ringMaterial.clone());
		expandRing.rotation.x = Math.PI / 2;
		expandRing.position.z = 0.1; // FIXED: Position slightly in front of planet
		expandRing.renderOrder = 501; // Draw after planet so depth hides back ring
		// expandRing.material.side = THREE.FrontSide; // Hide backside of ring (Already set above)
		this.expandButton.add(expandRing);
		
		const collapseRing = new THREE.Mesh(ringGeometry, ringMaterial.clone());
		collapseRing.rotation.x = Math.PI / 2;
		collapseRing.position.z = 0.1; // FIXED: Position slightly in front of planet
		collapseRing.renderOrder = 501;
		// collapseRing.material.side = THREE.FrontSide; // Already set above
		this.collapseButton.add(collapseRing);
		
		const exitRing = new THREE.Mesh(ringGeometry, ringMaterial.clone());
		exitRing.rotation.x = Math.PI / 2;
		exitRing.position.z = 0.1; // FIXED: Position slightly in front of planet
		exitRing.renderOrder = 501;
		// exitRing.material.side = THREE.FrontSide; // Already set above
		this.exitButton.add(exitRing);
		
		// Create arrow indicators on planets (swapped directions)
		this.createArrowIndicator(this.expandButton, 'down', 0x000000);
		this.createArrowIndicator(this.collapseButton, 'up', 0x000000);
		this.createXIndicator(this.exitButton, 0x000000);
		
		// Ensure all buttons have indicators in front
		// this.ensureButtonIndicatorsAreFrontal(this.expandButton); // Now handled by individual indicator creation
		// this.ensureButtonIndicatorsAreFrontal(this.collapseButton); // Now handled by individual indicator creation
		// this.ensureButtonIndicatorsAreFrontal(this.exitButton); // Now handled by individual indicator creation
		
		// Force exit button to be clearly visible with high render order
		this.exitButton.traverse(obj => {
			if (obj.material) {
				obj.material.depthTest = false; // Keep false for exit button to ensure clickability?
				obj.renderOrder = 600; // Keep high for exit button
			}
		});
		
		// Initial positioning handled by updateButtonPositions
		// this.exitButton.position.set(0, 5, -1.0); 
		
		// Log the button hierarchy to debug icon visibility
		// console.log("Expand button children:", this.expandButton.children.length);
		// console.log("Collapse button children:", this.collapseButton.children.length);
		// console.log("Exit button children:", this.exitButton.children.length);
	}
	
	/**
	 * Update button positions based on scoreboard dimensions and mode
	 * 
	 * @param {number} width - Scoreboard width
	 * @param {number} height - Scoreboard height
	 * @param {string} sizeMode - Current size mode ('normal', 'tall', 'hidden')
	 * @param {boolean} detailMode - Whether the scoreboard is in token detail mode
	 */
	updateButtonPositions(width, height, sizeMode, detailMode = false) {
		console.log(`Updating button positions: mode=${sizeMode}, width=${width}, height=${height}, detailMode=${detailMode}`);
		
		// Ensure buttons are always positioned outside the scoreboard area
		const topOffset = 1.0; // FIXED: Reduced distance above the scoreboard
		const buttonSpacing = 3.0; // Increased space between buttons for better visibility
		const socialButtonSpacing = 2.0; // Increased for more spacing
		
		// Set Z to be always in front
		const buttonZ = -3.0; // CRITICAL: Much further negative Z to bring buttons forward
		
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
			
			// CRITICAL: Force expand/collapse buttons to be visible in hidden mode
			this.expandButton.visible = true;
			this.collapseButton.visible = true;
			
			// CRITICAL: Make buttons more visible in hidden mode by adjusting materials
			[this.expandButton, this.collapseButton].forEach(button => {
				if (!button) return;
				button.traverse(obj => {
					if (obj.material) {
						obj.material.depthTest = false;
						obj.renderOrder = 5000; // CRITICAL: Much higher render order
						// Ensure opacity is set to fully visible
						if (obj.material.transparent) {
							obj.material.opacity = 1.0;
						}
					}
				});
			});
			
			// CRITICAL: Ensure the arrows are properly positioned in front of planets
			// this.ensureButtonIndicatorsAreFrontal(this.expandButton);
			// this.ensureButtonIndicatorsAreFrontal(this.collapseButton);
			
			console.log("Hidden mode: Buttons positioned at bottom, next to each other");
		} else {
			// Position expand/collapse at top left and right for clarity
			const topY = height/2 + topOffset;
			
			// Put expand button at top left, clearly visible
			this.expandButton.position.set(-width/2 - 1, topY, buttonZ); // FIXED: Closer to board
			
			// Put collapse button at top right, clearly visible
			this.collapseButton.position.set(width/2 + 1, topY, buttonZ); // FIXED: Closer to board
			
			// Ensure buttons are visible and depth settings are correct
			[this.expandButton, this.collapseButton].forEach(button => {
				if (!button) return;
				
				button.visible = true;
				console.log(`Setting ${button.userData?.action} button to visible`);
				
				// Make sure all materials are set for visibility
				button.traverse(obj => {
					if (obj.material) {
						obj.material.depthTest = false;
						obj.renderOrder = 5000; // CRITICAL: Much higher render order
					}
				});
			});
			
			// Ensure arrows are visible
			// this.ensureButtonIndicatorsAreFrontal(this.expandButton);
			// this.ensureButtonIndicatorsAreFrontal(this.collapseButton);
			
			console.log(`Normal/tall mode: Buttons positioned at top left/right at y=${topY}`);
		}
		
		// Always position exit button at top right corner with clear visibility
		this.exitButton.position.set(width/2 + 1, height/2 + topOffset, buttonZ); // FIXED: Closer to board
		
		// CRITICAL FIX: Set exit button visibility based on detail mode
		this.exitButton.visible = detailMode;
		
		// Force exit button to be clearly visible with proper render settings when visible
		if (this.exitButton.visible) {
			this.exitButton.traverse(obj => {
				if (obj.material) {
					obj.material.depthTest = false;
					obj.renderOrder = 5000; // CRITICAL: Much higher render order
				}
			});
			console.log(`Exit button positioned at top right and set to visible`);
		}
		
		// Double check positions are valid
		console.log(`Button positions after update:
			- Expand: ${JSON.stringify(this.expandButton.position.toArray())} visible=${this.expandButton.visible}
			- Collapse: ${JSON.stringify(this.collapseButton.position.toArray())} visible=${this.collapseButton.visible}
			- Exit: ${JSON.stringify(this.exitButton.position.toArray())} visible=${this.exitButton.visible}
		`);
		
		// If we have a buttons group, make sure it's positioned appropriately 
		// and always visible regardless of mode
		if (this.buttonsGroup) {
			this.buttonsGroup.visible = true;
			
			// Make sure depthTest is disabled for all button materials
			this.buttonsGroup.traverse(obj => {
				if (obj.material) {
					obj.material.depthTest = false;
					obj.renderOrder = 5000; // CRITICAL: Much higher render order
					if (obj.material.transparent) {
						obj.material.opacity = 1.0;
					}
				}
			});
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
		const interactionObjects = [];
		if (this.expandButton && this.expandButton.visible) {
			interactionObjects.push(this.expandButton);
		}
		if (this.collapseButton && this.collapseButton.visible) {
			interactionObjects.push(this.collapseButton);
		}
		if (this.exitButton && this.exitButton.visible) {
			interactionObjects.push(this.exitButton);
		}
		
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
		// Dispose of button materials
		if (this.expandPlanetMaterial) this.expandPlanetMaterial.dispose();
		if (this.collapsePlanetMaterial) this.collapsePlanetMaterial.dispose();
		if (this.exitPlanetMaterial) this.exitPlanetMaterial.dispose();
		
		// Remove buttons from parent and dispose of their geometries/materials
		const buttons = [
			this.expandButton, 
			this.collapseButton, 
			this.exitButton
		];
		
		buttons.forEach(button => {
			if (button) {
				button.traverse(obj => {
					if (obj.geometry) obj.geometry.dispose();
					if (obj.material) obj.material.dispose();
				});
			}
		});
		
		this.parentGroup.remove(this.buttonsGroup);
		this.buttonsGroup = null;
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
							  obj === this.exitButton;
							  
		if (isDirectButton) return true;
		
		// Check if object has button userData
		if (obj.userData?.isButton) return true;
		
		// Check if parent is a button
		if (obj.parent) {
			if (obj.parent.userData?.isButton) return true;
			
			// Check if parent is one of our button groups
			if (obj.parent === this.expandButton || 
				obj.parent === this.collapseButton || 
				obj.parent === this.exitButton) {
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
		// Create a group to hold all buttons
		this.buttonsGroup = new THREE.Group();
		this.buttonsGroup.name = "ScoreboardButtons"; // Name for debugging
		
		// Add existing buttons to the group (and remove from parentGroup)
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
		
		// Add the button group to the parent
		this.parentGroup.add(this.buttonsGroup);
		
		console.log("Created buttons group and added all standard buttons to it.");
	}

	createArrowIndicator(buttonGroup, direction, color) {
		// Create a simple arrow shape (just the arrowhead, no stalk)
		const arrowGroup = new THREE.Group();
		arrowGroup.renderOrder = 6000; 
		
		// Common parameters for improved visibility
		const arrowWidth = 0.6;  
		const arrowHeight = 0.6; 
		
		const arrowMaterial = new THREE.MeshBasicMaterial({ 
			color: color,
			side: THREE.DoubleSide,
			depthTest: false,
			depthWrite: false,
			transparent: false, 
			opacity: 1.0
		});
		
		// Position for arrow components - zPos for meshes within arrowGroup
		const meshZPos = 0; // Meshes are at the origin of arrowGroup
		const renderOrder = 6000; 
		
		if (direction === 'up') {
			const triangleShape = new THREE.Shape();
			triangleShape.moveTo(-arrowWidth/2, -arrowHeight/2);
			triangleShape.lineTo(0, arrowHeight/2);
			triangleShape.lineTo(arrowWidth/2, -arrowHeight/2);
			triangleShape.lineTo(-arrowWidth/2, -arrowHeight/2);
			
			const triangleGeometry = new THREE.ShapeGeometry(triangleShape);
			const triangleMesh = new THREE.Mesh(triangleGeometry, arrowMaterial);
			triangleMesh.position.z = meshZPos;
			triangleMesh.renderOrder = renderOrder;
			arrowGroup.add(triangleMesh);
		} else if (direction === 'down') {
			const triangleShape = new THREE.Shape();
			triangleShape.moveTo(-arrowWidth/2, arrowHeight/2);
			triangleShape.lineTo(0, -arrowHeight/2);
			triangleShape.lineTo(arrowWidth/2, arrowHeight/2);
			triangleShape.lineTo(-arrowWidth/2, arrowHeight/2);
			
			const triangleGeometry = new THREE.ShapeGeometry(triangleShape);
			const triangleMesh = new THREE.Mesh(triangleGeometry, arrowMaterial);
			triangleMesh.position.z = meshZPos;
			triangleMesh.renderOrder = renderOrder;
			arrowGroup.add(triangleMesh);
		}
		
		// Position the entire arrow group to be slightly in front of the planet (which is at z=0 in buttonGroup)
		arrowGroup.position.z = 0.2; // Closer to the planet face
		
		arrowGroup.traverse(obj => {
			if (obj.material) {
				obj.material.depthTest = false;
				obj.material.depthWrite = false;
				obj.material.transparent = false; 
				obj.material.opacity = 1.0;
				obj.renderOrder = renderOrder; // All parts of arrow share same high render order
			}
		});
		
		buttonGroup.add(arrowGroup);
	}

	createXIndicator(buttonGroup, color) {
		const xGroup = new THREE.Group();
		xGroup.renderOrder = 6000; 
		
		const xSize = 0.8;    
		const lineWidth = 0.2; 
		
		// Position for X components - zPos for meshes within xGroup
		const meshZPos = 0; // Meshes are at the origin of xGroup
		const renderOrder = 6000; 
		
		const xMaterial = new THREE.MeshBasicMaterial({ 
			color: 0x000000, 
			side: THREE.DoubleSide,
			depthTest: false,
			depthWrite: false,
			transparent: false, 
			opacity: 1.0
		});
		
		const line1Geometry = new THREE.PlaneGeometry(lineWidth, xSize);
		const line1 = new THREE.Mesh(line1Geometry, xMaterial);
		line1.position.z = meshZPos;
		line1.rotation.z = Math.PI / 4; 
		line1.renderOrder = renderOrder;
		xGroup.add(line1);
		
		const line2Geometry = new THREE.PlaneGeometry(lineWidth, xSize);
		const line2 = new THREE.Mesh(line2Geometry, xMaterial);
		line2.position.z = meshZPos;
		line2.rotation.z = -Math.PI / 4; 
		line2.renderOrder = renderOrder;
		xGroup.add(line2);
		
		// Position the entire X group to be slightly in front of the planet
		xGroup.position.z = 0.2; // Closer to the planet face
		
		xGroup.traverse(obj => {
			if (obj.material) {
				obj.material.depthTest = false;
				obj.material.depthWrite = false;
				obj.material.transparent = false;
				obj.material.opacity = 1.0;
				obj.renderOrder = renderOrder; // All parts of X share same high render order
			}
		});
		
		buttonGroup.add(xGroup);
	}
} 