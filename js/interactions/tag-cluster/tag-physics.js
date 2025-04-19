import * as THREE from 'three';

/**
 * TagPhysics - Proper implementation for tag positioning and interactions
 * 
 * This system creates a cohesive isometric cluster structure with tags at right angles,
 * properly handles tag entry and movement, and ensures stable physics.
 * 
 * NOTE: If font loading issues occur (SyntaxError with "<!DOCTYPE" not valid JSON),
 * make sure that:
 * 1. The font files exist in the /fonts directory
 * 2. The paths in TagManager's loadFont() method match actual font filenames
 * 3. All imports use the same Three.js version (currently using unpkg.com/three@0.159.0)
 */
export class TagPhysics {
	/**
	 * @param {THREE.Scene} scene - Three.js scene reference
	 */
	constructor(scene) {
		this.scene = scene;

		// Physics configuration - properly tuned values
		this.config = {
			// Structure parameters
			cubeCoherence: 1.8,        // How strongly we enforce cube structure (increased)
			tagSeparation: 0.01,       // Hair's width spacing between tags
			rightAngleTolerance: 0.05, // Strict right angle enforcement
			
			// Movement parameters
			damping: 0.92,             // Strong damping to prevent bouncing
			maxSpeed: 0.4,             // Conservative speed limit
			entrySpeed: 0.3,           // New tag approach speed
			spinRate: 0.003,           // Subtle constant rotation
			
			// Force parameters
			repulsionStrength: 2.2,    // Tag repulsion force (increased)
			surfaceAttraction: 1.5,    // Pull to form outer shell (increased)
			structureStrength: 1.8,    // Force maintaining cube structure (increased)
			verticalPriority: 2.0,     // Strong vertical priority for up/down movement
			
			// Animation parameters
			resizeTime: 0.5,           // Seconds for size transitions
			settleTolerance: 0.0005,   // When to consider a tag settled
			
			// Distribution and packing
			faceBalancing: 0.9,        // How strongly to balance tags across faces
			packingDensity: 1.3        // Density factor (higher = tighter packing)
		};

		// Internal state
		this.tagData = new Map();
		this.cubeCentre = new THREE.Vector3();
		this.cubeSize = 1.0;
		this.cubeOrientation = new THREE.Quaternion();
		this.lastUpdateTime = performance.now() / 1000;
		this.movementChains = new Map(); // For propagating movements
		
		// Cache of face direction vectors 
		this.faceDirections = [
			new THREE.Vector3(1, 0, 0),   // +X
			new THREE.Vector3(-1, 0, 0),  // -X
			new THREE.Vector3(0, 1, 0),   // +Y
			new THREE.Vector3(0, -1, 0),  // -Y
			new THREE.Vector3(0, 0, 1),   // +Z
			new THREE.Vector3(0, 0, -1)   // -Z
		];
		
		// Face utilization tracking
		this.faceUtilization = [0, 0, 0, 0, 0, 0];
		
		// Debug helpers
		this.debug = {
			showStructure: false,
			cubeHelper: null
		};
	}

	/**
	 * Register a tag with the physics system
	 */
	initializeTag(tag, isNew = false) {
		if (!tag || !tag.mesh) {
			console.warn("TagPhysics: Attempted to initialize invalid tag");
			return;
		}

		// Set initial orientation for right angles
		const orientation = this.calculateTagOrientation(tag.mesh);
		tag.mesh.setRotationFromQuaternion(orientation);
		tag.mesh.updateMatrixWorld();

		// Store physics data
		const data = {
			velocity: new THREE.Vector3(),
			angularVelocity: new THREE.Vector3(),
			mass: this.calculateMass(tag),
			bbox: new THREE.Box3().setFromObject(tag.mesh),
			orientation: orientation.clone(),
			targetOrientation: orientation.clone(),
			movementAxis: this.calculateMovementAxis(tag.mesh), // Primary movement axis
			isNew: isNew,
			isSettled: false,
			isOnSurface: false,
			face: -1, // Which cube face
			entryPosition: null,
			age: 0,
			size: {
				current: tag.mesh.scale.x,
				target: tag.mesh.scale.x,
				transitionStart: 0,
				transitionProgress: 1
			},
			// Collision chain data
			chainParent: null,
			chainChildren: [],
			chainProcessed: false
		};

		this.tagData.set(tag.id, data);
	}

