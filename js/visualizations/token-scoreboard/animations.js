import * as THREE from 'three';
import { easeInOutQuad } from './utils.js';

/**
 * Handles animations for the token scoreboard
 */
export class AnimationManager {
	constructor() {
		this.isMoving = false;
		this.movementStartTime = 0;
		this.movementDuration = 1000; // Duration of flight animation in ms
		this.movementStartQuaternion = new THREE.Quaternion();
		this.targetQuaternion = new THREE.Quaternion();
		this.onAnimationComplete = null;
		
		// Frame rate control for smoother animations
		this.lastFrameTime = 0;
		this.targetFPS = 60;
		this.frameInterval = 1000 / this.targetFPS;
	}
	
	/**
	 * Animate the scoreboard flying to a new position
	 * @param {THREE.Group} scoreboardGroup - The scoreboard group to animate
	 * @param {THREE.Vector3} targetPos - Target position to move to
	 * @param {THREE.Quaternion} targetQuaternion - Target rotation
	 * @param {number} scale - Scale to apply to the scoreboard
	 * @param {Function} onComplete - Function to call when animation is complete
	 */
	animateMovement(scoreboardGroup, targetPos, targetQuaternion, scale = 0.3, onComplete = null) {
		// Stop any existing animation
		this.isMoving = false;
		
		// Set flag that we're currently moving
		this.isMoving = true;
		this.movementStartTime = performance.now();
		this.onAnimationComplete = onComplete;
		
		// Store starting position and rotation
		const startPosition = scoreboardGroup.position.clone();
		this.movementStartQuaternion.copy(scoreboardGroup.quaternion);
		this.targetQuaternion = targetQuaternion.clone();
		
		// Store starting and target scale
		const startScale = scoreboardGroup.scale.x;
		const targetScale = scale;
		
		// Get movement direction vector for jet effects
		const moveDir = new THREE.Vector3().subVectors(targetPos, startPosition);
		
		// Properly rotate target quaternion for text orientation
		const rotZ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
		const rotY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
		this.targetQuaternion.multiply(rotZ).multiply(rotY);
		
		// Set up animation with frame rate control
		const animate = (currentTime) => {
			if (!this.isMoving) return;
			
			// Frame rate control for smoother animations
			if (currentTime - this.lastFrameTime < this.frameInterval) {
				requestAnimationFrame(animate);
				return;
			}
			this.lastFrameTime = currentTime;
			
			const elapsed = currentTime - this.movementStartTime;
			const progress = Math.min(elapsed / this.movementDuration, 1);
			
			// Use ease-in-out function for smoother movement
			const t = easeInOutQuad(progress);
			
			// Interpolate position
			scoreboardGroup.position.lerpVectors(startPosition, targetPos, t);
			
			// Interpolate rotation
			scoreboardGroup.quaternion.slerpQuaternions(
				this.movementStartQuaternion,
				this.targetQuaternion,
				t
			);
			
			// Interpolate scale
			const currentScale = startScale + (targetScale - startScale) * t;
			scoreboardGroup.scale.set(currentScale, currentScale, currentScale);
			
			// Continue animation if not complete
			if (progress < 1) {
				requestAnimationFrame(animate);
			} else {
				this.isMoving = false;
				
				// Call the completion callback if provided
				if (this.onAnimationComplete) {
					this.onAnimationComplete();
					this.onAnimationComplete = null;
				}
			}
		};
		
		// Start animation
		this.lastFrameTime = 0; // Reset frame timer
		requestAnimationFrame(animate);
		
		// Return movement direction for jet effects
		return moveDir;
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
	 */
	animateCornerBolts(cornerBolts, isTallMode, startHeight, targetHeight, onUpdate, onComplete) {
		// Skip if no corner bolts exist
		if (!cornerBolts || cornerBolts.length < 4) {
			if (onComplete) onComplete();
			return;
		}
		
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
		const startPosTopLeft = topLeftBolt.position.clone();
		const startPosTopRight = topRightBolt.position.clone();
		const startPosBottomLeft = bottomLeftBolt.position.clone();
		const startPosBottomRight = bottomRightBolt.position.clone();
		
		// Validate starting positions - ensure left bolts are on left and right bolts are on right
		// This prevents any incorrect starting positions
		const halfWidth = (startPosTopRight.x - startPosTopLeft.x) / 2 - 0.45;
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
		
		// Store starting plate positions if they exist
		const startPosTopLeftPlate = topLeftBolt.userData.plate ? topLeftBolt.userData.plate.position.clone() : null;
		const startPosTopRightPlate = topRightBolt.userData.plate ? topRightBolt.userData.plate.position.clone() : null;
		const startPosBottomLeftPlate = bottomLeftBolt.userData.plate ? bottomLeftBolt.userData.plate.position.clone() : null;
		const startPosBottomRightPlate = bottomRightBolt.userData.plate ? bottomRightBolt.userData.plate.position.clone() : null;
		
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
			
			// Trigger jet effects periodically during animation
			if (jetsManager) {
				// Try to emit jet particles every 150ms during animation
				if (timestamp - lastJetTime > 150) {
					const intensity = 0.5 + easedProgress * 0.5; // Increase intensity as animation progresses
					
					// Create random movement directions for jets
					const jets = jetsManager.jets || [];
					jets.forEach((jet, index) => {
						if (!jet) return;
						
						// Create movement direction with random variations
						const moveDir = new THREE.Vector3(
							(Math.random() - 0.5) * 0.2,
							(Math.random() - 0.5) * 0.2,
							(Math.random() - 0.5) * 0.2 - 0.8 // Mostly backward
						);
						
						// Emit multiple particles for better effect
						const particleCount = Math.ceil(5 * intensity);
						for (let i = 0; i < particleCount; i++) {
							jetsManager.emitJetParticle(jet, moveDir, intensity);
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
				// Ensure final positions are exactly as intended
				topLeftBolt.position.copy(targetTopLeftPos);
				topRightBolt.position.copy(targetTopRightPos);
				bottomLeftBolt.position.copy(targetBottomLeftPos);
				bottomRightBolt.position.copy(targetBottomRightPos);
				
				// Double-check that bolts maintained their correct sides
				if (topLeftBolt.position.x > 0 || bottomLeftBolt.position.x > 0) {
					console.warn("Left bolts ended up on wrong side - fixing");
					topLeftBolt.position.x = -Math.abs(topLeftBolt.position.x);
					bottomLeftBolt.position.x = -Math.abs(bottomLeftBolt.position.x);
				}
				if (topRightBolt.position.x < 0 || bottomRightBolt.position.x < 0) {
					console.warn("Right bolts ended up on wrong side - fixing");
					topRightBolt.position.x = Math.abs(topRightBolt.position.x);
					bottomRightBolt.position.x = Math.abs(bottomRightBolt.position.x);
				}
				
				// Ensure final positions for plates
				if (topLeftBolt.userData.plate) {
					const plateOffset = new THREE.Vector3(0, 0, 0.1);
					topLeftBolt.userData.plate.position.copy(targetTopLeftPos.clone().add(plateOffset));
				}
				
				if (topRightBolt.userData.plate) {
					const plateOffset = new THREE.Vector3(0, 0, 0.1);
					topRightBolt.userData.plate.position.copy(targetTopRightPos.clone().add(plateOffset));
				}
				
				if (bottomLeftBolt.userData.plate) {
					const plateOffset = new THREE.Vector3(0, 0, 0.1);
					bottomLeftBolt.userData.plate.position.copy(targetBottomLeftPos.clone().add(plateOffset));
				}
				
				if (bottomRightBolt.userData.plate) {
					const plateOffset = new THREE.Vector3(0, 0, 0.1);
					bottomRightBolt.userData.plate.position.copy(targetBottomRightPos.clone().add(plateOffset));
				}
				
				// Final jet burst on completion
				if (jetsManager) {
					jetsManager.jets.forEach(jet => {
						if (!jet) return;
						
						// Create backward burst effect
						const moveDir = new THREE.Vector3(0, 0, -1);
						for (let i = 0; i < 10; i++) {
							jetsManager.emitJetParticle(jet, moveDir, 1.0);
						}
					});
				}
				
				// Call completion callback
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
	animateCornerBoltsToCorner(cornerBolts, startHeight, targetHeight, onUpdate, onComplete) {
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
	animateCornerBoltsToNormalPositions(cornerBolts, startHeight, targetHeight, onUpdate, onComplete) {
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
} 