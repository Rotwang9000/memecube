import * as THREE from 'three';
import { easeInOutQuad } from '../common/utils.js';

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
} 