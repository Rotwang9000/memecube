/**
 * TagPhysics - Physics engine for tag movement and positioning
 * Implements cube structure, collision detection, and force calculations
 * Handles tag entry animations, movement chains, and structure maintenance
 */

import * as THREE from 'three';

// Directions for tag orientations (6 cube faces)
const DIRECTIONS = {
	FRONT: new THREE.Vector3(0, 0, 1),
	BACK: new THREE.Vector3(0, 0, -1),
	LEFT: new THREE.Vector3(-1, 0, 0),
	RIGHT: new THREE.Vector3(1, 0, 0),
	TOP: new THREE.Vector3(0, 1, 0),
	BOTTOM: new THREE.Vector3(0, -1, 0)
};

// Cube face tracking
const CUBE_FACES = {
	FRONT: 'front',
	BACK: 'back',
	LEFT: 'left',
	RIGHT: 'right',
	TOP: 'top',
	BOTTOM: 'bottom'
};

// Interlocking configuration for tag positioning
const INTERLOCKING = {
	ENABLED: true,
	SNAP_THRESHOLD: 0.5,       // Distance at which tags snap together (increased from 0.3)
	SNAP_STRENGTH: 2.0,        // Strength of the snapping force (increased from 1.2)
	INTERLOCKING_FORCE: 1.5,   // Force pulling interlocked tags together (increased from 0.8)
	MAX_CONNECTIONS: 8,        // Maximum number of connections per tag (increased from 6)
	CONNECTION_MEMORY: 10000,  // How long connections are remembered (ms) (increased from 5000)
	DEPTH_RATIO: 0.85          // Tag depth as percentage of height (85%)
};

export class TagPhysics {
	/**
	 * Create a new TagPhysics engine
	 * @param {THREE.Scene} scene - Three.js scene
	 * @param {Object} options - Configuration options
	 */
	constructor(scene, options = {}) {
		// Store reference to scene
		this.scene = scene;
		
		// Configuration
		this.options = {
			tagSpacing: -0.15,        // Negative spacing for interlocking (increased overlap from -0.05)
			maxSpeed: 2.0,            // Max tag speed (meters/second)
			damping: 0.95,            // Velocity damping factor (0-1)
			entrySpeed: 0.5,          // Speed of tags entering the structure
			entryDistance: 15.0,      // Distance from center where tags start entering (reduced from 20.0)
			collisionElasticity: 0.05, // Elasticity of collisions (reduced from 0.1)
			centralAttractionForce: 0.35, // Force pulling tags toward center (increased from 0.2)
			faceBalancingForce: 0.2,  // Force encouraging even tag distribution (reduced from 0.3)
			interlockingEnabled: INTERLOCKING.ENABLED, // Whether tags interlock
			...options
		};
		
		// Physics data tracking for each tag
		this.tags = new Map();
		
		// Cube face usage tracking
		this.faceUsage = {
			[CUBE_FACES.FRONT]: 0,
			[CUBE_FACES.BACK]: 0,
			[CUBE_FACES.LEFT]: 0,
			[CUBE_FACES.RIGHT]: 0,
			[CUBE_FACES.TOP]: 0,
			[CUBE_FACES.BOTTOM]: 0
		};
		
		// Collision chain tracking
		this.movingTags = new Set();
		this.collisionChain = new Map();
		
		// Interlocking connections between tags
		this.connections = new Map();
		
		// Debug visualization
		this.debug = options.debug || false;
		this.debugObjects = [];
		
		// Timer for physics updates
		this.lastUpdateTime = Date.now();
		
		// Initialize helpers
		this.initHelpers();
	}
	
