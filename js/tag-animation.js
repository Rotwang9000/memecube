import * as THREE from 'three';
import { TagEasing } from './tag-easing.js';

/**
 * Handles animations for tags in the cube
 */
export class TagAnimation {
	constructor() {
		// Currently animating tags
		this.animatingTags = [];
		this.resizingTags = [];
	}
	
	/**
	 * Process animations for all tags currently being animated
	 */
	update() {
		// Update animating tags (both new tags flying in and existing tags shifting)
		for (let i = this.animatingTags.length - 1; i >= 0; i--) {
			const tag = this.animatingTags[i];
			
			if (tag.isAnimating) {
				this.updateFlyInAnimation(tag, i);
			} else if (tag.isMoving) {
				this.updateShiftAnimation(tag, i);
			}
		}
		
		// Update resizing tags
		this.updateResizingTags();
	}
	
	/**
	 * Update the fly-in animation for a new tag
	 */
	updateFlyInAnimation(tag, index) {
		// Slower animation allows more time to process collisions properly
		tag.animationProgress += 0.005;
		
		// If animation is complete
		if (tag.animationProgress >= 1) {
			tag.isAnimating = false;
			tag.position.copy(tag.targetPosition);
			tag.mesh.position.copy(tag.position);
			
			// Update bounding box with final position
			tag.bbox.setFromObject(tag.mesh);
			
			// Check if this tag has other animations pending
			if (!tag.isMoving && !tag.isResizing) {
				this.animatingTags.splice(index, 1);
			}
		} else {
			// Calculate current position using better easing function
			// Use a combination of easing functions for more natural motion
			let t;
			
			// First third: slow start (ease in)
			if (tag.animationProgress < 0.3) {
				t = TagEasing.easeInQuad(tag.animationProgress / 0.3) * 0.3;
			} 
			// Middle part: faster motion
			else if (tag.animationProgress < 0.7) {
				t = 0.3 + TagEasing.easeInOutQuad((tag.animationProgress - 0.3) / 0.4) * 0.4;
			}
			// Final part: elastic settling
			else {
				t = 0.7 + TagEasing.easeOutElastic((tag.animationProgress - 0.7) / 0.3) * 0.3;
			}
			
			// Vector from current position towards target
			const currentPos = tag.mesh.position.clone();
			const direction = tag.targetPosition.clone().sub(currentPos);
			
			// Move part way there based on easing
			const newPosition = currentPos.clone().add(direction.multiplyScalar(t));
			
			// Check for collisions in the new position
			// We'll create a temporary bounding box at the new position to check for collisions
			const tempBox = tag.bbox.clone();
			const movement = newPosition.clone().sub(currentPos);
			tempBox.min.add(movement);
			tempBox.max.add(movement);
			
			// Detect solid collisions
			if (tag.animationProgress > 0.1) { // Start checking earlier (was 0.2)
				let solidBlock = false;
				const collisionTags = [];
				
				// Check against all other tags
				for (const otherTag of this.animatingTags) {
					// Skip self
					if (otherTag === tag) continue;
					// Skip tags without bounding boxes
					if (!otherTag.bbox) continue;
					
					// Check for intersection
					if (tempBox.intersectsBox(otherTag.bbox)) {
						solidBlock = true;
						
						// Calculate the center-to-center vector
						const tagCenter = new THREE.Vector3();
						otherTag.bbox.getCenter(tagCenter);
						
						const newTagCenter = new THREE.Vector3();
						tempBox.getCenter(newTagCenter);
						
						// Vector pointing from existing tag to new tag
						const centerToCenter = newTagCenter.clone().sub(tagCenter);
						
						// Normalize to get direction
						const pushDir = centerToCenter.clone().normalize();
						
						// Calculate overlap volume
						const intersection = new THREE.Box3();
						intersection.copy(tempBox).intersect(otherTag.bbox);
						
						const overlapVolume = 
							(intersection.max.x - intersection.min.x) *
							(intersection.max.y - intersection.min.y) *
							(intersection.max.z - intersection.min.z);
						
						const tagVolume =
							(otherTag.bbox.max.x - otherTag.bbox.min.x) *
							(otherTag.bbox.max.y - otherTag.bbox.min.y) *
							(otherTag.bbox.max.z - otherTag.bbox.min.z);
						
						// Calculate overlap as percentage of tag volume
						const overlapPercentage = overlapVolume / tagVolume;
						
						collisionTags.push({
							tag: otherTag,
							direction: pushDir,
							overlapPercentage: overlapPercentage
						});
					}
				}
				
				// If we detected collisions, process them
				if (solidBlock && collisionTags.length > 0) {
					// Switch to collision handling mode
					if (!tag.hasProcessedCollisions) {
						tag.collidingTags = collisionTags;
						this.processCollisionsAtImpact(tag);
						tag.hasProcessedCollisions = true;
						
						// Adjust the target position to stop at the collision point
						// Move slightly back from the collision
						const backupDistance = movement.length() * 0.2;
						tag.targetPosition = newPosition.clone().sub(
							movement.normalize().multiplyScalar(backupDistance)
						);
					}
					
					// If the collision has already been processed, just stop at the current position
					tag.isAnimating = false;
					tag.position.copy(tag.mesh.position);
					
					// Update bounding box with current position
					tag.bbox.setFromObject(tag.mesh);
					
					// Skip the rest of the animation update
					return;
				}
			}
			
			// No collisions detected or not checking yet, continue normal animation
			tag.mesh.position.copy(newPosition);
			
			// Update tag's current position
			tag.position.copy(newPosition);
			
			// Update bounding box with current position
			tag.bbox.setFromObject(tag.mesh);
			
			// Check for impacts with tags that should be displaced
			// Only do this check if we haven't processed collisions yet
			if (!tag.hasProcessedCollisions && tag.collidingTags && tag.collidingTags.length > 0) {
				// Check if we're at the impact point - use progress as a threshold
				// We want to trigger collision reactions when the tag is about 75% of the way to its target
				if (tag.animationProgress > 0.75) {
					this.processCollisionsAtImpact(tag);
					tag.hasProcessedCollisions = true; // Mark as processed so we don't do it again
				}
			}
		}
	}
	
