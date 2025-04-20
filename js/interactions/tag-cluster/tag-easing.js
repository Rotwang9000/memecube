/**
 * Collection of easing functions for tag animations
 * These provide different motion patterns for smoother, more natural animations
 */
export class TagEasing {
	// Quadratic easing functions
	static easeInQuad(x) {
		return x * x;
	}
	
	static easeOutQuad(x) {
		return 1 - (1 - x) * (1 - x);
	}
	
	static easeInOutQuad(x) {
		return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
	}
	
	// Cubic easing functions
	static easeOutCubic(x) {
		return 1 - Math.pow(1 - x, 3);
	}
	
	static easeInOutCubic(x) {
		return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
	}
	
	// Elastic easing function for more interesting animations
	static easeOutElastic(x) {
		const c4 = (2 * Math.PI) / 3;
		
		return x === 0
			? 0
			: x === 1
			? 1
			: Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
	}
} 