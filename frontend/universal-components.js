// Universal Components for MentorHub
class UniversalComponents {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    async init() {
        // Skip initialization on login/register pages to avoid header conflicts
        const currentPage = window.location.pathname.split('/').pop();
        if (currentPage.includes('login') || currentPage.includes('register')) {
            // Only add footer for login/register pages
            await this.createFooter();
            return;
        }
        
        await this.loadCurrentUser();
        this.createHeader();
        await this.createFooter();
        this.attachEventListeners();
    }

    async loadCurrentUser() {
        try {
            const token = localStorage.getItem('token');
            if (!token) return null;

            const response = await fetch('/api/auth/profile', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                this.currentUser = await response.json();
                localStorage.setItem('user', JSON.stringify(this.currentUser));
                return this.currentUser;
            } else {
                // Clear invalid token
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        } catch (error) {
            console.error('Error loading current user:', error);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
        return null;
    }

    createHeader() {
        const existingHeader = document.querySelector('.universal-header');
        if (existingHeader) {
            existingHeader.remove();
        }

        const headerHTML = this.currentUser ? this.getLoggedInHeader() : this.getLoggedOutHeader();
        
        // Insert header at the beginning of body
        document.body.insertAdjacentHTML('afterbegin', headerHTML);
    }

    getLoggedOutHeader() {
        return `
            <nav class="universal-header">
                <div class="container">
                    <div class="header-nav">
                        <a href="landing.html" class="navbar-brand text-decoration-none">
                            <div class="logo">
                                <i class="fas fa-graduation-cap"></i>
                                MentorHub
                            </div>
                        </a>
                        <div class="header-actions">
                            <a href="about.html" class="btn btn-link text-decoration-none me-2">About</a>
                            <a href="contact.html" class="btn btn-link text-decoration-none me-2">Contact</a>
                            <a href="login.html" class="btn btn-outline-primary me-2">Login</a>
                            <a href="register.html" class="btn btn-primary">Register</a>
                        </div>
                    </div>
                </div>
            </nav>
        `;
    }

    getLoggedInHeader() {
        const user = this.currentUser.data || this.currentUser;
        const userInitials = user.firstName && user.lastName 
            ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
            : user.email[0].toUpperCase();

        const dashboardLink = this.getDashboardLink(user.role);

        return `
            <nav class="universal-header">
                <div class="container">
                    <div class="header-nav">
                        <a href="${dashboardLink}" class="navbar-brand text-decoration-none">
                            <div class="logo">
                                <i class="fas fa-graduation-cap"></i>
                                MentorHub
                            </div>
                        </a>
                        <div class="header-actions">
                            <button class="dashboard-message-btn me-2" onclick="openMessagingModal()">
                                <i class="fas fa-comments"></i>
                                Messages
                            </button>
                            <a href="mentors.html" class="btn btn-link text-decoration-none me-2">Find Mentors</a>
                            <div class="user-info">
                                <div class="user-avatar">${userInitials}</div>
                                <span class="me-2">${user.firstName || user.email}</span>
                            </div>
                            <div class="dropdown">
                                <button class="btn btn-link dropdown-toggle" type="button" data-bs-toggle="dropdown">
                                    <i class="fas fa-cog"></i>
                                </button>
                                <ul class="dropdown-menu dropdown-menu-end">
                                    <li><a class="dropdown-item" href="${dashboardLink}"><i class="fas fa-tachometer-alt me-2"></i>Dashboard</a></li>
                                    <li><a class="dropdown-item" href="settings.html"><i class="fas fa-cog me-2"></i>Settings</a></li>
                                    <li><a class="dropdown-item" href="documents.html"><i class="fas fa-file-alt me-2"></i>Documents</a></li>
                                    <li><hr class="dropdown-divider"></li>
                                    <li><a class="dropdown-item" href="#" onclick="universalComponents.logout()"><i class="fas fa-sign-out-alt me-2"></i>Logout</a></li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>
        `;
    }

    getDashboardLink(role) {
        switch (role) {
            case 'admin':
                return 'admin-dashboard.html';
            case 'mentor':
                return 'mentor-dashboard.html';
            case 'student':
                return 'student-dashboard.html';
            default:
                return 'dashboard.html';
        }
    }

    async createFooter() {
        // Only add footer if it doesn't already exist
        const existingFooter = document.querySelector('footer');
        if (existingFooter) {
            return; // Don't add duplicate footer
        }

        try {
            // Load the global footer HTML
            const response = await fetch('global-footer.html');
            if (response.ok) {
                const footerHTML = await response.text();
                document.body.insertAdjacentHTML('beforeend', footerHTML);
            } else {
                console.error('Failed to load global footer');
            }
        } catch (error) {
            console.error('Error loading footer:', error);
        }
    }

    attachEventListeners() {
        // Handle responsive dropdown toggles
        document.addEventListener('click', function(e) {
            if (e.target.closest('.dropdown-toggle')) {
                e.preventDefault();
                const dropdown = e.target.closest('.dropdown');
                const menu = dropdown.querySelector('.dropdown-menu');
                menu.classList.toggle('show');
            } else {
                // Close all dropdowns when clicking outside
                document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
                    menu.classList.remove('show');
                });
            }
        });
    }

    async logout() {
        try {
            const token = localStorage.getItem('token');
            
            // Call logout endpoint
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Clear local storage and redirect regardless of API response
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'landing.html';
        }
    }

    // Utility method to show notifications
    showNotification(message, type = 'info') {
        // Remove existing notifications
        document.querySelectorAll('.notification').forEach(n => n.remove());
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="d-flex align-items-center justify-content-between">
                <div class="d-flex align-items-center">
                    <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'} me-2"></i>
                    ${message}
                </div>
                <button class="btn btn-sm btn-link text-white p-0 ms-2" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    // Method to refresh header when user logs in/out
    async refreshHeader() {
        await this.loadCurrentUser();
        this.createHeader();
    }

    // Method to add custom CSS for specific pages
    addPageSpecificStyles(styles) {
        const styleElement = document.createElement('style');
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }
}

// Initialize universal components
const universalComponents = new UniversalComponents();

// Make available globally
window.universalComponents = universalComponents;