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
		
		// Set up animation
		const animate = (currentTime) => {
			if (!this.isMoving) return;
			
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
		
		const topLeftBolt = cornerBolts[0];
		const topRightBolt = cornerBolts[1];
		const bottomLeftBolt = cornerBolts[2]; 
		const bottomRightBolt = cornerBolts[3];
		
		// Animation parameters
		const duration = 800;
		const startTime = performance.now();
		
		// Store starting values
		const startPosTopLeft = topLeftBolt.position.clone();
		const startPosTopRight = topRightBolt.position.clone();
		const startPosBottomLeft = bottomLeftBolt.position.clone();
		const startPosBottomRight = bottomRightBolt.position.clone();
		
		// Store starting plate positions if they exist
		const startPosTopLeftPlate = topLeftBolt.userData.plate ? topLeftBolt.userData.plate.position.clone() : null;
		const startPosTopRightPlate = topRightBolt.userData.plate ? topRightBolt.userData.plate.position.clone() : null;
		
		// Calculate target positions for top bolts
		const targetTopLeftPos = isTallMode 
			? topLeftBolt.userData.targetTallPosition.clone()
			: topLeftBolt.userData.originalPosition.clone();
		
		const targetTopRightPos = isTallMode 
			? topRightBolt.userData.targetTallPosition.clone()
			: topRightBolt.userData.originalPosition.clone();
		
		// Animation function
		const animate = (timestamp) => {
			const elapsed = timestamp - startTime;
			const progress = Math.min(elapsed / duration, 1);
			const easedProgress = easeInOutQuad(progress);
			
			// Update height with proper easing
			const newHeight = startHeight + (targetHeight - startHeight) * easedProgress;
			
			// Call update callback with current height
			if (onUpdate) {
				onUpdate(newHeight, easedProgress);
			}
			
			// Animate top bolts
			topLeftBolt.position.lerpVectors(startPosTopLeft, targetTopLeftPos, easedProgress);
			topRightBolt.position.lerpVectors(startPosTopRight, targetTopRightPos, easedProgress);
			
			// Animate decorative plates if they exist
			if (topLeftBolt.userData.plate && startPosTopLeftPlate) {
				// Calculate offset relative to bolt position - the plate is always slightly behind the bolt
				const plateOffset = new THREE.Vector3(0, 0, -0.1);
				const targetPlatePos = targetTopLeftPos.clone().add(plateOffset);
				topLeftBolt.userData.plate.position.lerpVectors(startPosTopLeftPlate, targetPlatePos, easedProgress);
			}
			
			if (topRightBolt.userData.plate && startPosTopRightPlate) {
				const plateOffset = new THREE.Vector3(0, 0, -0.1);
				const targetPlatePos = targetTopRightPos.clone().add(plateOffset);
				topRightBolt.userData.plate.position.lerpVectors(startPosTopRightPlate, targetPlatePos, easedProgress);
			}
			
			// Continue animation if not complete
			if (progress < 1) {
				requestAnimationFrame(animate);
			} else {
				// Ensure final positions are exactly as intended
				topLeftBolt.position.copy(targetTopLeftPos);
				topRightBolt.position.copy(targetTopRightPos);
				
				// Ensure final positions for plates
				if (topLeftBolt.userData.plate) {
					const plateOffset = new THREE.Vector3(0, 0, -0.1);
					topLeftBolt.userData.plate.position.copy(targetTopLeftPos.clone().add(plateOffset));
				}
				
				if (topRightBolt.userData.plate) {
					const plateOffset = new THREE.Vector3(0, 0, -0.1);
					topRightBolt.userData.plate.position.copy(targetTopRightPos.clone().add(plateOffset));
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
		
		// Create animation
		const animate = (timestamp) => {
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
		
		// Create animation
		const animate = (timestamp) => {
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