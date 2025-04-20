/**
 * TagPhysics - Core physics engine for tag positioning and movement
 * Enforces an interlocking cube structure with strict right-angle orientations
 */

import * as THREE from 'three';

export class TagPhysics {
    /**
     * Create a new TagPhysics instance
     * @param {THREE.Scene} scene - Three.js scene
     * @param {Object} options - Configuration options
     */
    constructor(scene, options = {}) {
        this.scene = scene;
        this.tagManager = options.tagManager || null;
        this.options = {
            cubeSize: options.initialCubeSize || 10, // Initial cube size - will adjust dynamically
            spacing: 0.005,             // Reduced to hair's width spacing between tags
            centralForce: 0.08,        // Increased force pulling tags toward center
            surfaceForce: 0.05,        // Reduced force to allow closer packing
            damping: 0.85,             // Slightly reduced damping for more responsive movement
            maxSpeed: 0.3,             // Reduced max speed for controlled movement
            collisionForce: 0.3,       // Increased collision force for tighter packing
            faceBalanceFactor: 0.5,    // Factor for balancing tags across faces
            flipAnimationDuration: 1000, // Duration in ms for flip to face animation
            ...options
        };

        // Track tags and their physics data
        this.tags = new Map();
        // Track face distribution (6 faces of a cube)
        this.faceCounts = { px: 0, nx: 0, py: 0, ny: 0, pz: 0, nz: 0 };
        // Track collision chains to prevent recursive movement
        this.collisionChains = new Set();
        // Track last update time to handle large time deltas
        this.lastUpdateTime = Date.now();
        // Track document visibility for pausing physics
        this.isDocumentVisible = true;
        // Register visibility change listener
        document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
    }

    /**
     * Add a new tag to the physics system
     * @param {Object} tag - Tag object to add
     * @param {Array} allTags - Array of all tags for collision checking
     * @returns {boolean} - Whether placement was successful
     */
    addNewTag(tag, allTags) {
        if (!tag || !tag.mesh) return false;

        // Determine which face to place the tag on (least populated)
        const targetFace = this.getLeastPopulatedFace();
        // Assign face to tag for orientation and positioning
        tag.physicsFace = targetFace;
        // Increment face count
        this.faceCounts[targetFace]++;

        // Set initial position far outside the cube at a random angle
        const initialPosition = this.getRandomSphericalPosition();
        tag.mesh.position.copy(initialPosition);

        // Set orientation to fly in on its end towards the center, aligned with a cube axis
        this.setTagFlyInOrientation(tag, initialPosition);

        // Calculate mass based on size (larger tags have more mass)
        const size = tag.mesh.scale.x;
        const mass = 1.0 + (size - 1.0) * 2.0; // Increased mass influence for larger tags

        // Calculate initial velocity aiming towards the center
        const initialVelocity = new THREE.Vector3(0, 0, 0).sub(initialPosition).normalize().multiplyScalar(this.options.maxSpeed * 0.8);

        // Compute bounding box for collision detection
        this.updateTagBoundingBox(tag);

        // Add physics data to tag
        const physicsData = {
            velocity: initialVelocity,
            force: new THREE.Vector3(0, 0, 0),
            mass: mass,
            size: size,
            isMoving: true,
            lastCollisionTime: 0,
            face: targetFace,
            targetPosition: initialPosition.clone()
        };
        this.tags.set(tag.id, physicsData);
        tag.physics = physicsData;

        // Verify that targetPosition was properly initialized
        if (!physicsData.targetPosition) {
            console.warn("Failed to initialize targetPosition in physicsData, creating now");
            physicsData.targetPosition = initialPosition.clone();
        }

        // Update cube size based on new tag
        this.updateCubeSize();

        // Check for initial collisions and adjust position if needed
        // const success = this.adjustInitialPosition(tag, allTags);
        // if (!success) {
        //     this.removeTag(tag.id);
        //     return false;
        // }

        return true;
    }

