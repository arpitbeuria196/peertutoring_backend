// Dashboard JavaScript
const API_BASE_URL = window.location.origin + '/api';
let currentUser = null;

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    checkAuthentication();
    
    // Set up event handlers
    setupEventHandlers();
    
    // Load dashboard data
    loadDashboardData();
});

function setupEventHandlers() {
    // Sidebar navigation
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.getAttribute('data-section');
            if (section) {
                showSection(section);
                
                // Update active state
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
            }
        });
    });

    // Profile form
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', handleProfileUpdate);
    }
}

async function checkAuthentication() {
    const token = localStorage.getItem('authToken');
    
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            currentUser = data.user || data.data || data;
            
            // Redirect to role-specific dashboard
            if (currentUser.role === 'admin') {
                window.location.href = 'admin-dashboard.html';
                return;
            } else if (currentUser.role === 'mentor') {
                window.location.href = 'mentor-dashboard.html';
                return;
            } else if (currentUser.role === 'student') {
                window.location.href = 'student-dashboard.html';
                return;
            }
            
            updateUserDisplay();
        } else {
            // Try to get user from localStorage if API fails
            const storedUser = localStorage.getItem('currentUser');
            if (storedUser) {
                currentUser = JSON.parse(storedUser);
                
                // Redirect to role-specific dashboard
                if (currentUser.role === 'admin') {
                    window.location.href = 'admin-dashboard.html';
                    return;
                } else if (currentUser.role === 'mentor') {
                    window.location.href = 'mentor-dashboard.html';
                    return;
                } else if (currentUser.role === 'student') {
                    window.location.href = 'student-dashboard.html';
                    return;
                }
                
                updateUserDisplay();
            } else {
                localStorage.removeItem('authToken');
                localStorage.removeItem('currentUser');
                window.location.href = 'login.html';
            }
        }
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = 'login.html';
    }
}

function updateUserDisplay() {
    if (!currentUser) return;
    
    // Update greeting
    updateDashboardGreeting();
    
    // Update profile form
    updateProfileForm();
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

function updateProfileForm() {
    if (!currentUser) return;
    
    const firstName = document.getElementById('firstName');
    const lastName = document.getElementById('lastName');
    const email = document.getElementById('email');
    const role = document.getElementById('role');
    
    if (firstName) firstName.value = currentUser.firstName || '';
    if (lastName) lastName.value = currentUser.lastName || '';
    if (email) email.value = currentUser.email || '';
    if (role) role.value = currentUser.role || '';
}

function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show target section
    const targetSection = document.getElementById(`${sectionName}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Update sidebar navigation active state
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    const activeNav = document.querySelector(`[data-section="${sectionName}"]`);
    if (activeNav) {
        activeNav.classList.add('active');
    }
    
    // Load section-specific data
    loadSectionData(sectionName);
}

// Make showSection globally available
window.showSection = showSection;

function loadSectionData(sectionName) {
    switch (sectionName) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'messages':
            loadMessages();
            break;
        case 'mentors':
            loadMentors();
            break;
        case 'settings':
            // Settings are already loaded
            break;
    }
}

async function loadDashboardData() {
    // Load analytics data
    await loadAnalyticsData();
    
    // Load upcoming sessions
    loadUpcomingSessions();
    
    // Load recent activity
    loadRecentActivity();
}

async function loadAnalyticsData() {
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/sessions/analytics/dashboard`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            renderAnalytics(data.data);
        } else {
            console.error('Failed to load analytics');
            renderDefaultAnalytics();
        }
    } catch (error) {
        console.error('Analytics error:', error);
        renderDefaultAnalytics();
    }
}

