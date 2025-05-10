/**
 * Common physical effects functionality for visualizations
 * Includes bolt positioning and jet effects that work across different visualizations
 */
import * as THREE from 'three';

/**
 * Fix bolt positions at corners of a display
 * Call this whenever bolts get misplaced during transitions
 * 
 * @param {Object} params - Parameters object
 * @param {Array} params.cornerBolts - Array of bolt meshes
 * @param {number} params.width - Width of the display
 * @param {number} params.height - Height of the display
 * @param {Object} params.jetsManager - Optional jets manager to sync with bolts
 * @param {string} params.sizeMode - Current size mode, used to determine if jets should trigger
 * @returns {boolean} - Whether significant position changes were made
 */
export function fixBoltPositions({ cornerBolts, width, height, jetsManager, sizeMode }) {
	if (!cornerBolts || cornerBolts.length < 4) return false;
	
	const halfWidth = width / 2;
	const halfHeight = height / 2;
	
	// Find bolts by their side property
	const rightBolts = cornerBolts.filter(bolt => bolt.userData.isRightSide);
	const leftBolts = cornerBolts.filter(bolt => !bolt.userData.isRightSide);
	
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
		bolt.position.set(halfWidth + 0.45, yPos, -0.2);
		bolt.visible = true;
		
		// Check if position changed significantly
		if (Math.abs(originalX - bolt.position.x) > 0.001 || 
			Math.abs(originalY - bolt.position.y) > 0.001) {
			significantChange = true;
		}
		
		// Update plate position if it exists
		if (bolt.userData.plate) {
			bolt.userData.plate.position.set(halfWidth + 0.45, yPos, -0.1);
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
		bolt.position.set(-halfWidth - 0.45, yPos, -0.2);
		bolt.visible = true;
		
		// Check if position changed significantly
		if (Math.abs(originalX - bolt.position.x) > 0.001 || 
			Math.abs(originalY - bolt.position.y) > 0.001) {
			significantChange = true;
		}
		
		// Update plate position if it exists
		if (bolt.userData.plate) {
			bolt.userData.plate.position.set(-halfWidth - 0.45, yPos, -0.1);
			bolt.userData.plate.visible = true;
		}
		
		// Ensure color is set correctly
		if (bolt.material) {
			bolt.material.color.set(0x00ff00); // Green for left
			bolt.material.emissive.set(0x00ff00);
		}
	});
	
	// Always force sync jets after bolt positions are fixed
	if (jetsManager) {
		// Use forced sync when positions were changed significantly
		jetsManager.syncJetsWithBolts(significantChange);
		
		// If positions changed significantly and we're not in hidden mode, trigger jet effect
		if (significantChange && sizeMode !== 'hidden') {
			triggerJetEffect({ jetsManager, cornerBolts, intensity: 0.8 }); // Increased from 0.7 for more visibility
			
			// Additional sync after a short delay to ensure particles follow the bolts
			setTimeout(() => {
				if (jetsManager) {
					jetsManager.syncJetsWithBolts(true);
				}
			}, 50);
		}
	}
	
	return significantChange;
}

/**
 * Trigger a jet effect for visual feedback
 * Creates particle bursts from the corner bolts
 * 
 * @param {Object} params - Parameters object
 * @param {Object} params.jetsManager - Jets manager instance
 * @param {Array} params.cornerBolts - Array of bolt meshes
 * @param {number} params.intensity - Effect intensity (0.0-1.0+)
 * @param {boolean} params.isBurstEffect - Whether to create a star-like burst pattern
 */
export function triggerJetEffect({ jetsManager, cornerBolts, intensity = 1.0, isBurstEffect = false }) {
	if (!jetsManager || !cornerBolts || cornerBolts.length < 4) return;
	
	console.log(`Triggering jet effect with intensity ${intensity}${isBurstEffect ? ' (burst effect)' : ''}`);
	
	// First force sync jets with bolts to ensure proper positioning
	jetsManager.syncJetsWithBolts(true);
	
	// Create random movement vectors for each corner
	cornerBolts.forEach((bolt, index) => {
		// Skip if bolt isn't visible
		if (!bolt.visible) {
			console.log("Bolt is not visible, skipping jet effect");
			return;
		}
		
		// Find the matching jet for this bolt
		const jet = jetsManager.jets[index];
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
					jetsManager.emitJetParticle(jet, burstDir, intensity * 2.0);
				}
			}
			
			// Add additional particles in random directions
			for (let i = 0; i < 30 * intensity; i++) {
				const randomDir = new THREE.Vector3(
					(Math.random() - 0.5) * 2,
					(Math.random() - 0.5) * 2,
					-0.8 * intensity
				).normalize();
				
				jetsManager.emitJetParticle(jet, randomDir, intensity * 1.5);
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
				jetsManager.emitJetParticle(jet, moveDir, intensity * 2.0); // Double intensity
			}
		}
	});
	
	// Update last movement time to prevent immediate fade
	if (jetsManager) {
		jetsManager.lastMovementTime = performance.now();
	}
	
	// Schedule multiple echo effects for better visibility and longer duration
	if (intensity > 0.3) {
		// Create 3 echo effects with decreasing intensity and ensure sync on each echo
		for (let i = 1; i <= 3; i++) {
			setTimeout(() => {
				// Re-sync jets and bolts before each echo effect
				jetsManager.syncJetsWithBolts(true);
				
				// Create the echo effect
				cornerBolts.forEach((bolt, index) => {
					if (!bolt.visible) return;
					
					const jet = jetsManager.jets[index];
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
						jetsManager.emitJetParticle(jet, echoDir, intensity * (1 - i * 0.2));
					}
				});
				
				// Update last movement time to prevent fade
				jetsManager.lastMovementTime = performance.now();
			}, i * 150); // Spread out over time
		}
	}
} 