	/**
	 * Initialize physics helpers
	 */
	initHelpers() {
		// Collision shape helper - uses box3 for collision detection
		this.getTagBoundingBox = (tag) => {
			if (!tag || !tag.mesh) return null;
			
			// Get tag geometry bounds
			const box = new THREE.Box3().setFromObject(tag.mesh);
			
			// Add spacing to box (hair's width)
			const spacing = this.options.tagSpacing;
			box.min.x -= spacing;
			box.min.y -= spacing;
			box.min.z -= spacing;
			box.max.x += spacing;
			box.max.y += spacing;
			box.max.z += spacing;
			
			return box;
		};
		
		// Face identification helper - determines which cube face a tag belongs to
		this.getTagFace = (tag) => {
			if (!tag || !tag.mesh) return CUBE_FACES.FRONT;
			
			// Get tag direction (using position as proxy for orientation)
			const position = tag.mesh.position;
			const distFromCenter = position.length();
			
			// If too close to center, use velocity to determine face
			if (distFromCenter < 0.1) {
				const tagData = this.tags.get(tag.id);
				if (tagData && tagData.velocity.length() > 0.01) {
					const vel = tagData.velocity.clone().normalize();
					
					// Find face based on velocity
					return this.getFaceFromDirection(vel);
				}
			}
			
			// Determine face based on position
			// Which coordinate has the highest absolute value?
			const absX = Math.abs(position.x);
			const absY = Math.abs(position.y);
			const absZ = Math.abs(position.z);
			
			if (absX >= absY && absX >= absZ) {
				return position.x >= 0 ? CUBE_FACES.RIGHT : CUBE_FACES.LEFT;
			} else if (absY >= absX && absY >= absZ) {
				return position.y >= 0 ? CUBE_FACES.TOP : CUBE_FACES.BOTTOM;
			} else {
				return position.z >= 0 ? CUBE_FACES.FRONT : CUBE_FACES.BACK;
			}
		};
		
		// Helper to get a face from a direction vector
		this.getFaceFromDirection = (direction) => {
			// Get the closest face based on dot product
			let maxDot = -Infinity;
			let bestFace = CUBE_FACES.FRONT;
			
			for (const [face, dirVector] of Object.entries(DIRECTIONS)) {
				const dot = direction.dot(dirVector);
				if (dot > maxDot) {
					maxDot = dot;
					bestFace = CUBE_FACES[face];
				}
			}
			
			return bestFace;
		};
		
		// Helper to get a direction vector from a face
		this.getDirectionFromFace = (face) => {
			switch (face) {
				case CUBE_FACES.FRONT: return DIRECTIONS.FRONT.clone();
				case CUBE_FACES.BACK: return DIRECTIONS.BACK.clone();
				case CUBE_FACES.LEFT: return DIRECTIONS.LEFT.clone();
				case CUBE_FACES.RIGHT: return DIRECTIONS.RIGHT.clone();
				case CUBE_FACES.TOP: return DIRECTIONS.TOP.clone();
				case CUBE_FACES.BOTTOM: return DIRECTIONS.BOTTOM.clone();
				default: return DIRECTIONS.FRONT.clone();
			}
		};
		
		// Helper to get rotation quaternion for tag based on face
		this.getRotationForFace = (face) => {
			const quaternion = new THREE.Quaternion();
			
			switch (face) {
				case CUBE_FACES.FRONT:
					// Default orientation
					quaternion.setFromEuler(new THREE.Euler(0, 0, 0));
					break;
				case CUBE_FACES.BACK:
					// Rotate 180° around Y
					quaternion.setFromEuler(new THREE.Euler(0, Math.PI, 0));
					break;
				case CUBE_FACES.LEFT:
					// Rotate 90° around Y
					quaternion.setFromEuler(new THREE.Euler(0, -Math.PI/2, 0));
					break;
				case CUBE_FACES.RIGHT:
					// Rotate -90° around Y
					quaternion.setFromEuler(new THREE.Euler(0, Math.PI/2, 0));
					break;
				case CUBE_FACES.TOP:
					// Rotate -90° around X
					quaternion.setFromEuler(new THREE.Euler(-Math.PI/2, 0, 0));
					break;
				case CUBE_FACES.BOTTOM:
					// Rotate 90° around X
					quaternion.setFromEuler(new THREE.Euler(Math.PI/2, 0, 0));
					break;
			}
			
			return quaternion;
		};
	}
	
	/**
	 * Add a new tag to the physics system
	 * @param {Object} tag - Tag to add
	 * @param {Array} existingTags - All existing tags
	 * @returns {boolean} - Whether addition was successful
	 */
	addNewTag(tag, existingTags) {
		if (!tag || !tag.mesh) return false;
		
		// Create physics data for this tag
		const physicsData = {
			position: tag.mesh.position.clone(),
			velocity: new THREE.Vector3(),
			acceleration: new THREE.Vector3(),
			mass: this.calculateTagMass(tag),
			size: tag.mesh.scale.x,
			activationTime: Date.now(),
			isActive: false,
			isEntering: true,
			entryProgress: 0,
			lastCollisionTime: 0,
			face: null
		};
		
		// Select a cube face for the tag, prioritizing less used faces
		physicsData.face = this.selectTargetFace();
		
		// Increment face usage count
		this.faceUsage[physicsData.face]++;
		
		// Set initial position far away from center
		const entryDirection = this.getDirectionFromFace(physicsData.face);
		
		// Apply random variation to entry direction (small angle)
		const randomVariation = new THREE.Vector3(
			(Math.random() - 0.5) * 0.2,
			(Math.random() - 0.5) * 0.2,
			(Math.random() - 0.5) * 0.2
		);
		entryDirection.add(randomVariation).normalize();
		
		// Set entry position far outside the structure
		const entryPosition = entryDirection.clone().multiplyScalar(this.options.entryDistance);
		tag.mesh.position.copy(entryPosition);
		
		// Set entry velocity toward center
		const entryVelocity = entryDirection.clone().negate().multiplyScalar(this.options.entrySpeed);
		physicsData.velocity.copy(entryVelocity);
		
		// Set tag rotation based on face
		tag.mesh.quaternion.copy(this.getRotationForFace(physicsData.face));
		
		// Store physics data
		this.tags.set(tag.id, physicsData);
		
		// For the first tag, place it at the center
		if (existingTags.length === 1) {
			tag.mesh.position.set(0, 0, 0);
			physicsData.velocity.set(0, 0, 0);
			physicsData.isEntering = false;
			physicsData.isActive = true;
		}
		
		return true;
	}
	