	/**
	 * Update the shifting animation for tags that are moving aside
	 */
	updateShiftAnimation(tag, index) {
		// Faster movement speed for more responsive shifting
		tag.moveProgress += 0.04; // Increased from 0.03
		
		// If move is complete
		if (tag.moveProgress >= 1) {
			tag.isMoving = false;
			tag.position.copy(tag.targetPosition);
			tag.mesh.position.copy(tag.position);
			
			// Update bounding box with final position
			tag.bbox.setFromObject(tag.mesh);
			
			// Check if this tag has other animations pending
			if (!tag.isAnimating && !tag.isResizing) {
				this.animatingTags.splice(index, 1);
			}
		} else {
			// Calculate current position using easing function
			const t = TagEasing.easeOutCubic(tag.moveProgress);
			
			// Vector from current position towards target
			const currentPos = tag.mesh.position.clone();
			const direction = tag.targetPosition.clone().sub(currentPos);
			
			// Move part way there based on easing
			const newPosition = currentPos.clone().add(direction.multiplyScalar(t));
			
			// Create a temporary bounding box to check for collisions
			const tempBox = tag.bbox.clone();
			const movement = newPosition.clone().sub(currentPos);
			tempBox.min.add(movement);
			tempBox.max.add(movement);
			
			// Check for solid collisions during movement
			let solidBlock = false;
			let solidDirection = null;
			let minOverlap = Infinity;
			
			// Check against all other tags (except those being shifted themselves)
			for (const otherTag of this.animatingTags) {
				// Skip self
				if (otherTag === tag) continue;
				// Skip tags without bounding boxes
				if (!otherTag.bbox) continue;
				// Skip tags that are also moving (to avoid blocking chains)
				if (otherTag.isMoving) continue;
				
				// Check for intersection
				if (tempBox.intersectsBox(otherTag.bbox)) {
					solidBlock = true;
					
					// Calculate intersection distance to find minimum distance to resolve collision
					const intersection = new THREE.Box3();
					intersection.copy(tempBox).intersect(otherTag.bbox);
					
					// Find minimum overlap dimension (smallest distance to resolve collision)
					const overlapX = intersection.max.x - intersection.min.x;
					const overlapY = intersection.max.y - intersection.min.y;
					const overlapZ = intersection.max.z - intersection.min.z;
					
					// Find the smallest overlap dimension
					let minDim = Math.min(overlapX, overlapY, overlapZ);
					
					// Store the smallest overlap and direction
					if (minDim < minOverlap) {
						minOverlap = minDim;
						
						// Calculate centers
						const tagCenter = new THREE.Vector3();
						otherTag.bbox.getCenter(tagCenter);
						
						const movingCenter = new THREE.Vector3();
						tempBox.getCenter(movingCenter);
						
						// Get push direction away from the collided tag
						solidDirection = movingCenter.clone().sub(tagCenter).normalize();
					}
				}
			}
			
			// If we detected a collision during movement
			if (solidBlock && solidDirection) {
				// Adjust the position to resolve collision
				// Move in the direction of the smallest overlap plus some extra to ensure no overlap
				const resolutionDistance = minOverlap * 1.1;
				newPosition.add(solidDirection.multiplyScalar(resolutionDistance));
				
				// Update the target position to ensure future movements don't cause overlap
				tag.targetPosition = newPosition.clone();
			}
			
			// Update position with collision resolution if needed
			tag.mesh.position.copy(newPosition);
			
			// Update tag's current position
			tag.position.copy(newPosition);
			
			// Update bounding box with current position
			tag.bbox.setFromObject(tag.mesh);
		}
	}
	