    /**
     * Get a position aligned with the specified face, far outside the cube for fly-in effect
     * @param {string} face - Face identifier (px, nx, py, ny, pz, nz)
     * @returns {THREE.Vector3} - Position aligned with the face
     */
    getFaceAlignedPosition(face) {
        const radius = this.options.cubeSize * 3; // Start far out for dramatic effect
        const offset = radius * 1.5; // Additional offset to ensure alignment far from center
        switch (face) {
            case 'px': return new THREE.Vector3(offset, 0, 0);
            case 'nx': return new THREE.Vector3(-offset, 0, 0);
            case 'py': return new THREE.Vector3(0, offset, 0);
            case 'ny': return new THREE.Vector3(0, -offset, 0);
            case 'pz': return new THREE.Vector3(0, 0, offset);
            case 'nz': return new THREE.Vector3(0, 0, -offset);
            default: return new THREE.Vector3(offset, 0, 0);
        }
    }

    /**
     * Update the cube size based on the current tags
     */
    updateCubeSize() {
        if (this.tags.size === 0) return;
        
        // Calculate average tag size and count
        let totalSize = 0;
        let maxSize = 0;
        
        for (const [tagId, physicsData] of this.tags) {
            totalSize += physicsData.size;
            maxSize = Math.max(maxSize, physicsData.size);
        }
        
        const avgSize = totalSize / this.tags.size;
        const tagCount = this.tags.size;
        
        // Calculate a dynamic cube size based on:
        // 1. Average tag size
        // 2. Number of tags (more tags need more space)
        // 3. Maximum tag size (to ensure largest tag fits)
        const baseCubeSize = Math.max(
            10, // Minimum size
            avgSize * 3 + maxSize,
            Math.cbrt(tagCount) * avgSize * 2
        );
        
        // Smooth transition to new cube size
        this.options.cubeSize = this.options.cubeSize * 0.8 + baseCubeSize * 0.2;
    }

    /**
     * Get the least populated face of the cube
     * @returns {string} - Face identifier (px, nx, py, ny, pz, nz)
     */
    getLeastPopulatedFace() {
        let minCount = Infinity;
        let targetFace = 'px';
        for (const [face, count] of Object.entries(this.faceCounts)) {
            if (count < minCount) {
                minCount = count;
                targetFace = face;
            }
        }
        return targetFace;
    }

    /**
     * Get a random spherical position far outside the cube for dramatic fly-in
     * @returns {THREE.Vector3} - Random position on a sphere
     */
    getRandomSphericalPosition() {
        const radius = this.options.cubeSize * 3; // Start far out for dramatic effect
        const theta = Math.random() * Math.PI * 2; // Azimuthal angle
        const phi = Math.random() * Math.PI; // Polar angle
        return new THREE.Vector3(
            radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.sin(phi) * Math.sin(theta),
            radius * Math.cos(phi)
        );
    }

    /**
     * Set tag orientation to fly in on its end towards the center, aligned with a cube axis
     * @param {Object} tag - Tag to orient
     * @param {THREE.Vector3} initialPosition - Initial position of the tag
     */
    setTagFlyInOrientation(tag, initialPosition) {
        // Direction from initial position to center
        const directionToCenter = new THREE.Vector3(0, 0, 0).sub(initialPosition).normalize();
        
        // Choose a random cube axis to align with (x, y, or z)
        const axes = [
            new THREE.Vector3(1, 0, 0),  // x-axis
            new THREE.Vector3(0, 1, 0),  // y-axis
            new THREE.Vector3(0, 0, 1)   // z-axis
        ];
        const randomAxis = axes[Math.floor(Math.random() * axes.length)];
        
        // Create a rotation that aligns the tag's end (z-axis in local space) with the direction to center
        const rotationMatrix = new THREE.Matrix4();
        
        // Use z-axis as the primary direction for end-first flight
        const endDirection = directionToCenter;
        
        // Pick a perpendicular vector for "up" direction based on the chosen axis
        let up;
        if (randomAxis.x === 1) {
            up = new THREE.Vector3(0, 1, 0);
        } else if (randomAxis.y === 1) {
            up = new THREE.Vector3(0, 0, 1);
        } else {
            up = new THREE.Vector3(1, 0, 0);
        }
        
        if (Math.abs(endDirection.dot(up)) > 0.9) {
            // If end direction is too close to up, use a different up vector
            up = new THREE.Vector3(1, 0, 0);
        }
        
        // Compute right vector as cross product
        const right = new THREE.Vector3().crossVectors(up, endDirection).normalize();
        
        // Recompute up to ensure orthogonality
        up = new THREE.Vector3().crossVectors(endDirection, right).normalize();
        
        // Create rotation matrix and apply it
        rotationMatrix.makeBasis(right, up, endDirection);
        tag.mesh.quaternion.setFromRotationMatrix(rotationMatrix);
        
        // Store original face-based rotation to revert to after fly-in
        tag.originalRotation = this.getFaceRotation(tag.physicsFace);
    }