function renderAnalytics(analytics) {
    const analyticsSection = document.getElementById('analytics-section');
    if (!analyticsSection) return;
    
    let cards = '';
    
    if (analytics.userType === 'mentor') {
        cards = `
            <div class="col-md-3">
                <div class="stat-card">
                    <div class="stat-icon">
                        <i class="fas fa-calendar-check"></i>
                    </div>
                    <div class="stat-info">
                        <h3>${analytics.totalSessions}</h3>
                        <p>Total Sessions</p>
                        <small class="text-success">+12% from last month</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="stat-card">
                    <div class="stat-icon">
                        <i class="fas fa-clock"></i>
                    </div>
                    <div class="stat-info">
                        <h3>${analytics.upcomingSessions}</h3>
                        <p>Upcoming Sessions</p>
                        <small class="text-muted">Today</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="stat-card">
                    <div class="stat-icon">
                        <i class="fas fa-dollar-sign"></i>
                    </div>
                    <div class="stat-info">
                        <h3>$${analytics.monthlyEarnings.toLocaleString()}</h3>
                        <p>This Month Earnings</p>
                        <small class="text-success">+8% from last month</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="stat-card">
                    <div class="stat-icon">
                        <i class="fas fa-bell"></i>
                    </div>
                    <div class="stat-info">
                        <h3>${analytics.pendingRequests}</h3>
                        <p>Pending Requests</p>
                        <small class="text-warning">Needs attention</small>
                    </div>
                </div>
            </div>
        `;
    } else if (analytics.userType === 'student') {
        cards = `
            <div class="col-md-4">
                <div class="stat-card">
                    <div class="stat-icon">
                        <i class="fas fa-graduation-cap"></i>
                    </div>
                    <div class="stat-info">
                        <h3>${analytics.totalSessions}</h3>
                        <p>Sessions Completed</p>
                        <small class="text-success">Keep learning!</small>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="stat-card">
                    <div class="stat-icon">
                        <i class="fas fa-clock"></i>
                    </div>
                    <div class="stat-info">
                        <h3>${analytics.upcomingSessions}</h3>
                        <p>Upcoming Sessions</p>
                        <small class="text-muted">Next 7 days</small>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="stat-card">
                    <div class="stat-icon">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="stat-info">
                        <h3>${analytics.activeMentors}</h3>
                        <p>Active Mentors</p>
                        <small class="text-info">Your network</small>
                    </div>
                </div>
            </div>
        `;
    } else if (analytics.userType === 'admin') {
        cards = `
            <div class="col-md-3">
                <div class="stat-card">
                    <div class="stat-icon">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="stat-info">
                        <h3>${analytics.totalUsers}</h3>
                        <p>Total Users</p>
                        <small class="text-info">Active platform users</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="stat-card">
                    <div class="stat-icon">
                        <i class="fas fa-chalkboard-teacher"></i>
                    </div>
                    <div class="stat-info">
                        <h3>${analytics.totalMentors}</h3>
                        <p>Total Mentors</p>
                        <small class="text-success">Approved mentors</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="stat-card">
                    <div class="stat-icon">
                        <i class="fas fa-exclamation-circle"></i>
                    </div>
                    <div class="stat-info">
                        <h3>${analytics.pendingApprovals}</h3>
                        <p>Pending Verifications</p>
                        <small class="text-warning">Needs review</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="stat-card">
                    <div class="stat-icon">
                        <i class="fas fa-calendar-check"></i>
                    </div>
                    <div class="stat-info">
                        <h3>${analytics.completedSessions}</h3>
                        <p>Completed Sessions</p>
                        <small class="text-success">Platform total</small>
                    </div>
                </div>
            </div>
        `;
    }
    
    analyticsSection.innerHTML = `<div class="row">${cards}</div>`;
}

function renderDefaultAnalytics() {
    const analyticsSection = document.getElementById('analytics-section');
    if (!analyticsSection) return;
    
    analyticsSection.innerHTML = `
        <div class="row">
            <div class="col-12">
                <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    Loading analytics data...
                </div>
            </div>
        </div>
    `;
}

async function loadUpcomingSessions() {
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/sessions/upcoming`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            renderUpcomingSessions(data.data || []);
        } else {
            renderUpcomingSessions([]);
        }
    } catch (error) {
        console.error('Load sessions error:', error);
        renderUpcomingSessions([]);
    }
}

function renderUpcomingSessions(sessions) {
    const container = document.getElementById('upcoming-sessions');
    if (!container) return;
    
    if (!sessions || sessions.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-calendar-alt fa-3x mb-3"></i>
                <p>No upcoming sessions scheduled</p>
                <small>Book a session with a mentor to get started</small>
            </div>
        `;
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

function loadRecentActivity() {
    const container = document.getElementById('recent-activity');
    if (!container) return;
    
    // Show placeholder activity for now
    container.innerHTML = `
        <div class="d-flex align-items-center mb-3">
            <div class="activity-icon me-3">
                <i class="fas fa-check-circle text-success"></i>
            </div>
            <div>
                <p class="mb-1">Profile updated successfully</p>
                <small class="text-muted">Just now</small>
            </div>
        </div>
        <div class="d-flex align-items-center mb-3">
            <div class="activity-icon me-3">
                <i class="fas fa-user-plus text-info"></i>
            </div>
            <div>
                <p class="mb-1">Account approved and activated</p>
                <small class="text-muted">Today</small>
            </div>
        </div>
        <div class="d-flex align-items-center">
            <div class="activity-icon me-3">
                <i class="fas fa-file-upload text-primary"></i>
            </div>
            <div>
                <p class="mb-1">Documents verified successfully</p>
                <small class="text-muted">Yesterday</small>
            </div>
        </div>
    `;
}

function loadMessages() {
    const conversationsList = document.getElementById('conversations-list');
    if (!conversationsList) return;
    
    conversationsList.innerHTML = `
        <div class="text-center text-muted py-4">
            <i class="fas fa-comments fa-3x mb-3"></i>
            <p>No conversations yet</p>
            <small>Start messaging mentors to see conversations here</small>
        </div>
    `;
}

async function loadMentors() {
    const mentorsGrid = document.getElementById('mentors-grid');
    if (!mentorsGrid) return;
    
    // Show loading state
    mentorsGrid.innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading mentors...</span>
            </div>
            <p class="mt-2 text-muted">Finding available mentors...</p>
        </div>
    `;

    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/search/mentors?limit=6`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            renderMentorsList(data.data.mentors || []);
        } else {
            renderMentorsError();
        }
    } catch (error) {
        console.error('Load mentors error:', error);
        renderMentorsError();
    }
}

