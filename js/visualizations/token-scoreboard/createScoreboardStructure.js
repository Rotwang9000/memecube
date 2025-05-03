import * as THREE from 'three';

/**
 * Create the physical frame structure of the scoreboard
 * @param {THREE.Group} scoreboardGroup - Group to add elements to
 * @param {number} width - Width of the scoreboard
 * @param {number} height - Height of the scoreboard
 */
export function createScoreboardStructure(scoreboardGroup, width, height) {
	// Create black back panel
	const backPanelGeometry = new THREE.BoxGeometry(width, height, 0.05);
	const backPanelMaterial = new THREE.MeshPhongMaterial({
		color: 0x000000,
		transparent: true,
		opacity: 0.1,
		depthTest: true
	});
	const backPanel = new THREE.Mesh(backPanelGeometry, backPanelMaterial);
	backPanel.position.z = -1.5; // Furthest back
	backPanel.renderOrder = 1; // Lower render order (drawn first)
	scoreboardGroup.add(backPanel);
	
	// Store reference to the back panel mesh for later scaling
	scoreboardGroup.userData.backPanelMesh = backPanel;
	
	// Create semi-transparent LED display area
	const displayGeometry = new THREE.BoxGeometry(width * 0.98, height * 0.95, 0.02);
	const displayMaterial = new THREE.MeshPhongMaterial({
		color: 0x000000,
		transparent: true,
		opacity: 0.3,
		depthTest: true
	});
	const displayMesh = new THREE.Mesh(displayGeometry, displayMaterial);
	displayMesh.position.z = -0.5; // In front of back panel, behind LEDs
	displayMesh.renderOrder = 2; // Higher render order (drawn later)
	scoreboardGroup.add(displayMesh);
	
	// Store reference to the display mesh for later scaling
	scoreboardGroup.userData.displayMesh = displayMesh;
	
	// Add ambient lighting specifically for the scoreboard
	const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
	scoreboardGroup.add(ambientLight);
}

/**
 * Add decorative elements to the scoreboard
 * @param {THREE.Group} scoreboardGroup - Group to add elements to
 * @param {number} width - Width of the scoreboard
 * @param {number} height - Height of the scoreboard
 * @returns {Array} An array of corner bolts for later manipulation
 */
export function addDecorativeElements(scoreboardGroup, width, height) {
	// Create corner bolts with different colors
	const cornerBolts = [];
	const halfWidth = width / 2;
	const halfHeight = height / 2;
	
	// Create all four corner bolts with clear side identification
	const createBolt = (x, y, isRight) => {
		const boltGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.2, 16);
		// Use different colors for left/right bolts
		const boltColor = isRight ? 0xDAA520 : 0x00ff00; // Gold for right side, green for left
		const boltMaterial = new THREE.MeshStandardMaterial({
			color: boltColor,
			metalness: 0.8,
			roughness: 0.2,
			emissive: boltColor,
			emissiveIntensity: 0.4
		});
		const bolt = new THREE.Mesh(boltGeometry, boltMaterial);
		bolt.rotation.x = Math.PI / 2; // Rotate to face outward
		bolt.position.set(x, y, -1.0); // Position in front of display (more negative Z)
		bolt.renderOrder = 10; // High render order to be in front
		
		// Add user data to track which side this bolt belongs to
		bolt.userData.isRightSide = isRight;
		bolt.userData.originalPosition = new THREE.Vector3(x, y, -1.0);
		bolt.userData.isCornerBolt = true;
		
		// Add a decorative plate behind the bolt (use cylinder instead of box)
		const plateGeometry = new THREE.CylinderGeometry(0.55, 0.55, 0.05, 12);
		const plateMaterial = new THREE.MeshStandardMaterial({
			color: 0x333333,
			metalness: 0.5,
			roughness: 0.5,
			depthWrite: false, // Don't write to depth buffer
			depthTest: false   // Don't test against depth buffer
		});
		const plate = new THREE.Mesh(plateGeometry, plateMaterial);
		plate.rotation.x = Math.PI / 2; // Rotate to face outward like bolt
		plate.position.set(x, y, -0.9); // Slightly behind the bolt
		plate.renderOrder = 9; // Lower than bolt but higher than background
		
		// Store reference to the plate
		bolt.userData.plate = plate;
		
		// Add both to the group
		scoreboardGroup.add(bolt);
		scoreboardGroup.add(plate);
		
		return bolt;
	};
	
	// Top-left bolt (GREEN)
	cornerBolts.push(createBolt(-halfWidth - 0.45, halfHeight + 0.1, false));
	
	// Top-right bolt (GOLD)
	cornerBolts.push(createBolt(halfWidth + 0.45, halfHeight + 0.1, true));
	
	// Bottom-left bolt (GREEN)
	cornerBolts.push(createBolt(-halfWidth - 0.45, -halfHeight - 0.1, false));
	
	// Bottom-right bolt (GOLD)
	cornerBolts.push(createBolt(halfWidth + 0.45, -halfHeight - 0.1, true));
	
	console.log("Corner bolts created with clear sidedness:", 
		cornerBolts.map(bolt => `isRightSide: ${bolt.userData.isRightSide}`));
	
	return cornerBolts;
} 