    /**
     * Get face-based rotation for a tag after fly-in
     * @param {string} face - Face identifier
     * @returns {THREE.Euler} - Euler rotation
     */
    getFaceRotation(face) {
        switch (face) {
            case 'px': return new THREE.Euler(0, 0, 0);
            case 'nx': return new THREE.Euler(0, Math.PI, 0);
            case 'py': return new THREE.Euler(Math.PI / 2, 0, 0);
            case 'ny': return new THREE.Euler(-Math.PI / 2, 0, 0);
            case 'pz': return new THREE.Euler(0, Math.PI / 2, 0);
            case 'nz': return new THREE.Euler(0, -Math.PI / 2, 0);
            default: return new THREE.Euler(0, 0, 0);
        }
    }

    /**
     * Adjust initial position to avoid collisions and pack tags tightly
     * @param {Object} tag - Tag to adjust
     * @param {Array} allTags - Array of all tags
     * @returns {boolean} - Whether adjustment was successful
     */
    adjustInitialPosition(tag, allTags) {
        if (!tag || !tag.mesh || !tag.mesh.position || typeof tag.mesh.position.clone !== 'function') {
            console.error('Invalid tag or mesh position in adjustInitialPosition', { tag: tag, mesh: tag?.mesh, position: tag?.mesh?.position });
            return false;
        }

        const physicsData = this.tags.get(tag.id);
        if (!physicsData) {
            console.error('No physics data found for tag in adjustInitialPosition', { tagId: tag.id });
            return false;
        }

        if (!Array.isArray(allTags)) {
            console.error('allTags is not an array in adjustInitialPosition', { allTags: allTags });
            return false;
        }

        const face = physicsData.face;
        const currentPosition = tag.mesh.position.clone();
        const faceNormal = this.getFaceNormal(face);
        const stepSize = 0.2; // Small steps to move closer
        const minDistance = physicsData.size + this.options.spacing;
        let attempts = 0;
        const maxAttempts = 50;
        let bestPosition = currentPosition.clone();
        let minCollisionDistance = Infinity;

        // Try to move the tag closer to the center along the face normal
        while (attempts < maxAttempts) {
            let hasCollision = false;
            let closestCollisionDistance = Infinity;

            // Check collisions with other tags
            for (const otherTag of allTags) {
                if (otherTag.id === tag.id || !otherTag.mesh) continue;
                const distance = currentPosition.distanceTo(otherTag.mesh.position);
                const combinedSize = (physicsData.size + (otherTag.physics?.size || physicsData.size)) / 2;
                const requiredDistance = combinedSize + this.options.spacing;

                if (distance < requiredDistance && distance < closestCollisionDistance) {
                    hasCollision = true;
                    closestCollisionDistance = distance;
                }
            }

            // Update best position if this is the closest non-colliding position
            if (!hasCollision && currentPosition.length() < minCollisionDistance) {
                bestPosition.copy(currentPosition);
                minCollisionDistance = currentPosition.length();
            }

            // If no collision, we can stop (position is good)
            if (!hasCollision) {
                tag.mesh.position.copy(currentPosition);
                if (!physicsData.targetPosition) {
                    physicsData.targetPosition = currentPosition.clone();
                } else {
                    physicsData.targetPosition.copy(currentPosition);
                }
                return true;
            }

            // If collision, move away slightly along the face normal or adjust tangentially
            if (attempts < maxAttempts / 2) {
                // First half of attempts: move inward along normal
                currentPosition.add(faceNormal.clone().multiplyScalar(-stepSize));
            } else {
                // Second half: adjust tangentially on the face
                const tangentDir = attempts % 2 === 0 ? this.getTagUpDirection(face) : this.getTagUpDirection(face).cross(faceNormal);
                currentPosition.add(tangentDir.clone().multiplyScalar(stepSize * (Math.random() - 0.5) * 2));
            }
            attempts++;
        }

        // If we couldn't find a non-colliding position, use the best we have
        tag.mesh.position.copy(bestPosition);
        if (!physicsData.targetPosition) {
            physicsData.targetPosition = bestPosition.clone();
        } else {
            physicsData.targetPosition.copy(bestPosition);
        }
        return true; // Accept even if there's a minor overlap to ensure placement
    }

