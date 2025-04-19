import * as THREE from 'three';

/**
 * TagPhysics - Proper implementation for tag positioning and interactions
 * 
 * This system creates a cohesive cube structure with tags at right angles,
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
			cubeCoherence: 0.9,        // How strongly we enforce cube structure (increased)
			tagSeparation: 0.1,        // Minimal spacing between tags (increased)
			rightAngleTolerance: 0.1,  // How strictly we enforce right angles
			
			// Movement parameters
			damping: 0.88,            // Strong damping to prevent bouncing (increased)
			maxSpeed: 0.8,            // Conservative speed limit (decreased)
			entrySpeed: 0.4,          // New tag approach speed (decreased)
			spinRate: 0.01,           // Subtle constant rotation
			
			// Force parameters
			repulsionStrength: 1.2,   // Tag repulsion force (increased)
			surfaceAttraction: 0.9,   // Pull to form outer shell (increased)
			structureStrength: 0.8,   // Force maintaining cube structure (increased)
			verticalPriority: 1.5,    // Prioritize vertical separation
			
			// Animation parameters
			resizeTime: 0.5,          // Seconds for size transitions
			settleTolerance: 0.001    // When to consider a tag settled
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
	 * Calculate orientation that aligns tag with cube structure
	 */
	calculateTagOrientation(mesh) {
		// Find closest cube face to align with
		let bestFace = 0;
		let maxAlignment = -Infinity;
		
		const tagForward = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.quaternion);
		
		for (let i = 0; i < this.faceDirections.length; i++) {
			const alignment = tagForward.dot(this.faceDirections[i]);
			if (alignment > maxAlignment) {
				maxAlignment = alignment;
				bestFace = i;
			}
		}
		
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
	 * Add a new tag that flies toward the cube structure
	 */
	addNewTag(tag, existingTags = []) {
		if (!tag || !tag.mesh) {
			console.warn("TagPhysics: Attempted to add invalid tag");
			return;
		}

		// Update cube structure info
		this.updateCubeStructure(existingTags);
		
		// Calculate spawn position
		const spawnDistance = this.calculateSpawnDistance(existingTags);
		
		// Choose best entry face 
		const targetFace = this.chooseBestEntryFace(existingTags);
		const faceDir = this.faceDirections[targetFace];
		
		// Position and orient tag
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
		
		// Entry velocity with slight randomization for naturalism
		const toCube = new THREE.Vector3()
			.subVectors(this.cubeCentre, entryPos)
			.normalize();
			
		// Add slight randomization to avoid head-on approach
		toCube.x += (Math.random() - 0.5) * 0.2;
		toCube.y += (Math.random() - 0.5) * 0.2;
		toCube.z += (Math.random() - 0.5) * 0.2;
		toCube.normalize();
		
		data.velocity.copy(toCube.multiplyScalar(this.config.entrySpeed));
	}

	/**
	 * Find best face for new tag entry
	 */
	chooseBestEntryFace(existingTags) {
		// Count tags on each face
		const faceCounts = [0, 0, 0, 0, 0, 0];
		
		for (const tag of existingTags) {
			if (!tag || !this.tagData.has(tag.id)) continue;
			const data = this.tagData.get(tag.id);
			if (data.face >= 0 && data.face < 6) {
				faceCounts[data.face]++;
			}
		}
		
		// Find face with fewest tags
		let minCount = Infinity;
		let bestFace = 0;
		
		for (let i = 0; i < 6; i++) {
			if (faceCounts[i] < minCount) {
				minCount = faceCounts[i];
				bestFace = i;
			}
		}
		
		// Add randomization (30% chance to choose random face)
		if (Math.random() < 0.3) {
			bestFace = Math.floor(Math.random() * 6);
		}
		
		return bestFace;
	}

	/**
	 * Calculate appropriate spawn distance
	 */
	calculateSpawnDistance(existingTags) {
		// Base on furthest tag plus margin
		let maxDistance = 0;
		
		for (const tag of existingTags) {
			if (!tag || !tag.mesh) continue;
			const dist = tag.mesh.position.length();
			maxDistance = Math.max(maxDistance, dist);
		}
		
		// Ensure minimum reasonable distance 
		// Changed from 1.5 to 1.2 to make tags closer together
		maxDistance = Math.max(maxDistance, this.cubeSize * 1.2);
		
		// Add smaller margin for spawning to avoid too much separation
		// Changed from 3.0 to 1.8 to bring tags in closer
		return maxDistance + 1.8;
	}

	/**
	 * Remove a tag from the physics system
	 */
	removeTag(tagId) {
		if (!this.tagData.has(tagId)) {
			console.warn(`TagPhysics: Attempted to remove non-existent tag ${tagId}`);
			return false;
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

		// Larger tags push outward, smaller pull inward
		const isGrowing = newSize > data.size.current;
		if (isGrowing) {
			// Calculate outward direction
			const outwardDir = new THREE.Vector3()
				.subVectors(tag.mesh.position, this.cubeCentre)
				.normalize();
				
			// Apply gentle outward impulse
			const impulse = Math.min(0.3, (newSize / data.size.current) - 1);
			data.velocity.addScaledVector(outwardDir, impulse);
			
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
		
		// Ensure no intersections
		this.resolveIntersections(tags);
		
		// Update debug visualization if enabled
		if (this.debug.showStructure) {
			this.updateDebugVisualization();
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
		
		// Calculate center and size
		let sum = new THREE.Vector3();
		let count = 0;
		let maxDist = 0;
		
		for (const tag of tags) {
			if (!tag || !tag.mesh) continue;
			sum.add(tag.mesh.position);
			count++;
			
			const dist = tag.mesh.position.length();
			maxDist = Math.max(maxDist, dist);
		}
		
		// Update center
		if (count > 0) {
			this.cubeCentre.copy(sum.divideScalar(count));
			
			// Adjust cube size to be tighter (changed multiplier from 1.2 to 1.1)
			this.cubeSize = Math.max(1.0, maxDist * 1.1);
			
			// Force minimum cube size based on tag count to prevent too-small clusters
			const minSizeByCount = Math.pow(count * 0.15, 1/3) + 1.0; // Cubic root scaling
			this.cubeSize = Math.max(this.cubeSize, minSizeByCount);
		}
		
		// Assign tags to faces
		this.assignTagsToFaces(tags);
	}

	/**
	 * Assign tags to appropriate cube faces
	 */
	assignTagsToFaces(tags) {
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
			
			// Calculate force based on position
			const relPos = new THREE.Vector3()
				.subVectors(tag.mesh.position, this.cubeCentre);
			const distance = relPos.length();
			
			if (data.isOnSurface) {
				// Surface tags maintain distance near cube radius
				const targetDist = this.cubeSize * 0.5;
				const distError = targetDist - distance;
				
				// Force pulls/pushes to maintain cube shape
				// Apply stronger coherence force for surface tags (multiplied by 1.5)
				const forceMag = distError * this.config.structureStrength * 1.5;
				const forceDir = relPos.clone().normalize();
				
				data.velocity.addScaledVector(forceDir, forceMag * dt / data.mass);
			} else {
				// Interior tags move toward center with stronger force
				// Increased force for interior tags to ensure tighter packing (multiplied by 2.0)
				const forceMag = distance * 0.2 * this.config.structureStrength;
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
		// Calculate target orientation
		const targetOrientation = this.calculateTagOrientation(tag.mesh);
		data.targetOrientation.copy(targetOrientation);
		
		// Smoothly interpolate toward target
		const slerpFactor = Math.min(1.0, dt * 2.0);
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
				const minSeparation = (sizeA + sizeB) * 0.5 + this.config.tagSeparation;
				
				// Apply forces if too close
				if (distance < minSeparation) {
					// Calculate repulsion strength
					const overlap = minSeparation - distance;
					let forceMag = overlap * this.config.repulsionStrength;
					
					// Prioritize vertical separation
					const verticalComponent = Math.abs(direction.y);
					if (verticalComponent > 0.5) {
						forceMag *= this.config.verticalPriority;
					}
					
					// Calculate force for each tag
					const totalMass = dataA.mass + dataB.mass;
					const forceA = forceMag * (dataB.mass / totalMass);
					const forceB = forceMag * (dataA.mass / totalMass);
					
					// Handle chain propagation
					if (dataA.chainProcessed) {
						dataB.velocity.addScaledVector(direction.negate(), forceB * dt / dataB.mass);
						this.propagateMovement(tagA.id, tagB.id);
					} else if (dataB.chainProcessed) {
						dataA.velocity.addScaledVector(direction, forceA * dt / dataA.mass);
						this.propagateMovement(tagB.id, tagA.id);
					} else {
						// Normal case - both respond
						dataA.velocity.addScaledVector(direction, forceA * dt / dataA.mass);
						dataB.velocity.addScaledVector(direction.negate(), forceB * dt / dataB.mass);
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
		// Expand for early intersection test
		const expanded1 = bbox1.clone().expandByScalar(this.config.tagSeparation);
		return expanded1.intersectsBox(bbox2);
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
	 * Arrange tags on a specific face
	 */
	organizeFaceTags(faceTags, faceIndex, dt) {
		if (faceTags.length <= 1) return;
		
		const faceNormal = this.faceDirections[faceIndex];
		
		// Find face center
		const faceCenter = this.cubeCentre.clone().addScaledVector(
			faceNormal, 
			this.cubeSize * 0.5
		);
		
		// Calculate tangent vectors
		const up = new THREE.Vector3(0, 1, 0);
		const tangent1 = new THREE.Vector3().crossVectors(up, faceNormal).normalize();
		if (tangent1.lengthSq() < 0.1) {
			// Special case for top/bottom
			tangent1.set(1, 0, 0);
		}
		const tangent2 = new THREE.Vector3().crossVectors(faceNormal, tangent1).normalize();
		
		// Apply organization forces
		for (const tagA of faceTags) {
			if (!tagA || !this.tagData.has(tagA.id)) continue;
			const dataA = this.tagData.get(tagA.id);
			
			// Calculate position in face coordinates
			const relPosA = new THREE.Vector3().subVectors(tagA.mesh.position, faceCenter);
			const proj1A = relPosA.dot(tangent1);
			const proj2A = relPosA.dot(tangent2);
			
			// Accumulate forces
			let netForce = new THREE.Vector3();
			
			for (const tagB of faceTags) {
				if (tagA === tagB) continue;
				if (!tagB || !this.tagData.has(tagB.id)) continue;
				
				// Calculate relative positioning
				const relPosB = new THREE.Vector3().subVectors(tagB.mesh.position, faceCenter);
				const proj1B = relPosB.dot(tangent1);
				const proj2B = relPosB.dot(tangent2);
				
				// Calculate separation in face space
				const deltaProj1 = proj1A - proj1B;
				const deltaProj2 = proj2A - proj2B;
				const faceDist = Math.sqrt(deltaProj1*deltaProj1 + deltaProj2*deltaProj2);
				
				if (faceDist < 0.001) continue;
				
				// Calculate organization force
				const forceMag = 0.1 / (faceDist + 0.1);
				const forceDir = new THREE.Vector3()
					.addScaledVector(tangent1, deltaProj1)
					.addScaledVector(tangent2, deltaProj2)
					.normalize();
				
				netForce.addScaledVector(forceDir, forceMag);
			}
			
			// Apply force
			dataA.velocity.addScaledVector(netForce, dt / dataA.mass);
		}
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
	 * Resolve any remaining intersections
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
				
				// Prioritize vertical separation
				if (Math.abs(direction.y) > 0.5) {
					direction.y *= this.config.verticalPriority;
					direction.normalize();
				}
				
				// Calculate overlap
				const sizeA = this.getTagSize(dataA.bbox);
				const sizeB = this.getTagSize(dataB.bbox);
				const minSeparation = (sizeA + sizeB) * 0.5 + this.config.tagSeparation;
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
} 