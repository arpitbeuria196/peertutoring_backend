// Application Configuration
const API_BASE_URL = '/api';
let authToken = localStorage.getItem('authToken');
let currentUser = null;

// Initialize Application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    
    // Check authentication status
    if (authToken) {
        checkAuthAndLoadUser();
    } else {
        showLandingPage();
    }
});

function initializeApp() {
    // Set up auth tab switching
    const authTabs = document.querySelectorAll('.auth-tab');
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.getAttribute('data-tab');
            showAuthTab(tabName);
        });
    });

    // Set up sidebar navigation
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.getAttribute('data-section');
            if (section) {
                showDashboardSection(section);
                
                // Update active state
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
            }
        });
    });
}

function setupEventListeners() {
    // Form submissions
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const uploadForm = document.getElementById('uploadForm');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    if (uploadForm) {
        uploadForm.addEventListener('submit', handleFileUpload);
    }
}

// Page Navigation Functions
function showPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Show target page
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
    }
}

function showLandingPage() {
    showPage('landing-page');
}

function showLogin() {
    showPage('login-page');
    showAuthTab('login');
}

function showRegister(role = 'student') {
    showPage('login-page');
    showAuthTab('signup');
    
    // Pre-select role if specified
    if (role === 'mentor') {
        document.getElementById('mentor').checked = true;
    } else {
        document.getElementById('student').checked = true;
    }
}

function showAuthTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update forms
    document.querySelectorAll('.auth-form').forEach(form => {
        form.classList.remove('active');
    });
    document.getElementById(`${tabName}-form`).classList.add('active');
}

function showDocumentPage() {
    showPage('document-page');
    loadUserDocuments();
}

function showDashboard() {
    showPage('dashboard-page');
    loadDashboardData();
}

function showDashboardSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show target section
    const targetSection = document.getElementById(`${sectionName}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
    }
}

// API Request Helper
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    };

    // Add auth token if available
    if (authToken) {
        config.headers['Authorization'] = `Bearer ${authToken}`;
    }

    try {
        const response = await fetch(url, config);
        const data = await response.json();
        
        // Handle token expiration
        if (response.status === 401) {
            logout();
            return { success: false, message: 'Session expired. Please login again.' };
        }
        
        return {
            success: response.ok,
            status: response.status,
            data: data.data || data.message || data,
            message: data.message
        };
    } catch (error) {
        console.error('API Request Error:', error);
        return {
            success: false,
            message: 'Network error. Please check your connection.'
        };
    }
}

// Authentication Functions
async function handleLogin(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const loginData = {
        login: formData.get('login'),
        password: formData.get('password')
    };

    showLoading(e.target.querySelector('button[type="submit"]'));
    
    const response = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginData)
    });

    hideLoading(e.target.querySelector('button[type="submit"]'));

    if (response.success) {
        authToken = response.data.token;
        currentUser = response.data.user;
        localStorage.setItem('authToken', authToken);
        
        showSuccess('Login successful! Redirecting to dashboard...');
        setTimeout(() => {
            redirectToDashboard(response.data.user.role);
        }, 1500);
    } else {
        if (response.status === 403 && response.data.code === 'ACCOUNT_PENDING_APPROVAL') {
            showError('Your account is pending approval. Please wait for admin approval or upload required documents.');
            // Show document upload option for pending users
            setTimeout(() => {
                currentUser = response.data.user;
                showDocumentPage();
            }, 2000);
        } else {
            showError(response.message || 'Login failed. Please check your credentials.');
        }
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    
    // Split full name into first and last name
    const fullName = formData.get('fullName').trim().split(' ');
    const firstName = fullName[0] || '';
    const lastName = fullName.slice(1).join(' ') || firstName; // Use first name as last name if only one name provided
    
    const registerData = {
        email: formData.get('email'),
        username: formData.get('email').split('@')[0], // Use email prefix as username
        firstName: firstName,
        lastName: lastName,
        password: formData.get('password'),
        role: formData.get('role')
    };

    showLoading(e.target.querySelector('button[type="submit"]'));
    
    const response = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify(registerData)
    });

    hideLoading(e.target.querySelector('button[type="submit"]'));

    if (response.success) {
        currentUser = response.data.user;
        showSuccess('Registration successful! Please upload your required documents for verification.');
        
        // Clear form and redirect to document upload
        e.target.reset();
        setTimeout(() => {
            showDocumentPage();
        }, 2000);
    } else {
        showError(response.message || 'Registration failed. Please try again.');
    }
}

async function checkAuthAndLoadUser() {
    if (!authToken) return;
    
    const response = await apiRequest('/auth/profile');
    
    if (response.success) {
        currentUser = response.data;
        
        // Check if user needs to upload documents
        if (!currentUser.isApproved && currentUser.role !== 'admin') {
            showDocumentPage();
        } else {
            showDashboard();
        }
    } else {
        logout();
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'landing.html';
}

// Document Management Functions
function uploadDocument(documentType) {
    document.getElementById('documentType').value = documentType;
    const modal = new bootstrap.Modal(document.getElementById('uploadModal'));
    modal.show();
}

async function handleFileUpload(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    
    showLoading(e.target.querySelector('button[type="submit"]'));
    
    const response = await apiRequest('/upload/document', {
        method: 'POST',
        body: formData,
        headers: {} // Remove Content-Type to let browser set it for FormData
    });

    hideLoading(e.target.querySelector('button[type="submit"]'));

    if (response.success) {
        showUploadSuccess('Document uploaded successfully! It will be reviewed by our admin team.');
        
        // Close modal and reload documents
        bootstrap.Modal.getInstance(document.getElementById('uploadModal')).hide();
        setTimeout(() => {
            loadUserDocuments();
        }, 1000);
    } else {
        showUploadError(response.message || 'Upload failed. Please try again.');
    }
}

async function loadUserDocuments() {
    if (!currentUser) return;
    
    const response = await apiRequest(`/documents/user/${currentUser._id}`);
    
    if (response.success) {
        renderDocumentsTable(response.data);
        
        // Update user name display
        const userNameElement = document.getElementById('current-user-name');
        if (userNameElement && currentUser) {
            userNameElement.textContent = `${currentUser.firstName} ${currentUser.lastName}`;
        }
    }
}

function renderDocumentsTable(documents) {
    const tbody = document.getElementById('documents-table-body');
    if (!tbody) return;
    
    if (!documents || documents.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted">No documents uploaded yet</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = documents.map(doc => `
        <tr>
            <td>
                <i class="fas fa-file-alt me-2"></i>
                ${doc.documentType === 'offerDocument' ? 'Offer Letter' : 'Resume'}
            </td>
            <td>${doc.filename}</td>
            <td>${formatDate(doc.uploadDate)}</td>
            <td>
                <span class="status-badge status-${doc.status.toLowerCase()}">
                    ${doc.status}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-outline-primary me-1" onclick="downloadDocument('${doc._id}')">
                    <i class="fas fa-download"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteDocument('${doc._id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

async function downloadDocument(documentId) {
    window.open(`${API_BASE_URL}/documents/download/${documentId}`, '_blank');
}

async function deleteDocument(documentId) {
    if (!confirm('Are you sure you want to delete this document?')) return;
    
    const response = await apiRequest(`/documents/${documentId}`, {
        method: 'DELETE'
    });
    
    if (response.success) {
        showSuccess('Document deleted successfully.');
        loadUserDocuments();
    } else {
        showError(response.message || 'Failed to delete document.');
    }
}

// Dashboard Functions
async function loadDashboardData() {
    if (!currentUser) return;
    
    // Update greeting
    updateDashboardGreeting();
    
    // Load upcoming sessions
    loadUpcomingSessions();
    
    // Load recent activity
    loadRecentActivity();
}

function updateDashboardGreeting() {
    const greetingElement = document.getElementById('dashboard-greeting');
    if (greetingElement && currentUser) {
        const hour = new Date().getHours();
        let greeting = 'Good morning';
        
        if (hour >= 12 && hour < 17) {
            greeting = 'Good afternoon';
        } else if (hour >= 17) {
            greeting = 'Good evening';
        }
        
        greetingElement.textContent = `${greeting}, ${currentUser.firstName}!`;
    }
}

async function loadUpcomingSessions() {
    const response = await apiRequest('/sessions/my-sessions');
    
    if (response.success) {
        renderUpcomingSessions(response.data);
    }
}

function renderUpcomingSessions(sessions) {
    const container = document.getElementById('upcoming-sessions');
    if (!container) return;
    
    if (!sessions || sessions.length === 0) {
        container.innerHTML = '<p class="text-muted">No upcoming sessions scheduled.</p>';
        return;
    }
    
    container.innerHTML = sessions.slice(0, 3).map(session => `
        <div class="session-card">
            <div class="session-info">
                <div class="session-avatar">
                    ${session.mentorName ? session.mentorName.charAt(0).toUpperCase() : 'M'}
                </div>
                <div class="session-details">
                    <h6>${session.subject || 'Session'} with ${session.mentorName || 'Mentor'}</h6>
                    <p><i class="fas fa-calendar me-1"></i>${formatDateTime(session.scheduledTime)}</p>
                    <p><i class="fas fa-book me-1"></i>${session.description || 'No description'}</p>
                </div>
            </div>
            <span class="session-status status-${session.status.toLowerCase()}">
                ${session.status}
            </span>
        </div>
    `).join('');
}

async function loadRecentActivity() {
    const container = document.getElementById('recent-activity');
    if (!container) return;
    
    // Mock recent activity for now
    container.innerHTML = `
        <div class="d-flex align-items-center mb-3">
            <div class="activity-icon me-3">
                <i class="fas fa-check-circle text-success"></i>
            </div>
            <div>
                <p class="mb-1">Session with Dr. Michael Chen completed</p>
                <small class="text-muted">2 days ago</small>
            </div>
        </div>
        <div class="d-flex align-items-center mb-3">
            <div class="activity-icon me-3">
                <i class="fas fa-message text-primary"></i>
            </div>
            <div>
                <p class="mb-1">New message from Emma Rodriguez</p>
                <small class="text-muted">3 days ago</small>
            </div>
        </div>
        <div class="d-flex align-items-center">
            <div class="activity-icon me-3">
                <i class="fas fa-user-check text-info"></i>
            </div>
            <div>
                <p class="mb-1">Profile updated successfully</p>
                <small class="text-muted">1 week ago</small>
            </div>
        </div>
    `;
}

// Utility Functions
function showLoading(button) {
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Loading...';
}

function hideLoading(button) {
    button.disabled = false;
    // Restore original button text based on context
    if (button.closest('#loginForm')) {
        button.innerHTML = 'Login';
    } else if (button.closest('#registerForm')) {
        button.innerHTML = 'Continue';
    } else if (button.closest('#uploadForm')) {
        button.innerHTML = 'Upload Document';
    }
}

function showSuccess(message) {
    showResponse(message, 'success');
}

function showError(message) {
    showResponse(message, 'error');
}

function showUploadSuccess(message) {
    showUploadResponse(message, 'success');
}

function showUploadError(message) {
    showUploadResponse(message, 'error');
}

function showResponse(message, type) {
    const container = document.getElementById('auth-response');
    if (!container) return;
    
    container.className = `response-container response-${type}`;
    container.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'} me-2"></i>
            <div>${message}</div>
        </div>
    `;
    container.style.display = 'block';
    
    // Auto-hide success messages
    if (type === 'success') {
        setTimeout(() => {
            container.style.display = 'none';
        }, 3000);
    }
}

function showUploadResponse(message, type) {
    const container = document.getElementById('upload-response');
    if (!container) return;
    
    container.className = `response-container response-${type}`;
    container.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'} me-2"></i>
            <div>${message}</div>
        </div>
    `;
    container.style.display = 'block';
    
    // Auto-hide success messages
    if (type === 'success') {
        setTimeout(() => {
            container.style.display = 'none';
        }, 3000);
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

// Forgot Password Function
function showForgotPassword() {
    // This would typically show a forgot password modal
    // For now, just show an alert
    alert('Forgot password functionality would be implemented here. Please contact support for password reset.');
}

// Global error handler
window.addEventListener('error', function(e) {
    console.error('Application error:', e.error);
});

// Handle page refresh/navigation
window.addEventListener('beforeunload', function(e) {
    // Could save any unsaved data here
});