    /**
     * Remove a tag from the physics system
     * @param {string} tagId - ID of tag to remove
     */
    removeTag(tagId) {
        const physicsData = this.tags.get(tagId);
        if (physicsData) {
            this.faceCounts[physicsData.face]--;
            this.tags.delete(tagId);
            // Update cube size after removing a tag
            this.updateCubeSize();
        }
    }

    /**
     * Handle tag resize
     * @param {Object} tag - Tag to resize
     * @param {number} newSize - New size
     * @returns {boolean} - Whether resize was successful
     */
    handleTagResize(tag, newSize) {
        if (!tag || !tag.mesh || !this.tags.has(tag.id)) return false;
        tag.mesh.scale.set(newSize, newSize, newSize);
        const physicsData = this.tags.get(tag.id);
        physicsData.size = newSize;
        physicsData.mass = 1.0 + (newSize - 1.0) * 0.5;
        // Update cube size when a tag is resized
        this.updateCubeSize();
        return true;
    }

    /**
     * Update physics simulation
     */
    update() {
        const now = Date.now();
        const deltaTime = Math.min(now - this.lastUpdateTime, 100); // Cap delta time to prevent large jumps
        this.lastUpdateTime = now;

        // Skip physics update if document is not visible
        if (!this.isDocumentVisible) return;

        // Apply forces to all tags
        for (const [tagId, physicsData] of this.tags) {
            const tag = this.getTagById(tagId);
            if (!tag || !tag.mesh) continue;

            // Reset force
            physicsData.force.set(0, 0, 0);

            // Apply stronger central force (increased for better pull to center, stronger for larger tags)
            const ageFactor = this.calculateAgeFactor(tag);
            const sizeFactor = physicsData.size / 1.5; // Increased effect of size on pull
            const centralForce = this.options.centralForce * (1 + ageFactor) * 2.0 * (1 + sizeFactor); // Increased base multiplier
            const toCenter = new THREE.Vector3(0, 0, 0).sub(tag.mesh.position).normalize();
            physicsData.force.add(toCenter.multiplyScalar(centralForce));

            // Apply minimal surface force to avoid predefined spots
            const surfaceNormal = this.getFaceNormal(physicsData.face);
            const surfaceForce = this.options.surfaceForce * 0.2; // Reduced to avoid forcing to surface
            physicsData.force.add(surfaceNormal.multiplyScalar(surfaceForce));

            // Apply gravity-like force towards the assigned face after fly-in period
            if (tag.createdAt && Date.now() - tag.createdAt > 5000) {
                const faceGravityForce = 0.15 * (1 + ageFactor) * (1 + sizeFactor); // Increased gravity force for larger tags
                physicsData.force.add(surfaceNormal.multiplyScalar(-faceGravityForce)); // Pull towards face
            }

            // Apply collision forces with size-based pushing
            this.applyCollisionForces(tag, physicsData);

            // Add small random jiggle force to help tags slot together
            const jiggleForce = 0.01 * (1 + ageFactor); // Small force, increases slightly with age
            const jiggle = new THREE.Vector3(
                (Math.random() - 0.5) * jiggleForce,
                (Math.random() - 0.5) * jiggleForce,
                (Math.random() - 0.5) * jiggleForce
            );
            physicsData.force.add(jiggle);

            // Update velocity with damping (reduced for smaller tags to prevent bouncing)
            physicsData.velocity.add(physicsData.force.divideScalar(physicsData.mass));
            const dampingFactor = physicsData.mass > 2.0 ? this.options.damping : this.options.damping * 1.2; // Smaller tags damp more
            physicsData.velocity.multiplyScalar(dampingFactor);

            // Limit speed
            if (physicsData.velocity.length() > this.options.maxSpeed) {
                physicsData.velocity.normalize().multiplyScalar(this.options.maxSpeed);
            }

            // Constrain movement to up/down relative to tag orientation only after initial fly-in
            const constrainedVelocity = tag.createdAt && Date.now() - tag.createdAt > 5000 ? 
                this.constrainVelocity(tag, physicsData.velocity) : physicsData.velocity;

            // Update position
            tag.mesh.position.add(constrainedVelocity);
            physicsData.isMoving = constrainedVelocity.length() > 0.01;

            // Animate flip to face-based orientation after fly-in period
            if (tag.createdAt && Date.now() - tag.createdAt > 5000 && tag.originalRotation) {
                const elapsedSinceFlipStart = Date.now() - (tag.flipStartTime || tag.createdAt + 5000);
                if (elapsedSinceFlipStart < this.options.flipAnimationDuration) {
                    if (!tag.flipStartTime) {
                        tag.flipStartTime = Date.now();
                        tag.startQuaternion = tag.mesh.quaternion.clone();
                    }
                    const progress = elapsedSinceFlipStart / this.options.flipAnimationDuration;
                    const targetQuaternion = new THREE.Quaternion().setFromEuler(tag.originalRotation);
                    tag.mesh.quaternion.slerpQuaternions(tag.startQuaternion, targetQuaternion, progress);
                } else {
                    tag.mesh.rotation.copy(tag.originalRotation);
                    delete tag.originalRotation; // Clean up
                    delete tag.flipStartTime;
                    delete tag.startQuaternion;
                }
            }

            // Update bounding box for accurate collision detection
            this.updateTagBoundingBox(tag);
        }
    }