function renderMentorsList(mentors) {
    const mentorsGrid = document.getElementById('mentors-grid');
    if (!mentorsGrid) return;

    if (mentors.length === 0) {
        mentorsGrid.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-user-graduate fa-3x mb-3"></i>
                <p>No mentors available right now</p>
                <small>Check back later for new mentors</small>
            </div>
        `;
        return;
    }

    mentorsGrid.innerHTML = `
        <div class="row g-3">
            ${mentors.map(mentor => `
                <div class="col-md-6 col-lg-4">
                    <div class="card mentor-card h-100 shadow-sm">
                        <div class="card-body">
                            <div class="d-flex align-items-center mb-3">
                                <div class="mentor-avatar me-3 bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style="width: 50px; height: 50px; font-weight: bold;">
                                    ${mentor.firstName ? mentor.firstName.charAt(0).toUpperCase() : 'M'}
                                </div>
                                <div>
                                    <h6 class="card-title mb-1">${mentor.firstName} ${mentor.lastName}</h6>
                                    <div class="mentor-rating text-warning">
                                        ${'★'.repeat(Math.floor(mentor.rating || 4))}${'☆'.repeat(5 - Math.floor(mentor.rating || 4))}
                                        <span class="ms-1 text-muted small">(${mentor.totalReviews || 0})</span>
                                    </div>
                                </div>
                            </div>
                            
                            <p class="card-text small text-muted mb-2">${(mentor.bio || 'Experienced mentor ready to help you learn').substring(0, 80)}...</p>
                            
                            <div class="mentor-skills mb-3">
                                ${(mentor.skills || ['Programming', 'Tutoring']).slice(0, 3).map(skill => 
                                    `<span class="badge bg-light text-primary border me-1 mb-1">${skill}</span>`
                                ).join('')}
                                ${mentor.skills && mentor.skills.length > 3 ? `<span class="text-muted small">+${mentor.skills.length - 3} more</span>` : ''}
                            </div>
                            
                            <div class="d-flex justify-content-between align-items-center">
                                <div class="mentor-price">
                                    <strong class="text-success">$${mentor.hourlyRate || 25}/hr</strong>
                                </div>
                                <button class="btn btn-primary btn-sm" onclick="requestSession('${mentor._id}', '${mentor.firstName} ${mentor.lastName}')">
                                    <i class="fas fa-calendar-plus me-1"></i>Book Session
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        
        <div class="text-center mt-4">
            <button class="btn btn-outline-primary" onclick="showMentorSearch()">
                <i class="fas fa-search me-1"></i>Find More Mentors
            </button>
        </div>
    `;
}

function renderMentorsError() {
    const mentorsGrid = document.getElementById('mentors-grid');
    if (mentorsGrid) {
        mentorsGrid.innerHTML = `
            <div class="text-center py-4">
                <i class="fas fa-exclamation-triangle fa-2x text-warning mb-3"></i>
                <p class="text-muted">Unable to load mentors</p>
                <button class="btn btn-outline-primary btn-sm" onclick="loadMentors()">
                    <i class="fas fa-refresh me-1"></i>Try Again
                </button>
            </div>
        `;
    }
}

function requestSession(mentorId, mentorName) {
    showNotification(`Session request with ${mentorName} will be available soon!`, 'info');
    // TODO: Implement session booking modal
}

function showMentorSearch() {
    window.location.href = 'mentors.html';
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const updateData = {
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        about: formData.get('about'),
        title: formData.get('title'),
        company: formData.get('company'),
        bio: formData.get('bio')
    };

    const submitButton = e.target.querySelector('button[type="submit"]');
    showLoading(submitButton, 'Saving...');
    
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/users/profile`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });

        const data = await response.json();
        hideLoading(submitButton, 'Save Changes');

        if (response.ok && data.success) {
            currentUser = { ...currentUser, ...updateData };
            updateDashboardGreeting();
            showNotification('Profile updated successfully!', 'success');
        } else {
            showNotification(data.message || 'Failed to update profile', 'error');
        }
    } catch (error) {
        hideLoading(submitButton, 'Save Changes');
        console.error('Profile update error:', error);
        showNotification('Network error. Please try again.', 'error');
    }
}

function showLoading(button, text) {
    button.disabled = true;
    button.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${text}`;
}

function hideLoading(button, originalText) {
    button.disabled = false;
    button.innerHTML = `<i class="fas fa-save me-2"></i>${originalText}`;
}

function showNotification(message, type = 'info') {
    const toast = document.getElementById('notificationToast');
    const toastMessage = document.getElementById('toastMessage');
    
    if (toast && toastMessage) {
        toastMessage.textContent = message;
        
        // Update toast styling based on type
        toast.className = `toast ${type === 'success' ? 'bg-success text-white' : type === 'error' ? 'bg-danger text-white' : ''}`;
        
        const bootstrapToast = new bootstrap.Toast(toast);
        bootstrapToast.show();
    }
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

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'landing.html';
}

// Make functions globally available
window.logout = logout;
window.showSection = showSection;
window.handleProfileUpdate = handleProfileUpdate;