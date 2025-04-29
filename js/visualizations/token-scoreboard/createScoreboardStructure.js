import * as THREE from 'three';

/**
 * Create the physical structure of the scoreboard
 * @param {THREE.Group} scoreboardGroup - The group to add the scoreboard elements to
 * @param {number} width - Width of the scoreboard
 * @param {number} height - Height of the scoreboard
 * @returns {THREE.Group} The scoreboard group with all elements added
 */
export function createScoreboardStructure(scoreboardGroup, width, height) {

	
	// Create display background (completely black with high transparency)
	const displayGeometry = new THREE.BoxGeometry(width, height * 1.1, 0.1);
	const displayMaterial = new THREE.MeshBasicMaterial({
		color: 0x000000,
		transparent: true,
		opacity: 0.3
	});
	
	const display = new THREE.Mesh(displayGeometry, displayMaterial);
	display.position.z = 0.1;
	display.renderOrder = 0;
	scoreboardGroup.add(display);
	
	// Save reference for dynamic resizing later
	if (!scoreboardGroup.userData) scoreboardGroup.userData = {};
	scoreboardGroup.userData.displayMesh = display;
	
	// Add a back panel to prevent seeing through the scoreboard – also store reference
	const backPanelGeometry = new THREE.PlaneGeometry(width + 0.5, height + 0.5);
	const backPanelMaterial = new THREE.MeshBasicMaterial({
		color: 0x000000,
		side: THREE.BackSide,
		transparent: true,
		opacity: 0.1
	});
	
	const backPanel = new THREE.Mesh(backPanelGeometry, backPanelMaterial);
	backPanel.position.z = 0.3;
	backPanel.renderOrder = 0;
	scoreboardGroup.add(backPanel);
	
	scoreboardGroup.userData.backPanelMesh = backPanel;
	
	// Return the modified scoreboardGroup
	return scoreboardGroup;
}

/**
 * Add decorative elements to make the scoreboard more interesting
 * @param {THREE.Group} scoreboardGroup - The group to add the decorative elements to
 * @param {number} width - Width of the scoreboard
 * @param {number} height - Height of the scoreboard
 * @returns {Array} The corner bolts for animation
 */
export function addDecorativeElements(scoreboardGroup, width, height) {
	// Add corner bolts - make them larger for better visibility
	const boltGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.5, 6); // Increased from 0.25, 0.25, 0.6
	
	// Gold for positive-X (right side after rotations) and Silver for negative-X – easier debugging
	const goldMaterial = new THREE.MeshStandardMaterial({
		color: 0xDAA520,
		metalness: 0.85,
		roughness: 0.25,
		emissive: 0xDAA520,
		emissiveIntensity: 0.2 // Add slight glow
	});
	const silverMaterial = new THREE.MeshStandardMaterial({
		color: 0xCCCCCC,
		metalness: 1,
		roughness: 0,
		emissive: 0xCCCCCC,
		emissiveIntensity: 0.2 // Add slight glow
	});
	
	// Use larger offsets for both gold and silver bolts
	// Z-axis is NEGATIVE for objects to appear IN FRONT of the scoreboard
	// IMPORTANT: X-AXIS IS FLIPPED - right is negative, left is positive in this coordinate system
	// Negative Z values bring objects CLOSER to the camera (in front)
	const cornerPositions = [
		[-width/2 - 0.45,  height/2 + 0.1, -1.0], // Top-left (neg X) - pushed even further out
		[ width/2 + 0.45,  height/2 + 0.1, -1.0], // Top-right (pos X) - pushed even further out
		[-width/2 - 0.45, -height/2 - 0.1, -1.0], // Bottom-left (neg X) - pushed even further out
		[ width/2 + 0.45, -height/2 - 0.1, -1.0], // Bottom-right (pos X) - pushed even further out
	];
	
	// Store bolts in an array for later animation
	const cornerBolts = [];
	
	// Material for decorative plates behind bolts
	const plateMaterial = new THREE.MeshStandardMaterial({
		color: 0x333333,
		metalness: 0.9,
		roughness: 0.35,
	});
	
	cornerPositions.forEach((pos, index) => {
		// Create decorative plate behind the bolt
		const plateGeometry = new THREE.CylinderGeometry(0.35, 0.35, 0.1, 10);
		const plate = new THREE.Mesh(plateGeometry, plateMaterial);
		plate.position.set(pos[0], pos[1], pos[2] + 0.1); // Position slightly behind bolt
		plate.rotation.x = Math.PI / 2;
		scoreboardGroup.add(plate);
		
		// Choose material based on X sign
		const boltMaterial = silverMaterial;
		const bolt = new THREE.Mesh(boltGeometry, boltMaterial);
		bolt.position.set(pos[0], pos[1], pos[2]);
		
		// Make bolts more visible by angling them a bit
		bolt.rotation.x = Math.PI / 2; // Base rotation for cylinder to face forward
		
		// Add a slight rotation around the z-axis for a more interesting look
		if (index % 2 === 0) { // Right-side bolts (indexes 0,2)
			bolt.rotation.z = Math.PI / 10; // Rotate slightly clockwise
		} else { // Left-side bolts (indexes 1,3)
			bolt.rotation.z = -Math.PI / 10; // Rotate slightly counter-clockwise
		}
		
		bolt.userData = { 
			isCornerBolt: true,
			originalPosition: new THREE.Vector3(pos[0], pos[1], pos[2]),
			isRightSide: (index % 2 === 0), // Flag to identify right/left bolts
			cornerIndex: index,
			plate: plate // Reference to the plate for animations
		};
		
		// Ensure bolt has higher renderOrder to appear in front
		bolt.renderOrder = 10;
		plate.renderOrder = 9;
		
		cornerBolts.push(bolt);
		scoreboardGroup.add(bolt);
	});
	
	// Add a note about axis orientation directly into the codebase
	console.log(`
	***AXIS ORIENTATION NOTE FOR DEVELOPERS***
	In the 3D scoreboard coordinate system:
	- NEGATIVE Z values bring objects FORWARD (toward the camera)
	- POSITIVE Z values push objects BACK (away from the camera)
	- For X/Y positioning, consider that the scoreboard will be rotated
	- After rotation, RIGHT side will have POSITIVE X values
	- After rotation, TOP side will have POSITIVE Y values
	`);
	
	// Return the corner bolts for animation
	return cornerBolts;
} 