	/**
	 * Update all tags that are currently resizing
	 */
	updateResizingTags() {
		for (let i = this.resizingTags.length - 1; i >= 0; i--) {
			const tag = this.resizingTags[i];
			
			// Update resize progress
			tag.resizeProgress += 0.05;
			
			// If resize is complete
			if (tag.resizeProgress >= 1) {
				tag.isResizing = false;
				tag.size = tag.targetSize;
				
				// Make sure the scale is properly set
				const scaleFactor = tag.size / tag.originalSize;
				tag.mesh.scale.set(scaleFactor, scaleFactor, scaleFactor);
				
				// Update bounding box with final scale
				tag.bbox.setFromObject(tag.mesh);
				
				// Remove from resizing tags
				this.resizingTags.splice(i, 1);
			} else {
				// Calculate current size using easing
				const t = TagEasing.easeOutQuad(tag.resizeProgress);
				const currentSize = tag.size + (tag.targetSize - tag.size) * t;
				
				// Update mesh scale
				const scaleFactor = currentSize / tag.originalSize;
				tag.mesh.scale.set(scaleFactor, scaleFactor, scaleFactor);
				
				// Update bounding box with current scale
				tag.bbox.setFromObject(tag.mesh);
			}
		}
	}
	
	/**
	 * Add subtle wobble to individual tags for organic feeling
	 */
	applyWobble(tags) {
		for (const tag of tags) {
			if (!tag.isAnimating && !tag.isMoving) {
				// Small subtle floating motion
				const time = Date.now() * 0.001;
				const hash = this.hashCode(tag.text); // Generate a unique value for each tag
				const offset = hash / 1000000; // Create a unique offset from the hash
				
				// Very subtle wobble
				const floatY = Math.sin(time + offset) * 0.02;
				const floatX = Math.cos(time + offset * 2) * 0.02;
				
				// Apply wobble but keep the tag close to its core position
				const pos = tag.targetPosition.clone();
				pos.y += floatY;
				pos.x += floatX;
				tag.mesh.position.copy(pos);
			}
		}
	}
	
