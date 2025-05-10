import * as THREE from 'three';
import { animateCornerBolts } from '../common/physical-structure.js';
import { easeInOutQuad, calculateHorizontalSpreadFactor } from '../common/utils.js';
import { fixBoltPositions, triggerJetEffect } from '../common/physical-effects.js';

export class ScoreboardModeManager {
	constructor(tokenScoreboard) {
		this.tokenScoreboard = tokenScoreboard;
		this.currentSizeMode = 'hidden'; // Initial mode
		this.targetHeight = 0;
		this.startHeight = 0;
		this.isAnimatingMode = false;
		this.lastModeChangeTime = 0;
		
		// For burst effect calculations
		this._burstFromOrigin = false;
		this._burstOriginPoint = null;

		// Constants from TokenScoreboard that might be needed or configured
		this.animationDuration = 800; // Duration for bolt animations, e.g.
	}

	/**
	 * Compute the scoreboard height required to fill ~90% of the viewport vertically
	 */
	computeExpandedHeight() {
		const ts = this.tokenScoreboard;
		if (!ts.camera) {
			console.log("ScoreboardModeManager: No camera found, returning default expanded height");
			return ts.expandedHeight || 20; // Fallback to tokenScoreboard's default or 20
		}
		const fovRadians = ts.camera.fov * Math.PI / 180;
		const distance = 10; // Same distance used in _updateScreenPosition
		const fullHeight = 2 * Math.tan(fovRadians / 2) * distance;
		return fullHeight * 2.5; // Adjusted to make the height larger
	}

	/**
	 * Change the size mode of the scoreboard
	 * @param {string} newMode - The new size mode ('normal', 'tall', 'hidden')
	 */
	changeSizeMode(newMode) {
		const ts = this.tokenScoreboard;

		const now = performance.now();
		if (now - (this.lastModeChangeTime || 0) < 1000) {
			console.log(`ScoreboardModeManager: Ignoring size mode change to ${newMode} – called too soon.`);
			return;
		}
		this.lastModeChangeTime = now;

		console.log(`ScoreboardModeManager: Changing size mode from ${this.currentSizeMode} to: ${newMode}`);
		if (this.currentSizeMode === newMode) return;

		// Fix bolt positions first to ensure clean transition
		fixBoltPositions({
			cornerBolts: ts.cornerBolts,
			width: ts.width,
			height: ts.height,
			jetsManager: ts.jetsManager,
			sizeMode: ts.sizeMode
		});

		const previousMode = this.currentSizeMode;
		this.currentSizeMode = newMode;
		ts.sizeMode = newMode; // Also update on the main scoreboard for other logic

		this._burstFromOrigin = (previousMode === 'hidden' || previousMode === 'small') && 
							(newMode === 'normal' || newMode === 'tall');

		if (this._burstFromOrigin) {
			this._burstOriginPoint = new THREE.Vector3(0, 0, -0.5);
			if (ts.cornerBolts) {
				ts.cornerBolts.forEach(bolt => {
					bolt.visible = true;
					if (bolt.userData.plate) bolt.userData.plate.visible = true;
					bolt.position.copy(this._burstOriginPoint);
					if (bolt.userData.plate) {
						bolt.userData.plate.position.copy(this._burstOriginPoint);
						bolt.userData.plate.position.z += 0.1;
					}
				});
				if (ts.jetsManager) {
					ts.jetsManager.syncJetsWithBolts(true);
					triggerJetEffect({
						jetsManager: ts.jetsManager,
						cornerBolts: ts.cornerBolts,
						intensity: 1.5,
						isBurstEffect: true
					});
				}
			}
		}

		if (previousMode === 'hidden' && (newMode === 'normal' || newMode === 'tall')) {
			if (ts.ledDisplay && ts.ledDisplay.ledGroup) {
				ts.ledDisplay.ledGroup.visible = true;
			}
			if (ts.buttonManager) {
				if (ts.buttonManager.expandButton) ts.buttonManager.expandButton.visible = true;
				if (ts.buttonManager.collapseButton) ts.buttonManager.collapseButton.visible = true;
			}
		}

		if (newMode === 'hidden') {
			if (ts.expandPlanet) {
				ts.expandPlanet.visible = true;
				ts._positionExpandPlanetBottomRight(); // This method remains on TokenScoreboard for now
			}
			if (ts.cornerBolts) {
				ts.cornerBolts.forEach(bolt => {
					bolt.visible = false;
					if (bolt.userData?.plate) bolt.userData.plate.visible = false;
				});
			}
		}
		
		// This will call tokenScoreboard's method, which might be further refactored
		// For now, this manager updates the conceptual height, TokenScoreboard updates its physical parts
		ts.updateScoreboardDimensions(); 

		if (newMode === 'normal' && ts.buttonManager) {
			ts.buttonManager.updateButtonPositions(ts.width, ts.height, newMode, ts.detailMode);
			ts.buttonManager.updateButtonColors(newMode);
			[ts.buttonManager.expandButton, ts.buttonManager.collapseButton, ts.buttonManager.urlButton].forEach(button => {
				if (button) {
					button.traverse(obj => {
						if (obj.material) {
							obj.material.depthTest = true;
							obj.material.renderOrder = 15;
						}
					});
				}
			});
		}

		if (!this._burstFromOrigin) {
			ts.fixBoltPositions();
		}
		
		this.positionAndExpandScoreboard(); // Call method within this class

		try {
			localStorage.setItem('scoreboardSizeMode', newMode);
		} catch (e) {
			console.error('ScoreboardModeManager: Failed to save size mode to local storage:', e);
		}
	}

