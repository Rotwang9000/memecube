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
        // Enable verbose debugging
        this.DEBUG_MODE = true;
        
        this.scene = scene;
        this.tagManager = options.tagManager || null;
        this.options = {
            cubeSize: options.initialCubeSize || 10, // Initial cube size - will adjust dynamically
            spacing: 0.005,             // Reduced to hair's width spacing between tags
            centralForce: 0.18,        // Increased force pulling tags toward center
            surfaceForce: 1.005,        // Reduced force to allow closer packing
            damping: 0.5,             // Slightly reduced damping for more responsive movement
            maxSpeed: 1.6,             // Reduced max speed for controlled movement
            collisionForce: 0.1,       // Increased collision force for tighter packing
            faceBalanceFactor: 0.5,    // Factor for balancing tags across faces
            flipAnimationDuration: 1000, // Duration in ms for flip to face animation
            initialMoveSpeed: 0.02,     // Drastically reduced initial speed for more dramatic entry
            easingFactor: 0.01,         // Much smaller easing factor for much slower acceleration
            cubeGravityStrength: 0.35,  // Increased strength of gravity pulling tags toward cube faces
            postRotationBoost: 0.15,    // New: boost force after rotation to form tighter cube
            collisionPushScale: 0.3,    // New: scale for collision pushback during rotation/resize
            easingCurveExponent: 2.0,   // New: exponent for non-linear easing curve
            ...options
        };

        // Track tags and their physics data
        this.tags = new Map();
        // Track face distribution (6 faces of a cube)
        this.faceCounts = { px: 0, nx: 0, py: 0, ny: 0, pz: 0, nz: 0 };
        // Track collision chains to prevent recursive movement
        this.collisionChains = new Set();
        // Use animation frame timing instead of absolute time
        this.clock = new THREE.Clock();
        this.lastDeltaTime = 0;
        // Track document visibility for pausing physics
        this.isDocumentVisible = true;
        this.isPaused = false;
        // Register visibility change listener
        document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
        
        // Log constructor completion
        if (this.DEBUG_MODE) {
            console.log('TagPhysics constructor completed with options:', this.options);
        }
    }

    /**
     * Add a new tag to the physics system
     * @param {Object} tag - Tag object to add
     * @param {Array} allTags - Array of all tags for collision checking
     * @returns {boolean} - Whether placement was successful
     */
    addNewTag(tag, allTags) {
        if (!tag || !tag.mesh) {
            if (this.DEBUG_MODE) console.error('Invalid tag passed to addNewTag');
            return false;
        }

        // Determine which face to place the tag on (least populated)
        const targetFace = this.getLeastPopulatedFace();
        // Assign face to tag for orientation and positioning
        tag.physicsFace = targetFace;
        // Increment face count
        this.faceCounts[targetFace]++;

        // Set initial position far outside the cube at a random angle
        const initialPosition = this.getRandomSphericalPosition();
        tag.mesh.position.copy(initialPosition);
        if (this.DEBUG_MODE) console.log(`Tag ${tag.id} initial position:`, initialPosition);

        // Set orientation to fly in on its end towards the center, aligned with a cube axis
        this.setTagFlyInOrientation(tag, initialPosition);

        // Calculate mass based on size (larger tags have more mass)
        const size = tag.mesh.scale.x;
        const mass = 1.0 + (size - 1.0) * 2.0; // Increased mass influence for larger tags

        // Calculate initial velocity aiming towards the center with very gentle force
        const directionToCenter = new THREE.Vector3(0, 0, 0).sub(initialPosition).normalize();
        const initialVelocity = directionToCenter.multiplyScalar(this.options.maxSpeed * 0.3); // Reduced initial speed
        if (this.DEBUG_MODE) console.log(`Tag ${tag.id} initial velocity vector:`, initialVelocity, 'magnitude:', initialVelocity.length());

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
            targetPosition: initialPosition.clone(),
            // Use elapsed time from clock instead of absolute timestamps
            creationElapsedTime: this.clock.getElapsedTime(),
            lastInteractionElapsedTime: this.clock.getElapsedTime(),
            // Flag to track initial movement phase
            initialMovement: true,
            // Track frames for debugging
            frameCount: 0,
            forceDirectMove: true, // Flag to force direct movement regardless of physics in first frames
            speedFactor: 0.01, // Start with extremely slow speed and ease in gradually
            collisionPushback: new THREE.Vector3(0, 0, 0), // Track collision pushback force
            easeProgress: 0.0, // Track easing progress for non-linear easing
            postRotationMoveEnabled: false, // Enable post-rotation movement flag
            postRotationStartTime: 0 // When post-rotation movement started
        };
        this.tags.set(tag.id, physicsData);
        tag.physics = physicsData;

        // Verify that targetPosition was properly initialized
        if (!physicsData.targetPosition) {
            console.warn("Failed to initialize targetPosition in physicsData, creating now");
            physicsData.targetPosition = initialPosition.clone();
        }

        // Log initial setup
        if (this.DEBUG_MODE) {
            console.log(`Tag ${tag.id} added to physics:`, {
                position: tag.mesh.position.clone(),
                velocity: initialVelocity.clone(),
                face: targetFace,
                mass: mass,
                size: size
            });
        }

        // Update cube size based on new tag
        this.updateCubeSize();

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
     * Set tag orientation with X-axis aligned with ray from center (side-first orientation)
     * @param {Object} tag - Tag to orient
     * @param {THREE.Vector3} initialPosition - Initial position of the tag
     */
    setTagFlyInOrientation(tag, initialPosition) {
        // Direction from center to initial position (radial ray outward)
        const radialRay = initialPosition.clone().normalize();
        
        // For tags to fly in sideways along the ray:
        // 1. Tag's X-axis should be aligned with the ray from center
        // 2. Tag's Z-axis (depth) should be perpendicular to the ray
        // 3. Tag's Y-axis (height) should be upward-facing when possible
        
        // Right direction (X-axis) points along the ray from center
        const right = radialRay.clone(); // X-axis aligned with ray
        
        // Find a consistent up direction (try to keep text upright when possible)
        const worldUp = new THREE.Vector3(0, 1, 0);
        
        // Forward direction (Z-axis) should be perpendicular to both right and up
        let forward = new THREE.Vector3().crossVectors(worldUp, right).normalize();
        
        // If forward vector is too small (ray nearly vertical), use world X as reference
        if (forward.lengthSq() < 0.01) {
            const worldForward = new THREE.Vector3(0, 0, 1);
            forward = new THREE.Vector3().crossVectors(right, worldForward).normalize();
        }
        
        // Recalculate up to ensure perfect orthogonality
        const up = new THREE.Vector3().crossVectors(forward, right).normalize();
        
        // Create rotation matrix with X-axis along ray
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeBasis(right, up, forward);
        
        // Apply rotation
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
        
        // Store original size for comparison
        const oldSize = tag.physics.size;
        
        // Apply the resize
        tag.mesh.scale.set(newSize, newSize, newSize);
        const physicsData = this.tags.get(tag.id);
        physicsData.size = newSize;
        physicsData.mass = 1.0 + (newSize - 1.0) * 0.5;
        
        // Update collision detection after resize
        this.updateTagBoundingBox(tag);
        
        // If tag got larger, push surrounding tags away to make room
        if (newSize > oldSize) {
            // Wait a frame to let the tag bounding box update properly
            setTimeout(() => {
                // Push surrounding tags away with enough force to make space
                this.pushSurroundingTags(tag, physicsData, newSize - oldSize);
            }, 16); // Wait one frame (approx 16ms)
        }
        
        // Update cube size when a tag is resized
        this.updateCubeSize();
        return true;
    }
    
    /**
     * Push surrounding tags away to make room after a resize or during rotation
     * @param {Object} tag - Tag that's pushing others
     * @param {Object} physicsData - Physics data for the tag
     * @param {number} forceFactor - Scale factor for push force (e.g. size difference)
     */
    pushSurroundingTags(tag, physicsData, forceFactor = 1.0) {
        if (!tag || !tag.mesh) return;
        
        // Update bounding box for accurate collision detection
        this.updateTagBoundingBox(tag);
        
        // Check collision with all other tags
        for (const [otherId, otherPhysics] of this.tags) {
            if (tag.id === otherId) continue;
            const otherTag = this.getTagById(otherId);
            if (!otherTag || !otherTag.mesh) continue;
            
            // Update other tag's bounding box
            this.updateTagBoundingBox(otherTag);
            
            // Get centers of both boxes
            const tagCenter = new THREE.Vector3();
            const otherCenter = new THREE.Vector3();
            tag.boundingBox.getCenter(tagCenter);
            otherTag.boundingBox.getCenter(otherCenter);
            
            // Calculate distance and direction
            const distance = tagCenter.distanceTo(otherCenter);
            const combinedSize = (physicsData.size + otherPhysics.size);
            const requiredSpace = combinedSize * 1.1; // 10% extra spacing
            
            // If too close, push away
            if (distance < requiredSpace) {
                // Calculate direction and force
                const direction = otherCenter.clone().sub(tagCenter).normalize();
                const pushForce = (requiredSpace - distance) * 0.5 * forceFactor;
                
                // Add velocity to other tag to push it away
                otherPhysics.velocity.add(direction.multiplyScalar(pushForce));
                
                // Reset any immovability on the pushed tag to allow movement
                otherPhysics.immovableUntil = 0;
                
                // Apply immediate position adjustment if overlap is severe
                if (distance < combinedSize * 0.9) {
                    const adjustment = direction.clone().multiplyScalar((combinedSize * 0.9) - distance);
                    otherTag.mesh.position.add(adjustment);
                }
                
                if (this.DEBUG_MODE) {
                    console.log(`Tag ${tag.id} pushing ${otherId} with force ${pushForce}`);
                }
            }
        }
    }

    /**
     * Update physics simulation
     */
    update() {
        // Skip physics update if document is not visible or simulation is paused
        if (!this.isDocumentVisible || this.isPaused) {
            // Reset the clock when we're paused to avoid large delta on resume
            if (this.isPaused) {
                this.clock.getDelta(); // Consume the delta time
            }
            return;
        }

        // Use THREE.Clock for consistent timing
        const deltaTime = Math.min(this.clock.getDelta(), 0.05); // Cap at 50ms (20fps minimum)
        this.lastDeltaTime = deltaTime;

        // Scale factor to normalize physics rate (16.67ms is approx 60fps)
        const normalizedDeltaTime = deltaTime / 0.01667;

        // Apply forces to all tags
        for (const [tagId, physicsData] of this.tags) {
            const tag = this.getTagById(tagId);
            if (!tag || !tag.mesh) continue;

            // Safety check: Fix any NaN in position
            if (isNaN(tag.mesh.position.x) || isNaN(tag.mesh.position.y) || isNaN(tag.mesh.position.z)) {
                console.warn(`Fixed NaN position for tag ${tagId}`);
                // Reset to default position if NaN detected
                tag.mesh.position.set(0, 0, 0);
            }

            // Safety check: Fix any NaN in velocity
            if (physicsData.velocity && (isNaN(physicsData.velocity.x) || isNaN(physicsData.velocity.y) || isNaN(physicsData.velocity.z))) {
                console.warn(`Fixed NaN velocity for tag ${tagId}`);
                physicsData.velocity.set(0, 0, 0);
            }

            // Increment frame counter for this tag
            physicsData.frameCount = (physicsData.frameCount || 0) + 1;
            
            // Debug output every 10 frames for the first 50 frames
            if (this.DEBUG_MODE && physicsData.frameCount <= 50 && physicsData.frameCount % 10 === 0) {
                // Prevent logging NaN values
                if (!isNaN(tag.mesh.position.x) && !isNaN(physicsData.velocity.x)) {
                    console.log(`Tag ${tagId} frame ${physicsData.frameCount} - position:`, tag.mesh.position.clone(), 
                        'velocity:', physicsData.velocity.clone(), 'length:', physicsData.velocity.length(),
                        'forceDirectMove:', physicsData.forceDirectMove);
                }
            }

            // For the first 60 frames, force direct movement with dramatic non-linear easing
            if (physicsData.frameCount <= 60 && physicsData.forceDirectMove) {
                // Get direction to center and move directly
                const toCenter = new THREE.Vector3(0, 0, 0).sub(tag.mesh.position).normalize();
                
                // Update easing progress (0.0 to 1.0)
                physicsData.easeProgress = Math.min(1.0, physicsData.easeProgress + (this.options.easingFactor * normalizedDeltaTime));
                
                // Apply non-linear easing curve for more dramatic entry (slow start, faster end)
                const easeCurve = Math.pow(physicsData.easeProgress, this.options.easingCurveExponent);
                physicsData.speedFactor = easeCurve * 0.5; // Cap at 50% max speed during initial approach
                
                const easedSpeed = this.options.initialMoveSpeed * physicsData.speedFactor;
                
                const directMoveAmount = easedSpeed * normalizedDeltaTime;
                const moveVector = toCenter.multiplyScalar(directMoveAmount);
                
                // Apply direct movement (bypassing physics)
                tag.mesh.position.add(moveVector);
                
                if (this.DEBUG_MODE && physicsData.frameCount === 1) {
                    console.log(`Force moving tag ${tagId} directly by:`, moveVector, 'speed factor:', physicsData.speedFactor);
                }
                
                // Still run physics for subsequent frames but ensure init movement works
                physicsData.velocity = toCenter.clone().multiplyScalar(this.options.maxSpeed * physicsData.speedFactor * 0.5);
            }

            // Reset force
            physicsData.force.set(0, 0, 0);

            // Get current elapsed time for time-based calculations
            const currentElapsedTime = this.clock.getElapsedTime();

            // Check if this is the initial movement period (first second)
            const creationTime = physicsData.creationElapsedTime || 0;
            const ageInSeconds = currentElapsedTime - creationTime;
            const isInitialMovement = ageInSeconds < 3.0; // Extended initial period for debugging
            physicsData.initialMovement = isInitialMovement;

            // Apply stronger central force (increased for better pull to center, stronger for larger tags)
            const ageFactor = this.calculateAgeFactor(physicsData, currentElapsedTime);
            const sizeFactor = physicsData.size / 1.5; // Increased effect of size on pull
            
            // Apply extra strong central force during initial movement to ensure tags start moving
            const centralForceMultiplier = isInitialMovement ? 10.0 : 3.0; // Much stronger at start
            const centralForce = this.options.centralForce * (1 + ageFactor) * centralForceMultiplier * (1 + sizeFactor);
            const toCenter = new THREE.Vector3(0, 0, 0).sub(tag.mesh.position).normalize();
            physicsData.force.add(toCenter.multiplyScalar(centralForce));

            // Apply minimal surface force to avoid predefined spots
            const surfaceNormal = this.getFaceNormal(physicsData.face);
            const surfaceForce = this.options.surfaceForce * 0.2; // Reduced to avoid forcing to surface
            physicsData.force.add(surfaceNormal.multiplyScalar(surfaceForce));

            // Apply gravity-like force towards the assigned face after fly-in period
            if (ageInSeconds > 5.0 && !physicsData.flipCompleted && !physicsData.flipStartElapsedTime) { 
                const faceGravityForce = 0.15 * (1 + ageFactor) * (1 + sizeFactor); // Increased gravity force for larger tags
                physicsData.force.add(surfaceNormal.multiplyScalar(-faceGravityForce)); // Pull towards face
            }

            // Apply cube-directed gravity after rotation to form a cube shape
            if (physicsData.flipCompleted) {
                this.applyCubeGravity(tag, physicsData);
                
                // Enable post-rotation movement after flip completes
                if (!physicsData.postRotationMoveEnabled) {
                    physicsData.postRotationMoveEnabled = true;
                    physicsData.postRotationStartTime = currentElapsedTime;
                    physicsData.immovableUntil = 0; // Reset any immovability to allow movement
                    
                    // Add a small inward impulse to help form the cube
                    const inwardImpulse = tag.mesh.position.clone().negate().normalize().multiplyScalar(this.options.postRotationBoost);
                    physicsData.velocity.add(inwardImpulse);
                    
                    if (this.DEBUG_MODE) {
                        console.log(`Tag ${tagId} post-rotation movement enabled, applied impulse:`, inwardImpulse);
                    }
                }
                
                // Apply additional forces during post-rotation period (first 5 seconds)
                if (physicsData.postRotationMoveEnabled) {
                    const postRotationElapsed = currentElapsedTime - physicsData.postRotationStartTime;
                    if (postRotationElapsed < 5.0) {
                        // Gradually decreasing boost toward cube formation
                        const boostFactor = 1.0 - (postRotationElapsed / 5.0);
                        const inwardBoost = tag.mesh.position.clone().negate().normalize().multiplyScalar(
                            this.options.postRotationBoost * boostFactor
                        );
                        physicsData.force.add(inwardBoost);
                    }
                }
            }

            // Skip collision detection in very early frames
            if (physicsData.frameCount > 3) {
                // Apply collision forces with size-based pushing
                this.applyCollisionForces(tag, physicsData, currentElapsedTime);
            }

            // Add small random jiggle force to help tags slot together
            const jiggleForce = 0.01 * (1 + ageFactor); // Small force, increases slightly with age
            const jiggle = new THREE.Vector3(
                (Math.random() - 0.5) * jiggleForce,
                (Math.random() - 0.5) * jiggleForce,
                (Math.random() - 0.5) * jiggleForce
            );
            physicsData.force.add(jiggle);
            
            // Update velocity with damping (reduced for smaller tags to prevent bouncing)
            // Scale force by normalized deltaTime for consistent physics
            physicsData.velocity.add(physicsData.force.clone().divideScalar(physicsData.mass).multiplyScalar(normalizedDeltaTime));

            // Check velocity magnitude after applying forces - for debugging
            if (isInitialMovement && physicsData.velocity.length() < 0.1) {
                console.log(`Tag ${tagId} has low velocity during initial movement: ${physicsData.velocity.length()}, force: ${physicsData.force.length()}`);
            }

            const dampingFactor = Math.pow(physicsData.mass > 2.0 ? this.options.damping : this.options.damping * 1.5, normalizedDeltaTime); // Increased damping for smaller tags
            // Only apply damping after initial fly-in and rotation to ensure movement at start
            if ((physicsData.flipCompleted || physicsData.flipStartElapsedTime) && !isInitialMovement) {
                physicsData.velocity.multiplyScalar(dampingFactor);
            }

            // Apply additional damping after inactivity to stabilize positions, but only after face rotation
            const lastInteractionTime = physicsData.lastInteractionElapsedTime || 0;
            if (physicsData.flipCompleted && currentElapsedTime - lastInteractionTime > 5.0) { // 5 seconds of no user interaction, post-rotation
                physicsData.velocity.multiplyScalar(0.95); // Additional damping
            }

            // Force velocity alignment with ray to center for flying tags
            // This ensures tags always move toward center even after being pushed
            if (!physicsData.flipStartElapsedTime && !physicsData.flipCompleted && ageInSeconds > 1.0) {
                // Calculate the current direction of movement
                const currentDirection = physicsData.velocity.clone().normalize();
                
                // Calculate the ideal direction (toward center)
                const idealDirection = new THREE.Vector3(0, 0, 0).sub(tag.mesh.position).normalize();
                
                // Calculate the angle between current and ideal direction
                const angleToIdeal = currentDirection.angleTo(idealDirection);
                
                // If the tag is moving in a significantly wrong direction, correct it
                if (angleToIdeal > 0.8) { // ~45 degrees
                    // Gradually align velocity with ideal direction
                    const alignmentStrength = 0.2; // Speed of realignment
                    const alignmentFactor = alignmentStrength * normalizedDeltaTime;
                    
                    // Create a blended direction
                    const blendedDirection = currentDirection.clone()
                        .multiplyScalar(1 - alignmentFactor)
                        .add(idealDirection.multiplyScalar(alignmentFactor))
                        .normalize();
                    
                    // Apply the blended direction while maintaining speed
                    const currentSpeed = physicsData.velocity.length();
                    physicsData.velocity.copy(blendedDirection.multiplyScalar(currentSpeed));
                }
            }

            // Limit speed
            if (physicsData.velocity.length() > this.options.maxSpeed) {
                physicsData.velocity.normalize().multiplyScalar(this.options.maxSpeed);
            }

            // Skip immovability check during initial frames or post-rotation movement period
            const skipImmovabilityCheck = 
                physicsData.frameCount <= 10 || 
                (physicsData.postRotationMoveEnabled && 
                 currentElapsedTime - physicsData.postRotationStartTime < 3.0);
                
            if (!skipImmovabilityCheck) {
                // Check if tag has recently moved significantly to apply temporary immovability
                const velocityDelta = physicsData.velocity.clone().multiplyScalar(normalizedDeltaTime);
                const positionDeltaMagnitude = velocityDelta.length();
                if (positionDeltaMagnitude > 0.05) { // If moved more than a small threshold
                    physicsData.lastSignificantMoveTime = currentElapsedTime;
                    physicsData.immovableUntil = currentElapsedTime + 2.0; // Immovable for 2 seconds
                }

                // Apply immovability if within the period after significant movement
                // This helps propagate movement outward and prevents loops
                if (physicsData.immovableUntil && currentElapsedTime < physicsData.immovableUntil) {
                    physicsData.velocity.set(0, 0, 0); // Stop movement temporarily
                }
            }

            // Constrain movement to up/down relative to tag orientation only after initial fly-in
            const constrainedVelocity = ageInSeconds > 8.0 ? 
                this.constrainVelocity(tag, physicsData.velocity) : physicsData.velocity;

            // Update position - scale by normalized deltaTime for consistent movement
            const positionDelta = constrainedVelocity.clone().multiplyScalar(normalizedDeltaTime);
            tag.mesh.position.add(positionDelta);
            physicsData.isMoving = constrainedVelocity.length() > 0.01;

            // Remove direct movement flag after sufficient frames
            if (physicsData.frameCount > 10) {
                physicsData.forceDirectMove = false;
            }

            // Determine if tag has settled in the cluster based on multiple factors
            const lowVelocity = constrainedVelocity.length() < 0.03; // More strict velocity threshold
            const minimumFlightTime = 3.0; // Increased minimum time before considering flip (3 seconds)
            const hasFlownEnough = ageInSeconds > minimumFlightTime;
            
            // Check if the tag is close enough to the center to be considered part of the cluster
            const distanceToCenter = tag.mesh.position.length();
            const maxClusterRadius = this.options.cubeSize * 0.85; // Cluster radius as percentage of cube size
            const isInCluster = distanceToCenter < maxClusterRadius;
            
            // Check for neighboring tags to confirm it's actually part of the cluster
            const hasNeighbors = this.checkForNeighbors(tag, 4.0); // Check for tags within 4.0 units
            
            // Detect if tag is stuck (trying to move inward but not getting closer)
            const stuckDetectionPeriod = 1.5; // Check position changes over 1.5 seconds (slightly longer to be patient)
            
            // Initialize position history if needed
            if (!physicsData.positionHistory) {
                physicsData.positionHistory = [];
                physicsData.lastPositionRecordTime = currentElapsedTime;
            }
            
            // Record position periodically
            if (currentElapsedTime - physicsData.lastPositionRecordTime > 0.2) { // Every 0.2 seconds
                physicsData.positionHistory.push({
                    position: tag.mesh.position.clone(),
                    time: currentElapsedTime
                });
                physicsData.lastPositionRecordTime = currentElapsedTime;
                
                // Keep only records within the detection period
                while (physicsData.positionHistory.length > 0 && 
                      (currentElapsedTime - physicsData.positionHistory[0].time) > stuckDetectionPeriod) {
                    physicsData.positionHistory.shift();
                }
            }
            
            // Determine if tag is stuck (trying to move inward but making little progress)
            let isStuck = false;
            if (physicsData.positionHistory.length >= 5 && hasFlownEnough) { // Need at least 5 records (~1 second) to assess
                // Check if tag is moving toward center
                const movingInward = constrainedVelocity.dot(tag.mesh.position.clone().negate().normalize()) > 0;
                
                // If trying to move inward, check if it's making progress
                if (movingInward) {
                    // Calculate distance moved over the detection period
                    const oldestPosition = physicsData.positionHistory[0].position;
                    const distanceMoved = tag.mesh.position.distanceTo(oldestPosition);
                    
                    // If minimal movement despite trying to move inward, consider it stuck
                    isStuck = distanceMoved < 0.15 && hasNeighbors; // Slightly increased threshold for movement
                }
            }
            
            // Only consider a tag settled normally when it has low velocity, is in the cluster, and has neighbors
            // OR if it's stuck trying to move inward (will trigger earlier flip)
            const isSettled = (lowVelocity && isInCluster && hasNeighbors) || isStuck;

            // Apply magnet-like reorientation during flight to keep tag's X-axis aligned with ray from center
            if (!physicsData.flipStartElapsedTime && tag.originalRotation) {
                // Only apply during flight phase (before settling and flipping)
                const shouldReorient = !isSettled && hasFlownEnough;
                if (shouldReorient) {
                    this.applyMagneticReorientation(tag, normalizedDeltaTime);
                }
            }

            // Check for nearby tags and adjust position to avoid overlapping during rotation
            // This prevents tags from overlapping during their flip to face-orientation
            if (physicsData.flipStartElapsedTime) {
                // Reset accumulated pushback force
                physicsData.collisionPushback = physicsData.collisionPushback || new THREE.Vector3(0, 0, 0);
                physicsData.collisionPushback.set(0, 0, 0);
                
                // During rotation, actively check and resolve collisions
                this.checkAndResolveCollisionsDuringRotation(tag, physicsData, normalizedDeltaTime);
                
                // Apply the accumulated pushback directly to position
                if (physicsData.collisionPushback.lengthSq() > 0) {
                    tag.mesh.position.add(physicsData.collisionPushback);
                    
                    if (this.DEBUG_MODE) {
                        console.log(`Tag ${tagId} pushed during rotation by:`, physicsData.collisionPushback.clone());
                    }
                }
            }

            // Animate flip to face-based orientation after tag has properly settled into the cluster
            if (hasFlownEnough && isSettled && tag.originalRotation && !physicsData.flipStartElapsedTime) {
                physicsData.flipStartElapsedTime = currentElapsedTime;
                physicsData.startQuaternion = tag.mesh.quaternion.clone();
                
                // Don't consider the tag fully settled yet - it should continue trying to move inward
                physicsData.isFullySettled = false;
            }
            
            // Progress the flip animation if it has started
            if (physicsData.flipStartElapsedTime) {
                const flipElapsedTime = (currentElapsedTime - physicsData.flipStartElapsedTime) * 1000; // Convert to ms
                if (flipElapsedTime < this.options.flipAnimationDuration) {
                    const progress = flipElapsedTime / this.options.flipAnimationDuration;
                    const targetQuaternion = new THREE.Quaternion().setFromEuler(tag.originalRotation);
                    tag.mesh.quaternion.slerpQuaternions(physicsData.startQuaternion, targetQuaternion, progress);
                } else {
                    tag.mesh.rotation.copy(tag.originalRotation);
                    delete tag.originalRotation; // Clean up
                    delete physicsData.startQuaternion;
                    
                    // After flip is complete, allow tag to continue moving inward
                    // Apply a small inward impulse to help it overcome any small barriers
                    const inwardDirection = tag.mesh.position.clone().negate().normalize();
                    physicsData.velocity.add(inwardDirection.multiplyScalar(0.05));
                    
                    // Mark flip as completed but keep trying to settle better
                    physicsData.flipCompleted = true;
                    delete physicsData.flipStartElapsedTime;
                }
            }
            
            // After flip is completed, boost inward movement periodically to help fully settle
            if (physicsData.flipCompleted && !physicsData.isFullySettled) {
                // Check if tag is still trying to move inward but is blocked
                const inwardDirection = tag.mesh.position.clone().negate().normalize();
                
                // Every few seconds, give an inward push to help overcome small barriers
                if (!physicsData.lastInwardBoostTime || 
                    (currentElapsedTime - physicsData.lastInwardBoostTime > 2.0)) {
                    // Safeguard against NaN
                    if (!isNaN(inwardDirection.x) && !isNaN(inwardDirection.y) && !isNaN(inwardDirection.z)) {
                        physicsData.velocity.add(inwardDirection.multiplyScalar(0.08));
                    }
                    physicsData.lastInwardBoostTime = currentElapsedTime;
                }
                
                // After sufficient time, consider tag fully settled
                if (!physicsData.settlementStartTime) {
                    physicsData.settlementStartTime = currentElapsedTime;
                } else if (currentElapsedTime - physicsData.settlementStartTime > 10.0) {
                    physicsData.isFullySettled = true;
                }
            }

            // Update bounding box for accurate collision detection
            this.updateTagBoundingBox(tag);
        }
    }

    /**
     * Calculate age factor for a tag (0 for new, 1 for old)
     * @param {Object} physicsData - Physics data for the tag
     * @param {number} currentElapsedTime - Current elapsed time from the clock
     * @returns {number} - Age factor
     */
    calculateAgeFactor(physicsData, currentElapsedTime) {
        const creationTime = physicsData.creationElapsedTime || 0;
        const ageInSeconds = currentElapsedTime - creationTime;
        const maxAgeInSeconds = 5 * 60; // 5 minutes max age influence
        return Math.min(ageInSeconds / maxAgeInSeconds, 1.0);
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
     * @param {number} currentElapsedTime - Current elapsed time from the clock
     */
    applyCollisionForces(tag, physicsData, currentElapsedTime) {
        // Safety check
        if (!tag || !tag.mesh || isNaN(tag.mesh.position.x)) return;
        
        // Update collision box for the current tag
        this.updateTagBoundingBox(tag);
        
        for (const [otherId, otherPhysics] of this.tags) {
            if (tag.id === otherId) continue;
            const otherTag = this.getTagById(otherId);
            if (!otherTag || !otherTag.mesh || isNaN(otherTag.mesh.position.x)) continue;

            // Update collision box for the other tag
                this.updateTagBoundingBox(otherTag);

            // Use two methods for collision detection:
            // 1. Box intersection test (more precise)
            // 2. Spherical distance check (faster backup)

            // Method 1: Check if collision boxes intersect
            const boxesIntersect = tag.collisionBox.intersectsBox(otherTag.collisionBox);
            
            // Method 2: Check center distance
            const distanceVector = tag.mesh.position.clone().sub(otherTag.mesh.position);
            const distance = distanceVector.length();
            
            // Approximate combined size using the largest dimension of bounding boxes plus spacing
            const tagSize = Math.max(tag.physicsDimensions.x, tag.physicsDimensions.y, tag.physicsDimensions.z);
            const otherSize = Math.max(otherTag.physicsDimensions.x, otherTag.physicsDimensions.y, otherTag.physicsDimensions.z);
            const combinedSize = (tagSize + otherSize) / 2 + this.options.spacing * 3; // Further increased spacing
            
            // Collision occurs if boxes intersect OR if centers are too close
            if (boxesIntersect || distance < combinedSize) {
                // Collision detected - calculate appropriate response
                let forceMagnitude = 0;
                let direction;
                
                if (boxesIntersect) {
                    // If boxes intersect, calculate overlap based on boxes
                    // Get centers of both boxes
                    const tagCenter = new THREE.Vector3();
                    const otherCenter = new THREE.Vector3();
                    tag.collisionBox.getCenter(tagCenter);
                    otherTag.collisionBox.getCenter(otherCenter);
                    
                    // Direction from other to this tag
                    direction = tagCenter.clone().sub(otherCenter).normalize();
                    
                    // Strong push force for intersecting boxes (prevent overlapping)
                    forceMagnitude = this.options.collisionForce * 5.0;
                } else {
                    // If just spherically close, use distance-based force
                const overlap = combinedSize - distance;
                    direction = distanceVector.normalize();
                    
                    // Smaller tags push harder relative to their mass to make space
                    const sizeRatio = physicsData.size < otherPhysics.size ? 1.8 : 1.0; // Smaller tags push even more
                    forceMagnitude = this.options.collisionForce * overlap * sizeRatio * 4.0; // Increased force
                }
                
                // Apply mass-based scaling to the force
                forceMagnitude *= (physicsData.mass / (otherPhysics.mass + physicsData.mass));
                
                // Add the force
                physicsData.force.add(direction.multiplyScalar(forceMagnitude));

                // Track collision chain to prevent recursive movement
                if (!this.collisionChains.has(tag.id)) {
                    this.collisionChains.add(otherId);
                    otherPhysics.lastCollisionElapsedTime = currentElapsedTime;
                }
            }
        }
        
        // Clear collision chain if enough time has passed
        if (!physicsData.lastCollisionElapsedTime || 
            physicsData.lastCollisionElapsedTime < currentElapsedTime - 1.0) {
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
        
        // Compute accurate bounding box from the mesh geometry
        if (!tag.boundingBox) {
            tag.boundingBox = new THREE.Box3().setFromObject(tag.mesh);
        } else {
            tag.boundingBox.setFromObject(tag.mesh);
        }
        
        // Store dimensions for quick access
        const size = new THREE.Vector3();
        tag.boundingBox.getSize(size);
        tag.physicsDimensions = size;
        
        // Create a slightly larger "collision box" to ensure separation
        // This acts like a glass cube surrounding the tag
        if (!tag.collisionBox) {
            tag.collisionBox = new THREE.Box3();
        }
        
        // Make collision box slightly larger (10% in each dimension)
        const padding = 1.1;
        const min = tag.boundingBox.min.clone().multiplyScalar(padding);
        const max = tag.boundingBox.max.clone().multiplyScalar(padding);
        tag.collisionBox.set(min, max);
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
            // When becoming visible again, reset the clock to prevent large delta
            this.clock.getDelta(); // Consume any large delta that accumulated while hidden
            this.isPaused = false;
            
            // Reset collision state
                this.collisionChains.clear();
                
            // Reduce any existing velocities to prevent jumps
                for (const [tagId, physicsData] of this.tags) {
                    if (physicsData.velocity) {
                        physicsData.velocity.multiplyScalar(0.1);
                    }
                }
        } else {
            // Pause the simulation when not visible
            this.isPaused = true;
        }
    }

    /**
     * Update a tag's last interaction time
     * @param {string} tagId - ID of the tag
     */
    recordTagInteraction(tagId) {
        const physicsData = this.tags.get(tagId);
        if (physicsData) {
            physicsData.lastInteractionElapsedTime = this.clock.getElapsedTime();
        }
    }

    /**
     * Check if a tag has neighbors within specified radius
     * @param {Object} tag - Tag to check
     * @param {number} radius - Search radius
     * @returns {boolean} - Whether the tag has neighbors
     */
    checkForNeighbors(tag, radius = 4.0) {
        if (!tag || !tag.mesh) return false;
        
        let neighborCount = 0;
        const position = tag.mesh.position;
        const tagSize = tag.physics ? tag.physics.size : 1.0;
        
        for (const [otherId, otherPhysics] of this.tags) {
            if (tag.id === otherId) continue;
            const otherTag = this.getTagById(otherId);
            if (!otherTag || !otherTag.mesh) continue;
            
            const distance = position.distanceTo(otherTag.mesh.position);
            const otherSize = otherPhysics.size || 1.0;
            const combinedSize = (tagSize + otherSize) * 1.5; // Account for tag dimensions plus some buffer
            
            if (distance < Math.max(radius, combinedSize)) {
                neighborCount++;
                if (neighborCount >= 1) { // Reduced threshold to be more sensitive to nearby tags
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * Apply magnetic reorientation to keep tag's X-axis aligned with ray from center
     * @param {Object} tag - Tag to reorient
     * @param {number} normalizedDeltaTime - Normalized delta time for smooth rotation
     */
    applyMagneticReorientation(tag, normalizedDeltaTime) {
        if (!tag || !tag.mesh) return;
        
        // Get ray from center to tag position (this is our target X-axis direction)
        const position = tag.mesh.position.clone();
        const rayFromCenter = position.clone().normalize();
        
        // Get current X-axis direction of tag
        const tagRight = new THREE.Vector3(1, 0, 0).applyQuaternion(tag.mesh.quaternion).normalize();
        
        // Calculate angle between current X-axis and ray from center
        const angleToRay = tagRight.angleTo(rayFromCenter);
        
        // Only reorient if X-axis not aligned with ray by more than 15 degrees
        if (angleToRay > 0.26) { // ~15 degrees in radians
            // Create rotation to align X-axis with ray from center
            const rotationSpeed = 0.12 * normalizedDeltaTime; // Quick rotation for responsive alignment
            
            // Calculate rotation axis (cross product gives perpendicular axis)
            const rotationAxis = new THREE.Vector3().crossVectors(tagRight, rayFromCenter).normalize();
            
            // If rotation axis is valid (not zero length), apply rotation
            if (rotationAxis.lengthSq() > 0.001) {
                // Create quaternion for incremental rotation
                const deltaRotation = new THREE.Quaternion().setFromAxisAngle(
                    rotationAxis, 
                    Math.min(angleToRay, rotationSpeed) // Limit rotation amount per frame
                );
                
                // Apply incremental rotation
                tag.mesh.quaternion.premultiply(deltaRotation);
                tag.mesh.quaternion.normalize(); // Normalize to prevent drift
            }
        }
    }

    /**
     * Check for and resolve collisions during rotation to prevent overlapping
     * @param {Object} tag - Tag to check for collisions
     * @param {Object} physicsData - Physics data for the tag
     * @param {number} normalizedDeltaTime - Normalized delta time for consistent physics
     */
    checkAndResolveCollisionsDuringRotation(tag, physicsData, normalizedDeltaTime) {
        // Make sure collision box is up to date
        this.updateTagBoundingBox(tag);
        
        // Look for collisions with all other tags
        for (const [otherId, otherPhysics] of this.tags) {
            if (tag.id === otherId) continue;
            const otherTag = this.getTagById(otherId);
            if (!otherTag || !otherTag.mesh) continue;
            
            // Update other tag's collision box
            this.updateTagBoundingBox(otherTag);
            
            // Check for box collision (precise)
            const boxesIntersect = tag.collisionBox.intersectsBox(otherTag.collisionBox);
            
            // Also check for close proximity even if not intersecting
            const tagCenter = new THREE.Vector3();
            const otherCenter = new THREE.Vector3();
            tag.boundingBox.getCenter(tagCenter);
            otherTag.boundingBox.getCenter(otherCenter);
            
            const centerDistance = tagCenter.distanceTo(otherCenter);
            const combinedSize = Math.max(
                (tag.physicsDimensions.x + otherTag.physicsDimensions.x) / 2,
                (tag.physicsDimensions.y + otherTag.physicsDimensions.y) / 2,
                (tag.physicsDimensions.z + otherTag.physicsDimensions.z) / 2
            );
            
            // Consider collision if boxes intersect OR centers are close
            const tooClose = centerDistance < combinedSize * 1.2; // 20% buffer zone
            
            // If boxes intersect during rotation, move this tag away
            if (boxesIntersect || tooClose) {
                // Vector pointing away from other tag
                const awayVector = tagCenter.clone().sub(otherCenter).normalize();
                
                // Strong pushback force during rotation to prevent overlapping
                // Scale based on how close/overlapping they are
                const overlapFactor = boxesIntersect ? 2.0 : (1.0 - (centerDistance / (combinedSize * 1.2)));
                const pushDistance = 0.2 * normalizedDeltaTime * overlapFactor * this.options.collisionPushScale;
                
                const pushVector = awayVector.multiplyScalar(pushDistance);
                
                // Accumulate pushback (will be applied directly to position)
                physicsData.collisionPushback.add(pushVector);
                
                // Also add a velocity component in that direction for continuous separation
                physicsData.velocity.add(awayVector.multiplyScalar(0.3 * overlapFactor));
                
                if (this.DEBUG_MODE && boxesIntersect) {
                    console.log(`Collision detected during rotation of tag ${tag.id} with ${otherId}`);
                }
            }
        }
    }

    /**
     * Apply cube-directed gravity to pull tags toward the nearest cube face after rotation
     * @param {Object} tag - Tag to apply gravity to
     * @param {Object} physicsData - Physics data for the tag
     */
    applyCubeGravity(tag, physicsData) {
        // Safety check
        if (!tag || !tag.mesh) return;
        
        // Get tag position
        const position = tag.mesh.position.clone();
        
        // Don't apply gravity if position contains NaN
        if (isNaN(position.x) || isNaN(position.y) || isNaN(position.z)) {
            return;
        }
        
        // Calculate distance to center
        const distanceToCenter = position.length();
        
        // Calculate the target cube size (how far out the cube faces should be)
        const targetCubeSize = this.options.cubeSize * 0.8; // Cube slightly smaller than overall diameter
        
        // Find the axis with the largest absolute value (closest to a cube face)
        const absX = Math.abs(position.x);
        const absY = Math.abs(position.y);
        const absZ = Math.abs(position.z);
        
        // Create gravity direction vector
        const gravityDir = new THREE.Vector3(0, 0, 0);
        
        // Determine which cube face is closest and apply gravity towards that face
        if (absX >= absY && absX >= absZ) {
            // X-axis (left or right face)
            gravityDir.x = position.x > 0 ? 1 : -1;
        } else if (absY >= absX && absY >= absZ) {
            // Y-axis (top or bottom face)
            gravityDir.y = position.y > 0 ? 1 : -1;
        } else {
            // Z-axis (front or back face)
            gravityDir.z = position.z > 0 ? 1 : -1;
        }
        
        // Calculate how far from the cube face the tag is
        const currentDist = (gravityDir.x !== 0) ? absX : 
                          (gravityDir.y !== 0) ? absY : absZ;
        
        // Calculate desired distance
        const targetDist = targetCubeSize;
        
        // Apply gravity force based on distance from the cube face
        if (currentDist < targetDist) {
            // If inside the cube, push outward toward face
            const force = gravityDir.clone().multiplyScalar(
                this.options.cubeGravityStrength * (targetDist - currentDist) / targetDist
            );
            physicsData.force.add(force);
        } else if (currentDist > targetDist) {
            // If outside the cube, pull inward toward face
            const force = gravityDir.clone().multiplyScalar(
                -this.options.cubeGravityStrength * (currentDist - targetDist) / currentDist
            );
            physicsData.force.add(force);
        }
        
        // Add extra force to center tags on their faces (horizontal/vertical centering)
        const faceNormal = gravityDir.clone();
        const tangentPos = position.clone().sub(faceNormal.clone().multiplyScalar(currentDist));
        
        // Calculate centering force (pulls toward center of face)
        if (tangentPos.lengthSq() > 0.01) {
            const centeringForce = tangentPos.clone().multiplyScalar(-0.05 * this.options.cubeGravityStrength);
            physicsData.force.add(centeringForce);
        }
    }

    /**
     * Vector safe normalization to prevent NaN errors
     * @param {THREE.Vector3} vector - Vector to normalize safely
     * @returns {THREE.Vector3} - Normalized vector or zero vector if length is too small
     */
    safeNormalize(vector) {
        const length = vector.length();
        if (length < 0.00001 || isNaN(length)) {
            return new THREE.Vector3(0, 0, 0);
        }
        return vector.clone().divideScalar(length);
    }
} 