	/**
	 * Calculate the primary movement axis for the tag (up/down relative to tag orientation)
	 */
	calculateMovementAxis(mesh) {
		// Calculate the "up" vector in the tag's local space
		const localUp = new THREE.Vector3(0, 1, 0);
		return localUp.applyQuaternion(mesh.quaternion);
	}

	/**
	 * Calculate orientation that aligns tag with cube structure
	 */
	calculateTagOrientation(mesh) {
		// Find best face based on utilization
		let bestFace = this.chooseBestFace();
		
		// Create quaternion that aligns tag with cube face
		const alignQuat = new THREE.Quaternion();
		const faceDir = this.faceDirections[bestFace];
		
		// Handle orientation differently based on face
		if (bestFace === 2 || bestFace === 3) { // Y faces
			alignQuat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), faceDir);
		} else { // X and Z faces
			alignQuat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), faceDir);
			const upright = new THREE.Quaternion().setFromAxisAngle(faceDir, Math.PI/2);
			alignQuat.multiply(upright);
		}
		
		return alignQuat;
	}

	/**
	 * Choose the best face to place a new tag based on current utilization
	 */
	chooseBestFace() {
		// Find the least utilized face with some randomization
		let minUtilization = Infinity;
		let leastUtilizedFaces = [];
		
		// Find faces with minimum utilization
		for (let i = 0; i < 6; i++) {
			if (this.faceUtilization[i] < minUtilization) {
				minUtilization = this.faceUtilization[i];
				leastUtilizedFaces = [i];
			} else if (this.faceUtilization[i] === minUtilization) {
				leastUtilizedFaces.push(i);
			}
		}
		
		// Randomly select from least utilized faces
		const faceIndex = Math.floor(Math.random() * leastUtilizedFaces.length);
		return leastUtilizedFaces[faceIndex];
	}

	/**
	 * Add a new tag that flies toward the cube structure
	 */
	addNewTag(tag, existingTags = []) {
		if (!tag || !tag.mesh) {
			console.warn("TagPhysics: Attempted to add invalid tag");
			return;
		}

		// Update cube structure info
		this.updateCubeStructure(existingTags);
		
		// Choose best entry face - prioritize even distribution
		const targetFace = this.chooseBestEntryFace(existingTags);
		
		// Update face utilization
		this.faceUtilization[targetFace]++;
		
		const faceDir = this.faceDirections[targetFace];
		
		// Calculate spawn position
		const spawnDistance = this.calculateSpawnDistance(existingTags);
		
		// Position and orient tag - always entering along the text reading direction
		const entryPos = faceDir.clone().negate().multiplyScalar(spawnDistance);
		tag.mesh.position.copy(entryPos);
		
		const orientation = this.calculateTagOrientation(tag.mesh);
		tag.mesh.setRotationFromQuaternion(orientation);
		tag.mesh.updateMatrixWorld();

		// Register with physics
		this.initializeTag(tag, true);

		// Configure entry trajectory
		const data = this.tagData.get(tag.id);
		data.entryPosition = entryPos.clone();
		data.face = targetFace;
		
		// Entry velocity aligned with tag's forward direction
		const tagForward = new THREE.Vector3(0, 0, 1).applyQuaternion(tag.mesh.quaternion);
		data.velocity.copy(tagForward.multiplyScalar(this.config.entrySpeed));
	}

	/**
	 * Find best face for new tag entry
	 */
	chooseBestEntryFace(existingTags) {
		// Find the least utilized face
		let minCount = Infinity;
		let bestFaces = [];
		
		for (let i = 0; i < 6; i++) {
			if (this.faceUtilization[i] < minCount) {
				minCount = this.faceUtilization[i];
				bestFaces = [i];
			} else if (this.faceUtilization[i] === minCount) {
				bestFaces.push(i);
			}
		}
		
		// If we have multiple best faces, choose randomly
		return bestFaces[Math.floor(Math.random() * bestFaces.length)];
	}

	/**
	 * Calculate appropriate spawn distance
	 */
	calculateSpawnDistance(existingTags) {
		// Find furthest tag distance
		let maxDistSq = 0;
		
		for (const tag of existingTags) {
			if (!tag || !tag.mesh) continue;
			const distSq = tag.mesh.position.lengthSq();
			maxDistSq = Math.max(maxDistSq, distSq);
		}
		
		const maxDistance = Math.sqrt(maxDistSq);
		
		// Ensure minimum reasonable distance 
		const baseDistance = Math.max(maxDistance, this.cubeSize);
		
		// Add small margin for spawning
		return baseDistance + 1.0;
	}

	/**
	 * Remove a tag from the physics system
	 */
	removeTag(tagId) {
		if (!this.tagData.has(tagId)) {
			console.warn(`TagPhysics: Attempted to remove non-existent tag ${tagId}`);
			return false;
		}
		
		// Decrement face utilization
		const data = this.tagData.get(tagId);
		if (data.face >= 0 && data.face < 6) {
			this.faceUtilization[data.face] = Math.max(0, this.faceUtilization[data.face] - 1);
		}
		
		this.tagData.delete(tagId);
		return true;
	}

	/**
	 * Handle tag resizing with smooth transitions
	 */
	handleTagResize(tag, newSize) {
		if (!tag || !tag.mesh || !this.tagData.has(tag.id)) {
			console.warn("TagPhysics: Attempted to resize invalid tag");
			return;
		}

		const data = this.tagData.get(tag.id);
		const currentTime = performance.now() / 1000;
		
		// Setup for size transition animation
		data.size.current = tag.mesh.scale.x;
		data.size.target = newSize;
		data.size.transitionStart = currentTime;
		data.size.transitionProgress = 0;
		
		// Mark as unsettled
		data.isSettled = false;

		// Larger tags push outward along movement axis, smaller pull inward
		const isGrowing = newSize > data.size.current;
		if (isGrowing) {
			// Use movement axis (up/down relative to tag) with some outward direction
			const outwardDir = new THREE.Vector3()
				.subVectors(tag.mesh.position, this.cubeCentre)
				.normalize();
			
			// Blend movement axis with outward direction, favoring the movement axis
			const moveDir = new THREE.Vector3().copy(data.movementAxis);
			moveDir.addScaledVector(outwardDir, 0.3);
			moveDir.normalize();
			
			// Apply gentle impulse
			const impulse = Math.min(0.3, (newSize / data.size.current) - 1);
			data.velocity.addScaledVector(moveDir, impulse);
			
			// Start movement chain for propagation
			this.startMovementChain(tag.id);
		}
	}

	/**
	 * Main update function called each frame
	 */
	update(tags) {
		if (!tags || tags.length === 0) return;

		// Calculate time delta
		const currentTime = performance.now() / 1000;
		const dt = Math.min(0.033, currentTime - this.lastUpdateTime);
		this.lastUpdateTime = currentTime;
		if (dt <= 0) return;

		// Update cube structure
		this.updateCubeStructure(tags);
		
		// Apply subtle rotation to whole structure
		this.rotateStructure(dt);
		
		// Process movement chains
		this.processMovementChains(tags, dt);
		
		// Update bounding boxes
		this.updateBoundingBoxes(tags);

		// Apply physics forces
		this.applyCohesionForces(tags, dt);
		this.applyRepulsionForces(tags, dt);
		this.applySurfaceForces(tags, dt);

		// Integrate motion
		this.integrateMotion(tags, dt);
		
		// Constrain movement to primarily along movement axis
		this.constrainMovement(tags);
		
		// Ensure no intersections
		this.resolveIntersections(tags);
		
		// Update debug visualization if enabled
		if (this.debug.showStructure) {
			this.updateDebugVisualization();
		}
	}

	/**
	 * Constrain movement to be primarily along the tag's movement axis
	 */
	constrainMovement(tags) {
		for (const tag of tags) {
			if (!tag || !tag.mesh || !this.tagData.has(tag.id)) continue;
			const data = this.tagData.get(tag.id);
			
			// Skip new tags still entering
			if (data.isNew && data.age < 1.0) continue;
			
			// Get movement axis (up/down relative to tag)
			const movementAxis = data.movementAxis;
			
			// Project velocity onto movement axis to keep primarily up/down movement
			const currentVelocity = data.velocity.clone();
			const movementComponent = currentVelocity.dot(movementAxis);
			const alignedVelocity = movementAxis.clone().multiplyScalar(movementComponent);
			
			// Add small amount of original velocity to avoid being too restricted
			alignedVelocity.addScaledVector(currentVelocity, 0.1);
			
			// Update velocity
			data.velocity.copy(alignedVelocity);
		}
	}

	/**
	 * Apply subtle rotation to entire structure
	 */
	rotateStructure(dt) {
		// Create rotation increment
		const rotAngle = this.config.spinRate * dt;
		const rotQuat = new THREE.Quaternion().setFromAxisAngle(
			new THREE.Vector3(0, 1, 0), // Y-axis rotation
			rotAngle
		);
		
		// Apply to cube orientation
		this.cubeOrientation.premultiply(rotQuat);
		
		// Update face directions
		for (let i = 0; i < this.faceDirections.length; i++) {
			this.faceDirections[i].applyQuaternion(rotQuat);
		}
	}

	/**
	 * Update cube structure information
	 */
	updateCubeStructure(tags) {
		if (tags.length === 0) return;
		
		// Calculate center using weighted average based on tag size
		let totalWeight = 0;
		let weightedSum = new THREE.Vector3();
		let maxDistSq = 0;
		
		// First pass: calculate weighted center
		for (const tag of tags) {
			if (!tag || !tag.mesh) continue;
			
			// Use tag scale as weight (larger tags have more influence)
			const weight = tag.mesh.scale.x * tag.mesh.scale.x;
			totalWeight += weight;
			
			// Add weighted position
			weightedSum.addScaledVector(tag.mesh.position, weight);
			
			// Track maximum distance squared
			const distSq = tag.mesh.position.lengthSq();
			maxDistSq = Math.max(maxDistSq, distSq);
		}
		
		// Update center
		if (totalWeight > 0) {
			// Use weighted average for center
			this.cubeCentre.copy(weightedSum.divideScalar(totalWeight));
			
			// Calculate tight cube size based on maximum distance
			this.cubeSize = Math.max(1.0, Math.sqrt(maxDistSq) * 0.8);
			
			// Scale based on tag count with appropriate density
			const minSizeByCount = Math.pow(tags.length * 0.08, 1/3) * this.config.packingDensity + 0.7;
			this.cubeSize = Math.max(this.cubeSize, minSizeByCount);
		}
		
		// Assign tags to faces for proper structure
		this.assignTagsToFaces(tags);
	}

	/**
	 * Assign tags to appropriate cube faces
	 */
	assignTagsToFaces(tags) {
		// Reset face utilization
		this.faceUtilization = [0, 0, 0, 0, 0, 0];
		
		for (const tag of tags) {
			if (!tag || !tag.mesh || !this.tagData.has(tag.id)) continue;
			const data = this.tagData.get(tag.id);

			// Skip new tags still entering
			if (data.isNew && data.age < 1.0) continue;
			
			// Find which face this tag belongs to
			const relPos = new THREE.Vector3()
				.subVectors(tag.mesh.position, this.cubeCentre)
				.normalize();
			
			// Find best aligned face
			let bestFace = 0;
			let bestAlignment = -Infinity;
			
			for (let i = 0; i < this.faceDirections.length; i++) {
				const alignment = relPos.dot(this.faceDirections[i]);
				if (alignment > bestAlignment) {
					bestAlignment = alignment;
					bestFace = i;
				}
			}
			
			// Assign to face if alignment is good
			if (bestAlignment > 0.7) {
				data.face = bestFace;
				data.isOnSurface = true;
				this.faceUtilization[bestFace]++;
			} else {
				data.isOnSurface = false;
			}
		}
	}

	/**
	 * Update all tag bounding boxes
	 */
	updateBoundingBoxes(tags) {
		for (const tag of tags) {
			if (!tag || !tag.mesh || !this.tagData.has(tag.id)) continue;
			const data = this.tagData.get(tag.id);
			data.bbox.setFromObject(tag.mesh);
		}
	}

	/**
	 * Apply forces to maintain cube structure
	 */
	applyCohesionForces(tags, dt) {
		for (const tag of tags) {
			if (!tag || !tag.mesh || !this.tagData.has(tag.id)) continue;
			const data = this.tagData.get(tag.id);
			
			// Skip tags in active chains
			if (data.chainProcessed) continue;
			
			// Calculate direction to cube center
			const relPos = new THREE.Vector3()
				.subVectors(tag.mesh.position, this.cubeCentre);
			const distance = relPos.length();
			
			if (data.isOnSurface) {
				// Surface tags should maintain distance at cube radius
				const targetDist = this.cubeSize * 0.5;
				const distError = targetDist - distance;
				
				// Force pulls/pushes to maintain cube shape
				const forceMag = distError * this.config.structureStrength * 2.0;
				const forceDir = relPos.clone().normalize();
				
				// Apply force primarily along movement axis
				const movementComponent = forceDir.dot(data.movementAxis);
				const alignedForce = data.movementAxis.clone().multiplyScalar(movementComponent * forceMag * 1.5);
				const lateralForce = forceDir.clone().multiplyScalar(forceMag * 0.5);
				
				// Combine forces with priority to movement axis
				data.velocity.addScaledVector(alignedForce, dt / data.mass);
				data.velocity.addScaledVector(lateralForce, dt / data.mass);
			} else {
				// Interior tags move toward center with stronger force
				const forceMag = distance * 0.3 * this.config.structureStrength * 4.0;
				const forceDir = relPos.clone().normalize().negate();
				
				data.velocity.addScaledVector(forceDir, forceMag * dt / data.mass);
			}
			
			// Align orientation with cube structure
			if (data.face >= 0) {
				this.alignTagOrientation(tag, data, dt);
			}
		}
	}

	/**
	 * Align tag orientation with cube structure
	 */
	alignTagOrientation(tag, data, dt) {
		// Smoothly interpolate toward target
		const slerpFactor = Math.min(1.0, dt * 3.0);
		data.orientation.slerp(data.targetOrientation, slerpFactor);
		
		// Apply to mesh
		tag.mesh.quaternion.copy(data.orientation);
	}

	/**
	 * Apply repulsion forces between tags
	 */
	applyRepulsionForces(tags, dt) {
		for (let i = 0; i < tags.length; i++) {
			const tagA = tags[i];
			if (!tagA || !this.tagData.has(tagA.id)) continue;
			const dataA = this.tagData.get(tagA.id);
			
			// Skip processed chain tags
			if (dataA.chainProcessed) continue;

			for (let j = i + 1; j < tags.length; j++) {
				const tagB = tags[j];
				if (!tagB || !this.tagData.has(tagB.id)) continue;
				const dataB = this.tagData.get(tagB.id);

				// Skip both processed tags
				if (dataA.chainProcessed && dataB.chainProcessed) continue;
				
				// Skip if too far apart
				if (!this.areTagsClose(dataA.bbox, dataB.bbox)) continue;

				// Calculate repulsion direction
				const posA = tagA.mesh.position;
				const posB = tagB.mesh.position;
				const direction = new THREE.Vector3().subVectors(posA, posB);
				
				if (direction.lengthSq() === 0) {
					direction.set(Math.random() * 0.01, 0.01, Math.random() * 0.01);
				}
				
				const distance = direction.length();
				direction.normalize();
				
				// Calculate sizes for proper separation
				const sizeA = this.getTagSize(dataA.bbox);
				const sizeB = this.getTagSize(dataB.bbox);
				
				// Use hair's width separation
				const minSeparation = (sizeA + sizeB) * 0.35 + this.config.tagSeparation;
				
				// Apply forces if too close
				if (distance < minSeparation) {
					// Calculate repulsion strength
					const overlap = minSeparation - distance;
					let forceMag = overlap * this.config.repulsionStrength * 2.0;
					
					// Project forces onto movement axes for both tags
					const dirAlongAxisA = direction.dot(dataA.movementAxis);
					const dirAlongAxisB = direction.dot(dataB.movementAxis);
					
					// Create blended force directions prioritizing movement along axes
					const forceDir_A = new THREE.Vector3().copy(dataA.movementAxis)
						.multiplyScalar(dirAlongAxisA)
						.addScaledVector(direction, 0.2)
						.normalize();
						
					const forceDir_B = new THREE.Vector3().copy(dataB.movementAxis)
						.multiplyScalar(-dirAlongAxisB)
						.addScaledVector(direction.clone().negate(), 0.2)
						.normalize();
					
					// Calculate force for each tag
					const totalMass = dataA.mass + dataB.mass;
					const forceA = forceMag * (dataB.mass / totalMass);
					const forceB = forceMag * (dataA.mass / totalMass);
					
					// Handle chain propagation
					if (dataA.chainProcessed) {
						dataB.velocity.addScaledVector(forceDir_B, forceB * dt / dataB.mass);
						this.propagateMovement(tagA.id, tagB.id);
					} else if (dataB.chainProcessed) {
						dataA.velocity.addScaledVector(forceDir_A, forceA * dt / dataA.mass);
						this.propagateMovement(tagB.id, tagA.id);
					} else {
						// Normal case - both respond
						dataA.velocity.addScaledVector(forceDir_A, forceA * dt / dataA.mass);
						dataB.velocity.addScaledVector(forceDir_B, forceB * dt / dataB.mass);
					}
					
					// Mark as unsettled
					dataA.isSettled = dataB.isSettled = false;
				}
			}
		}
	}

	/**
	 * Get approximate tag size
	 */
	getTagSize(bbox) {
		const size = new THREE.Vector3();
		bbox.getSize(size);
		return (size.x + size.y + size.z) / 3;
	}

	/**
	 * Check if tags are close enough to interact
	 */
	areTagsClose(bbox1, bbox2) {
		// Expand for early intersection test - minimal expansion for hair's width check
		const expanded1 = bbox1.clone().expandByScalar(this.config.tagSeparation * 2);
		return expanded1.intersectsBox(bbox2);
	}

	/**
	 * Start a movement chain for collision propagation
	 */
	startMovementChain(tagId) {
		if (!this.tagData.has(tagId)) return;
		
		// Clear existing chain
		if (this.movementChains.has(tagId)) {
			this.clearMovementChain(tagId);
		}
		
		// Create new chain
		this.movementChains.set(tagId, {
			root: tagId,
			processed: false,
			members: new Set([tagId]),
			startTime: performance.now() / 1000
		});
		
		// Mark as processed
		this.tagData.get(tagId).chainProcessed = true;
	}

	/**
	 * Add tag to movement chain
	 */
	propagateMovement(fromId, toId) {
		if (!this.tagData.has(fromId) || !this.tagData.has(toId)) return;
		if (fromId === toId) return;
		
		// If source in chain, add target
		if (this.movementChains.has(fromId)) {
			const chain = this.movementChains.get(fromId);
			
			if (chain.members.has(toId)) return;
			
			// Add to chain
			chain.members.add(toId);
			this.tagData.get(toId).chainProcessed = true;
			
			// Track relationships
			this.tagData.get(toId).chainParent = fromId;
			this.tagData.get(fromId).chainChildren.push(toId);
		}
	}

	/**
	 * Process active movement chains
	 */
	processMovementChains(tags, dt) {
		for (const [rootId, chain] of this.movementChains.entries()) {
			const currentTime = performance.now() / 1000;
			const chainAge = currentTime - chain.startTime;
			
			// Expire old chains
			if (chainAge > 1.5) {
				this.clearMovementChain(rootId);
				continue;
			}
			
			// Check if settled
			let allSettled = true;
			for (const memberId of chain.members) {
				if (!this.tagData.has(memberId)) continue;
				const data = this.tagData.get(memberId);
				
				if (data.velocity.lengthSq() > this.config.settleTolerance) {
					allSettled = false;
					break;
				}
			}
			
			// Clear if settled
			if (allSettled) {
				this.clearMovementChain(rootId);
			}
		}
	}

	/**
	 * Clean up a movement chain
	 */
	clearMovementChain(rootId) {
		if (!this.movementChains.has(rootId)) return;
		
		const chain = this.movementChains.get(rootId);
		
		// Reset all members
		for (const memberId of chain.members) {
			if (!this.tagData.has(memberId)) continue;
			const data = this.tagData.get(memberId);
			
			data.chainProcessed = false;
			data.chainParent = null;
			data.chainChildren = [];
		}
		
		// Remove chain
		this.movementChains.delete(rootId);
	}

	/**
	 * Integrate motion for all tags
	 */
	integrateMotion(tags, dt) {
		for (const tag of tags) {
			if (!tag || !tag.mesh || !this.tagData.has(tag.id)) continue;
			const data = this.tagData.get(tag.id);
			
			// Handle size transitions
			this.updateTagSize(tag, data, dt);
			
			// Update age for new tags
			if (data.isNew) {
				data.age += dt;
				if (data.age > 3.0) {
					data.isNew = false;
				}
			}
			
			// Apply damping
			data.velocity.multiplyScalar(Math.pow(1 - this.config.damping, dt));
			
			// Speed limit
			const speedSq = data.velocity.lengthSq();
			if (speedSq > this.config.maxSpeed * this.config.maxSpeed) {
				data.velocity.multiplyScalar(this.config.maxSpeed / Math.sqrt(speedSq));
			}
			
			// Move the mesh
			tag.mesh.position.addScaledVector(data.velocity, dt);
			
			// Update matrix
			tag.mesh.updateMatrix();
			
			// Check if settled
			if (speedSq < this.config.settleTolerance) {
				data.isSettled = true;
			} else {
				data.isSettled = false;
			}
		}
		
		// Batch matrix updates
		for (const tag of tags) {
			if (tag && tag.mesh) {
				tag.mesh.updateMatrixWorld();
			}
		}
	}

	/**
	 * Handle smooth size transitions
	 */
	updateTagSize(tag, data, dt) {
		const currentTime = performance.now() / 1000;
		
		// Check if in transition
		if (data.size.transitionProgress < 1.0) {
			// Calculate progress
			const elapsed = currentTime - data.size.transitionStart;
			data.size.transitionProgress = Math.min(1.0, elapsed / this.config.resizeTime);
			
			// Use easing function
			const t = this.easeInOutCubic(data.size.transitionProgress);
			const newSize = data.size.current * (1-t) + data.size.target * t;
			
			// Apply new size
			tag.mesh.scale.set(newSize, newSize, newSize);
			
			// Update mass at completion
			if (data.size.transitionProgress >= 1.0) {
				data.mass = this.calculateMass(tag);
			}
		}
	}

	/**
	 * Easing function for animations
	 */
	easeInOutCubic(t) {
		return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
	}

	/**
	 * Resolve any remaining intersections - with hair's width spacing
	 */
	resolveIntersections(tags) {
		for (let i = 0; i < tags.length; i++) {
			const tagA = tags[i];
			if (!tagA || !this.tagData.has(tagA.id)) continue;
			const dataA = this.tagData.get(tagA.id);
			
			for (let j = i + 1; j < tags.length; j++) {
				const tagB = tags[j];
				if (!tagB || !this.tagData.has(tagB.id)) continue;
				const dataB = this.tagData.get(tagB.id);

				// Skip if not intersecting
				if (!dataA.bbox.intersectsBox(dataB.bbox)) continue;

				// Calculate separation vector
				const posA = tagA.mesh.position;
				const posB = tagB.mesh.position;
				const direction = new THREE.Vector3().subVectors(posA, posB);
				
				if (direction.lengthSq() < 0.0001) {
					direction.set(0.001, 0.002, 0.001);
				}
				
				direction.normalize();
				
				// Reduced vertical priority for more organic look
				if (Math.abs(direction.y) > 0.5) {
					direction.y *= this.config.verticalPriority;
					direction.normalize();
				}
				
				// Calculate overlap - reduced factor for tighter packing
				const sizeA = this.getTagSize(dataA.bbox);
				const sizeB = this.getTagSize(dataB.bbox);
				const minSeparation = (sizeA + sizeB) * 0.35 + this.config.tagSeparation;
				const currentDist = posA.distanceTo(posB);
				const overlap = Math.max(0, minSeparation - currentDist);

				if (overlap > 0) {
					// Calculate separation amounts
					const totalInverseMass = 1/dataA.mass + 1/dataB.mass;
					const moveA = overlap * (1/dataA.mass) / totalInverseMass;
					const moveB = overlap * (1/dataB.mass) / totalInverseMass;
					
					// Separate without velocity
					posA.addScaledVector(direction, moveA * 0.5);
					posB.addScaledVector(direction, -moveB * 0.5);
					
					// Update matrices
					tagA.mesh.updateMatrix();
					tagB.mesh.updateMatrix();
					
					// Mark as unsettled
					dataA.isSettled = dataB.isSettled = false;
				}
			}
		}
	}

	/**
	 * Calculate mass based on volume and importance
	 */
	calculateMass(tag) {
		const bbox = new THREE.Box3().setFromObject(tag.mesh);
		const size = new THREE.Vector3();
		bbox.getSize(size);
		
		const volume = size.x * size.y * size.z;
		const importance = tag.visualImportance || 1.0;
		
		return Math.max(volume * importance, 0.01);
	}

	/**
	 * Update debug visualization if enabled
	 */
	updateDebugVisualization() {
		// Remove existing helper
		if (this.debug.cubeHelper && this.debug.cubeHelper.parent) {
			this.debug.cubeHelper.parent.remove(this.debug.cubeHelper);
		}
		
		// Create cube visualization
		const cubeSize = this.cubeSize;
		const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
		const material = new THREE.MeshBasicMaterial({
			color: 0x00ff00, 
			wireframe: true,
			transparent: true,
			opacity: 0.2
		});
		
		this.debug.cubeHelper = new THREE.Mesh(geometry, material);
		this.debug.cubeHelper.position.copy(this.cubeCentre);
		this.debug.cubeHelper.quaternion.copy(this.cubeOrientation);
		
		this.scene.add(this.debug.cubeHelper);
	}

	/**
	 * Organize tags on cube surface
	 */
	applySurfaceForces(tags, dt) {
		// Group tags by face
		const faceTags = [[], [], [], [], [], []];
		
		for (const tag of tags) {
			if (!tag || !tag.mesh || !this.tagData.has(tag.id)) continue;
			const data = this.tagData.get(tag.id);

			if (data.face >= 0 && data.face < 6) {
				faceTags[data.face].push(tag);
			}
		}
		
		// Process each face
		for (let face = 0; face < 6; face++) {
			this.organizeFaceTags(faceTags[face], face, dt);
		}
	}

	/**
	 * Organize tags on a specific cube face for optimal distribution
	 * @param {Array} faceTags - Array of tags on this face
	 * @param {number} faceIndex - Index of the face (0-5)
	 * @param {number} dt - Time delta for physics calculations
	 */
	organizeFaceTags(faceTags, faceIndex, dt) {
		if (!faceTags || faceTags.length === 0) return;
		
		// Get face normal direction
		const faceDir = this.faceDirections[faceIndex];
		
		// Create perpendicular axes for organization
		const up = new THREE.Vector3(0, 1, 0);
		if (Math.abs(faceDir.dot(up)) > 0.9) {
			// For top/bottom faces, use X axis
			up.set(1, 0, 0);
		}
		
		const right = new THREE.Vector3().crossVectors(up, faceDir).normalize();
		const perpUp = new THREE.Vector3().crossVectors(faceDir, right).normalize();
		
		// Calculate target position for each tag on the face
		for (let i = 0; i < faceTags.length; i++) {
			const tag = faceTags[i];
			if (!tag || !tag.mesh || !this.tagData.has(tag.id)) continue;
			const data = this.tagData.get(tag.id);
			
			// Skip tags in active chains
			if (data.chainProcessed) continue;
			
			// Calculate position relative to cube center and project onto face plane
			const relPos = new THREE.Vector3().subVectors(tag.mesh.position, this.cubeCentre);
			
			// Project onto face plane
			const distAlongNormal = relPos.dot(faceDir);
			const projectedPos = new THREE.Vector3().copy(relPos)
				.addScaledVector(faceDir, -distAlongNormal);
			
			// Calculate target position - keep the same projected position but at correct distance
			const targetDist = this.cubeSize * 0.5;
			const targetPos = new THREE.Vector3().copy(projectedPos).normalize()
				.multiplyScalar(targetDist)
				.add(this.cubeCentre);
			
			// For balancing, apply slight force to distribute tags more evenly
			for (let j = 0; j < faceTags.length; j++) {
				if (i === j) continue;
				
				const otherTag = faceTags[j];
				if (!otherTag || !otherTag.mesh) continue;
				
				// Calculate 2D separation on face plane
				const otherRelPos = new THREE.Vector3().subVectors(otherTag.mesh.position, this.cubeCentre);
				const otherProjPos = new THREE.Vector3().copy(otherRelPos)
					.addScaledVector(faceDir, -otherRelPos.dot(faceDir));
				
				const separation = new THREE.Vector3().subVectors(projectedPos, otherProjPos);
				const dist = separation.length();
				
				if (dist < 0.001) continue; // Skip if too close to avoid division by zero
				
				// Apply repulsion along face plane
				const repulsionStrength = Math.min(0.5, 0.2 / Math.max(0.1, dist));
				const repulsionDir = separation.normalize();
				
				// Apply force primarily in the plane of the face
				targetPos.addScaledVector(repulsionDir, repulsionStrength * this.config.faceBalancing);
			}
			
			// Create movement vector towards target
			const moveDir = new THREE.Vector3().subVectors(targetPos, tag.mesh.position);
			const moveDist = moveDir.length();
			
			if (moveDist > 0.001) {
				moveDir.normalize();
				
				// Apply force primarily along tag's movement axis
				const axisAlignment = moveDir.dot(data.movementAxis);
				const axisAlignedForce = data.movementAxis.clone()
					.multiplyScalar(axisAlignment * this.config.surfaceAttraction);
				
				// Add small lateral force component
				const lateralForce = moveDir.clone().multiplyScalar(this.config.surfaceAttraction * 0.3);
				
				// Apply force with priority to axis-aligned movement
				data.velocity.addScaledVector(axisAlignedForce, dt * 2.0 / data.mass);
				data.velocity.addScaledVector(lateralForce, dt * 0.5 / data.mass);
			}
		}
	}
} 