	/**
	 * Two-phase animation for going to tall mode:
	 * 1. First reposition to center of screen
	 * 2. Then expand height and position top bolts
	 */
	positionAndExpandScoreboard() {
		const ts = this.tokenScoreboard;
		console.log("ScoreboardModeManager: Starting two-phase animation");

		if (this.isAnimatingMode) {
			console.log("ScoreboardModeManager: Animation already in progress, ignoring.");
			return;
		}
		this.isAnimatingMode = true;
		ts.isAnimatingMode = true; // Keep ts flag in sync for now

		if (ts.jetsManager && this.currentSizeMode !== 'hidden') {
			ts.jetsManager.syncJetsWithBolts(true);
			triggerJetEffect({
				jetsManager: ts.jetsManager,
				cornerBolts: ts.cornerBolts,
				intensity: 1.0
			});
		}

		if (ts.ledDisplay) {
			ts.ledDisplay.clear();
		}

		this.startHeight = ts.height;
		if (this.currentSizeMode === 'tall') {
			this.targetHeight = this.computeExpandedHeight();
		} else if (this.currentSizeMode === 'normal') {
			this.targetHeight = 8; // Default normal height
		} else { // hidden
			this.targetHeight = 1;
		}

		if (ts.cornerBolts && ts.cornerBolts.length >= 4 && ts.camera) {
			const fov = ts.camera.fov * Math.PI / 180;
			const distance = 10;
			const viewHeight = 2 * Math.tan(fov / 2) * distance;
			const viewWidth = viewHeight * ts.camera.aspect;
			const actualPixelWidth = window.innerWidth || 1200;
			const horizontalSpreadFactor = calculateHorizontalSpreadFactor(actualPixelWidth);

			const rightBolts = ts.cornerBolts.filter(bolt => bolt.userData.isRightSide);
			const leftBolts = ts.cornerBolts.filter(bolt => !bolt.userData.isRightSide);
			const topRightBolt = rightBolts.find(bolt => bolt.position.y > 0) || rightBolts[0];
			const topLeftBolt = leftBolts.find(bolt => bolt.position.y > 0) || leftBolts[0];

			if (topRightBolt) {
				topRightBolt.userData.targetTallPosition = new THREE.Vector3(
					viewWidth * horizontalSpreadFactor, viewHeight * 0.48,
					topRightBolt.userData.originalPosition?.z || -0.2
				);
			}
			if (topLeftBolt) {
				topLeftBolt.userData.targetTallPosition = new THREE.Vector3(
					-viewWidth * horizontalSpreadFactor, viewHeight * 0.48,
					topLeftBolt.userData.originalPosition?.z || -0.2
				);
			}
		}

		const isHiddenToNormal = this.currentSizeMode === 'normal' && this.startHeight <= 1;
		ts.isPositioningFirst = true; // Signal to TokenScoreboard
		ts._updateScreenPosition();

		if (isHiddenToNormal) {
			ts.cornerBolts?.forEach(bolt => {
				bolt.visible = true;
				if (bolt.userData.plate) bolt.userData.plate.visible = true;
			});
			if (ts.ledDisplay && ts.ledDisplay.ledGroup) ts.ledDisplay.ledGroup.visible = true;
			if (ts.scoreboardGroup.userData.displayMesh) ts.scoreboardGroup.userData.displayMesh.visible = true;
			if (ts.jetsManager) ts.jetsManager.syncJetsWithBolts(true);
		}

		if (this.currentSizeMode === 'hidden') {
			ts.cornerBolts?.forEach(bolt => {
				bolt.visible = false;
				if (bolt.userData.plate) bolt.userData.plate.visible = false;
			});
		}

		const checkMovementComplete = () => {
			if (!ts.animationManager.isMoving) {
				console.log("ScoreboardModeManager: Repositioning complete, now expanding height");
				ts.isPositioningFirst = false;

				if (ts.jetsManager && this.currentSizeMode !== 'hidden') {
					ts.jetsManager.syncJetsWithBolts(true);
					triggerJetEffect({
						jetsManager: ts.jetsManager,
						cornerBolts: ts.cornerBolts,
						intensity: 0.8,
						isBurstEffect: this._burstFromOrigin
					});
				}

				animateCornerBolts(
					ts.cornerBolts,
					this.currentSizeMode === 'tall',
					this.startHeight,
					this.targetHeight,
					(newHeight, progress) => {
						ts.height = newHeight;
						ts.updateScoreboardDimensions();
						if (ts.ledDisplay) ts.ledDisplay.height = newHeight;
						if (ts.jetsManager && this.currentSizeMode !== 'hidden') {
							ts.jetsManager.syncJetsWithBolts(true);
							if (Math.random() < 0.08) triggerJetEffect({
								jetsManager: ts.jetsManager,
								cornerBolts: ts.cornerBolts,
								intensity: 0.7
							});
						}
					},
					() => this.finalizeSizeModeChange(),
					{ burstFromOrigin: !!this._burstFromOrigin, burstOrigin: this._burstOriginPoint || new THREE.Vector3(0, 0, -1.0) }
				);
			} else {
				requestAnimationFrame(checkMovementComplete);
				if (ts.jetsManager && this.currentSizeMode !== 'hidden') {
					ts.jetsManager.syncJetsWithBolts();
				}
			}
		};

		if (ts.animationManager.isMoving) {
			checkMovementComplete();
		} else {
			ts.isPositioningFirst = false;
			if (ts.jetsManager && this.currentSizeMode !== 'hidden') ts.jetsManager.syncJetsWithBolts(true);

			if (isHiddenToNormal) {
				setTimeout(() => {
					ts.height = 1;
					if (ts.jetsManager) triggerJetEffect({
						jetsManager: ts.jetsManager, 
						cornerBolts: ts.cornerBolts,
						intensity: 0.9, 
						isBurstEffect: this._burstFromOrigin
					});
					animateCornerBolts(
						ts.cornerBolts, false, ts.height, this.targetHeight,
						(newHeight, progress) => {
							ts.height = newHeight;
							ts.updateScoreboardDimensions();
							if (ts.ledDisplay) ts.ledDisplay.height = newHeight;
							if (ts.jetsManager) ts.jetsManager.syncJetsWithBolts(true);
							if (ts.ledDisplay && ts.ledDisplay.ledGroup) {
								ts.ledDisplay.ledGroup.visible = true;
								ts.ledDisplay.ledGroup.traverse(obj => {
									if (obj.material && obj.material.opacity !== undefined) {
										obj.material.opacity = Math.min(1.0, progress * 2);
									}
								});
							}
							if (ts.jetsManager && Math.random() < 0.15) {
								triggerJetEffect({
									jetsManager: ts.jetsManager, 
									cornerBolts: ts.cornerBolts,
									intensity: 0.6 * progress, 
									isBurstEffect: this._burstFromOrigin
								});
							}
						},
						() => this.finalizeSizeModeChange(),
						{ burstFromOrigin: !!this._burstFromOrigin, burstOrigin: this._burstOriginPoint || new THREE.Vector3(0, 0, -1.0) }
					);
				}, 100);
			} else {
				animateCornerBolts(
					ts.cornerBolts,
					this.currentSizeMode === 'tall',
					this.startHeight || ts.height,
					this.targetHeight,
					(newHeight, progress) => {
						ts.height = newHeight;
						ts.updateScoreboardDimensions();
						if (ts.ledDisplay) ts.ledDisplay.height = newHeight;
						if (ts.jetsManager && this.currentSizeMode !== 'hidden') {
							ts.jetsManager.syncJetsWithBolts(true);
						}
						if (ts.jetsManager && this.currentSizeMode !== 'hidden' && Math.random() < 0.1) {
							triggerJetEffect({
								jetsManager: ts.jetsManager, 
								cornerBolts: ts.cornerBolts,
								intensity: 0.5, 
								isBurstEffect: this._burstFromOrigin
							});
						}
					},
					() => this.finalizeSizeModeChange(),
					{ burstFromOrigin: !!this._burstFromOrigin, burstOrigin: this._burstOriginPoint || new THREE.Vector3(0, 0, -1.0) }
				);
			}
		}
	}

