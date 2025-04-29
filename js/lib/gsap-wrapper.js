// This is a wrapper for GSAP to make it work with ES modules
// It loads GSAP from a CDN that provides the ES module version

// Import the ESM version of GSAP
import gsap from 'https://cdn.jsdelivr.net/npm/gsap@3.12.7/+esm';

// Export everything from GSAP
export default gsap;
export const {
    // Core GSAP elements
    to,
    from,
    fromTo,
    set,
    timeline,
    getProperty,
    quickSetter,
    registerPlugin,
    // Utilities
    delayedCall,
    getTweensOf,
    getById,
    exportRoot,
    // Eases
    Power0,
    Power1,
    Power2,
    Power3,
    Power4,
    Linear,
    Quad,
    Cubic,
    Quart,
    Quint,
    Strong,
    Elastic,
    Back,
    SteppedEase,
    Bounce,
    Sine,
    Expo,
    Circ,
} = gsap; 