	/**
	 * Remove a tag from the physics system
	 * @param {string} tagId - ID of tag to remove
	 * @returns {boolean} - Whether removal was successful
	 */
	removeTag(tagId) {
		// Get tag data
		const tagData = this.tags.get(tagId);
		if (!tagData) return false;
		
		// Decrement face usage count
		if (tagData.face) {
			this.faceUsage[tagData.face]--;
		}
		
		// Remove from physics data
		this.tags.delete(tagId);
		
		// Remove from moving tags and collision chain
		this.movingTags.delete(tagId);
		this.collisionChain.delete(tagId);
		
		return true;
	}
	
	/**
	 * Handle tag resizing
	 * @param {Object} tag - Tag to resize
	 * @param {number} newSize - New tag size
	 * @returns {boolean} - Whether resize was successful
	 */
	handleTagResize(tag, newSize) {
		if (!tag || !tag.mesh) return false;
		
		// Get tag data
		const tagData = this.tags.get(tag.id);
		if (!tagData) return false;
		
		// Store old size
		const oldSize = tagData.size;
		
		// Update physics properties
		tagData.size = newSize;
		tagData.mass = this.calculateTagMass(tag);
		
		// Apply new scale to the mesh
		tag.mesh.scale.set(newSize, newSize, newSize);
		
		// If this is a significant size change, activate physics response
		if (Math.abs(newSize - oldSize) / oldSize > 0.1) {
			this.activateTag(tag.id);
			
			// Add a small outward push if growing, inward if shrinking
			const direction = tag.mesh.position.clone().normalize();
			const pushMagnitude = (newSize - oldSize) * 2.0;
			const push = direction.multiplyScalar(pushMagnitude);
			
			tagData.velocity.add(push);
		}
		
		return true;
	}
	
	/**
	 * Calculate mass for a tag based on its size and other properties
	 * @param {Object} tag - Tag to calculate mass for
	 * @returns {number} - Calculated mass
	 */
	calculateTagMass(tag) {
		if (!tag || !tag.mesh) return 1.0;
		
		// Base mass on size (scale)
		const size = tag.mesh.scale.x;
		
		// Mass increases with the cube of size (volume)
		return Math.pow(size, 3);
	}
	
	/**
	 * Select the best face to place a new tag on
	 * @returns {string} - Selected face
	 */
	selectTargetFace() {
		// Find the face with lowest usage
		let lowestUsage = Infinity;
		let lowestFace = CUBE_FACES.FRONT;
		
		for (const [face, usage] of Object.entries(this.faceUsage)) {
			if (usage < lowestUsage) {
				lowestUsage = usage;
				lowestFace = face;
			}
		}
		
		// If there's a tie, add some randomness
		const tiedFaces = Object.entries(this.faceUsage)
			.filter(([_, usage]) => usage === lowestUsage)
			.map(([face, _]) => face);
		
		if (tiedFaces.length > 1) {
			// Randomly select among tied faces
			return tiedFaces[Math.floor(Math.random() * tiedFaces.length)];
		}
		
		return lowestFace;
	}
	
	/**
	 * Activate a tag for physics updates
	 * @param {string} tagId - ID of tag to activate
	 */
	activateTag(tagId) {
		const tagData = this.tags.get(tagId);
		if (!tagData) return;
		
		tagData.isActive = true;
		tagData.lastActivationTime = Date.now();
		this.movingTags.add(tagId);
	}
	
