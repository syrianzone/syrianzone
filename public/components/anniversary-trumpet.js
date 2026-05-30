// Anniversary Trumpet Component
// Shows a trumpet button during September 26-29 that opens a YouTube video modal

/**
 * AnniversaryTrumpet Component
 * Creates a trumpet button that appears during September 26-29
 * Opens a modal with an embedded YouTube video when clicked
 */
class AnniversaryTrumpet {
    constructor(options = {}) {
        this.options = {
            // Position settings
            bottom: options.bottom || '24px',
            right: options.right || '24px',

            // Video settings
            videoId: options.videoId || 'l000YtQMbvw',

            // Style settings
            className: options.className || 'search-filter-button',

            // Custom selectors
            containerId: options.containerId || 'anniversaryTrumpet',
            modalId: options.modalId || 'anniversaryModal',

            ...options
        };

        this.button = null;
        this.modal = null;
        this.isVisible = false;

        this.init();
    }

    /**
     * Initialize the component
     */
    init() {
        if (!this.shouldShow()) return;

        this.createButton();
        this.createModal();
        this.bindEvents();
    }

    /**
     * Check if current date is between September 26-29
     */
    shouldShow() {
        const now = new Date();
        const month = now.getMonth() + 1; // getMonth() is 0-based
        const day = now.getDate();

        return month === 9 && day >= 26 && day <= 29;
    }

    /**
     * Create the trumpet button element
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

        // Style like the settings button from the homepage
        this.button.className = 'settings-btn';
        this.button.style.position = 'fixed';
        this.button.style.bottom = '2rem';
        this.button.style.right = '2rem';
        this.button.style.zIndex = '9999';
        this.button.style.display = 'block';
        this.button.style.borderRadius = '0px'; // Square corners like settings button
        this.button.style.fontSize = '1.1rem'; // Match settings button font size

        // Add trumpet emoji
        this.button.innerHTML = '🎺';

        // Add accessibility attributes
        this.button.setAttribute('aria-label', 'طوطنالو');
        this.button.setAttribute('title', 'طوطنالو');

        // Append to body
        document.body.appendChild(this.button);
        this.isVisible = true;
    }

    /**
     * Create the modal element
     */
    createModal() {
        // Check if modal already exists
        const existingModal = document.getElementById(this.options.modalId);
        if (existingModal) {
            this.modal = existingModal;
            return;
        }

        // Create modal element
        this.modal = document.createElement('div');
        this.modal.id = this.options.modalId;
        this.modal.className = 'modal';

        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modalContent.style.maxWidth = '800px';
        modalContent.style.width = '90%';
        modalContent.style.height = '70vh';

        // Create modal header
        const modalHeader = document.createElement('div');
        modalHeader.className = 'modal-header';

        const modalTitle = document.createElement('h3');
        modalTitle.textContent = 'طوطنالو';

        const closeButton = document.createElement('button');
        closeButton.className = 'close-modal';
        closeButton.innerHTML = '✕';
        closeButton.setAttribute('aria-label', 'Close');

        modalHeader.appendChild(modalTitle);
        modalHeader.appendChild(closeButton);

        // Create modal body
        const modalBody = document.createElement('div');
        modalBody.className = 'modal-body';
        modalBody.style.padding = '0';
        modalBody.style.height = 'calc(100% - 80px)';

        // Create iframe for YouTube video with autoplay
        const iframe = document.createElement('iframe');
        iframe.src = `https://www.youtube.com/embed/${this.options.videoId}?autoplay=1&rel=0`;
        iframe.width = '100%';
        iframe.height = '100%';
        iframe.frameBorder = '0';
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        iframe.allowFullscreen = true;
        iframe.style.borderRadius = '0 0 var(--radius-lg) var(--radius-lg)';

        modalBody.appendChild(iframe);

        modalContent.appendChild(modalHeader);
        modalContent.appendChild(modalBody);
        this.modal.appendChild(modalContent);

        // Append to body
        document.body.appendChild(this.modal);
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        if (!this.button || !this.modal) return;

        // Button click event to open modal
        this.button.addEventListener('click', (e) => {
            e.preventDefault();
            this.openModal();
        });

        // Close modal events
        const closeButton = this.modal.querySelector('.close-modal');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                this.closeModal();
            });
        }

        // Click outside modal to close
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        });

        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('open')) {
                this.closeModal();
            }
        });
    }

    /**
     * Open the modal
     */
    openModal() {
        if (!this.modal) return;

        this.modal.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    /**
     * Close the modal
     */
    closeModal() {
        if (!this.modal) return;

        this.modal.classList.remove('open');
        document.body.style.overflow = '';
    }

    /**
     * Destroy the component and clean up
     */
    destroy() {
        if (this.button && this.button.parentNode) {
            this.button.parentNode.removeChild(this.button);
        }

        if (this.modal && this.modal.parentNode) {
            this.modal.parentNode.removeChild(this.modal);
        }

        document.body.style.overflow = '';
        this.button = null;
        this.modal = null;
        this.isVisible = false;
    }
}

/**
 * Initialize anniversary trumpet functionality
 */
function initializeAnniversaryTrumpet(options = {}) {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            new AnniversaryTrumpet(options);
        });
    } else {
        new AnniversaryTrumpet(options);
    }
}

// Auto-initialize if script is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only auto-initialize if no existing component and we're in the date range
    const existingButton = document.getElementById('anniversaryTrumpet');
    const shouldAutoInit = !existingButton;

    if (shouldAutoInit) {
        new AnniversaryTrumpet();
    }
});

// Export for module systems and global access
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AnniversaryTrumpet, initializeAnniversaryTrumpet };
} else {
    // Global access
    window.AnniversaryTrumpet = AnniversaryTrumpet;
    window.initializeAnniversaryTrumpet = initializeAnniversaryTrumpet;

    // Add to SZ namespace if it exists
    if (typeof window.SZ === 'object') {
        window.SZ.AnniversaryTrumpet = AnniversaryTrumpet;
        window.SZ.initializeAnniversaryTrumpet = initializeAnniversaryTrumpet;
    }
}
