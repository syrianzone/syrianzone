// Back to Top Button Component
// Provides a reusable back-to-top button with consistent styling across the Syrian Zone project

/**
 * BackToTop Component
 * Creates and manages a back-to-top button with smooth scrolling functionality
 * Uses the same styling as /syofficial for consistency
 */
class BackToTop {
    constructor(options = {}) {
        this.options = {
            // Position settings
            bottom: options.bottom || '24px', // 1.5rem = 24px
            left: options.left || '24px',     // 1.5rem = 24px
            
            // Behavior settings
            showThreshold: options.showThreshold || 300, // pixels scrolled before showing
            
            // Style settings (following syofficial pattern)
            className: options.className || 'search-filter-button',
            
            // Animation settings
            smoothScroll: options.smoothScroll !== false, // default true
            
            // Custom selectors
            containerId: options.containerId || 'backToTop',
            
            ...options
        };

        this.button = null;
        this.isVisible = false;
        
        this.init();
    }

    /**
     * Initialize the back-to-top button
     */
    init() {
        this.createButton();
        this.bindEvents();
        this.updateVisibility(); // Initial visibility check
    }

    /**
     * Create the back-to-top button element
     */
    createButton() {
        // Check if button already exists
        const existingButton = document.getElementById(this.options.containerId);
        if (existingButton) {
            this.button = existingButton;
            return;
        }

        // Create button element
        this.button = document.createElement('button');
        this.button.id = this.options.containerId;
        
        // Set classes - using the same classes as syofficial
        this.button.className = `${this.options.className} fixed bottom-6 left-6 z-50 h-10 w-10 bg-[var(--sz-color-primary)] text-white shadow-lg hover:bg-[var(--sz-color-accent)] transition-colors`;
        
        // Set initial style
        this.button.style.display = 'none';
        
        // Add icon
        this.button.innerHTML = '<i class="fas fa-arrow-up h-5 w-5 mx-auto"></i>';
        
        // Add accessibility attributes
        this.button.setAttribute('aria-label', 'العودة إلى الأعلى');
        this.button.setAttribute('title', 'العودة إلى الأعلى');
        
        // Append to body
        document.body.appendChild(this.button);
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        if (!this.button) return;

        // Scroll event to show/hide button
        window.addEventListener('scroll', () => {
            this.updateVisibility();
        });

        // Click event to scroll to top
        this.button.addEventListener('click', (e) => {
            e.preventDefault();
            this.scrollToTop();
        });
    }

    /**
     * Update button visibility based on scroll position
     */
    updateVisibility() {
        if (!this.button) return;

        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const shouldShow = scrollTop > this.options.showThreshold;

        if (shouldShow && !this.isVisible) {
            this.show();
        } else if (!shouldShow && this.isVisible) {
            this.hide();
        }
    }

    /**
     * Show the back-to-top button
     */
    show() {
        if (!this.button) return;
        
        this.button.style.display = 'block';
        this.isVisible = true;
    }

    /**
     * Hide the back-to-top button
     */
    hide() {
        if (!this.button) return;
        
        this.button.style.display = 'none';
        this.isVisible = false;
    }

    /**
     * Scroll to top of the page
     */
    scrollToTop() {
        if (this.options.smoothScroll) {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        } else {
            window.scrollTo(0, 0);
        }
    }

    /**
     * Destroy the component and clean up
     */
    destroy() {
        if (this.button && this.button.parentNode) {
            this.button.parentNode.removeChild(this.button);
        }
        
        // Remove event listeners would be handled by garbage collection
        // since we're removing the element
        this.button = null;
        this.isVisible = false;
    }
}

/**
 * Initialize back-to-top functionality
 * Can be called directly or used as a utility function
 */
function initializeBackToTop(options = {}) {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            new BackToTop(options);
        });
    } else {
        new BackToTop(options);
    }
}

// Auto-initialize if script is loaded and no explicit initialization is needed
// Check for data attribute or global config to determine auto-init
document.addEventListener('DOMContentLoaded', () => {
    // Only auto-initialize if there's no existing backToTop element
    // and no explicit opt-out
    const existingButton = document.getElementById('backToTop');
    const autoInit = document.body.dataset.backToTopAuto !== 'false';
    
    if (!existingButton && autoInit) {
        new BackToTop();
    }
});

// Export for module systems and global access
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BackToTop, initializeBackToTop };
} else {
    // Global access
    window.BackToTop = BackToTop;
    window.initializeBackToTop = initializeBackToTop;
    
    // Add to SZ namespace if it exists
    if (typeof window.SZ === 'object') {
        window.SZ.BackToTop = BackToTop;
        window.SZ.initializeBackToTop = initializeBackToTop;
    }
}