	/**
	 * Update physics for all tags
	 * @returns {boolean} - Whether update was successful
	 */
	update() {
		// Calculate delta time (capped to prevent giant jumps if tab was inactive)
		const now = Date.now();
		const dt = Math.min((now - this.lastUpdateTime) / 1000, 0.1);
		this.lastUpdateTime = now;
		
		// Process each tag
		for (const [tagId, tagData] of this.tags.entries()) {
			// Skip inactive tags
			if (!tagData.isActive && !tagData.isEntering) continue;
			
			// Get tag object from scene
			const tag = this.getTagById(tagId);
			if (!tag || !tag.mesh) continue;
			
			// Handle entry phase
			if (tagData.isEntering) {
				this.updateTagEntry(tag, tagData, dt);
				continue;
			}
			
			// Apply forces
			this.applyForces(tag, tagData, dt);
			
			// Update velocity
			tagData.velocity.add(tagData.acceleration.clone().multiplyScalar(dt));
			
			// Apply damping
			tagData.velocity.multiplyScalar(Math.pow(this.options.damping, dt));
			
			// Cap maximum speed
			const speed = tagData.velocity.length();
			if (speed > this.options.maxSpeed) {
				tagData.velocity.multiplyScalar(this.options.maxSpeed / speed);
			}
			
			// Update position
			const movement = tagData.velocity.clone().multiplyScalar(dt);
			tag.mesh.position.add(movement);
			
			// Reset acceleration
			tagData.acceleration.set(0, 0, 0);
			
			// Check for collisions
			this.checkAndResolveCollisions(tag, tagData);
			
			// Check if tag has stopped moving
			if (tagData.velocity.lengthSq() < 0.001 && tagData.acceleration.lengthSq() < 0.001) {
				tagData.isActive = false;
				this.movingTags.delete(tagId);
			}
		}
		
		// Update debug visualization
		if (this.debug) {
			this.updateDebugVisualizations();
		}
		
		return true;
	}
	
	/**
	 * Update a tag during its entry phase
	 * @param {Object} tag - Tag being updated
	 * @param {Object} tagData - Physics data for tag
	 * @param {number} dt - Delta time in seconds
	 */
	updateTagEntry(tag, tagData, dt) {
		// Check if tag is near the structure
		const distanceToCenter = tag.mesh.position.length();
		
		// When tag gets close enough to the center, check for collisions
		if (distanceToCenter < 5.0) {
			// Check for collisions with existing tags
			const collisionResult = this.findCollisions(tag);
			
			if (collisionResult.hasCollision) {
				// End entry phase
				tagData.isEntering = false;
				tagData.isActive = true;
				
				// Apply collision response
				this.resolveCollisions(tag, tagData, collisionResult.collisions);
			} else if (distanceToCenter < 2.0) {
				// If we're close to center but haven't hit anything,
				// end entry phase and apply a small random force
				tagData.isEntering = false;
				tagData.isActive = true;
				
				// Slow down and apply small random force
				tagData.velocity.multiplyScalar(0.2);
				
				const randomForce = new THREE.Vector3(
					(Math.random() - 0.5) * 0.5,
					(Math.random() - 0.5) * 0.5,
					(Math.random() - 0.5) * 0.5
				);
				
				tagData.acceleration.add(randomForce);
			}
		}
		
		// Continue moving tag during entry
		tag.mesh.position.add(tagData.velocity.clone().multiplyScalar(dt));
	}
	
	/**
	 * Apply forces to a tag
	 * @param {Object} tag - Tag to apply forces to
	 * @param {Object} tagData - Physics data for tag
	 * @param {number} dt - Delta time in seconds
	 */
	applyForces(tag, tagData, dt) {
		// Get current time
		const now = Date.now();
		
		// 1. Central attraction force (stronger pull toward center)
		const toCenter = new THREE.Vector3().sub(tag.mesh.position);
		const distanceToCenter = tag.mesh.position.length();
		
		// Scale force with distance - increased by 50%
		const centralForceMagnitude = this.options.centralAttractionForce * distanceToCenter * 1.5;
		const centralForce = toCenter.normalize().multiplyScalar(centralForceMagnitude);
		
		tagData.acceleration.add(centralForce);
		
		// 2. Face balancing force (encourage even distribution)
		// Get current face and expected position
		const currentFace = tagData.face;
		const faceDirection = this.getDirectionFromFace(currentFace);
		
		// Calculate ideal distance from center based on tag's age
		// Older tags should be closer to center
		const age = (now - tagData.activationTime) / 1000; // seconds
		const maxAge = 300; // 5 minutes
		const normalizedAge = Math.min(age / maxAge, 1);
		
		// Larger tags should be farther out
		const sizeFactor = tagData.size;
		
		// Base distance (0.5 - 3.0 units) - reduced from (1.0 - 5.0)
		const idealDistance = (0.5 + 2.5 * (1 - normalizedAge)) * sizeFactor;
		
		// Create force toward the ideal position on the face
		const idealPosition = faceDirection.clone().multiplyScalar(idealDistance);
		const toIdealPosition = idealPosition.clone().sub(tag.mesh.position);
		
		const faceForce = toIdealPosition.multiplyScalar(this.options.faceBalancingForce);
		tagData.acceleration.add(faceForce);
		
		// 3. Apply interlocking forces to connected tags
		if (this.options.interlockingEnabled) {
			this.applyInterlockingForces(tag, tagData);
		}
	}
	