	/**
	 * Process collisions at the moment of impact
	 */
	processCollisionsAtImpact(incomingTag) {
		// Skip if there are no colliding tags
		if (!incomingTag.collidingTags || incomingTag.collidingTags.length === 0) {
			return;
		}
		
		// Calculate the total energy of the incoming tag based on size
		// Larger tags have more energy and cause more dramatic effects
		const incomingEnergy = incomingTag.size * 3.5; // Increased for more dramatic effect
		
		// If this is a forced collision (from dynamic positioning), increase energy
		const energyMultiplier = incomingTag.forceCollisions ? 2.5 : 2.0; // Increased multipliers
		
		// Track total energy distributed to apply any remainder to the first tag
		let totalEnergyDistributed = 0;
		
		// Create a chain reaction by tracking secondary collisions
		const secondaryCollisions = [];
		
		// Process immediate collisions
		for (const collision of incomingTag.collidingTags) {
			const hitTag = collision.tag;
			
			// Skip tags that are already animating
			if (hitTag.isAnimating || hitTag.isMoving || hitTag.isResizing) continue;
			
			// Calculate relative size factor
			const sizeRatio = incomingTag.size / hitTag.size;
			
			// Calculate energy transfer based on overlap and size ratio
			// More overlap and larger incoming tags transfer more energy
			const energyTransfer = incomingEnergy * 
				collision.overlapPercentage * 
				Math.min(2.0, sizeRatio) * 
				energyMultiplier;
			
			totalEnergyDistributed += energyTransfer;
			
			// Calculate how much to shrink based on energy transfer
			// More energy = more shrinking
			const shrinkFactor = Math.max(0.3, 1.0 - (energyTransfer * 0.25)); // Increased shrink factor
			
			// Calculate new size
			const newSize = hitTag.size * shrinkFactor;
			
			// Set up resizing
			hitTag.targetSize = newSize;
			hitTag.isResizing = true;
			hitTag.resizeProgress = 0;
			
			if (!this.resizingTags.includes(hitTag)) {
				this.resizingTags.push(hitTag);
			}
			
			// Calculate push distance based on energy transfer
			const pushDistance = hitTag.size * collision.overlapPercentage * 
								 (2.0 + energyTransfer * 1.2); // Increased for more dramatic pushing
			
			// Add significant jitter to push direction for more chaotic, organic movement
			const jitterAmount = 0.3; // Increased from 0.2
			const jitterX = (Math.random() * 2 - 1) * jitterAmount;
			const jitterY = (Math.random() * 2 - 1) * jitterAmount;
			const jitterZ = (Math.random() * 2 - 1) * jitterAmount;
			
			const jitteredDirection = collision.direction.clone().add(
				new THREE.Vector3(jitterX, jitterY, jitterZ)
			).normalize();
			
			const newPosition = hitTag.position.clone().add(
				jitteredDirection.multiplyScalar(pushDistance)
			);
			
			// Set up movement
			hitTag.targetPosition = newPosition;
			hitTag.isMoving = true;
			hitTag.moveProgress = 0;
			
			if (!this.animatingTags.includes(hitTag)) {
				this.animatingTags.push(hitTag);
			}
			
			// Add this tag to secondary collisions list if it has enough energy
			if (energyTransfer > 0.5) {
				secondaryCollisions.push({
					tag: hitTag,
					energy: energyTransfer * 0.7 // Reduced energy for secondary collisions
				});
			}
		}
		
		// Process secondary collisions (tags pushed by the primary collision)
		for (const secondary of secondaryCollisions) {
			// Find all tags that this secondary tag might hit
			const secondaryTag = secondary.tag;
			
			// Skip if the tag doesn't have a bbox yet or if we don't know its target position
			if (!secondaryTag.bbox || !secondaryTag.targetPosition) continue;
			
			// Create a temp bounding box at the target position
			const tempBox = secondaryTag.bbox.clone();
			const movement = secondaryTag.targetPosition.clone().sub(secondaryTag.position);
			tempBox.min.add(movement);
			tempBox.max.add(movement);
			
			// Expand the box slightly to catch near-misses
			const expansionAmount = 0.2;
			tempBox.expandByScalar(expansionAmount);
			
			// Find tags that would be hit by this secondary movement
			const secondaryHits = [];
			
			for (const potentialHit of this.animatingTags) {
				// Skip the original tag and the secondary tag itself
				if (potentialHit === incomingTag || potentialHit === secondaryTag) continue;
				
				// Skip tags that are already being processed
				if (potentialHit.isMoving || potentialHit.isResizing) continue;
				
				// Skip tags without bounding boxes
				if (!potentialHit.bbox) continue;
				
				// Check for collision with the expanded box
				if (tempBox.intersectsBox(potentialHit.bbox)) {
					// Calculate direction based on center-to-center
					const tagCenter = new THREE.Vector3();
					potentialHit.bbox.getCenter(tagCenter);
					
					const secondaryCenter = new THREE.Vector3();
					tempBox.getCenter(secondaryCenter);
					
					const direction = secondaryCenter.clone().sub(tagCenter).normalize();
					
					secondaryHits.push({
						tag: potentialHit,
						direction: direction,
						energy: secondary.energy * 0.7 // Increased from 0.5 for more dramatic effect
					});
				}
			}
			
			// Process these secondary hits with reduced effect
			for (const hit of secondaryHits) {
				const hitTag = hit.tag;
				
				// Skip if already being animated
				if (hitTag.isAnimating || hitTag.isMoving || hitTag.isResizing) continue;
				
				// Less aggressive shrinking for secondary collisions
				const shrinkFactor = Math.max(0.6, 1.0 - (hit.energy * 0.15)); // Increased shrink effect
				const newSize = hitTag.size * shrinkFactor;
				
				// Set up resizing
				hitTag.targetSize = newSize;
				hitTag.isResizing = true;
				hitTag.resizeProgress = 0;
				
				if (!this.resizingTags.includes(hitTag)) {
					this.resizingTags.push(hitTag);
				}
				
				// Calculate smaller push distance for secondary collisions
				const pushDistance = hitTag.size * hit.energy * 1.0; // Increased from 0.5
				
				// Add small jitter
				const jitterAmount = 0.15; // Increased from 0.1
				const jitteredDirection = hit.direction.clone().add(
					new THREE.Vector3(
						(Math.random() * 2 - 1) * jitterAmount,
						(Math.random() * 2 - 1) * jitterAmount,
						(Math.random() * 2 - 1) * jitterAmount
					)
				).normalize();
				
				const newPosition = hitTag.position.clone().add(
					jitteredDirection.multiplyScalar(pushDistance)
				);
				
				// Set up movement
				hitTag.targetPosition = newPosition;
				hitTag.isMoving = true;
				hitTag.moveProgress = 0;
				
				if (!this.animatingTags.includes(hitTag)) {
					this.animatingTags.push(hitTag);
				}
			}
		}
	}
	
	/**
	 * Simple string hash function for wobble effect
	 */
	hashCode(str) {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			hash = ((hash << 5) - hash) + str.charCodeAt(i);
			hash |= 0; // Convert to 32-bit integer
		}
		return hash;
	}
} 