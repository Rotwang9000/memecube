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
        this.DEBUG_MODE = false;
        
        this.scene = scene;
        this.tagManager = options.tagManager || null;
        this.options = {
            cubeSize: options.initialCubeSize || 10, // Initial cube size - will adjust dynamically
            spacing: 0.005,            // Reduced spacing for closer clumping
            centralForce: 22.5,      // Further increased central force for even tighter clumping
            surfaceForce: 0.0005,      // Reduced surface force to prevent excessive spread
            damping: 150.0,           // Damping to reduce flickering and feedback loops
            maxSpeed: 0.8,            // Max speed for movement
            collisionForce: 0.05,     // Reduced collision force for gentler pushing
            faceBalanceFactor: 0.15,  // Factor for balancing tags across faces
            flipAnimationDuration: 750, // Duration in ms for flip to face animation
            initialMoveSpeed: 0.3,     // Initial movement to kick-start flight
            easingFactor: 0.03,        // Easing factor for acceleration
            cubeGravityStrength: 0.05, // Reduced strength of gravity pulling tags toward cube faces
            postRotationBoost: 0.2,   // Boost force after rotation to form cube
            collisionPushScale: 0.2,   // Scale for collision pushback during rotation/resize
            easingCurveExponent: 1.5,  // Exponent for initial movement curve
            flipCollisionIterations: 3, // Number of collision resolution iterations during flip
            preventFlipOverlap: true,   // Prevent flipping if it would cause severe overlaps
            minFlipSpacing: 0.2,        // Minimum clear space required to allow flipping
            stationaryRecheckInterval: 0.1, // Interval to recheck stationary tags
            velocityThreshold: 0.1,      // Threshold for considering a tag as moving
            positionThreshold: 0.1,      // Threshold for considering a tag as in target position
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
            console.error("Tried to add a tag without a mesh to physics");
            return false;
        }
        
        // Calculate initial position
        const initialPosition = this.getRandomSphericalPosition();
        
        // Set tag mesh position
        tag.mesh.position.copy(initialPosition);
        
        // Assign a random face for this tag to move toward
        const targetFace = this.getLeastPopulatedFace(allTags);
        
        // Store the target face on the tag early so orientation & rotation logic can use it
        tag.physicsFace = targetFace;
        
        // Increment face count for distribution tracking
        this.faceCounts[targetFace] = (this.faceCounts[targetFace] || 0) + 1;
        
        // Calculate initial velocity toward center
        const initialVelocity = new THREE.Vector3(0, 0, 0);
        
        // Calculate mass based on tag size but with logarithmic scaling for smaller tags
        // This gives smaller tags proportionally higher mass to prevent them being flung around
        const baseSize = Math.max(tag.size || 1.0, 0.1);
        const size = Math.max(tag.mesh.scale.x, 0.5); // Ensure a minimum size of 0.5

        // Logarithmic mass calculation: 
        // - Smaller tags get higher mass relative to their size
        // - Larger tags get lower mass relative to their size
        // This creates a more balanced physics system
        const logFactor = 1 - Math.log10(Math.min(size, 10)) / Math.log10(10);
        const massFactor = 0.5 + logFactor * 0.5; // Ranges from 0.5 to 1.0
        const mass = Math.max(size * massFactor, 0.5); // Ensure minimum mass of 0.5
        
        // Set initial orientation & store target rotation for flip animation
        this.setTagFlyInOrientation(tag, initialPosition);
        
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
            creationElapsedTime: this.clock.getElapsedTime(),
            lastInteractionElapsedTime: this.clock.getElapsedTime(),
            initialMovement: true,
            frameCount: 0,
            forceDirectMove: true,
            speedFactor: 0.05,
            collisionPushback: new THREE.Vector3(0, 0, 0),
            easeProgress: 0.0,
            postRotationMoveEnabled: false,
            postRotationStartTime: 0
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
        
        // Return success
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
        
        // Track minimum counts for horizontal and vertical faces separately
        let minHorizontalCount = Infinity;
        let minVerticalCount = Infinity;
        let bestHorizontalFace = 'px';
        let bestVerticalFace = 'py';
        
        // Consider horizontal faces (px, nx, pz, nz)
        const horizontalFaces = ['px', 'nx', 'pz', 'nz'];
        const verticalFaces = ['py', 'ny'];
        
        // Find minimum count for horizontal faces
        for (const face of horizontalFaces) {
            const count = this.faceCounts[face];
            if (count < minHorizontalCount) {
                minHorizontalCount = count;
                bestHorizontalFace = face;
            }
        }
        
        // Find minimum count for vertical faces
        for (const face of verticalFaces) {
            const count = this.faceCounts[face];
            if (count < minVerticalCount) {
                minVerticalCount = count;
                bestVerticalFace = face;
            }
        }
        
        // Calculate total tags on horizontal vs vertical faces
        const totalHorizontalTags = horizontalFaces.reduce((sum, face) => sum + this.faceCounts[face], 0);
        const totalVerticalTags = verticalFaces.reduce((sum, face) => sum + this.faceCounts[face], 0);
        
        // Calculate tags per face for horizontal and vertical
        const horizontalTagsPerFace = totalHorizontalTags / 4;  // 4 horizontal faces
        const verticalTagsPerFace = totalVerticalTags / 2;      // 2 vertical faces
        
        // Bias toward vertical faces slightly to improve height proportions
        const heightBiasFactor = 0.85; // Adjust this factor to control height bias
        
        // If vertical faces have fewer tags per face (adjusted by bias), prioritize vertical
        if (verticalTagsPerFace * heightBiasFactor < horizontalTagsPerFace) {
            targetFace = bestVerticalFace;
            if (this.DEBUG_MODE) {
                console.log(`Selected vertical face ${targetFace} (v: ${verticalTagsPerFace.toFixed(2)} vs h: ${horizontalTagsPerFace.toFixed(2)})`);
            }
        } else {
            targetFace = bestHorizontalFace;
            if (this.DEBUG_MODE) {
                console.log(`Selected horizontal face ${targetFace} (h: ${horizontalTagsPerFace.toFixed(2)} vs v: ${verticalTagsPerFace.toFixed(2)})`);
            }
        }
        
        return targetFace;
    }

    /**
     * Get a random spherical position far outside the cube for dramatic fly-in
     * @returns {THREE.Vector3} - Random position on a sphere
     */
    getRandomSphericalPosition() {
        const radius = this.options.cubeSize * 5; // Start even further out for more dramatic effect
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
        // Make text orientation random by adding random 180-degree rotation
        const isUpsideDown = Math.random() > 0.5;
        const flipY = isUpsideDown ? Math.PI : 0;

        switch (face) {
            case 'px': return new THREE.Euler(0, flipY, Math.PI / 2);
            case 'nx': return new THREE.Euler(0, Math.PI + flipY, -Math.PI / 2);
            case 'py': return new THREE.Euler(Math.PI / 2, flipY, 0);
            case 'ny': return new THREE.Euler(-Math.PI / 2, flipY, 0);
            case 'pz': return new THREE.Euler(0, Math.PI / 2 + flipY, Math.PI / 2);
            case 'nz': return new THREE.Euler(0, -Math.PI / 2 + flipY, -Math.PI / 2);
            default: return new THREE.Euler(0, flipY, 0);
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
            const requiredSpace = combinedSize * 1.2; // 20% extra spacing
            
            // If too close, push away gently and smoothly
            if (distance < requiredSpace) {
                // Calculate direction and a gentler force
                const direction = otherCenter.clone().sub(tagCenter).normalize();
                const pushForce = (requiredSpace - distance) * 0.2 * forceFactor; // Force for smoother movement
                
                // Apply a velocity change for smoother movement over time
                otherPhysics.velocity.add(direction.multiplyScalar(pushForce));
                
                // Reset any immovability on the pushed tag to allow movement
                otherPhysics.immovableUntil = 0;
                
                // Avoid immediate position adjustment unless overlap is severe
                if (distance < combinedSize * 0.7) {
                    const adjustment = direction.clone().multiplyScalar((combinedSize * 0.7) - distance);
                    otherTag.mesh.position.add(adjustment);
                }
                
                if (this.DEBUG_MODE) {
                    console.log(`Tag ${tag.id} gently pushing ${otherId} with force ${pushForce}`);
                }
            }
        }
    }

    /**
     * Update physics simulation - main update loop
     */
    update() {
        // Performance monitoring
        const perfStart = performance.now();
        const perfMetrics = {
            total: 0,
            deltaTime: 0,
            collisions: 0,
            tagUpdates: 0,
            overlapResolution: 0,
            cleanup: 0,
            tags: this.tags.size
        };
        
        // Skip physics update if document is not visible or simulation is paused
        if (!this.isDocumentVisible || this.isPaused) {
            // Reset the clock when we're paused to avoid large delta on resume
            if (this.isPaused) {
                this.clock.getDelta(); // Consume the delta time
            }
            return;
        }

        // Use THREE.Clock for consistent timing
        const dtStart = performance.now();
        const deltaTime = Math.min(this.clock.getDelta(), 0.05); // Cap at 50ms (20fps minimum)
        this.lastDeltaTime = deltaTime;

        // Scale factor to normalize physics rate (16.67ms is approx 60fps)
        const normalizedDeltaTime = deltaTime / 0.01667;
        
        // Get current elapsed time for time-based calculations
        const currentElapsedTime = this.clock.getElapsedTime();
        perfMetrics.deltaTime = performance.now() - dtStart;

        // Clean up any invalid tag references that might cause errors
        const cleanupStart = performance.now();
        this.cleanupInvalidTags();
        perfMetrics.cleanup = performance.now() - cleanupStart;
        
        // Track tags that need floating effects
        const flippedStationaryTags = [];
        
        // Flag to track if we found any stationary tags that should be moving
        let foundStationaryTags = false;

        // Process each tag
        const tagUpdateStart = performance.now();
        for (const [tagId, physicsData] of this.tags.entries()) {
            // Collect flipped stationary tags for floating effects
            if (physicsData.flipCompleted && 
                (!physicsData.isMoving || physicsData.velocity.length() < 0.1)) {
                const tag = this.getTagById(tagId);
                if (tag && tag.mesh) {
                    flippedStationaryTags.push({tag, physicsData});
                }
            }
            
            // Skip tags that have been fully processed and are stationary,
            // unless they're older than our recheck interval
            if (!physicsData.isMoving) {
                const timeSinceLastInteraction = currentElapsedTime - (physicsData.lastInteractionElapsedTime || 0);
                if (timeSinceLastInteraction < this.options.stationaryRecheckInterval) {
                    continue;
                } else {
                    // Time to recheck this stationary tag
                    foundStationaryTags = true;
                }
            }

            // Update this tag's physics and position
            this.updateSingleTag(tagId, physicsData, normalizedDeltaTime, currentElapsedTime);
            
            // Reset isMoving flag - will be set to true if actually moving
            physicsData.isMoving = false;
            
            // Check if tag is still moving based on velocity threshold
            const speed = physicsData.velocity ? physicsData.velocity.length() : 0;
            if (speed > this.options.velocityThreshold) {
                physicsData.isMoving = true;
            }
            
            // Also check if the tag is in its target position
            if (physicsData.targetPosition) {
                const tagObject = this.getTagById(tagId);
                if (tagObject && tagObject.mesh && tagObject.mesh.position) {
                    const distanceToTarget = physicsData.targetPosition.distanceTo(tagObject.mesh.position);
                    if (distanceToTarget > this.options.positionThreshold) {
                        physicsData.isMoving = true;
                    }
                } else {
                    // If tag doesn't exist or has no mesh, mark it for cleanup
                    console.warn(`Tag ${tagId} referenced in physics but doesn't exist or has no mesh - will be cleaned up`);
                    this.tags.delete(tagId);
                }
            }
        }
        perfMetrics.tagUpdates = performance.now() - tagUpdateStart;

        // Apply floating effects to all flipped stationary tags
        // This ensures the floating effect works even if tag updates are skipped
        if (flippedStationaryTags.length > 0) {
            this.applyFloatingEffects(flippedStationaryTags, currentElapsedTime);
        }

        // Ensure tags don't overlap after all updates
        const collisionStart = performance.now();
        this.ensureNoOverlap(2); // Reduced iterations for performance (was 4)
        perfMetrics.overlapResolution = performance.now() - collisionStart;
        
        // Calculate total time and log if it's too high  
        perfMetrics.total = performance.now() - perfStart;
        if (perfMetrics.total > 10) { // Log if over 10ms
            console.log('Physics performance:', perfMetrics);
        }
    }
    
    /**
     * Apply floating effects to flipped stationary tags
     * @param {Array} tags - Array of {tag, physicsData} objects to apply floating to
     * @param {number} currentElapsedTime - Current elapsed time
     */
    applyFloatingEffects(tags, currentElapsedTime) {
        // Get current time for smooth oscillation
        const currentTime = currentElapsedTime;
        
        for (const {tag, physicsData} of tags) {
            // Use tag ID to create different oscillation patterns for each tag
            const tagIdSum = physicsData.uniqueFloatOffset || this.createUniqueFloatOffset();
            physicsData.uniqueFloatOffset = tagIdSum;
            
            // Create smooth oscillations with different frequencies and phases
            // This creates a much more natural, wavy floating motion
            const floatStrength = 0.02; // More reasonable value for direct position changes
            
            // Calculate smooth floating forces using sine waves with different frequencies
            const floatX = Math.sin(currentTime * 0.7 + tagIdSum) * floatStrength;
            const floatY = Math.sin(currentTime * 0.5 + tagIdSum * 1.3) * floatStrength;
            const floatZ = Math.sin(currentTime * 0.6 + tagIdSum * 0.7) * floatStrength;
            
            // Create float vector
            const floatVector = new THREE.Vector3(floatX, floatY, floatZ);
            
            // Directly modify position to bypass damping
            tag.mesh.position.add(floatVector);
            
            // Reset any velocity that might counteract our position change
            physicsData.velocity.set(0, 0, 0);
            
            // Update bounding box after position change
            this.updateTagBoundingBox(tag);
        }
    }
    
    /**
     * Clean up any invalid tag references in the physics system
     * This prevents errors when trying to access properties of deleted tags
     */
    cleanupInvalidTags() {
        const tagsToRemove = [];
        
        // Find tags that don't exist or have no mesh
        for (const [tagId, physicsData] of this.tags.entries()) {
            const tag = this.getTagById(tagId);
            if (!tag || !tag.mesh) {
                tagsToRemove.push(tagId);
            }
        }
        
        // Remove invalid tags
        if (tagsToRemove.length > 0) {
            console.log(`Cleaning up ${tagsToRemove.length} invalid tag references from physics system`);
            tagsToRemove.forEach(tagId => {
                this.tags.delete(tagId);
            });
        }
    }
    
    /**
     * Update a single tag's physics and position
     * @param {string} tagId - Tag identifier
     * @param {Object} physicsData - Physics data for the tag
     * @param {number} normalizedDeltaTime - Normalized time delta
     * @param {number} currentElapsedTime - Current elapsed time
     */
    updateSingleTag(tagId, physicsData, normalizedDeltaTime, currentElapsedTime) {
        const tag = this.getTagById(tagId);
        if (!tag || !tag.mesh) return;

        // Fix any NaN values and update frame counter
        this.fixNaNValues(tag, physicsData);
        physicsData.frameCount = (physicsData.frameCount || 0) + 1;
        
        // Debug output for early frames
        this.logDebugInfoIfNeeded(tagId, tag, physicsData);

        // Handle dramatic entry movement for new tags
        if (this.handleEntryMovement(tagId, tag, physicsData, normalizedDeltaTime)) {
            return; // Early return for direct movement mode
        }

        // Calculate age for time-based behavior
        const ageInSeconds = currentElapsedTime - (physicsData.creationElapsedTime || 0);
        physicsData.initialMovement = ageInSeconds < 3.0;

        // Apply smooth position adjustment if set (for collision responses)
        if (physicsData.targetAdjustment && physicsData.targetAdjustment.lengthSq() > 0 && physicsData.smoothMoveStartTime) {
            const elapsedSinceStart = currentElapsedTime - physicsData.smoothMoveStartTime;
            const progress = Math.min(elapsedSinceStart / physicsData.smoothMoveDuration, 1.0);
            if (progress < 1.0) {
                // Apply partial adjustment based on progress
                const adjustmentThisFrame = physicsData.targetAdjustment.clone().multiplyScalar(progress);
                tag.mesh.position.add(adjustmentThisFrame);
                // Reduce target adjustment by what's been applied
                physicsData.targetAdjustment.sub(adjustmentThisFrame);
            } else {
                // Complete the adjustment and clear the target
                tag.mesh.position.add(physicsData.targetAdjustment);
                physicsData.targetAdjustment.set(0, 0, 0);
                delete physicsData.smoothMoveStartTime;
                delete physicsData.smoothMoveDuration;
            }
            this.updateTagBoundingBox(tag);
            
            // Check for NaN values after adjustment
            this.fixNaNValues(tag, physicsData);
        }

        // Apply various physics forces and update velocity
        this.applyPhysicsForces(tag, physicsData, normalizedDeltaTime, currentElapsedTime, ageInSeconds);
        
        // Check for NaN values after physics forces
        this.fixNaNValues(tag, physicsData);
        
        // Handle rotation or regular movement based on tag state
        if (physicsData.flipStartElapsedTime) {
            this.handleTagRotation(tag, physicsData, currentElapsedTime, normalizedDeltaTime);
        } else {
            this.handleTagMovement(tag, physicsData, normalizedDeltaTime, currentElapsedTime, ageInSeconds);
        }
        
        // Final NaN check after all movement updates
        this.fixNaNValues(tag, physicsData);
        
        // Always update bounding box after position changes
        this.updateTagBoundingBox(tag);
    }
    
    /**
     * Fix NaN values in position and velocity
     */
    fixNaNValues(tag, physicsData) {
        if (isNaN(tag.mesh.position.x) || isNaN(tag.mesh.position.y) || isNaN(tag.mesh.position.z)) {
            console.warn(`Fixed NaN position for tag ${tag.id}`);
            tag.mesh.position.set(0, 0, 0);
        }

        if (physicsData.velocity && (isNaN(physicsData.velocity.x) || isNaN(physicsData.velocity.y) || isNaN(physicsData.velocity.z))) {
            console.warn(`Fixed NaN velocity for tag ${tag.id}`);
            physicsData.velocity.set(0, 0, 0);
        }
        
        if (physicsData.force && (isNaN(physicsData.force.x) || isNaN(physicsData.force.y) || isNaN(physicsData.force.z))) {
            console.warn(`Fixed NaN force for tag ${tag.id}`);
            physicsData.force.set(0, 0, 0);
        }
    }
    
    /**
     * Vector safe normalization to prevent NaN errors
     * @param {THREE.Vector3} vector - Vector to normalize safely
     * @returns {THREE.Vector3} - Normalized vector or default vector if length is too small
     */
    safeNormalize(vector) {
        const length = vector.length();
        if (length < 0.00001 || isNaN(length)) {
            // Return a default unit vector instead of zero vector
            return new THREE.Vector3(0, 0, 1);
        }
        return vector.clone().divideScalar(length);
    }
    
    /**
     * Log debug information for early frames
     */
    logDebugInfoIfNeeded(tagId, tag, physicsData) {
        if (this.DEBUG_MODE && physicsData.frameCount <= 50 && physicsData.frameCount % 10 === 0) {
            if (!isNaN(tag.mesh.position.x) && !isNaN(physicsData.velocity.x)) {
                console.log(`Tag ${tagId} frame ${physicsData.frameCount} - position:`, tag.mesh.position.clone(), 
                    'velocity:', physicsData.velocity.clone(), 'length:', physicsData.velocity.length(),
                    'forceDirectMove:', physicsData.forceDirectMove);
            }
        }
    }
    
    /**
     * Handle dramatic entry movement with easing
     * @returns {boolean} True if tag is in direct movement mode
     */
    handleEntryMovement(tagId, tag, physicsData, normalizedDeltaTime) {
        // Always ensure there's an initial velocity pointing to center
        if (physicsData.frameCount === 1) {
            // Get direction to center
            const toCenter = new THREE.Vector3(0, 0, 0).sub(tag.mesh.position).normalize();
            
            // Set initial velocity at 0.5 times max speed, pointing to center
            physicsData.velocity = toCenter.clone().multiplyScalar(this.options.maxSpeed * 0.5);
            physicsData.easeProgress = 0.0;
            
            console.log(`Initializing tag ${tagId} velocity:`, physicsData.velocity.clone());
        }
    
        // For the first 60 frames, use direct movement with dramatic easing
        if (physicsData.frameCount <= 60 && physicsData.forceDirectMove) {
            // Get direction to center
            const toCenter = new THREE.Vector3(0, 0, 0).sub(tag.mesh.position).normalize();
            
            // Update easing progress (0.0 to 1.0)
            physicsData.easeProgress = Math.min(1.0, (physicsData.easeProgress || 0) + 
                                              (this.options.easingFactor * normalizedDeltaTime * 5.0));
            
            // Apply non-linear easing curve for dramatic entry (slow start, faster end)
            const easeCurve = Math.pow(physicsData.easeProgress, this.options.easingCurveExponent);
            physicsData.speedFactor = easeCurve * 0.8;
            
            // Calculate movement vector
            const easedSpeed = this.options.initialMoveSpeed * 5.0 * physicsData.speedFactor;
            const directMoveAmount = easedSpeed * normalizedDeltaTime;
            const moveVector = toCenter.multiplyScalar(directMoveAmount);
            
            // Apply movement directly
            tag.mesh.position.add(moveVector);
            
            // Debug logging for first frame
            if (this.DEBUG_MODE && physicsData.frameCount === 1) {
                console.log(`Force moving tag ${tagId} directly by:`, moveVector, 'speed factor:', physicsData.speedFactor);
            }
            
            // Set velocity for subsequent frames
            physicsData.velocity = toCenter.clone().multiplyScalar(this.options.maxSpeed * physicsData.speedFactor);
            
            // End direct movement after sufficient frames or allow physics to begin working
            if (physicsData.frameCount > 10) {
                physicsData.forceDirectMove = false;
            }
            
            // Return true to skip physics for initial frames only
            return physicsData.frameCount <= 15;
        }
        
        return false;
    }
    
    /**
     * Apply all physics forces to tag
     */
    applyPhysicsForces(tag, physicsData, normalizedDeltaTime, currentElapsedTime, ageInSeconds) {
        // Reset force for this frame
        physicsData.force = new THREE.Vector3(0, 0, 0);
        
        // Apply central attractive force
        this.applyCentralForce(tag, physicsData, currentElapsedTime);
        
        // Apply orientation forces
        this.applyOrientationForces(tag, physicsData, ageInSeconds);
        
        // Apply cube formation forces after rotation
        if (physicsData.flipCompleted) {
            this.applyCubeFormationForces(tag, physicsData, currentElapsedTime);
        }
        
        // Apply collision forces
        if (physicsData.frameCount > 3) {
            this.applyCollisionForces(tag, physicsData, currentElapsedTime);
        }
        
        // Apply jitter for better packing
        this.applyJitterForces(physicsData, ageInSeconds);
        
        // Update velocity based on accumulated forces
        this.updateVelocity(tag, physicsData, normalizedDeltaTime, currentElapsedTime, ageInSeconds);
        
        // Apply magnetic orientation during flight
        if (!physicsData.flipStartElapsedTime && !physicsData.flipCompleted && tag.originalRotation && ageInSeconds > 1.0) {
            this.applyMagneticReorientation(tag, normalizedDeltaTime);
        }
    }
    
    /**
     * Calculate gravity reduction factor based on flipped tags ratio
     * @returns {number} - Gravity reduction factor (0.2 to 1.0)
     */
    calculateGravityReductionFactor() {
        // Calculate the proportion of tags that have flipped
        let flippedTagCount = 0;
        let totalTagCount = this.tags.size;
        
        for (const [_, data] of this.tags) {
            if (data.flipCompleted) {
                flippedTagCount++;
            }
        }
        
        // Calculate gravity reduction factor
        let gravityReductionFactor = 1.0;
        // if (totalTagCount > 0) {
        //     const flippedRatio = flippedTagCount / totalTagCount;
        //     // Scale from 1.0 to 0.2 - more flipped tags = less central gravity
        //     gravityReductionFactor = Math.max(0.2, 1.0 - (flippedRatio * 0.8));
        // }
        
        return gravityReductionFactor;
    }
    
    /**
     * Apply central attractive force toward center
     */
    applyCentralForce(tag, physicsData, currentElapsedTime) {
        const distance = tag.mesh.position.length();
        const normalizedDist = Math.max(distance / (this.options.cubeSize || 1), 0.1); // Ensure non-zero
        const ageFactor = this.calculateAgeFactor(physicsData, currentElapsedTime);
        const sizeFactor = physicsData.size / 1.5;
        
        // Get gravity reduction factor based on proportion of flipped tags
        const gravityReductionFactor = this.calculateGravityReductionFactor();
        
        // Dynamic multiplier – stronger when further from centre or not yet rotated
        const baseMultiplier = physicsData.flipCompleted ? 3.5 : 6.0;
        
        // Use inverse square law for central force - stronger pull when further out
        const centralForce = this.options.centralForce * baseMultiplier * (normalizedDist * normalizedDist) * 
                            (1 + sizeFactor) * gravityReductionFactor;
        
        const toCenter = this.safeNormalize(tag.mesh.position.clone().negate());
        physicsData.force.add(toCenter.multiplyScalar(centralForce));
        
        // Give a gentle velocity nudging if current speed is very low but tag is still far
        if (physicsData.velocity.length() < 0.05 && distance > this.options.cubeSize * 0.9) {
            physicsData.velocity.add(toCenter.multiplyScalar(0.1 * gravityReductionFactor));
        }
    }
    
    /**
     * Apply forces related to face orientation
     */
    applyOrientationForces(tag, physicsData, ageInSeconds) {
        // Surface force
        const surfaceNormal = this.getFaceNormal(physicsData.face);
        const surfaceForce = this.options.surfaceForce * 0.2;
        physicsData.force.add(surfaceNormal.multiplyScalar(surfaceForce));
        
        // Face gravity force
        if (ageInSeconds > 5.0 && !physicsData.flipCompleted && !physicsData.flipStartElapsedTime) {
            const faceGravityForce = 0.15 * (1 + physicsData.size / 1.5);
            physicsData.force.add(surfaceNormal.multiplyScalar(-faceGravityForce));
        }
    }
    
    /**
     * Apply forces for cube formation after rotation
     */
    applyCubeFormationForces(tag, physicsData, currentElapsedTime) {
        // Apply cube gravity
        this.applyCubeGravity(tag, physicsData);
        
        // Get gravity reduction factor based on proportion of flipped tags
        const gravityReductionFactor = this.calculateGravityReductionFactor();
        
        // Enable post-rotation movement
        if (!physicsData.postRotationMoveEnabled) {
            physicsData.postRotationMoveEnabled = true;
            physicsData.postRotationStartTime = currentElapsedTime;
            physicsData.immovableUntil = 0; // Reset immovability
            
            // Apply inward impulse with reduction factor
            const inwardImpulse = tag.mesh.position.clone().negate().normalize()
                .multiplyScalar(this.options.postRotationBoost * gravityReductionFactor);
            physicsData.velocity.add(inwardImpulse);
            
            if (this.DEBUG_MODE) {
                console.log(`Tag ${tag.id} post-rotation movement enabled, applied impulse:`, inwardImpulse);
            }
        }
        
        // Apply decreasing boost during first 5 seconds
        if (physicsData.postRotationMoveEnabled) {
            const postRotationElapsed = currentElapsedTime - physicsData.postRotationStartTime;
            if (postRotationElapsed < 5.0) {
                const boostFactor = 1.0 - (postRotationElapsed / 5.0);
                const inwardBoost = tag.mesh.position.clone().negate().normalize().multiplyScalar(
                    this.options.postRotationBoost * boostFactor * gravityReductionFactor
                );
                physicsData.force.add(inwardBoost);
            }
        }
    }
    
    /**
     * Apply jitter forces for better packing
     */
    applyJitterForces(physicsData, ageInSeconds) {
        // Skip if tag is not flipped
        if (!physicsData.flipCompleted) return;
        
        // Only apply jitter forces to tags that are moving
        // Stationary flipped tags are now handled by applyFloatingEffects
        const isMovingFromCollision = physicsData.lastCollisionElapsedTime && 
                                    (this.clock.getElapsedTime() - physicsData.lastCollisionElapsedTime < 1.0);
        
        // Only apply jitter if the tag is actively moving (being pushed around)
        if (!isMovingFromCollision || physicsData.velocity.length() <= 0.2) return;
        
        // Apply small random jitter to assist with packing
        const jitterStrength = 0.005 * Math.random();
        const jitterVector = new THREE.Vector3(
            (Math.random() - 0.5) * jitterStrength,
            (Math.random() - 0.5) * jitterStrength,
            (Math.random() - 0.5) * jitterStrength
        );
        
        // Add jitter to velocity
        physicsData.velocity.add(jitterVector);
    }
    
    /**
     * Find tag ID for physics data by looking through all tags
     * @param {Object} targetPhysicsData - The physics data to find the tag ID for
     * @returns {string|null} - The tag ID if found, null otherwise
     */
    findTagIdForPhysicsData(targetPhysicsData) {
        for (const [tagId, physicsData] of this.tags.entries()) {
            if (physicsData === targetPhysicsData) {
                // Store the ID for future reference
                physicsData.tagId = tagId;
                return tagId;
            }
        }
        return null;
    }
    
    /**
     * Create a unique float offset for a tag based on its ID
     * @returns {number} - A value between 0 and 2π for phase offset
     */
    createUniqueFloatOffset() {
        // Generate a random float offset if we don't have a tag ID
        return Math.random() * Math.PI * 2;
    }
    
    /**
     * Update velocity based on collision forces
     * @param {Object} tag - Tag to apply forces to
     * @param {Object} physicsData - Physics data for tag
     * @param {number} normalizedDeltaTime - Normalized delta time
     * @param {number} currentElapsedTime - Current elapsed time for age calculations
     * @param {number} ageInSeconds - Age of tag in seconds
     */
    updateVelocity(tag, physicsData, normalizedDeltaTime, currentElapsedTime, ageInSeconds) {
        // Apply very strong braking when collisions are detected
        if (physicsData.isColliding) {
            // Apply 80% velocity reduction upon collision for aggressive braking
            physicsData.velocity.multiplyScalar(0.2);
            
            // Exit early to prevent adding more velocity during collision
            return;
        }
        
        // Calculate size-based damping - smaller tags need more damping to remain stable
        const tagSize = physicsData.size || 1.0;
        const sizeFactor = Math.max(0.5, Math.min(1.0, tagSize / 3)); // Clamp between 0.5 and 1.0
        const inverseSizeFactor = 1 - (sizeFactor - 0.5) * 0.5; // Range from 1.0 (small) to 0.75 (large)
        
        // Handle special cases for new tags and post-rotation effects
        // We want different behavior based on tag age
        if (ageInSeconds < 1.5) {
            // Early after tag creation - use high damping, lower max speed
            const earlyDamping = 0.95 * inverseSizeFactor; // Higher damping for smaller tags
            physicsData.velocity.multiplyScalar(earlyDamping);
        } else if (ageInSeconds < 5) {
            // Settling phase - more natural physics
            const midDamping = 0.9 * inverseSizeFactor; // Higher damping for smaller tags
            physicsData.velocity.multiplyScalar(midDamping);
        } else {
            // Settled tag - very high damping to keep stable
            const lateDamping = 0.8 * inverseSizeFactor; // Higher damping for smaller tags
            physicsData.velocity.multiplyScalar(lateDamping);
        }
        
        // Apply a force-based acceleration
        if (physicsData.force) {
            // Calculate acceleration based on mass (F = ma, so a = F/m)
            const mass = Math.max(physicsData.mass || 1.0, 0.1); // Ensure we don't divide by zero
            
            // Scale force by a factor to prevent excessive acceleration
            const scaledForce = physicsData.force.clone().multiplyScalar(0.3 * sizeFactor);
            
            // Calculate acceleration vector (a = F/m)
            const acceleration = scaledForce.divideScalar(mass);
            
            // Update velocity (v = v + a*dt)
            physicsData.velocity.add(acceleration.multiplyScalar(normalizedDeltaTime));
        }
        
        // Cap velocity to max speed to prevent excessive movement
        // Need different caps for different tag ages
        let maxSpeed = this.options.maxSpeed * sizeFactor;
        
        // Scale max speed by tag age
        if (ageInSeconds < 1.5) {
            maxSpeed *= 0.5; // Lower max speed for new tags
        } else if (ageInSeconds < 5) {
            maxSpeed *= 0.7; // Mid max speed for settling tags
        } else if (physicsData.collisionPushback && physicsData.collisionPushback.lengthSq() > 0) {
            // If we have a collision pushback, temporarily allow higher speed
            maxSpeed *= 1.5;
        }
        
        // Constrain velocity to max speed
        const currentSpeed = physicsData.velocity.length();
        if (currentSpeed > maxSpeed) {
            physicsData.velocity.multiplyScalar(maxSpeed / currentSpeed);
        }
        
        // Apply strong braking when speed is very low to prevent perpetual motion
        if (currentSpeed < 0.05) {
            physicsData.velocity.multiplyScalar(0.7); // 70% velocity reduction
        }
        
        // Apply velocity constraints to prevent extreme values
        this.constrainVelocity(tag, physicsData.velocity);
    }
    
    /**
     * Align velocity toward center during flight
     */
    alignVelocityToCenter(tag, physicsData, normalizedDeltaTime) {
        const currentDirection = this.safeNormalize(physicsData.velocity.clone());
        const idealDirection = this.safeNormalize(new THREE.Vector3(0, 0, 0).sub(tag.mesh.position));
        const angleToIdeal = currentDirection.angleTo(idealDirection);
        
        if (angleToIdeal > 0.8) { // ~45 degrees
            const alignmentStrength = 0.2;
            const alignmentFactor = alignmentStrength * normalizedDeltaTime;
            
            const blendedDirection = currentDirection.clone()
                .multiplyScalar(1 - alignmentFactor)
                .add(idealDirection.multiplyScalar(alignmentFactor));
            
            const normalizedBlendedDirection = this.safeNormalize(blendedDirection);
            const currentSpeed = physicsData.velocity.length();
            physicsData.velocity.copy(normalizedBlendedDirection.multiplyScalar(currentSpeed));
        }
    }
    
    /**
     * Apply immovability check to prevent movement loops
     */
    applyImmovabilityCheck(tag, physicsData, normalizedDeltaTime, currentElapsedTime) {
        const skipImmovabilityCheck = 
            physicsData.frameCount <= 10 || 
            (physicsData.postRotationMoveEnabled && 
             currentElapsedTime - physicsData.postRotationStartTime < 3.0) ||
            physicsData.flipStartElapsedTime;
        
        if (!skipImmovabilityCheck) {
            const velocityDelta = physicsData.velocity.clone().multiplyScalar(normalizedDeltaTime);
            const movedDistance = velocityDelta.length();
            
            if (movedDistance > 0.05) {
                physicsData.lastSignificantMoveTime = currentElapsedTime;
                physicsData.immovableUntil = currentElapsedTime + 1.0; // Shorter freeze period
            }
            
            if (physicsData.immovableUntil && currentElapsedTime < physicsData.immovableUntil) {
                // Instead of freezing completely, heavily damp velocity for smoother effect
                physicsData.velocity.multiplyScalar(0.2);
            }
        }
    }
    
    /**
     * Handle tag rotation animation and collision resolution
     */
    handleTagRotation(tag, physicsData, currentElapsedTime, normalizedDeltaTime) {
        // Reset accumulated pushback force
        physicsData.collisionPushback = physicsData.collisionPushback || new THREE.Vector3(0, 0, 0);
        physicsData.collisionPushback.set(0, 0, 0);
        
        // Apply multiple iterations of collision resolution for better stability
        for (let i = 0; i < 3; i++) {
            this.checkAndResolveCollisionsDuringRotation(tag, physicsData, normalizedDeltaTime/3);
            
            // Apply pushback after each iteration
            if (physicsData.collisionPushback.lengthSq() > 0) {
                tag.mesh.position.add(physicsData.collisionPushback.clone().divideScalar(3));
                physicsData.collisionPushback.set(0, 0, 0);
                this.updateTagBoundingBox(tag);
            }
        }
        
        // Progress flip animation
        const flipElapsedTime = (currentElapsedTime - physicsData.flipStartElapsedTime) * 2500;
        if (flipElapsedTime < this.options.flipAnimationDuration) {
            // Ensure we have proper quaternions for rotation
            if (!physicsData.startQuaternion || !tag.originalRotation) {
                // If missing, recreate them
                physicsData.startQuaternion = tag.mesh.quaternion.clone();
                
                // If originalRotation is missing, recreate it from the target face
                if (!tag.originalRotation) {
                    const face = tag.physicsFace || physicsData.face;
                    console.log(`Recreating missing rotation for tag ${tag.id}, face: ${face}`);
                    const faceRotation = this.getFaceRotation(face);
                    tag.originalRotation = faceRotation;
                }
            }
            
            // Update rotation
            const progress = flipElapsedTime / this.options.flipAnimationDuration;
            
            // Get the target quaternion from the face rotation
            const targetQuaternion = new THREE.Quaternion().setFromEuler(tag.originalRotation);
            
            // Use slerp for smooth rotation
            tag.mesh.quaternion.slerpQuaternions(physicsData.startQuaternion, targetQuaternion, progress);
            
            // Continue moving towards center during flip with normal speed
            const positionDelta = physicsData.velocity.clone().multiplyScalar(normalizedDeltaTime);
            tag.mesh.position.add(positionDelta);
            
            // Check for new collisions after rotation and movement
            this.updateTagBoundingBox(tag);
            physicsData.collisionPushback.set(0, 0, 0);
            this.checkAndResolveCollisionsDuringRotation(tag, physicsData, normalizedDeltaTime);
            
            // Apply final pushback
            if (physicsData.collisionPushback.lengthSq() > 0) {
                tag.mesh.position.add(physicsData.collisionPushback);
                this.updateTagBoundingBox(tag);
            }
        } else {
            // Rotation complete
            if (tag.originalRotation) {
                tag.mesh.rotation.copy(tag.originalRotation);
            } else {
                // If originalRotation is missing, recreate from the face
                const face = tag.physicsFace || physicsData.face;
                const faceRotation = this.getFaceRotation(face);
                tag.mesh.rotation.copy(faceRotation);
                console.log(`Applied face rotation directly to tag ${tag.id}`);
            }
            
            // Clean up rotation state
            delete tag.originalRotation;
            delete physicsData.startQuaternion;
            
            // Apply inward impulse with appropriate strength
            const inwardDirection = this.safeNormalize(tag.mesh.position.clone().negate());
            physicsData.velocity.add(inwardDirection.multiplyScalar(0.1));
            
            // Apply moderate braking to allow some continued movement towards center
            physicsData.velocity.multiplyScalar(0.5);
            
            // Mark as completed
            physicsData.flipCompleted = true;
            delete physicsData.flipStartElapsedTime;
            
            // Log completion
            console.log(`Tag ${tag.id} rotation completed`);
        }
    }
    
    /**
     * Handle normal tag movement (non-rotating)
     */
    handleTagMovement(tag, physicsData, normalizedDeltaTime, currentElapsedTime, ageInSeconds) {
        // Constrain velocity based on tag age
        const constrainedVelocity = ageInSeconds > 6.0 ? 
            this.constrainVelocity(tag, physicsData.velocity) : physicsData.velocity;

        // Update position
        const positionDelta = constrainedVelocity.clone().multiplyScalar(normalizedDeltaTime);
        tag.mesh.position.add(positionDelta);
        
        // Track if tag is still moving
        physicsData.isMoving = constrainedVelocity.length() > 0.01;

        // Check if tag has settled and should start flipping
        const isSettled = this.checkIfTagHasSettled(tag, physicsData, ageInSeconds, currentElapsedTime);
        
        // Debug output to help diagnose flipping issues
        if (physicsData.frameCount % 120 === 0 && this.DEBUG_MODE) {
            console.log(`Tag ${tag.id} flip check:`, {
                isSettled,
                hasOriginalRotation: !!tag.originalRotation,
                flipping: !!physicsData.flipStartElapsedTime
            });
        }
        
        if (isSettled && tag.originalRotation && !physicsData.flipStartElapsedTime) {
            // Check if there's enough space to flip
            if (this.options.preventFlipOverlap) {
                const canFlipSafely = this.checkSpaceForFlipping(tag);
                if (!canFlipSafely) {
                    if (this.DEBUG_MODE) {
                        console.log(`Tag ${tag.id} waiting for more space before flipping`);
                    }
                    return;
                }
            }
            
            // Start flip animation
            physicsData.flipStartElapsedTime = currentElapsedTime;
            physicsData.startQuaternion = tag.mesh.quaternion.clone();
            physicsData.isFullySettled = false;
            
            // Ensure face for rotation is available
            if (!tag.physicsFace) {
                tag.physicsFace = physicsData.face;
            }
            
            // Output helpful diagnostic info
            console.log(`Tag ${tag.id} starting flip animation at ${currentElapsedTime}, face: ${tag.physicsFace}`);
        }
    }
    
    /**
     * Resolve all remaining collisions after individual updates
     */
    resolvePostUpdateCollisions(normalizedDeltaTime) {
        // Resolve collisions for flipping tags
        for (let i = 0; i < 3; i++) {
            // Find all currently flipping tags
            const flippingTags = [];
            for (const [tagId, physicsData] of this.tags) {
                if (physicsData.flipStartElapsedTime) {
                    const tag = this.getTagById(tagId);
                    if (tag && tag.mesh) {
                        flippingTags.push({tag, physicsData});
                    }
                }
            }
            
            // If no flipping tags, skip additional resolution
            if (flippingTags.length === 0) break;
            
            // Process each flipping tag
            let movementOccurred = false;
            for (const {tag, physicsData} of flippingTags) {
                // Extra collision check and resolution
                physicsData.collisionPushback = new THREE.Vector3(0, 0, 0);
                this.checkAndResolveCollisionsDuringRotation(tag, physicsData, normalizedDeltaTime/3);
                
                // Apply pushback if any
                if (physicsData.collisionPushback.lengthSq() > 0) {
                    tag.mesh.position.add(physicsData.collisionPushback);
                    this.updateTagBoundingBox(tag);
                    movementOccurred = true;
                }
            }
            
            // If no movement occurred in this pass, we can stop
            if (!movementOccurred) break;
        }
        
        // Final pass using strong collision resolution
        this.resolveAnyRemainingCollisions(normalizedDeltaTime);
    }
    
    /**
     * Resolve any remaining collisions with an extra strong approach
     * @param {number} normalizedDeltaTime - Normalized time delta
     */
    resolveAnyRemainingCollisions(normalizedDeltaTime) {
        // First identify which tags are currently flipping or have just completed flipping
        const activeTags = [];
        
        for (const [tagId, physicsData] of this.tags) {
            if (physicsData.flipStartElapsedTime || 
                (physicsData.flipCompleted && this.clock.getElapsedTime() - physicsData.postRotationStartTime < 1.0)) {
                const tag = this.getTagById(tagId);
                if (tag && tag.mesh) {
                    activeTags.push({tag, physicsData});
                }
            }
        }
        
        // Check ALL tags frequently for interlocking
        // This helps catch and fix any tags that somehow ended up interlocked
        const currentTime = this.clock.getElapsedTime();
        if (activeTags.length === 0) {
            // Run a full collision check every 0.1 seconds
            if (!this.lastFullCollisionCheck || (currentTime - this.lastFullCollisionCheck) > 0.1) {
                this.lastFullCollisionCheck = currentTime;
                
                // Check all tags
                for (const [tagId, physicsData] of this.tags) {
                    const tag = this.getTagById(tagId);
                    if (!tag || !tag.mesh) continue;
                    activeTags.push({tag, physicsData});
                }
                
                if (this.DEBUG_MODE) {
                    console.log(`Running full collision check at ${currentTime.toFixed(2)}`);
                }
            } else {
                // No active tags and not time for full check
                return;
            }
        }
        
        // Multiple iterations for better convergence
        for (let iteration = 0; iteration < 3; iteration++) {
            let maxOverlap = 0;
            let totalRepositionings = 0;
            
            // Process each active tag
            for (const {tag, physicsData} of activeTags) {
                // Update bounding box
                this.updateTagBoundingBox(tag);
                const pushback = new THREE.Vector3(0, 0, 0);
                
                // Check for collisions with all other tags
                for (const [otherId, otherPhysics] of this.tags) {
                    if (tag.id === otherId) continue;
                    
                    const otherTag = this.getTagById(otherId);
                    if (!otherTag || !otherTag.mesh) continue;
                    
                    // Update other tag's bounding box
                    this.updateTagBoundingBox(otherTag);
                    
                    // Check for collision
                    if (tag.collisionBox.intersectsBox(otherTag.collisionBox)) {
                        // Calculate pushback direction
                        const tagCenter = new THREE.Vector3();
                        const otherCenter = new THREE.Vector3();
                        tag.collisionBox.getCenter(tagCenter);
                        otherTag.collisionBox.getCenter(otherCenter);
                        
                        const direction = tagCenter.clone().sub(otherCenter).normalize();
                        
                        // Calculate actual overlap box
                        const overlapBox = new THREE.Box3();
                        overlapBox.copy(tag.collisionBox).intersect(otherTag.collisionBox);
                        
                        const overlapSize = new THREE.Vector3();
                        overlapBox.getSize(overlapSize);
                        
                        // Find maximum overlap dimension for strongest pushback along that axis
                        const maxDim = Math.max(overlapSize.x, overlapSize.y, overlapSize.z);
                        maxOverlap = Math.max(maxOverlap, maxDim);
                        
                        // Scale direction by primary axis of overlap for more direct separation
                        // This helps resolve right-angle interlocking better
                        const scaledDir = new THREE.Vector3(
                            direction.x * (overlapSize.x > 0.01 ? 1.0 : 0.1),
                            direction.y * (overlapSize.y > 0.01 ? 1.0 : 0.1), 
                            direction.z * (overlapSize.z > 0.01 ? 1.0 : 0.1)
                        ).normalize();
                        
                        // Calculate gentle pushback to separate tags
                        const pushStrength = maxDim * 0.01;
                        const pushVector = scaledDir.multiplyScalar(pushStrength);
                        
                        // Accumulate pushback
                        pushback.add(pushVector);
                        
                        // Also push the other tag in the opposite direction
                        // Using same smooth factor for both tags
                        const otherPushVector = scaledDir.clone().negate().multiplyScalar(pushStrength);
                        otherTag.mesh.position.add(otherPushVector);
                        
                        // Reset immovability
                        otherPhysics.immovableUntil = 0;
                        
                        // Apply a gentle velocity impulse for smooth continued separation
                        otherPhysics.velocity.add(otherPushVector.clone().multiplyScalar(0.2));
                        
                        // Update other tag's bounding box
                        this.updateTagBoundingBox(otherTag);
                        
                        totalRepositionings++;
                        
                        if (this.DEBUG_MODE) {
                            console.log(`[Iteration ${iteration}] Resolving collision between ${tag.id} and ${otherId}, overlap: ${maxDim.toFixed(2)}, direction: ${scaledDir.x.toFixed(1)},${scaledDir.y.toFixed(1)},${scaledDir.z.toFixed(1)}`);
                        }
                    }
                }
                
                // Apply accumulated pushback
                if (pushback.lengthSq() > 0) {
                    // Queue smooth adjustment for the main tag
                    if (!physicsData.targetAdjustment) {
                        physicsData.targetAdjustment = new THREE.Vector3();
                    }
                    physicsData.targetAdjustment.add(pushback);
                    if (!physicsData.smoothMoveStartTime) {
                        physicsData.smoothMoveStartTime = this.clock.getElapsedTime();
                        physicsData.smoothMoveDuration = 0.4; // Smooth over 0.4s
                    }

                    // Apply gentle velocity impulse to assist separation
                    physicsData.velocity.add(pushback.clone().multiplyScalar(0.2));

                    totalRepositionings++;
                }
            }
            
            // If no significant overlap or repositionings occurred, we can stop
            if (maxOverlap < 0.01 || totalRepositionings === 0) {
                break;
            }
        }
    }

    /**
     * Calculate age-based factor for physics forces
     * @param {Object} physicsData - Tag's physics data
     * @param {number} currentElapsedTime - Current elapsed time
     * @returns {number} - Age factor (0-1)
     */
    calculateAgeFactor(physicsData, currentElapsedTime) {
        // Calculate age in seconds
        const ageInSeconds = currentElapsedTime - (physicsData.creationElapsedTime || 0);
        
        // Age factor decays more slowly now (over 10 seconds instead of 5)
        // This keeps forces stronger for longer to prevent overlaps
        const ageFactor = Math.max(0, 1.0 - (ageInSeconds / 10.0));
        
        return ageFactor;
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
        // Project velocity onto up direction for unrestricted up/down movement
        const upMagnitude = velocity.dot(upDirection);
        const upComponent = upDirection.clone().multiplyScalar(upMagnitude);
        // Calculate lateral component (remaining velocity after removing up/down)
        const lateralComponent = velocity.clone().sub(upComponent);
        // Apply heavy damping to lateral movement to simulate resistance
        const dampedLateralComponent = lateralComponent.multiplyScalar(0.5); // 90% reduction in lateral speed
        // Combine components, allowing slow lateral movement
        return upComponent.add(dampedLateralComponent);
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
     */
    applyCollisionForces(tag, physicsData, currentElapsedTime) {
        // Safety check
        if (!tag || !tag.mesh || isNaN(tag.mesh.position.x)) return;
        
        // Update collision box for the current tag
        this.updateTagBoundingBox(tag);
        
        // Reset collision state for braking logic
        physicsData.isColliding = false;
        
        // Reduce collision force if tag has completed rotation and settled for stability
        const isSettled = physicsData.flipCompleted && 
                         (currentElapsedTime - (physicsData.postRotationStartTime || 0) > 3.0);
        // Use appropriate collision force multiplier
        const collisionForceMultiplier = isSettled ? 0.2 : 0.4;
        
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
            const combinedSize = (tagSize + otherSize) / 2 + this.options.spacing * 3;
            
            // If collision detected by either method, apply repulsive force
            if (boxesIntersect || distance < combinedSize) {
                // Get more accurate overlap direction using box centers if boxes intersect
                let direction;
                let forceMagnitude;
                
                // Mark both tags as currently colliding (for braking logic)
                physicsData.isColliding = true;
                otherPhysics.isColliding = true;
                physicsData.lastCollisionElapsedTime = currentElapsedTime;
                otherPhysics.lastCollisionElapsedTime = currentElapsedTime;
                
                if (boxesIntersect) {
                    const centerA = new THREE.Vector3();
                    const centerB = new THREE.Vector3();
                    tag.collisionBox.getCenter(centerA);
                    otherTag.collisionBox.getCenter(centerB);
                    
                    // Direction from other tag to this tag
                    direction = this.safeNormalize(centerA.clone().sub(centerB));
                    
                    // Compute overlapping region
                    const overlapBox = tag.collisionBox.clone().intersect(otherTag.collisionBox);
                    const overlapSize = new THREE.Vector3();
                    overlapBox.getSize(overlapSize);
                    const maxOverlap = Math.max(overlapSize.x, overlapSize.y, overlapSize.z);
                    
                    // Force is proportional to overlap
                    forceMagnitude = this.options.collisionForce * maxOverlap * 0.5 * collisionForceMultiplier;
                    
                    // If both tags are settled, apply smooth position adjustment
                    const otherIsSettled = otherPhysics.flipCompleted && 
                                         (currentElapsedTime - (otherPhysics.postRotationStartTime || 0) > 3.0);
                    
                    // Check if other tag is already moving due to a recent collision
                    const otherRecentlyCollided = currentElapsedTime - (otherPhysics.lastCollisionElapsedTime || 0) < 0.8;
                    const otherIsMovingFromCollision = otherRecentlyCollided && otherPhysics.velocity && 
                                                     otherPhysics.velocity.lengthSq() > 0.01;
                    
                    if (isSettled && otherIsSettled) {
                        // Calculate position adjustment to gradually remove overlap
                        const adjustmentAmount = maxOverlap * 0.5; // 50% adjustment per frame (increased from 30%)
                        
                        // Determine adjustment distribution based on whether other tag is already moving
                        let tagAdjustmentFactor = 0.5;  // Default: Split adjustment equally
                        let otherAdjustmentFactor = 0.5;
                        
                        if (otherIsMovingFromCollision) {
                            // If the other tag is already moving from collision, move this tag more
                            tagAdjustmentFactor = 0.9;  // Increased from 0.8
                            otherAdjustmentFactor = 0.1; // Reduced from 0.2
                        }
                        
                        // Create adjustment vectors for both tags
                        const tagAdjustment = direction.clone().multiplyScalar(adjustmentAmount * tagAdjustmentFactor);
                        const otherAdjustment = direction.clone().negate().multiplyScalar(adjustmentAmount * otherAdjustmentFactor);
                        
                        // Store target positions for smooth interpolation over frames
                        physicsData.targetAdjustment = physicsData.targetAdjustment || new THREE.Vector3(0, 0, 0);
                        physicsData.targetAdjustment.add(tagAdjustment);
                        
                        // Only adjust the other tag if it's not in middle of responding to another collision
                        if (!otherIsMovingFromCollision) {
                            otherPhysics.targetAdjustment = otherPhysics.targetAdjustment || new THREE.Vector3(0, 0, 0);
                            otherPhysics.targetAdjustment.add(otherAdjustment);
                            otherPhysics.smoothMoveDuration = 0.4; // Faster adjustment (reduced from 0.6)
                            otherPhysics.smoothMoveStartTime = currentElapsedTime;
                        } else {
                            // Apply additional adjustment to current tag to compensate
                            physicsData.targetAdjustment.add(otherAdjustment.clone().multiplyScalar(0.5));
                        }
                        
                        // Set animation duration
                        physicsData.smoothMoveDuration = 0.4; // Faster adjustment (reduced from 0.6)
                        physicsData.smoothMoveStartTime = currentElapsedTime;
                        
                        // Apply very strong braking to prevent oscillation
                        physicsData.velocity.multiplyScalar(0.2); // Increased braking from 0.3 to 0.2
                        if (!otherIsMovingFromCollision) {
                            otherPhysics.velocity.multiplyScalar(0.2); // Increased braking from 0.3 to 0.2
                        }
                    }
                } else {
                    // If just spherically close, use distance-based force
                    const overlap = combinedSize - distance;
                    direction = this.safeNormalize(distanceVector);
                    
                    // Smaller tags push harder relative to their mass to make space
                    const sizeRatio = physicsData.size < otherPhysics.size ? 1.5 : 0.8;
                    forceMagnitude = this.options.collisionForce * overlap * sizeRatio * 0.5 * collisionForceMultiplier;
                }
                
                // Check if tag is already moving away from collision
                const movingAway = physicsData.velocity.dot(direction) > 0;
                
                // Check if other tag is already handling a collision
                const otherRecentlyCollided = currentElapsedTime - (otherPhysics.lastCollisionElapsedTime || 0) < 0.8;
                const otherIsMovingFromCollision = otherRecentlyCollided && otherPhysics.velocity && 
                                                 otherPhysics.velocity.lengthSq() > 0.01;
                
                // Only apply force if not already moving away or if boxes intersect
                if (!movingAway || boxesIntersect) {
                    // Apply mass-based scaling to the force
                    const massSum = Math.max(otherPhysics.mass + physicsData.mass, 0.001);
                    
                    // Adjust force distribution based on whether other tag is already moving
                    let currentTagForceFactor = physicsData.mass / massSum;
                    let otherTagForceFactor = otherPhysics.mass / massSum;
                    
                    if (otherIsMovingFromCollision) {
                        // Apply more force to current tag if other tag is already moving
                        currentTagForceFactor = Math.min(currentTagForceFactor * 1.5, 0.9);
                        otherTagForceFactor = 1.0 - currentTagForceFactor;
                    }
                    
                    const scaledForceMagnitude = forceMagnitude * currentTagForceFactor;
                    
                    // Add the force
                    physicsData.force.add(direction.multiplyScalar(scaledForceMagnitude));
                    
                    // Also apply force to the other tag in the opposite direction
                    // but only if it's not already handling a collision
                    if (!otherPhysics.forceDirectMove && !otherIsMovingFromCollision) {
                        const otherScaledForceMagnitude = forceMagnitude * otherTagForceFactor;
                        otherPhysics.force = otherPhysics.force || new THREE.Vector3(0, 0, 0);
                        otherPhysics.force.add(direction.clone().negate().multiplyScalar(otherScaledForceMagnitude));
                    }
                    
                    // Apply very strong braking to both tags when collision occurs 
                    physicsData.velocity.multiplyScalar(0.2); // Increased braking from 0.3 to 0.2
                    if (!otherPhysics.forceDirectMove) {
                        otherPhysics.velocity.multiplyScalar(0.2); // Increased braking from 0.3 to 0.2
                    }
                }

                // Track collision chain to prevent recursive movement
                if (!this.collisionChains.has(tag.id)) {
                    this.collisionChains.add(otherId);
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
        
        // Make collision box larger (25% in each dimension)
        const padding = 0.05;
        
        // Get center of bounding box
        const center = new THREE.Vector3();
        tag.boundingBox.getCenter(center);
        
        // Calculate new min/max with padding around center
        const halfSize = size.clone().multiplyScalar(0.5);
        const min = center.clone().sub(halfSize);
        const max = center.clone().add(halfSize);
        
        // Set collision box directly from min/max
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
     * @param {number} normalizedDeltaTime - Normalized time delta for smooth rotation
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
        
        // Only reorient if X-axis not aligned with ray by more than 10 degrees
        if (angleToRay > 0.17) { // ~10 degrees in radians
            // Create rotation to align X-axis with ray from center
            const rotationSpeed = 0.3 * normalizedDeltaTime; // Increased rotation speed for stronger alignment
            
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
     * Check and resolve collisions during rotation to prevent overlapping
     * @param {Object} tag - Tag to check for collisions
     * @param {Object} physicsData - Physics data for the tag
     * @param {number} normalizedDeltaTime - Normalized time delta for consistent physics
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
            
            const centerDirection = tagCenter.clone().sub(otherCenter).normalize();
            const centerDistance = tagCenter.distanceTo(otherCenter);
            
            // Calculate minimum separation distance based on tag dimensions
            // Look at actual dimensions rather than just average size
            const xSeparation = (tag.physicsDimensions.x + otherTag.physicsDimensions.x) * 0.6;
            const ySeparation = (tag.physicsDimensions.y + otherTag.physicsDimensions.y) * 0.6;
            const zSeparation = (tag.physicsDimensions.z + otherTag.physicsDimensions.z) * 0.6;
            
            // Calculate minimum required distance using the most relevant dimensions
            // based on approach direction (more accurate than simple averaging)
            const absDir = new THREE.Vector3(
                Math.abs(centerDirection.x),
                Math.abs(centerDirection.y),
                Math.abs(centerDirection.z)
            );
            
            // Weight separation requirements based on approach angle
            const weightedSep = 
                absDir.x * xSeparation +
                absDir.y * ySeparation +
                absDir.z * zSeparation;
                
            // Buffer zone for separation
            const bufferFactor = 1.2; // 20% buffer
            const combinedSize = weightedSep;
            const tooClose = centerDistance < combinedSize * bufferFactor;
            
            // If boxes intersect during rotation, move this tag away
            if (boxesIntersect || tooClose) {
                // Calculate how much overlap exists
                let overlapFactor;
                
                if (boxesIntersect) {
                    // If boxes intersect, calculate actual overlap amount
                    const overlapBox = new THREE.Box3().copy(tag.collisionBox).intersect(otherTag.collisionBox);
                    const overlapSize = new THREE.Vector3();
                    overlapBox.getSize(overlapSize);
                    
                    // Scale by largest overlap dimension for stronger response
                    const maxOverlap = Math.max(overlapSize.x, overlapSize.y, overlapSize.z);
                    overlapFactor = 4.0 * maxOverlap / combinedSize;
                } else {
                    // For proximity warning, scale by how close we are to allowed minimum
                    overlapFactor = 1.5 * (1.0 - (centerDistance / (combinedSize * bufferFactor)));
                }
                
                // Vector pointing away from other tag
                const awayVector = centerDirection;
                
                // Pushback force during rotation to prevent overlapping
                const pushDistance = 0.5 * normalizedDeltaTime * overlapFactor * this.options.collisionPushScale * 2.0;
                
                const pushVector = awayVector.multiplyScalar(pushDistance);
                
                // Accumulate pushback (will be applied directly to position)
                physicsData.collisionPushback.add(pushVector);
                
                // Also add a velocity component in that direction for continuous separation
                physicsData.velocity.add(awayVector.multiplyScalar(overlapFactor * 0.5));
                
                // If true intersection (boxes overlap), also push the other tag away
                if ((boxesIntersect || centerDistance < combinedSize) && !otherPhysics.flipStartElapsedTime) {
                    // Calculate push vector for other tag (in opposite direction)
                    const otherPushVector = awayVector.clone().negate().multiplyScalar(pushDistance);
                    
                    // Apply direct position change to other tag to quickly resolve collision
                    otherTag.mesh.position.add(otherPushVector);
                    
                    // Also add velocity to other tag to maintain separation
                    otherPhysics.velocity.add(awayVector.clone().negate().multiplyScalar(overlapFactor * 0.5));
                    
                    // Reset the other tag's immovability to allow it to move away
                    otherPhysics.lastInteractionElapsedTime = this.clock.getElapsedTime();
                    otherPhysics.immovableUntil = 0; // Allow immediate movement
                    
                    // Update the other tag's bounding box after changing its position
                    this.updateTagBoundingBox(otherTag);
                }
                
                if (this.DEBUG_MODE && boxesIntersect) {
                    console.log(`Collision detected during rotation of tag ${tag.id} with ${otherId}, pushback: ${pushDistance}, overlapFactor: ${overlapFactor.toFixed(2)}`);
                }
            }
        }
    }

    /**
     * Apply cube-directed gravity to pull tags toward the nearest cube face after rotation
     */
    applyCubeGravity(tag, physicsData) {
        if (!physicsData.face) return;
        
        // Skip if not settled enough
        if (!physicsData.flipCompleted) return;
        
        // Get normal vector for the face
        const faceNormal = this.getFaceNormal(physicsData.face);
        
        // Calculate the current distance from face
        const projection = tag.mesh.position.dot(faceNormal);
        const distanceToFace = Math.abs(projection - this.options.cubeSize * 0.5);
        
        // Calculate force strength based on distance (stronger when farther)
        const gravityStrength = this.options.cubeGravityStrength * 
                               Math.min(1.0, distanceToFace / this.options.cubeSize);
        
        // Calculate vector from tag to its target position on cube face
        const targetOffset = faceNormal.clone().multiplyScalar(this.options.cubeSize * 0.5);
        const targetPosition = targetOffset.clone();
        
        // Calculate vector pointing from current position to target position
        const toTarget = targetPosition.sub(tag.mesh.position.clone());
        
        // Normalize and scale by gravity strength
        const direction = this.safeNormalize(toTarget);
        
        // Apply force toward face target position
        physicsData.force.add(direction.multiplyScalar(gravityStrength));
        
        // Add braking effect to dampen oscillations, but not too strong
        if (physicsData.velocity.length() > 0.01) {
            // Calculate component of velocity along the target direction
            const velDotDir = physicsData.velocity.dot(direction);
            
            // Apply braking for any component of velocity NOT along target direction
            if (Math.abs(velDotDir) < physicsData.velocity.length() * 0.8) {
                physicsData.velocity.multiplyScalar(0.95); // 5% velocity reduction
            }
        }
    }

    /**
     * Check if tag has settled enough to start face rotation
     */
    checkIfTagHasSettled(tag, physicsData, ageInSeconds, currentElapsedTime) {
        // Ensure tag has been in the system long enough before settling
        // Min time before allowing settling - reduced to allow quicker flipping
        const minimumAllowedSettleTime = 0.5; // 0.5 second minimum
        if (ageInSeconds < minimumAllowedSettleTime) {
            return false;
        }
        
        // Check position in cluster first - primary condition based on distance
        const distanceToCenter = tag.mesh.position.length();
        // Use a much smaller cluster radius to force flipping closer to center
        const maxClusterRadius = this.options.cubeSize * 0.3; // Much smaller radius for closer flipping
        const isInClusterRange = distanceToCenter < maxClusterRadius;
        
        // Minimum flight time requirement as backup
        const minimumFlightTime = 0.8; // Quicker settlement
        const hasFlownEnough = ageInSeconds > minimumFlightTime;
        
        // Check basic settlement conditions - relaxed velocity check for quicker flipping
        const lowVelocity = physicsData.velocity.length() < 0.35;
        
        // Check if tag is stuck trying to move inward
        const isStuck = this.checkIfTagIsStuck(tag, physicsData, currentElapsedTime, false);
        
        // Tag is settled if within distance range and has low velocity
        const inRangeAndSettled = isInClusterRange && lowVelocity;
        
        // Alternative settlement conditions for backup
        const backupSettlement = hasFlownEnough && (lowVelocity || isStuck || ageInSeconds > 1.5);
        
        // Log settlement conditions for debugging
        if (physicsData.frameCount % 60 === 0 && this.DEBUG_MODE) {
            console.log(`Tag ${tag.id} settlement check: distance=${distanceToCenter.toFixed(2)}, 
                  velocity=${physicsData.velocity.length().toFixed(2)}, 
                  age=${ageInSeconds.toFixed(1)}, 
                  isStuck=${isStuck}, 
                  result=${inRangeAndSettled || backupSettlement}`);
        }
        
        // Prioritize distance to center for flip decision
        return isInClusterRange || (ageInSeconds > 1.2 && hasFlownEnough);
    }
    
    /**
     * Check if a tag is stuck trying to move inward
     */
    checkIfTagIsStuck(tag, physicsData, currentElapsedTime, hasNeighbors) {
        // Initialize position history if needed
        if (!physicsData.positionHistory) {
            physicsData.positionHistory = [];
            physicsData.lastPositionRecordTime = currentElapsedTime;
        }
        
        // Record position every 0.2 seconds
        if (currentElapsedTime - (physicsData.lastPositionRecordTime || 0) > 0.2) {
            physicsData.positionHistory.push({
                position: tag.mesh.position.clone(),
                time: currentElapsedTime
            });
            physicsData.lastPositionRecordTime = currentElapsedTime;
            
            // Keep only recent history (1.5 seconds)
            while (physicsData.positionHistory.length > 0 && 
                   (currentElapsedTime - physicsData.positionHistory[0].time) > 1.5) {
                physicsData.positionHistory.shift();
            }
        }
        
        // Need enough history to determine if stuck
        if (physicsData.positionHistory.length < 5) return false;
        
        // Check if tag is trying to move inward
        const movingInward = physicsData.velocity.dot(tag.mesh.position.clone().negate().normalize()) > 0;
        if (!movingInward) return false;
        
        // Check distance moved over time period
        const oldestPosition = physicsData.positionHistory[0].position;
        const distanceMoved = tag.mesh.position.distanceTo(oldestPosition);
        
        // If minimal movement despite trying to move inward, consider stuck
        return distanceMoved < 0.15 && hasNeighbors;
    }
    
    /**
     * Check if there's enough space for tag to flip without causing collisions
     * If not enough space, push other tags out of the way
     */
    checkSpaceForFlipping(tag) {
        if (!tag || !tag.mesh) return false;
        
        // Update tag's bounding box
        this.updateTagBoundingBox(tag);
        
        // Get tag dimensions
        const originalBox = tag.collisionBox.clone();
        
        // Calculate center of tag
        const center = new THREE.Vector3();
        originalBox.getCenter(center);
        
        // Get tag size
        const size = new THREE.Vector3();
        originalBox.getSize(size);
        
        // Calculate rotation space needed (smaller radius for less restrictive flipping)
        const maxDimension = Math.max(size.x, size.y, size.z);
        const rotationRadius = maxDimension * 0.5; // Further reduced to be even less restrictive
        
        // Create expanded box representing rotation space
        const expandedBox = new THREE.Box3(
            new THREE.Vector3(center.x - rotationRadius, center.y - rotationRadius, center.z - rotationRadius),
            new THREE.Vector3(center.x + rotationRadius, center.y + rotationRadius, center.z + rotationRadius)
        );
        
        // Check for collision with rotation space
        let maxOverlap = 0;
        let collidingTags = [];
        
        for (const [otherId, otherPhysics] of this.tags) {
            if (tag.id === otherId) continue;
            
            const otherTag = this.getTagById(otherId);
            if (!otherTag || !otherTag.mesh) continue;
            
            // Update other tag's collision box
            this.updateTagBoundingBox(otherTag);
            
            // If boxes intersect
            if (expandedBox.intersectsBox(otherTag.collisionBox)) {
                // Calculate overlap
                const overlapBox = new THREE.Box3();
                overlapBox.copy(expandedBox).intersect(otherTag.collisionBox);
                
                const overlapSize = new THREE.Vector3();
                overlapBox.getSize(overlapSize);
                
                // Find maximum overlap dimension
                const overlap = Math.max(overlapSize.x, overlapSize.y, overlapSize.z);
                maxOverlap = Math.max(maxOverlap, overlap);
                
                // Only consider severe overlaps as problematic
                if (overlap > this.options.minFlipSpacing) {
                    collidingTags.push({tag: otherTag, physics: otherPhysics, overlap});
                }
            }
        }
        
        // If overlap is small enough, allow flipping
        if (maxOverlap <= this.options.minFlipSpacing) {
            return true;
        }
        
        // Otherwise, push colliding tags out of the way
        collidingTags.forEach(({tag: otherTag, physics: otherPhysics, overlap}) => {
            if (!otherTag || !otherTag.mesh) return;
            
            // Vector pointing from this tag to other tag
            const pushDir = otherTag.mesh.position.clone().sub(tag.mesh.position).normalize();
            
            // Calculate push distance based on overlap
            const pushStrength = overlap * 1.5; // Push 150% of the overlap distance
            
            // Apply immediate position adjustment
            const pushVector = pushDir.multiplyScalar(pushStrength);
            otherTag.mesh.position.add(pushVector);
            
            // Also add velocity to ensure it keeps moving away
            otherPhysics.velocity.add(pushDir.multiplyScalar(0.8));
            
            // Reset immovability of the pushed tag
            otherPhysics.immovableUntil = 0;
            
            if (this.DEBUG_MODE) {
                console.log(`Pushing tag ${otherTag.id} out of the way by ${pushStrength} to allow tag ${tag.id} to flip`);
            }
            
            // Update its bounding box
            this.updateTagBoundingBox(otherTag);
        });
        
        // Return true to allow flipping even if we needed to push tags
        return collidingTags.length < 5; // Only restrict if there are too many colliding tags
    }

    /**
     * Remove a tag from the physics system with an animated fly-out effect
     * @param {string} tagId - ID of tag to remove
     * @param {number} duration - Duration of the fly-out animation in milliseconds
     * @returns {Promise} - Resolves when animation is complete
     */
    removeTagWithAnimation(tagId, duration = 1000) {
        const physicsData = this.tags.get(tagId);
        const tag = this.getTagById(tagId);
        if (!physicsData || !tag || !tag.mesh) {
            this.tags.delete(tagId);
            return Promise.resolve();
        }

        // Mark tag as being removed
        physicsData.isRemoving = true;
        physicsData.removalStartTime = this.clock.getElapsedTime();
        physicsData.removalDuration = duration / 1000; // Convert to seconds
        
        // Calculate fly-out direction (opposite of initial velocity or away from center)
        let flyOutDirection;
        if (physicsData.velocity && physicsData.velocity.lengthSq() > 0) {
            flyOutDirection = physicsData.velocity.clone().normalize().multiplyScalar(-1);
        } else {
            flyOutDirection = tag.mesh.position.clone().normalize();
        }
        
        // Set target position far outside the cube
        const targetDistance = this.options.cubeSize * 5;
        physicsData.removalTargetPosition = flyOutDirection.clone().multiplyScalar(targetDistance);
        physicsData.removalStartPosition = tag.mesh.position.clone();
        
        // Store original opacity if material supports it
        if (tag.mesh.material) {
            physicsData.originalOpacity = tag.mesh.material.opacity !== undefined ? tag.mesh.material.opacity : 1.0;
        } else {
            physicsData.originalOpacity = 1.0;
        }
        
        if (this.DEBUG_MODE) {
            console.log(`Starting removal animation for tag ${tagId}, flying out to:`, physicsData.removalTargetPosition);
        }
        
        // Return a promise that resolves when animation completes
        return new Promise((resolve) => {
            physicsData.removalResolve = resolve;
        });
    }

    /**
     * Handle removal animation for a tag
     * @param {string} tagId - ID of the tag being removed
     * @param {Object} physicsData - Physics data for the tag
     * @param {number} currentElapsedTime - Current elapsed time from the clock
     */
    handleRemovalAnimation(tagId, physicsData, currentElapsedTime) {
        const tag = this.getTagById(tagId);
        if (!tag || !tag.mesh) {
            this.tags.delete(tagId);
            if (physicsData.removalResolve) {
                physicsData.removalResolve();
            }
            return;
        }
        
        // Calculate progress of removal animation
        const elapsed = currentElapsedTime - physicsData.removalStartTime;
        const progress = Math.min(elapsed / physicsData.removalDuration, 1.0);
        
        // Update position - move from start to target
        const newPosition = physicsData.removalStartPosition.clone().lerp(
            physicsData.removalTargetPosition, 
            progress
        );
        tag.mesh.position.copy(newPosition);
        
        // Update opacity if material supports it
        if (tag.mesh.material && physicsData.originalOpacity !== undefined) {
            const newOpacity = physicsData.originalOpacity * (1.0 - progress);
            tag.mesh.material.opacity = newOpacity;
        }
        
        // If animation is complete, remove the tag
        if (progress >= 1.0) {
            if (this.DEBUG_MODE) {
                console.log(`Removal animation complete for tag ${tagId}`);
            }
            // Remove from physics system
            this.faceCounts[physicsData.face]--;
            this.tags.delete(tagId);
            // Remove mesh from scene if it exists
            if (tag.mesh) {
                this.scene.remove(tag.mesh);
            }
            // Resolve the promise
            if (physicsData.removalResolve) {
                physicsData.removalResolve();
            }
            // Update cube size after removal
            this.updateCubeSize();
        }
    }

    /**
     * Place tags in grid cells for spatial partitioning
     * @param {Map} grid - Grid map to populate
     * @param {number} cellSize - Size of each grid cell
     * @param {Array} tagIds - Array of tag IDs to process
     */
    populateGridCells(grid, cellSize, tagIds) {
        for (const tagId of tagIds) {
            const tag = this.getTagById(tagId);
            if (!tag || !tag.mesh) continue;
            
            // Get tag's position
            const pos = tag.mesh.position;
            
            // Calculate grid cell indices
            const x = Math.floor(pos.x / cellSize);
            const y = Math.floor(pos.y / cellSize);
            const z = Math.floor(pos.z / cellSize);
            
            // Create cell key (string for fast map lookup)
            const cellKey = `${x},${y},${z}`;
            
            // Add tag to cell
            if (!grid.has(cellKey)) {
                grid.set(cellKey, []);
            }
            grid.get(cellKey).push(tagId);
            
            // Also add to neighboring cells if near boundary
            // This ensures we catch collisions at cell boundaries
            const xFrac = (pos.x / cellSize) - x;
            const yFrac = (pos.y / cellSize) - y;
            const zFrac = (pos.z / cellSize) - z;
            
            // Check if we're near a boundary (within 20% of cell size)
            const checkNeighbors = (frac, dim) => {
                if (frac < 0.2) return -1; // Check negative neighbor
                if (frac > 0.8) return 1;  // Check positive neighbor
                return 0; // No need to check
            };
            
            const xNeighbor = checkNeighbors(xFrac, 'x');
            const yNeighbor = checkNeighbors(yFrac, 'y');
            const zNeighbor = checkNeighbors(zFrac, 'z');
            
            // Add to relevant neighbor cells
            if (xNeighbor !== 0) {
                const neighborKey = `${x + xNeighbor},${y},${z}`;
                if (!grid.has(neighborKey)) {
                    grid.set(neighborKey, []);
                }
                grid.get(neighborKey).push(tagId);
            }
            
            if (yNeighbor !== 0) {
                const neighborKey = `${x},${y + yNeighbor},${z}`;
                if (!grid.has(neighborKey)) {
                    grid.set(neighborKey, []);
                }
                grid.get(neighborKey).push(tagId);
            }
            
            if (zNeighbor !== 0) {
                const neighborKey = `${x},${y},${z + zNeighbor}`;
                if (!grid.has(neighborKey)) {
                    grid.set(neighborKey, []);
                }
                grid.get(neighborKey).push(tagId);
            }
        }
    }
    
    /**
     * Ensure no tags are overlapping by directly separating them
     * This is a final guarantee pass that runs after all physics updates
     * @param {number} maxIterations - Maximum iterations to try separating 
     */
    ensureNoOverlap(maxIterations = 4) {
        if (this.tags.size < 2) return;
        
        // Use a spatial grid to reduce O(n²) collision checks
        const perfStart = performance.now();
        const perfMetrics = {
            total: 0,
            gridCreation: 0,
            collisionChecks: 0, 
            pairsChecked: 0
        };

        // Current elapsed time for collision tracking
        const currentElapsedTime = this.clock.getElapsedTime();
        
        // Get all tag IDs
        const tagIds = Array.from(this.tags.keys());
        if (tagIds.length < 2) return;
        
        // Create spatial grid - simple spatial hash partitioning
        const gridStart = performance.now();
        const cellSize = 5; // Cell size based on average tag size + buffer
        const grid = new Map(); // Maps cell key to array of tag IDs
        
        // Place tags in grid cells
        this.populateGridCells(grid, cellSize, tagIds);
        
        perfMetrics.gridCreation = performance.now() - gridStart;
        
        // Run collision resolution iterations
        const collisionStart = performance.now();
        let totalPairsChecked = 0;
        
        for (let iter = 0; iter < maxIterations; iter++) {
            let anyMoved = false;
            
            // For each cell in the grid
            for (const [cellKey, cellTags] of grid.entries()) {
                // Skip cells with 0 or 1 tag
                if (cellTags.length < 2) continue;
                
                // Check for collisions between all tags in this cell
                for (let i = 0; i < cellTags.length; i++) {
                    const tagAId = cellTags[i];
                    const tagA = this.getTagById(tagAId);
                    if (!tagA || !tagA.mesh) continue;
                    
                    const physA = this.tags.get(tagAId);
                    if (!physA) continue;
                    
                    // Skip recently moved tags for stability
                    if (physA.lastCollisionElapsedTime && 
                        (currentElapsedTime - physA.lastCollisionElapsedTime) < 0.05) {
                        continue;
                    }
                    
                    // Make sure tag has a bounding box
                    if (!tagA.boundingBox || !tagA.collisionBox) {
                        this.updateTagBoundingBox(tagA);
                    }
                    
                    for (let j = i + 1; j < cellTags.length; j++) {
                        const tagBId = cellTags[j];
                        
                        // Skip if actually the same tag (can happen due to being in multiple cells)
                        if (tagAId === tagBId) continue;
                        
                        totalPairsChecked++;
                        
                        const tagB = this.getTagById(tagBId);
                        if (!tagB || !tagB.mesh) continue;
                        
                        const physB = this.tags.get(tagBId);
                        if (!physB) continue;
                        
                        // Skip recently moved tags for stability
                        if (physB.lastCollisionElapsedTime && 
                            (currentElapsedTime - physB.lastCollisionElapsedTime) < 0.05) {
                            continue;
                        }
                        
                        // Make sure tag has a bounding box
                        if (!tagB.boundingBox || !tagB.collisionBox) {
                            this.updateTagBoundingBox(tagB);
                        }
                        
                        // Check for overlap between collision boxes
                        if (!tagA.collisionBox || !tagB.collisionBox) continue;
                        
                        if (tagA.collisionBox.intersectsBox(tagB.collisionBox)) {
                            // Calculate the overlap depth - use bounding boxes for more accurate results
                            const box1 = tagA.boundingBox.clone();
                            const box2 = tagB.boundingBox.clone();
                            
                            // Find centers of both boxes
                            const center1 = new THREE.Vector3();
                            const center2 = new THREE.Vector3();
                            box1.getCenter(center1);
                            box2.getCenter(center2);
                            
                            // Get direction from center1 to center2
                            const dir = center2.clone().sub(center1).normalize();
                            
                            // Calculate sizes of both boxes
                            const size1 = new THREE.Vector3();
                            const size2 = new THREE.Vector3();
                            box1.getSize(size1);
                            box2.getSize(size2);
                            
                            // Get the distance between centers
                            const distance = center1.distanceTo(center2);
                            
                            // Calculate the minimum distance needed to separate
                            // Project half sizes onto separation direction
                            const halfSize1 = Math.max(
                                Math.abs(dir.x * size1.x * 0.5),
                                Math.abs(dir.y * size1.y * 0.5),
                                Math.abs(dir.z * size1.z * 0.5)
                            );
                            
                            const halfSize2 = Math.max(
                                Math.abs(dir.x * size2.x * 0.5),
                                Math.abs(dir.y * size2.y * 0.5),
                                Math.abs(dir.z * size2.z * 0.5)
                            );
                            
                            // Minimum distance to separate
                            const minDistance = halfSize1 + halfSize2;
                            
                            // Calculate overlap and movement needed
                            const overlap = Math.max(0, minDistance - distance);
                            
                            if (overlap > 0) {
                                // Calculate separation movement based on mass (heavier tags move less)
                                const mass1 = physA.mass || 1;
                                const mass2 = physB.mass || 1;
                                
                                // Use exponential mass ratio for more dramatic difference between small and large tags
                                const totalMass = mass1 + mass2;
                                const massRatio1 = Math.pow(mass2 / totalMass, 1.5); 
                                const massRatio2 = Math.pow(mass1 / totalMass, 1.5);
                                
                                const moveFactorA = overlap * massRatio1;
                                const moveFactorB = overlap * massRatio2;
                                
                                // Check if tags are currently repositioning - avoid jumps during animations
                                const isAnimating = 
                                    physA.flipStartElapsedTime || physB.flipStartElapsedTime || 
                                    physA.targetAdjustment || physB.targetAdjustment;
                                
                                if (isAnimating) {
                                    // Skip if either is currently animating
                                    continue;
                                } else {
                                    // Apply direct movement
                                    const moveA = dir.clone().multiplyScalar(-moveFactorA);
                                    const moveB = dir.clone().multiplyScalar(moveFactorB);
                                    
                                    tagA.mesh.position.add(moveA);
                                    tagB.mesh.position.add(moveB);
                                    
                                    // Nudge velocities too so tags keep separating naturally
                                    // But use a much smaller factor to prevent extreme velocities
                                    physA.velocity = physA.velocity || new THREE.Vector3(0, 0, 0);
                                    physB.velocity = physB.velocity || new THREE.Vector3(0, 0, 0);
                                    
                                    // Use an even smaller velocity adjustment for larger mass differences
                                    const velocityFactorA = 0.05 * (1 - massRatio1 * 0.5); // 0.025-0.05 range, smaller for larger tags
                                    const velocityFactorB = 0.05 * (1 - massRatio2 * 0.5); // 0.025-0.05 range, smaller for larger tags
                                    
                                    physA.velocity.add(moveA.clone().multiplyScalar(velocityFactorA));
                                    physB.velocity.add(moveB.clone().multiplyScalar(velocityFactorB));
                                }
                                
                                // Flag that we moved something
                                anyMoved = true;
                                
                                // Update collision times
                                physA.lastCollisionElapsedTime = currentElapsedTime;
                                physB.lastCollisionElapsedTime = currentElapsedTime;
                                
                                // Update boxes after moving
                                this.updateTagBoundingBox(tagA);
                                this.updateTagBoundingBox(tagB);
                            }
                        }
                    }
                }
            }
            
            // If nothing moved, we're done
            if (!anyMoved) break;
        }
        
        perfMetrics.collisionChecks = performance.now() - collisionStart;
        perfMetrics.pairsChecked = totalPairsChecked;
        perfMetrics.total = performance.now() - perfStart;
        
        // Log performance if slow
        if (perfMetrics.total > 5) {
            console.log('Overlap resolution performance:', perfMetrics);
        }
    }
} 