	/**
	 * Calculate ideal distance based on tag sizes (for interlocking)
	 * @param {Object} tagData - First tag data
	 * @param {Object} otherData - Second tag data
	 * @param {THREE.Vector3} direction - Direction vector between tags
	 * @returns {number} - Ideal distance for interlocking
	 */
	calculateIdealDistance(tagData, otherData, direction) {
		const tagSize = tagData.size;
		const otherSize = otherData.size;
		
		// Determine if we're connecting on depth axis
		const isDepthAxis = this.isDepthAxis(tagData.face, direction);
		const otherIsDepthAxis = this.isDepthAxis(otherData.face, direction.clone().negate());
		
		// Apply depth ratio if connecting on depth axis
		// Reduced contribution factor from 0.45 to 0.35 to create tighter interlocking
		const tagContribution = tagSize * (isDepthAxis ? INTERLOCKING.DEPTH_RATIO : 1.0) * 0.35;
		const otherContribution = otherSize * (otherIsDepthAxis ? INTERLOCKING.DEPTH_RATIO : 1.0) * 0.35;
		
		// Return combined distance with additional reduction factor for tighter clustering
		return (tagContribution + otherContribution) * 0.9;
	}
	
	/**
	 * Determine if a connection is along the depth axis of a tag
	 * @param {string} face - Face the tag is on
	 * @param {THREE.Vector3} direction - Direction to check
	 * @returns {boolean} - Whether direction is along depth axis
	 */
	isDepthAxis(face, direction) {
		// Get face normal
		const faceNormal = this.getDirectionFromFace(face);
		
		// Dot product close to 1 or -1 means aligned with face normal (depth axis)
		const dot = Math.abs(faceNormal.dot(direction));
		return dot > 0.7; // Threshold for considering it aligned with depth
	}
	
	/**
	 * Apply interlocking forces to keep connected tags together
	 * @param {Object} tag - Tag to apply forces to
	 * @param {Object} tagData - Physics data for tag
	 */
	applyInterlockingForces(tag, tagData) {
		// Skip if tag has no connections
		const tagConnections = this.connections.get(tag.id);
		if (!tagConnections || tagConnections.length === 0) return;
		
		// Current time for pruning old connections
		const now = Date.now();
		
		// Process each connection
		const activeConnections = tagConnections.filter(conn => now - conn.timestamp < INTERLOCKING.CONNECTION_MEMORY);
		
		// Update connections list (prune old ones)
		this.connections.set(tag.id, activeConnections);
		
		// Apply interlocking forces for each active connection
		for (const connection of activeConnections) {
			const otherTag = this.getTagById(connection.otherId);
			if (!otherTag || !otherTag.mesh) continue;
			
			const otherData = this.tags.get(connection.otherId);
			if (!otherData) continue;
			
			// Vector from this tag to other tag
			const toOther = otherTag.mesh.position.clone().sub(tag.mesh.position);
			const distance = toOther.length();
			
			// Calculate ideal distance based on tag sizes and direction
			const idealDistance = this.calculateIdealDistance(tagData, otherData, toOther.clone().normalize());
			
			// Calculate interlocking force - pulls tags to ideal distance
			const interlockingForce = toOther.normalize().multiplyScalar(
				(distance - idealDistance) * INTERLOCKING.INTERLOCKING_FORCE
			);
			
			// Apply force to both tags
			tagData.acceleration.add(interlockingForce);
			
			// Also apply rotational alignment force to keep tags properly oriented
			this.alignTagRotation(tag, tagData, otherTag, otherData, connection.normal);
		}
	}
	
	/**
	 * Align tag rotation to interlock with neighboring tags
	 * @param {Object} tag - Tag to align
	 * @param {Object} tagData - Physics data for tag
	 * @param {Object} otherTag - Other tag to align with
	 * @param {Object} otherData - Physics data for other tag
	 * @param {THREE.Vector3} contactNormal - Normal vector at contact point
	 */
	alignTagRotation(tag, tagData, otherTag, otherData, contactNormal) {
		// Get current face directions
		const thisDirection = this.getDirectionFromFace(tagData.face);
		const otherDirection = this.getDirectionFromFace(otherData.face);
		
		// For interlocking, tags should align with contact normal
		// We use a small quaternion adjustment to rotate toward alignment
		
		// Calculate target orientation based on contact normal
		const targetNormal = contactNormal.clone().negate(); // We want to face toward the other tag
		
		// Create rotation to align with target normal
		const currentRotation = tag.mesh.quaternion.clone();
		const targetRotation = this.getRotationForFace(this.getFaceFromDirection(targetNormal));
		
		// Lerp toward target rotation (small adjustment per frame)
		const newRotation = currentRotation.clone().slerp(targetRotation, 0.02);
		tag.mesh.quaternion.copy(newRotation);
	}
	
