import * as THREE from 'three';
import { easeInOutQuad } from '../common/utils.js'; // Use common utils

/**
 * Create the physical frame structure of the scoreboard
 * @param {THREE.Group} scoreboardGroup - Group to add elements to
 * @param {number} width - Width of the scoreboard
 * @param {number} height - Height of the scoreboard
 */
export function createScoreboardStructure(scoreboardGroup, width, height) {
	// Create semi-transparent LED display area/background
	const displayGeometry = new THREE.BoxGeometry(width, height, 0.02);
	const displayMaterial = new THREE.MeshPhongMaterial({
		color: 0x000000,
		transparent: true,
		opacity: 0.4,
		depthTest: true  // Ensure it's always visible behind LEDs
	});
	const displayMesh = new THREE.Mesh(displayGeometry, displayMaterial);
	displayMesh.position.z = 1.5; // Higher positive Z puts it behind the LEDs
	displayMesh.renderOrder = 1; // Lower render order (drawn first)
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
		bolt.position.set(x, y, -0.2); // Position in front of the LEDs (at z=0)
		bolt.renderOrder = 10; // High render order to be in front
		
		// Add user data to track which side this bolt belongs to
		bolt.userData.isRightSide = isRight;
		bolt.userData.originalPosition = new THREE.Vector3(x, y, -0.2);
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
		plate.position.set(x, y, -0.1); // Slightly behind the bolt but in front of the LEDs
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

/**
 * Animate corner bolts for tall mode transitions
 * 
 * @param {Array} cornerBolts - Array of bolt meshes
 * @param {boolean} isTallMode - Whether transitioning to tall mode
 * @param {number} startHeight - Starting height
 * @param {number} targetHeight - Target height to animate to
 * @param {Function} onUpdate - Callback for each animation frame
 * @param {Function} onComplete - Callback when animation completes
 * @param {Object} options - Optional: { burstFromOrigin: bool, burstOrigin: THREE.Vector3 }
 */
export function animateCornerBolts(cornerBolts, isTallMode, startHeight, targetHeight, onUpdate, onComplete, options = {}) {
	// Skip if no corner bolts exist
	if (!cornerBolts || cornerBolts.length < 4) {
		if (onComplete) onComplete();
		return;
	}
	
	const burstFromOrigin = !!options.burstFromOrigin;
	const burstOrigin = options.burstOrigin || new THREE.Vector3(0, 0, -1.0);
	
	// Find jets if they exist
	let jetsManager = null;
	if (cornerBolts[0].parent) {
		// Try to find jets manager on the scoreboard
		const scoreboardGroup = cornerBolts[0].parent;
		if (scoreboardGroup.userData && scoreboardGroup.userData.jetsManager) {
			jetsManager = scoreboardGroup.userData.jetsManager;
		}
	}
	
	// Store bolt references by position for clarity
	// Ensure we're using isRightSide to determine which is which
	const rightBolts = cornerBolts.filter(bolt => bolt.userData.isRightSide);
	const leftBolts = cornerBolts.filter(bolt => !bolt.userData.isRightSide);
	
	// Find top and bottom bolts for each side based on position
	const topRightBolt = rightBolts.find(bolt => bolt.position.y > 0) || rightBolts[0];
	const bottomRightBolt = rightBolts.find(bolt => bolt.position.y <= 0) || rightBolts[1];
	const topLeftBolt = leftBolts.find(bolt => bolt.position.y > 0) || leftBolts[0];
	const bottomLeftBolt = leftBolts.find(bolt => bolt.position.y <= 0) || leftBolts[1];
	
	// Animation parameters
	const duration = 800;
	const startTime = performance.now();
	
	// Store starting values
	let startPosTopLeft, startPosTopRight, startPosBottomLeft, startPosBottomRight;
	let halfWidth = 7.5; // Default half width for the scoreboard

	if (burstFromOrigin) {
		startPosTopLeft = burstOrigin.clone();
		startPosTopRight = burstOrigin.clone();
		startPosBottomLeft = burstOrigin.clone();
		startPosBottomRight = burstOrigin.clone();
		
		// Set all bolts to burstOrigin immediately
		topLeftBolt.position.copy(burstOrigin);
		topRightBolt.position.copy(burstOrigin);
		bottomLeftBolt.position.copy(burstOrigin);
		bottomRightBolt.position.copy(burstOrigin);
		
		// IMPROVED: If jetsManager exists, sync jets to burstOrigin and prepare for burst effect
		if (jetsManager && jetsManager.jets) {
			jetsManager.jets.forEach((jet, index) => {
				// Set base position to burst origin
				jet.basePosition.copy(burstOrigin);
				
				// Reset particle system position
				if (jet.system) jet.system.position.set(0, 0, 0);
				
				// Prepare particles for burst effect
				if (index < cornerBolts.length && cornerBolts[index].visible) {
					// Create burst direction
					const burstDir = new THREE.Vector3(
						(Math.random() - 0.5) * 0.4,
						(Math.random() - 0.5) * 0.4,
						-1.0
					).normalize();
					
					// Emit burst particles (fewer than normal to prevent overwhelming effect)
					for (let i = 0; i < 15; i++) {
						jetsManager.emitJetParticle(jet, burstDir, 1.5);
					}
				}
			});
			
			// Force sync to ensure correct positioning
			jetsManager.syncJetsWithBolts(true);
		}
	} else {
		startPosTopLeft = topLeftBolt.position.clone();
		startPosTopRight = topRightBolt.position.clone();
		startPosBottomLeft = bottomLeftBolt.position.clone();
		startPosBottomRight = bottomRightBolt.position.clone();
		
		// Calculate half width from existing bolt positions
		if (startPosTopRight.x > 0 && startPosTopLeft.x < 0) {
			halfWidth = (startPosTopRight.x - startPosTopLeft.x) / 2;
		} else {
			// Fallback to default if bolt positions don't make sense
			console.warn("Using default halfWidth as bolt positions are invalid");
			halfWidth = 7.5;
		}
		
		// Validate starting positions - ensure left bolts are on left and right bolts are on right
		if (startPosTopRight.x < 0 || startPosBottomRight.x < 0) {
			console.warn("Correcting right bolt positions - they were on the wrong side");
			startPosTopRight.x = Math.abs(halfWidth) + 0.45;
			startPosBottomRight.x = Math.abs(halfWidth) + 0.45;
		}
		if (startPosTopLeft.x > 0 || startPosBottomLeft.x > 0) {
			console.warn("Correcting left bolt positions - they were on the wrong side");
			startPosTopLeft.x = -Math.abs(halfWidth) - 0.45;
			startPosBottomLeft.x = -Math.abs(halfWidth) - 0.45;
		}
	}
	
	// Store starting plate positions if they exist
	const startPosTopLeftPlate = topLeftBolt.userData.plate ? topLeftBolt.userData.plate.position.clone() : null;
	const startPosTopRightPlate = topRightBolt.userData.plate ? topRightBolt.userData.plate.position.clone() : null;
	const startPosBottomLeftPlate = bottomLeftBolt.userData.plate ? bottomLeftBolt.userData.plate.position.clone() : null;
	const startPosBottomRightPlate = bottomRightBolt.userData.plate ? bottomRightBolt.userData.plate.position.clone() : null;
	
	// CRITICAL: Store the bolt-to-jet mapping for better synchronization
	const boltToJetMap = new Map();
	if (jetsManager && jetsManager.jets) {
		// Find matching jets for each bolt using both position and index
		cornerBolts.forEach((bolt, boltIndex) => {
			// Try to find by position first
			let matchedJet = jetsManager.jets.find(jet => 
				bolt.position.distanceTo(jet.basePosition) < 0.5);
			
			// If no match by position, use index if in range
			if (!matchedJet && boltIndex < jetsManager.jets.length) {
				matchedJet = jetsManager.jets[boltIndex];
			}
			
			if (matchedJet) {
				boltToJetMap.set(bolt, matchedJet);
				console.log(`Mapped bolt ${boltIndex} to jet`);
			}
		});
	}
	
	// Calculate target positions for all bolts
	let targetTopLeftPos, targetTopRightPos, targetBottomLeftPos, targetBottomRightPos;
	
	if (isTallMode) {
		// Top bolts - Use targetTallPosition if available
		if (topLeftBolt.userData.targetTallPosition) {
			targetTopLeftPos = topLeftBolt.userData.targetTallPosition.clone();
		} else {
			console.warn("No targetTallPosition for topLeftBolt, using a default");
			targetTopLeftPos = startPosTopLeft.clone();
			targetTopLeftPos.y += 2; // Move up by default
		}
		
		if (topRightBolt.userData.targetTallPosition) {
			targetTopRightPos = topRightBolt.userData.targetTallPosition.clone();
		} else {
			console.warn("No targetTallPosition for topRightBolt, using a default");
			targetTopRightPos = startPosTopRight.clone();
			targetTopRightPos.y += 2; // Move up by default
		}
		
		// Bottom bolts - Calculate new positions based on target height
		// Ensure they maintain their correct left/right sides
		const halfHeight = targetHeight / 2;
		
		// Ensure bottom bolts stay on correct sides
		targetBottomLeftPos = new THREE.Vector3(
			startPosBottomLeft.x < 0 ? startPosBottomLeft.x : -Math.abs(halfWidth) - 0.45, 
			-halfHeight - 0.1,
			startPosBottomLeft.z
		);
		
		targetBottomRightPos = new THREE.Vector3(
			startPosBottomRight.x > 0 ? startPosBottomRight.x : Math.abs(halfWidth) + 0.45,
			-halfHeight - 0.1,
			startPosBottomRight.z
		);
		
		// Validate target positions - ensure X coordinates maintain left/right sides
		if (targetTopLeftPos.x > 0) targetTopLeftPos.x = -Math.abs(targetTopLeftPos.x);
		if (targetBottomLeftPos.x > 0) targetBottomLeftPos.x = -Math.abs(targetBottomLeftPos.x);
		if (targetTopRightPos.x < 0) targetTopRightPos.x = Math.abs(targetTopRightPos.x);
		if (targetBottomRightPos.x < 0) targetBottomRightPos.x = Math.abs(targetBottomRightPos.x);
	} else {
		// Going back to normal mode - use originalPosition property or calculate
		const halfHeight = targetHeight / 2;
		
		// Left side bolts (both top and bottom)
		if (topLeftBolt.userData.originalPosition) {
			targetTopLeftPos = topLeftBolt.userData.originalPosition.clone();
			// Ensure it stays on the left side
			if (targetTopLeftPos.x > 0) targetTopLeftPos.x = -Math.abs(halfWidth) - 0.45;
		} else {
			console.warn("No originalPosition for topLeftBolt, calculating default left position");
			targetTopLeftPos = new THREE.Vector3(-Math.abs(halfWidth) - 0.45, halfHeight + 0.1, startPosTopLeft.z);
		}
		
		// Calculate bottom left position to match current height
		targetBottomLeftPos = new THREE.Vector3(
			startPosBottomLeft.x < 0 ? startPosBottomLeft.x : -Math.abs(halfWidth) - 0.45,
			-halfHeight - 0.1,
			startPosBottomLeft.z
		);
		
		// Right side bolts (both top and bottom)
		if (topRightBolt.userData.originalPosition) {
			targetTopRightPos = topRightBolt.userData.originalPosition.clone();
			// Ensure it stays on the right side
			if (targetTopRightPos.x < 0) targetTopRightPos.x = Math.abs(halfWidth) + 0.45;
		} else {
			console.warn("No originalPosition for topRightBolt, calculating default right position");
			targetTopRightPos = new THREE.Vector3(Math.abs(halfWidth) + 0.45, halfHeight + 0.1, startPosTopRight.z);
		}
		
		// Calculate bottom right position to match current height
		targetBottomRightPos = new THREE.Vector3(
			startPosBottomRight.x > 0 ? startPosBottomRight.x : Math.abs(halfWidth) + 0.45,
			-halfHeight - 0.1,
			startPosBottomRight.z
		);
	}
	
	// Log animation details for debugging
	console.log("Starting bolt animation:", 
		`isTallMode=${isTallMode}, startHeight=${startHeight}, targetHeight=${targetHeight}`);
	console.log("Target positions:", 
		`topLeft=(${targetTopLeftPos.x.toFixed(2)}, ${targetTopLeftPos.y.toFixed(2)})`,
		`topRight=(${targetTopRightPos.x.toFixed(2)}, ${targetTopRightPos.y.toFixed(2)})`,
		`bottomLeft=(${targetBottomLeftPos.x.toFixed(2)}, ${targetBottomLeftPos.y.toFixed(2)})`, 
		`bottomRight=(${targetBottomRightPos.x.toFixed(2)}, ${targetBottomRightPos.y.toFixed(2)})`);
	
	// Frame rate control
	let lastFrameTime = 0;
	const frameInterval = 1000 / 60; // Target 60fps
	
	// Track elapsed time for jet effects
	let lastJetTime = 0;
	
	// Animation function
	const animate = (timestamp) => {
		// Frame rate control for smoother animations
		if (timestamp - lastFrameTime < frameInterval) {
			requestAnimationFrame(animate);
			return;
		}
		lastFrameTime = timestamp;
		
		const elapsed = timestamp - startTime;
		const progress = Math.min(elapsed / duration, 1);
		const easedProgress = easeInOutQuad(progress);
		
		// Update height with proper easing
		const newHeight = startHeight + (targetHeight - startHeight) * easedProgress;
		
		// Call update callback with current height
		if (onUpdate) {
			onUpdate(newHeight, easedProgress);
		}
		
		// Animate all bolts while preserving their side (left/right)
		topLeftBolt.position.lerpVectors(startPosTopLeft, targetTopLeftPos, easedProgress);
		topRightBolt.position.lerpVectors(startPosTopRight, targetTopRightPos, easedProgress);
		bottomLeftBolt.position.lerpVectors(startPosBottomLeft, targetBottomLeftPos, easedProgress);
		bottomRightBolt.position.lerpVectors(startPosBottomRight, targetBottomRightPos, easedProgress);
		
		// Animate all decorative plates if they exist
		if (topLeftBolt.userData.plate && startPosTopLeftPlate) {
			const plateOffset = new THREE.Vector3(0, 0, 0.1);
			const targetPlatePos = targetTopLeftPos.clone().add(plateOffset);
			topLeftBolt.userData.plate.position.lerpVectors(startPosTopLeftPlate, targetPlatePos, easedProgress);
		}
		
		if (topRightBolt.userData.plate && startPosTopRightPlate) {
			const plateOffset = new THREE.Vector3(0, 0, 0.1);
			const targetPlatePos = targetTopRightPos.clone().add(plateOffset);
			topRightBolt.userData.plate.position.lerpVectors(startPosTopRightPlate, targetPlatePos, easedProgress);
		}
		
		if (bottomLeftBolt.userData.plate && startPosBottomLeftPlate) {
			const plateOffset = new THREE.Vector3(0, 0, 0.1);
			const targetPlatePos = targetBottomLeftPos.clone().add(plateOffset);
			bottomLeftBolt.userData.plate.position.lerpVectors(startPosBottomLeftPlate, targetPlatePos, easedProgress);
		}
		
		if (bottomRightBolt.userData.plate && startPosBottomRightPlate) {
			const plateOffset = new THREE.Vector3(0, 0, 0.1);
			const targetPlatePos = targetBottomRightPos.clone().add(plateOffset);
			bottomRightBolt.userData.plate.position.lerpVectors(startPosBottomRightPlate, targetPlatePos, easedProgress);
		}
		
		// IMPROVED: Directly update jet base positions to match bolts during animation
		if (jetsManager) {
			// Use our bolt-to-jet mapping
			if (boltToJetMap.size > 0) {
				// Update directly mapped jets with precise positioning
				boltToJetMap.forEach((jet, bolt) => {
					if (jet && bolt.visible) {
						// Ensure jet base position matches the bolt exactly
						jet.basePosition.copy(bolt.position);
						
						// Force particle system alignment
						if (jet.system) {
							jet.system.position.set(0, 0, 0);
							jet.system.visible = true;
							jet.system.renderOrder = 1000;
						}
					}
				});
				
				// Mark jets as updated to prevent excessive fade
				if (jetsManager.lastMovementTime) {
					jetsManager.lastMovementTime = timestamp;
				}
			} else {
				// Fallback to synchronizing all jets using jetsManager
				jetsManager.syncJetsWithBolts(true);
			}
			
			// Trigger jet effects periodically during animation
			if (timestamp - lastJetTime > 100) { // More frequent updates (150ms -> 100ms)
				const intensity = 0.5 + easedProgress * 0.5; // Increase intensity as animation progresses
				
				// Emit particles directly on bolts that are moving
				cornerBolts.forEach((bolt, index) => {
					// Skip invisible bolts
					if (!bolt.visible) return;
					
					// Find matching jet from mapping or by index
					const jet = boltToJetMap.get(bolt) || 
						(jetsManager.jets && index < jetsManager.jets.length ? jetsManager.jets[index] : null);
					
					if (jet) {
						// Update base position first
						jet.basePosition.copy(bolt.position);
						
						// Create movement direction with random variations but stronger effect
						const moveDir = new THREE.Vector3(
							(Math.random() - 0.5) * 0.25,
							(Math.random() - 0.5) * 0.25,
							(Math.random() - 0.5) * 0.2 - 0.9 // Stronger backward component
						);
						
						// Emit more particles for a more visible effect
						const particleCount = Math.ceil(7 * intensity); // Increased from 5
						for (let i = 0; i < particleCount; i++) {
							jetsManager.emitJetParticle(jet, moveDir, intensity * 1.2); // Slightly higher intensity
						}
					}
				});
				
				// Update last jet time
				lastJetTime = timestamp;
			}
		}
		
		// Continue animation if not complete
		if (progress < 1) {
			requestAnimationFrame(animate);
		} else {
			// Final position sync for jets
			if (jetsManager) {
				jetsManager.syncJetsWithBolts(true);
			}
			
			// Call the completion callback
			if (onComplete) onComplete();
		}
	};
	
	// Start animation
	requestAnimationFrame(animate);
}

/**
 * Animate all bolts to bottom left corner for hidden mode
 * 
 * @param {Array} cornerBolts - Array of bolt meshes
 * @param {number} startHeight - Starting height
 * @param {number} targetHeight - Target height for animation
 * @param {Function} onUpdate - Function to call on each update
 * @param {Function} onComplete - Function to call when complete
 */
export function animateCornerBoltsToCorner(cornerBolts, startHeight, targetHeight, onUpdate, onComplete) {
	// Skip if no corner bolts exist
	if (!cornerBolts || cornerBolts.length < 4) {
		if (onComplete) onComplete();
		return;
	}
	
	// Animation parameters
	const duration = 1000;
	const startTime = performance.now();
	
	// Store starting positions
	const startPositions = cornerBolts.map(bolt => bolt.position.clone());
	
	// Store starting plate positions
	const startPlatePositions = cornerBolts.map(bolt => 
		bolt.userData.plate ? bolt.userData.plate.position.clone() : null
	);
	
	// Frame rate control
	let lastFrameTime = 0;
	const frameInterval = 1000 / 60; // Target 60fps
	
	// Create animation
	const animate = (timestamp) => {
		// Frame rate control for smoother animations
		if (timestamp - lastFrameTime < frameInterval) {
			requestAnimationFrame(animate);
			return;
		}
		lastFrameTime = timestamp;
		
		const elapsed = timestamp - startTime;
		const progress = Math.min(elapsed / duration, 1);
		
		// Use easing function
		const easedProgress = easeInOutQuad(progress);
		
		// Update height
		const newHeight = startHeight + (targetHeight - startHeight) * easedProgress;
		
		// Call update callback with current height
		if (onUpdate) {
			onUpdate(newHeight, easedProgress);
		}
		
		// Calculate current bottom left corner position
		const targetX = -7.5 - 0.5; // Width/2 + offset
		const targetY = -newHeight/2 - 2.5; // This will change as height changes
		
		// Update all bolt positions - move to bottom left
		cornerBolts.forEach((bolt, index) => {
			const startPos = startPositions[index];
			
			// Move towards bottom left corner
			bolt.position.x = startPos.x + (targetX - startPos.x) * easedProgress;
			bolt.position.y = startPos.y + (targetY - startPos.y) * easedProgress;
			// Preserve z position from original position
			bolt.position.z = bolt.userData.originalPosition.z;
			
			// Update plate position if it exists
			if (bolt.userData.plate && startPlatePositions[index]) {
				bolt.userData.plate.position.x = bolt.position.x;
				bolt.userData.plate.position.y = bolt.position.y;
				bolt.userData.plate.position.z = bolt.position.z - 0.1; // Keep the plate behind the bolt
			}
		});
		
		// Continue animation if not complete
		if (progress < 1) {
			requestAnimationFrame(animate);
		} else {
			// Call the completion callback
			if (onComplete) onComplete();
		}
	};
	
	// Start animation
	requestAnimationFrame(animate);
}

/**
 * Animate bolts back to normal corner positions
 * 
 * @param {Array} cornerBolts - Array of bolt meshes
 * @param {number} startHeight - Starting height
 * @param {number} targetHeight - Target height for animation
 * @param {Function} onUpdate - Function to call on each update
 * @param {Function} onComplete - Function to call when complete
 */
export function animateCornerBoltsToNormalPositions(cornerBolts, startHeight, targetHeight, onUpdate, onComplete) {
	// Skip if no corner bolts exist
	if (!cornerBolts || cornerBolts.length < 4) {
		if (onComplete) onComplete();
		return;
	}
	
	// Animation parameters
	const duration = 1000;
	const startTime = performance.now();
	
	// Store starting positions
	const startPositions = cornerBolts.map(bolt => bolt.position.clone());
	
	// Store starting plate positions
	const startPlatePositions = cornerBolts.map(bolt => 
		bolt.userData.plate ? bolt.userData.plate.position.clone() : null
	);
	
	// Frame rate control
	let lastFrameTime = 0;
	const frameInterval = 1000 / 60; // Target 60fps
	
	// Create animation
	const animate = (timestamp) => {
		// Frame rate control for smoother animations
		if (timestamp - lastFrameTime < frameInterval) {
			requestAnimationFrame(animate);
			return;
		}
		lastFrameTime = timestamp;
		
		const elapsed = timestamp - startTime;
		const progress = Math.min(elapsed / duration, 1);
		
		// Use easing function
		const easedProgress = easeInOutQuad(progress);
		
		// Update height
		const newHeight = startHeight + (targetHeight - startHeight) * easedProgress;
		
		// Call update callback with current height
		if (onUpdate) {
			onUpdate(newHeight, easedProgress);
		}
		
		// Update all bolt positions
		cornerBolts.forEach((bolt, index) => {
			const startPos = startPositions[index];
			const targetPos = bolt.userData.originalPosition.clone();
			
			// For bottom bolts, adjust target Y to match current height
			if (index === 2 || index === 3) { // Bottom bolts
				targetPos.y = -newHeight/2 - 0.1;
			}
			
			// Move towards original position
			bolt.position.x = startPos.x + (targetPos.x - startPos.x) * easedProgress;
			bolt.position.y = startPos.y + (targetPos.y - startPos.y) * easedProgress;
			// Maintain the z position from originalPosition
			bolt.position.z = targetPos.z;
			
			// Update plate position if it exists
			if (bolt.userData.plate && startPlatePositions[index]) {
				bolt.userData.plate.position.x = bolt.position.x;
				bolt.userData.plate.position.y = bolt.position.y;
				bolt.userData.plate.position.z = bolt.position.z - 0.1; // Keep the plate behind the bolt
			}
		});
		
		// Continue animation if not complete
		if (progress < 1) {
			requestAnimationFrame(animate);
		} else {
			// Call the completion callback
			if (onComplete) onComplete();
		}
	};
	
	// Start animation
	requestAnimationFrame(animate);
} 