	/**
	 * Finalize the size mode change after animations
	 */
	finalizeSizeModeChange() {
		const ts = this.tokenScoreboard;
		ts.updateScoreboardDimensions();
		
		// Fix bolt positions at the end
		fixBoltPositions({
			cornerBolts: ts.cornerBolts,
			width: ts.width,
			height: ts.height, 
			jetsManager: ts.jetsManager,
			sizeMode: ts.sizeMode
		});

		if (ts.cornerBolts && ts.cornerBolts.length >= 4) {
			const rightBolts = ts.cornerBolts.filter(bolt => bolt.userData.isRightSide);
			const leftBolts = ts.cornerBolts.filter(bolt => !bolt.userData.isRightSide);
			rightBolts.forEach(bolt => {
				if (bolt.material) {
					bolt.material.color.set(0xDAA520);
					bolt.material.emissive.set(0xDAA520);
				}
			});
			leftBolts.forEach(bolt => {
				if (bolt.material) {
					bolt.material.color.set(0x00ff00);
					bolt.material.emissive.set(0x00ff00);
				}
			});
		}

		if (ts.ledDisplay) {
			ts.ledDisplay.width = ts.width;
			ts.ledDisplay.height = ts.height;
			ts.ledDisplay.recreateDisplay();
			if (Math.abs(ts.ledDisplay.height - ts.height) > 0.1) {
				ts.ledDisplay.height = ts.height;
				ts.ledDisplay.recreateDisplay();
			}
			if (ts.ledDisplay.ledGroup) {
				ts.ledDisplay.ledGroup.visible = this.currentSizeMode !== 'hidden';
				ts.ledDisplay.ledGroup.traverse(obj => {
					if (obj.material && obj.material.opacity !== undefined) {
						obj.material.opacity = 1.0;
					}
				});
			}
		}

		this.isAnimatingMode = false;
		ts.isAnimatingMode = false; // Sync flag
		ts._updateScreenPosition();

		if (this.currentSizeMode !== 'hidden') {
			if (ts.cornerBolts && ts.cornerBolts.length >= 4) {
				const rightBolts = ts.cornerBolts.filter(bolt => bolt.userData.isRightSide);
				const leftBolts = ts.cornerBolts.filter(bolt => !bolt.userData.isRightSide);
				const halfWidth = ts.width / 2;
				const halfHeight = ts.height / 2;

				rightBolts.forEach(bolt => {
					const isTopRow = bolt.position.y > 0;
					const yPos = isTopRow ? (halfHeight + 0.1) : (-halfHeight - 0.1);
					bolt.position.set(halfWidth + 0.45, yPos, -0.2);
					bolt.visible = true;
					if (bolt.userData.plate) {
						bolt.userData.plate.position.set(halfWidth + 0.45, yPos, -0.1);
						bolt.userData.plate.visible = true;
					}
				});
				leftBolts.forEach(bolt => {
					const isTopRow = bolt.position.y > 0;
					const yPos = isTopRow ? (halfHeight + 0.1) : (-halfHeight - 0.1);
					bolt.position.set(-halfWidth - 0.45, yPos, -0.2);
					bolt.visible = true;
					if (bolt.userData.plate) {
						bolt.userData.plate.position.set(-halfWidth - 0.45, yPos, -0.1);
						bolt.userData.plate.visible = true;
					}
				});
			}
			if (ts.scoreboardGroup?.userData?.displayMesh) ts.scoreboardGroup.userData.displayMesh.visible = true;
			if (ts.jetsManager?.jets) ts.jetsManager.jets.forEach(jet => { if (jet) jet.visible = true; });

			if (ts.buttonManager) {
				ts.buttonManager.updateButtonPositions(ts.width, ts.height, this.currentSizeMode, ts.detailMode);
				if (ts.buttonManager.expandButton) {
					ts.buttonManager.expandButton.visible = true;
					ts.buttonManager.expandButton.children.forEach(child => { child.visible = true; if (child.material) { child.material.depthTest = false; child.renderOrder = 100; } if (child.children?.length) child.children.forEach(gc => { gc.visible = true; if (gc.material) { gc.material.depthTest = false; gc.renderOrder = 100; }}); });
				}
				if (ts.buttonManager.collapseButton) {
					ts.buttonManager.collapseButton.visible = true;
					ts.buttonManager.collapseButton.children.forEach(child => { child.visible = true; if (child.material) { child.material.depthTest = false; child.renderOrder = 100; } if (child.children?.length) child.children.forEach(gc => { gc.visible = true; if (gc.material) { gc.material.depthTest = false; gc.renderOrder = 100; }}); });
				}
				ts.buttonManager.updateButtonColors(this.currentSizeMode);
			}
		}

		if (ts.jetsManager && this.currentSizeMode !== 'hidden') {
			const wasBurstAnimation = !!this._burstFromOrigin;
			ts.jetsManager.syncJetsWithBolts(true);
			triggerJetEffect({
				jetsManager: ts.jetsManager,
				cornerBolts: ts.cornerBolts,
				intensity: wasBurstAnimation ? 1.2 : 0.8,
				isBurstEffect: wasBurstAnimation
			});
			if (wasBurstAnimation) {
				setTimeout(() => {
					if (ts.jetsManager) {
						ts.jetsManager.syncJetsWithBolts(true);
						triggerJetEffect({
							jetsManager: ts.jetsManager,
							cornerBolts: ts.cornerBolts,
							intensity: 0.7,
							isBurstEffect: true
						});
					}
				}, 200);
			}
			this._burstFromOrigin = false;
			this._burstOriginPoint = null;
		}

		if (ts.buttonManager) {
			if (this.currentSizeMode === 'hidden') {
				if (ts.buttonManager.expandButton) {
					ts.buttonManager.expandButton.position.set(0, 0, -1.0);
					ts.buttonManager.expandButton.visible = true;
					ts.buttonManager.expandButton.traverse(obj => { if (obj.material) { obj.material.depthTest = false; obj.renderOrder = 100; } });
				}
				if (ts.buttonManager.collapseButton) ts.buttonManager.collapseButton.visible = false;
				if (ts.buttonManager.exitButton && !ts.detailMode) ts.buttonManager.exitButton.visible = false;
				else if (ts.buttonManager.exitButton && ts.detailMode) ts.buttonManager.exitButton.visible = true;
			} else {
				ts.buttonManager.updateButtonPositions(ts.width, ts.height, this.currentSizeMode, ts.detailMode);
			}

			if (this.currentSizeMode === 'hidden') {
				if (ts.cornerBolts) ts.cornerBolts.forEach(bolt => { bolt.visible = false; if (bolt.userData?.plate) bolt.userData.plate.visible = false; });
				if (!ts.detailMode) {
					ts.scoreboardGroup.traverse(obj => {
						if (obj === ts.scoreboardGroup) return;
						if (ts.buttonManager && (obj === ts.buttonManager.expandButton || (obj.parent && obj.parent === ts.buttonManager.expandButton))) {
							obj.visible = true; return;
						}
						obj.visible = false;
					});
				} else {
					ts.scoreboardGroup.traverse(obj => {
						if (obj === ts.scoreboardGroup) return;
						if (ts.buttonManager && (obj === ts.buttonManager.expandButton || (obj.parent && obj.parent === ts.buttonManager.expandButton) || obj === ts.buttonManager.exitButton || (obj.parent && obj.parent === ts.buttonManager.exitButton))) {
							obj.visible = true; return;
						}
						if (ts.socialButtonManager && ts.socialButtonManager.buttonList.some(btn => obj === btn || (obj.parent && obj.parent === btn))) {
							obj.visible = true; return;
						}
						obj.visible = false;
					});
					if (ts.socialButtonManager) {
						ts.socialButtonManager.positionButtonsAbove(ts.width, ts.height, 0);
					}
				}
			}
		}

		// Update social button manager state if it exists
		if (this.tokenScoreboard.socialButtonManager) { // Corrected reference
			this.tokenScoreboard.socialButtonManager.updateState(this.tokenScoreboard.detailToken, this.tokenScoreboard.width, this.tokenScoreboard.height);
		}
		
		console.log("ScoreboardModeManager: Size mode change finalized");
	}
} 