	/**
	 * Check for and resolve collisions for a tag
	 * @param {Object} tag - Tag to check collisions for
	 * @param {Object} tagData - Physics data for tag
	 */
	checkAndResolveCollisions(tag, tagData) {
		// Skip if this tag is in a collision cooldown
		const now = Date.now();
		if (now - tagData.lastCollisionTime < 50) return;
		
		// Find collisions
		const collisionResult = this.findCollisions(tag);
		
		// Resolve if there are collisions
		if (collisionResult.hasCollision) {
			tagData.lastCollisionTime = now;
			this.resolveCollisions(tag, tagData, collisionResult.collisions);
			
			// Make sure tag stays active
			tagData.isActive = true;
			
			// Record interlocking connections if enabled
			if (this.options.interlockingEnabled) {
				this.recordConnections(tag, collisionResult.collisions);
			}
		}
	}
	
	/**
	 * Record connections between interlocking tags
	 * @param {Object} tag - Tag with collisions
	 * @param {Array} collisions - Collision data
	 */
	recordConnections(tag, collisions) {
		if (!tag || !collisions || collisions.length === 0) return;
		
		// Get current connections for this tag
		let tagConnections = this.connections.get(tag.id) || [];
		
		// Process each collision as a potential connection
		for (const collision of collisions) {
			const otherTag = collision.tag;
			const normal = collision.normal;
			
			// Skip if we already have too many connections
			if (tagConnections.length >= INTERLOCKING.MAX_CONNECTIONS) break;
			
			// Check if we already have this connection
			const existingIndex = tagConnections.findIndex(conn => conn.otherId === otherTag.id);
			
			if (existingIndex >= 0) {
				// Update existing connection
				tagConnections[existingIndex].timestamp = Date.now();
				tagConnections[existingIndex].normal = normal;
			} else {
				// Add new connection
				tagConnections.push({
					otherId: otherTag.id,
					normal: normal,
					timestamp: Date.now()
				});
			}
			
			// Also record the connection for the other tag
			this.recordReciprocalConnection(otherTag.id, tag.id, normal.clone().negate());
		}
		
		// Update connections for this tag
		this.connections.set(tag.id, tagConnections);
	}
	
	/**
	 * Record reciprocal connection for the other tag
	 * @param {string} tagId - Tag ID
	 * @param {string} otherId - Other tag ID
	 * @param {THREE.Vector3} normal - Normal vector at contact point
	 */
	recordReciprocalConnection(tagId, otherId, normal) {
		// Get current connections for the other tag
		let otherConnections = this.connections.get(tagId) || [];
		
		// Check if connection already exists
		const existingIndex = otherConnections.findIndex(conn => conn.otherId === otherId);
		
		if (existingIndex >= 0) {
			// Update existing connection
			otherConnections[existingIndex].timestamp = Date.now();
			otherConnections[existingIndex].normal = normal;
		} else {
			// Add new connection if not at max
			if (otherConnections.length < INTERLOCKING.MAX_CONNECTIONS) {
				otherConnections.push({
					otherId: otherId,
					normal: normal,
					timestamp: Date.now()
				});
			}
		}
		
		// Update connections for the other tag
		this.connections.set(tagId, otherConnections);
	}
	