    /**
     * Calculate age factor for a tag (0 for new, 1 for old)
     * @param {Object} tag - Tag to calculate age factor for
     * @returns {number} - Age factor
     */
    calculateAgeFactor(tag) {
        const creationTime = tag.createdAt || 0;
        const age = Date.now() - creationTime;
        const maxAge = 5 * 60 * 1000; // 5 minutes max age influence
        return Math.min(age / maxAge, 1.0);
    }

    /**
     * Get face normal vector
     * @param {string} face - Face identifier
     * @returns {THREE.Vector3} - Normal vector
     */
    getFaceNormal(face) {
        switch (face) {
            case 'px': return new THREE.Vector3(1, 0, 0);
            case 'nx': return new THREE.Vector3(-1, 0, 0);
            case 'py': return new THREE.Vector3(0, 1, 0);
            case 'ny': return new THREE.Vector3(0, -1, 0);
            case 'pz': return new THREE.Vector3(0, 0, 1);
            case 'nz': return new THREE.Vector3(0, 0, -1);
            default: return new THREE.Vector3(1, 0, 0);
        }
    }

    /**
     * Constrain velocity to up/down direction relative to tag orientation
     * @param {Object} tag - Tag object
     * @param {THREE.Vector3} velocity - Original velocity
     * @returns {THREE.Vector3} - Constrained velocity
     */
    constrainVelocity(tag, velocity) {
        // Get tag's up direction based on face
        const upDirection = this.getTagUpDirection(tag.physicsFace);
        // Project velocity onto up direction
        const magnitude = velocity.dot(upDirection);
        return upDirection.clone().multiplyScalar(magnitude);
    }

