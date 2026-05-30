// View Toggle Component - Reusable grid/table view switcher
class ViewToggle {
    constructor(options = {}) {
        // Configuration with defaults
        this.config = {
            container: options.container || '.view-toggle-container',
            tableViewBtn: options.tableViewBtn || '#tableViewBtn',
            gridViewBtn: options.gridViewBtn || '#gridViewBtn',
            tableContainer: options.tableContainer || '#tableContainer',
            gridContainer: options.gridContainer || '#gridContainer',
            defaultView: options.defaultView || this.getDefaultView(),
            storageKey: options.storageKey || 'view-toggle-preference',
            onViewChange: options.onViewChange || null,
            responsive: options.responsive !== false, // Default to true
            ...options
        };

        this.currentView = this.getPersistedView() || this.config.defaultView;
        
        this.initializeElements();
        this.bindEvents();
        this.initializeView();
    }

    // Get default view based on screen size
    getDefaultView() {
        if (window.innerWidth < 768) {
            return 'grid'; // Mobile: grid view
        } else {
            return 'table'; // Tablet and desktop: table view
        }
    }

    // Persisted view helpers
    getPersistedView() {
        try { 
            return localStorage.getItem(this.config.storageKey) || null; 
        } catch (_) { 
            return null; 
        }
    }

    setPersistedView(view) {
        try { 
            localStorage.setItem(this.config.storageKey, view); 
        } catch (_) {}
    }

    // Initialize DOM elements
    initializeElements() {
        this.elements = {
            tableViewBtn: document.querySelector(this.config.tableViewBtn),
            gridViewBtn: document.querySelector(this.config.gridViewBtn),
            tableContainer: document.querySelector(this.config.tableContainer),
            gridContainer: document.querySelector(this.config.gridContainer)
        };

        // Validate required elements
        const requiredElements = ['tableViewBtn', 'gridViewBtn'];
        for (const element of requiredElements) {
            if (!this.elements[element]) {
                console.warn(`ViewToggle: Required element ${element} not found`);
            }
        }
    }

    // Bind event listeners
    bindEvents() {
        // View toggle functionality
        if (this.elements.tableViewBtn) {
            this.elements.tableViewBtn.addEventListener('click', () => {
                this.switchView('table');
            });
        }

        if (this.elements.gridViewBtn) {
            this.elements.gridViewBtn.addEventListener('click', () => {
                this.switchView('grid');
            });
        }

        // Window resize event for responsive view switching
        if (this.config.responsive) {
            window.addEventListener('resize', () => {
                this.handleResize();
            });
        }
    }

    // Initialize view based on current preference
    initializeView() {
        this.switchView(this.currentView);
    }

    // Handle window resize for responsive behavior
    handleResize() {
        const newDefaultView = this.getDefaultView();
        
        // Only switch if we don't have a user preference and the default changed
        if (!this.getPersistedView() && newDefaultView !== this.currentView) {
            this.switchView(newDefaultView);
        }
    }

    // Switch between table and grid view
    switchView(view) {
        this.currentView = view;
        this.setPersistedView(view);

        // Update button states
        if (this.elements.tableViewBtn) {
            this.elements.tableViewBtn.classList.toggle('active', view === 'table');
        }
        if (this.elements.gridViewBtn) {
            this.elements.gridViewBtn.classList.toggle('active', view === 'grid');
        }

        // Show/hide containers if they exist
        if (this.elements.tableContainer) {
            this.elements.tableContainer.style.display = view === 'table' ? 'block' : 'none';
        }
        if (this.elements.gridContainer) {
            if (view === 'grid') {
                // Remove display property to let CSS grid classes work
                this.elements.gridContainer.style.display = '';
            } else {
                this.elements.gridContainer.style.display = 'none';
            }
        }

        // Call callback if provided
        if (this.config.onViewChange) {
            this.config.onViewChange(view, this.currentView);
        }

        // Dispatch custom event
        this.dispatchViewChangeEvent(view);
    }

    // Dispatch custom event for view changes
    dispatchViewChangeEvent(view) {
        const event = new CustomEvent('viewToggle', {
            detail: { 
                view: view, 
                previousView: this.currentView,
                instance: this
            }
        });
        document.dispatchEvent(event);
    }

    // Get current view
    getCurrentView() {
        return this.currentView;
    }

    // Create HTML for view toggle buttons
    static createHTML(options = {}) {
        const {
            tableText = 'جدول',
            gridText = 'شبكة',
            tableIcon = 'fas fa-table',
            gridIcon = 'fas fa-th',
            tableViewBtnId = 'tableViewBtn',
            gridViewBtnId = 'gridViewBtn',
            containerClass = 'view-toggle-container',
            showTextOnMobile = false
        } = options;

        return `
            <div class="${containerClass} flex items-center space-x-2">
                <label class="text-sm text-gray-600">عرض:</label>
                <div class="flex bg-gray-100 rounded-lg p-1">
                    <button id="${tableViewBtnId}" class="view-toggle-btn px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-md transition-colors" data-view="table">
                        <i class="${tableIcon} ml-1"></i> 
                        <span class="${showTextOnMobile ? '' : 'hidden sm:inline'}">${tableText}</span>
                    </button>
                    <button id="${gridViewBtnId}" class="view-toggle-btn px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-md transition-colors" data-view="grid">
                        <i class="${gridIcon} ml-1"></i> 
                        <span class="${showTextOnMobile ? '' : 'hidden sm:inline'}">${gridText}</span>
                    </button>
                </div>
            </div>
        `;
    }

    // Create CSS for view toggle buttons
    static createCSS() {
        return `
            /* View Toggle Styles */
            .view-toggle-btn {
                color: #6b7280;
                background: transparent;
                border: none;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                min-width: 40px;
                white-space: nowrap;
            }

            .view-toggle-btn:hover {
                color: var(--sz-color-primary, #556A4E);
                background: rgba(85, 106, 78, 0.1);
            }

            .view-toggle-btn.active {
                color: white;
                background: var(--sz-color-primary, #556A4E);
            }

            /* Mobile-specific toggle button styles */
            @media (max-width: 640px) {
                .view-toggle-btn {
                    min-width: 36px;
                    padding: 6px 8px;
                }
                
                .view-toggle-btn i {
                    font-size: 0.875rem;
                }
            }

            /* Extra small mobile devices */
            @media (max-width: 480px) {
                .view-toggle-btn {
                    min-width: 32px;
                    padding: 4px 6px;
                    font-size: 0.7rem;
                }
                
                .view-toggle-btn i {
                    font-size: 0.75rem;
                }
            }
        `;
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ViewToggle;
}

// Global namespace
window.SZ = window.SZ || {};
window.SZ.ViewToggle = ViewToggle;