	/**
	 * Find collisions for a tag
	 * @param {Object} tag - Tag to check
	 * @returns {Object} - Collision result
	 */
	findCollisions(tag) {
		if (!tag || !tag.mesh) {
			return { hasCollision: false, collisions: [] };
		}
		
		// Get tag bounding box
		const tagBox = this.getTagBoundingBox(tag);
		if (!tagBox) {
			return { hasCollision: false, collisions: [] };
		}
		
		// Track collisions
		const collisions = [];
		
		// Check against all other tags
		for (const [otherId, otherData] of this.tags.entries()) {
			// Skip self
			if (otherId === tag.id) continue;
			
			// Get other tag
			const otherTag = this.getTagById(otherId);
			if (!otherTag || !otherTag.mesh) continue;
			
			// Get other tag's bounding box
			const otherBox = this.getTagBoundingBox(otherTag);
			if (!otherBox) continue;
			
			// Check for intersection
			if (tagBox.intersectsBox(otherBox)) {
				// Calculate penetration depth
				const center1 = new THREE.Vector3();
				const center2 = new THREE.Vector3();
				tagBox.getCenter(center1);
				otherBox.getCenter(center2);
				
				// Get vector from center1 to center2
				const penetrationVector = center2.clone().sub(center1);
				
				// Get tag size and other tag size
				const tagSize = tagBox.getSize(new THREE.Vector3());
				const otherSize = otherBox.getSize(new THREE.Vector3());
				
				// Calculate penetration depth along each axis
				const penetrationX = (tagSize.x + otherSize.x) / 2 - Math.abs(penetrationVector.x);
				const penetrationY = (tagSize.y + otherSize.y) / 2 - Math.abs(penetrationVector.y);
				const penetrationZ = (tagSize.z + otherSize.z) / 2 - Math.abs(penetrationVector.z);
				
				// Use the smallest penetration axis
				let axis = 'x';
				let minPenetration = penetrationX;
				
				if (penetrationY < minPenetration) {
					axis = 'y';
					minPenetration = penetrationY;
				}
				
				if (penetrationZ < minPenetration) {
					axis = 'z';
					minPenetration = penetrationZ;
				}
				
				// Create normal based on axis
				const normal = new THREE.Vector3();
				normal[axis] = Math.sign(penetrationVector[axis]);
				
				// Add collision
				collisions.push({
					tag: otherTag,
					data: otherData,
					normal: normal,
					penetration: minPenetration
				});
			}
		}
		
		return {
			hasCollision: collisions.length > 0,
			collisions
		};
	}
	
	/**
	 * Resolve collisions for a tag
	 * @param {Object} tag - Tag with collisions
	 * @param {Object} tagData - Physics data for tag
	 * @param {Array} collisions - Collision data
	 */
	resolveCollisions(tag, tagData, collisions) {
		if (!tag || !tag.mesh || !collisions || collisions.length === 0) return;
		
		// Process each collision
		for (const collision of collisions) {
			const otherTag = collision.tag;
			const otherData = collision.data;
			const normal = collision.normal;
			const penetration = collision.penetration;
			
			// Activate the other tag
			this.activateTag(otherTag.id);
			
			// Calculate relative velocity
			const relativeVelocity = tagData.velocity.clone().sub(otherData.velocity);
			
			// Calculate velocity along normal
			const normalVelocity = relativeVelocity.dot(normal);
			
			// Check for interlocking snap if enabled
			if (this.options.interlockingEnabled && Math.abs(normalVelocity) < INTERLOCKING.SNAP_THRESHOLD) {
				// Snap tags together when velocity is low
				this.snapTagsTogether(tag, tagData, otherTag, otherData, normal, penetration);
				continue;
			}
			
			// Only resolve if objects are moving toward each other
			if (normalVelocity < 0) {
				// Calculate impulse scalar
				const totalMass = tagData.mass + otherData.mass;
				const tagMassRatio = tagData.mass / totalMass;
				const otherMassRatio = otherData.mass / totalMass;
				
				// Calculate impulse
				const elasticity = this.options.collisionElasticity;
				const impulse = -(1 + elasticity) * normalVelocity;
				
				// Apply impulse
				const tagImpulse = normal.clone().multiplyScalar(impulse * otherMassRatio);
				const otherImpulse = normal.clone().multiplyScalar(-impulse * tagMassRatio);
				
				tagData.velocity.add(tagImpulse);
				otherData.velocity.add(otherImpulse);
				
				// Move objects apart to prevent sticking
				const separationVector = normal.clone().multiplyScalar(penetration);
				
				// For interlocking, use less separation
				const separationFactor = this.options.interlockingEnabled ? 0.05 : 0.1;
				
				tag.mesh.position.add(separationVector.clone().multiplyScalar(-otherMassRatio * separationFactor));
				otherTag.mesh.position.add(separationVector.clone().multiplyScalar(tagMassRatio * separationFactor));
				
				// Add to collision chain for propagation tracking
				this.collisionChain.set(otherTag.id, tag.id);
			}
		}
	}
	