    /**
     * Get tag's up direction based on face
     * @param {string} face - Face identifier
     * @returns {THREE.Vector3} - Up direction
     */
    getTagUpDirection(face) {
        switch (face) {
            case 'px': return new THREE.Vector3(0, 1, 0);
            case 'nx': return new THREE.Vector3(0, 1, 0);
            case 'py': return new THREE.Vector3(0, 0, 1);
            case 'ny': return new THREE.Vector3(0, 0, -1);
            case 'pz': return new THREE.Vector3(0, 1, 0);
            case 'nz': return new THREE.Vector3(0, 1, 0);
            default: return new THREE.Vector3(0, 1, 0);
        }
    }

    /**
     * Apply collision forces between tags using bounding box distances
     * @param {Object} tag - Tag to check collisions for
     * @param {Object} physicsData - Physics data for the tag
     */
    applyCollisionForces(tag, physicsData) {
        const now = Date.now();
        for (const [otherId, otherPhysics] of this.tags) {
            if (tag.id === otherId) continue;
            const otherTag = this.getTagById(otherId);
            if (!otherTag || !otherTag.mesh) continue;

            // Use bounding box for more accurate collision detection
            if (!tag.boundingBox || !otherTag.boundingBox) {
                this.updateTagBoundingBox(tag);
                this.updateTagBoundingBox(otherTag);
            }

            // Check if bounding boxes intersect or are too close
            const distanceVector = tag.mesh.position.clone().sub(otherTag.mesh.position);
            const distance = distanceVector.length();
            // Approximate combined size using the largest dimension of bounding boxes plus spacing
            const tagSize = Math.max(tag.physicsDimensions.x, tag.physicsDimensions.y, tag.physicsDimensions.z);
            const otherSize = Math.max(otherTag.physicsDimensions.x, otherTag.physicsDimensions.y, otherTag.physicsDimensions.z);
            const combinedSize = (tagSize + otherSize) / 2 + this.options.spacing;

            if (distance < combinedSize) {
                // Collision detected
                const overlap = combinedSize - distance;
                const direction = distanceVector.normalize();
                // Larger tags push harder, smaller tags absorb more force
                const forceMagnitude = this.options.collisionForce * overlap * (physicsData.mass / (otherPhysics.mass + physicsData.mass)) * 2;
                physicsData.force.add(direction.multiplyScalar(forceMagnitude));

                // Track collision chain to prevent recursive movement
                if (!this.collisionChains.has(tag.id)) {
                    this.collisionChains.add(otherId);
                    otherPhysics.lastCollisionTime = now;
                }
            }
        }
        // Clear collision chain if enough time has passed
        if (physicsData.lastCollisionTime < now - 1000) {
            this.collisionChains.delete(tag.id);
        }
    }

    /**
     * Placeholder for getting tag by ID (assumes TagManager has this method)
     * @param {string} id - Tag ID
     * @returns {Object|null} - Tag object
     */
    getTagById(id) {
        // Use tagManager if available
        if (this.tagManager) {
            return this.tagManager.getTagById(id);
        }
        return null;
    }

    /**
     * Update tag bounding box for collision detection
     * @param {Object} tag - Tag to compute bounding box for
     */
    updateTagBoundingBox(tag) {
        if (!tag.mesh) return;
        // Compute or update the bounding box
        if (!tag.boundingBox) {
            tag.boundingBox = new THREE.Box3().setFromObject(tag.mesh);
        } else {
            tag.boundingBox.setFromObject(tag.mesh);
        }
        // Store dimensions for quick access
        const size = new THREE.Vector3();
        tag.boundingBox.getSize(size);
        tag.physicsDimensions = size;
    }

    /**
     * Dispose of resources
     */
    dispose() {
        this.tags.clear();
        this.faceCounts = { px: 0, nx: 0, py: 0, ny: 0, pz: 0, nz: 0 };
        this.collisionChains.clear();
    }

    /**
     * Handle document visibility change to pause physics when tab is inactive
     */
    handleVisibilityChange() {
        this.isDocumentVisible = document.visibilityState === 'visible';
        if (this.isDocumentVisible) {
            this.lastUpdateTime = Date.now(); // Reset time to prevent large delta
        }
    }
} 