	/**
	 * Snap tags together for interlocking
	 * @param {Object} tag - First tag
	 * @param {Object} tagData - Physics data for first tag
	 * @param {Object} otherTag - Second tag to snap to
	 * @param {Object} otherData - Physics data for second tag
	 * @param {THREE.Vector3} normal - Normal vector at contact point
	 * @param {number} penetration - Penetration depth
	 */
	snapTagsTogether(tag, tagData, otherTag, otherData, normal, penetration) {
		// Calculate current positions
		const tagPos = tag.mesh.position.clone();
		const otherPos = otherTag.mesh.position.clone();
		
		// Calculate vector from tag to otherTag
		const toOther = otherPos.clone().sub(tagPos).normalize();
		
		// Calculate ideal distance based on tag sizes and direction
		const idealOffset = this.calculateIdealDistance(tagData, otherData, toOther);
		
		// Calculate ideal positions
		const idealTagPos = otherPos.clone().sub(toOther.clone().multiplyScalar(idealOffset));
		const idealOtherPos = tagPos.clone().add(toOther.clone().multiplyScalar(idealOffset));
		
		// Apply snapping force based on masses
		const totalMass = tagData.mass + otherData.mass;
		const tagMassRatio = tagData.mass / totalMass;
		const otherMassRatio = otherData.mass / totalMass;
		
		// Calculate position adjustments with increased snap strength
		const snapStrength = INTERLOCKING.SNAP_STRENGTH * 1.2; // 20% stronger than the SNAP_STRENGTH value
		const tagAdjustment = idealTagPos.clone().sub(tagPos).multiplyScalar(snapStrength * otherMassRatio);
		const otherAdjustment = idealOtherPos.clone().sub(otherPos).multiplyScalar(snapStrength * tagMassRatio);
		
		// Apply position adjustments
		tag.mesh.position.add(tagAdjustment);
		otherTag.mesh.position.add(otherAdjustment);
		
		// Dampen velocities to enhance interlocking (reduced dampening factor)
		tagData.velocity.multiplyScalar(0.9);  // Changed from 0.8
		otherData.velocity.multiplyScalar(0.9); // Changed from 0.8
		
		// Apply velocity along the connection to keep tags together
		// Increase alignment force to maintain closer formation
		const normalVelocity = tagData.velocity.clone().sub(otherData.velocity).dot(toOther);
		const alignmentForce = toOther.clone().multiplyScalar(normalVelocity * 0.8); // Increased from 0.5
		tagData.velocity.add(alignmentForce);
		otherData.velocity.sub(alignmentForce);
		
		// Record connection between tags for continued interlocking
		this.recordReciprocalConnection(tag.id, otherTag.id, toOther);
	}
	
	/**
	 * Get a tag by ID
	 * @param {string} tagId - Tag ID
	 * @returns {Object|null} - Found tag or null
	 */
	getTagById(tagId) {
		// This needs to be implemented by the caller or using a reference
		// Here we assume the scene contains the tags as children
		if (!this.scene) return null;
		
		// Search for the tag in the scene children
		for (const child of this.scene.children) {
			if (child.userData && child.userData.tagId === tagId) {
				return {
					id: tagId,
					mesh: child
				};
			}
		}
		
		// Alternative implementation could maintain a reference map
		return null;
	}
	
	/**
	 * Update debug visualizations
	 */
	updateDebugVisualizations() {
		// Remove old debug objects
		this.debugObjects.forEach(obj => {
			if (obj && this.scene) {
				this.scene.remove(obj);
			}
		});
		this.debugObjects = [];
		
		if (!this.debug) return;
		
		// Create new debug objects
		for (const [tagId, tagData] of this.tags.entries()) {
			const tag = this.getTagById(tagId);
			if (!tag || !tag.mesh) continue;
			
			// Velocity vector
			if (tagData.velocity.lengthSq() > 0.001) {
				const velocityLine = new THREE.ArrowHelper(
					tagData.velocity.clone().normalize(),
					tag.mesh.position,
					tagData.velocity.length() * 2,
					0xff0000
				);
				this.scene.add(velocityLine);
				this.debugObjects.push(velocityLine);
			}
			
			// Acceleration vector
			if (tagData.acceleration.lengthSq() > 0.001) {
				const accelLine = new THREE.ArrowHelper(
					tagData.acceleration.clone().normalize(),
					tag.mesh.position,
					tagData.acceleration.length() * 5,
					0x00ff00
				);
				this.scene.add(accelLine);
				this.debugObjects.push(accelLine);
			}
			
			// Bounding box
			const box = this.getTagBoundingBox(tag);
			if (box) {
				const helper = new THREE.Box3Helper(box, 0xffff00);
				this.scene.add(helper);
				this.debugObjects.push(helper);
			}
		}
	}
	
	/**
	 * Clean up resources used by physics system
	 */
	dispose() {
		// Clear all maps and sets
		this.tags.clear();
		this.movingTags.clear();
		this.collisionChain.clear();
		this.connections.clear();
		
		// Reset face usage
		for (const face in this.faceUsage) {
			this.faceUsage[face] = 0;
		}
		
		// Clean up debug objects
		if (this.debug) {
			this.debugObjects.forEach(obj => {
				if (obj && this.scene) {
					this.scene.remove(obj);
					if (obj.geometry) obj.geometry.dispose();
					if (obj.material) obj.material.dispose();
				}
			});
			this.debugObjects = [];
		}
	}
} 