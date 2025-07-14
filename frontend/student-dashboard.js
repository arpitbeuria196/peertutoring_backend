// Student Dashboard JavaScript
const API_BASE_URL = window.location.origin + '/api';
let currentUser = null;

document.addEventListener('DOMContentLoaded', function() {
    checkAuthentication();
    setupEventHandlers();
    loadStudentDashboard();
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
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
            }
        });
    });

    // Profile form
    const profileForm = document.getElementById('student-profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', handleProfileUpdate);
    }

    // Mentor search
    const searchInput = document.getElementById('mentor-search');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchMentors();
            }
        });
    }
}

async function checkAuthentication() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            
            if (currentUser.role !== 'student') {
                window.location.href = 'index.html';
                return;
            }
            
            updateUserDisplay();
        } else {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'landing.html';
        }
    } catch (error) {
        console.error('Authentication error:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'landing.html';
    }
}

function updateUserDisplay() {
    if (currentUser) {
        const studentNameEl = document.getElementById('student-name');
        if (studentNameEl) {
            studentNameEl.textContent = `${currentUser.firstName} ${currentUser.lastName}`;
        }
        
        const greetingEl = document.getElementById('student-greeting');
        if (greetingEl) {
            greetingEl.textContent = `Welcome back, ${currentUser.firstName}!`;
        }
        
        updateProfileForm();
    }
}

function updateProfileForm() {
    if (!currentUser) return;
    
    const firstNameEl = document.getElementById('student-firstName');
    const lastNameEl = document.getElementById('student-lastName');
    const bioEl = document.getElementById('student-bio');
    const interestsEl = document.getElementById('student-interests');
    const levelEl = document.getElementById('student-level');
    
    if (firstNameEl) firstNameEl.value = currentUser.firstName || '';
    if (lastNameEl) lastNameEl.value = currentUser.lastName || '';
    if (bioEl) bioEl.value = currentUser.bio || '';
    if (interestsEl) interestsEl.value = currentUser.interests ? currentUser.interests.join(', ') : '';
    if (levelEl) levelEl.value = currentUser.experienceLevel || '';
}

function showSection(sectionName) {
    // Hide all sections
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => section.classList.remove('active'));

    // Show selected section
    const targetSection = document.getElementById(`${sectionName}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
        loadSectionData(sectionName);
    }
}

function loadSectionData(sectionName) {
    switch (sectionName) {
        case 'dashboard':
            loadStudentDashboard();
            break;
        case 'mentors':
            loadMentors();
            break;
        case 'sessions':
            loadUpcomingSessions();
            break;
        case 'notifications':
            loadNotifications();
            break;
        case 'messages':
            loadMessages();
            break;
        case 'documents':
            // Navigate to documents page
            window.location.href = 'documents.html';
            break;
        case 'profile':
            updateProfileForm();
            break;
    }
}

async function loadStudentDashboard() {
    try {
        const token = localStorage.getItem('token');
        
        // Load student stats
        const response = await fetch(`${API_BASE_URL}/users/stats`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            updateStudentStats(data.data);
        }
        
        loadUpcomingSessions();
        loadRecentActivity();
        loadRecommendedMentors();
    } catch (error) {
        console.error('Error loading student dashboard:', error);
    }
}

function updateStudentStats(stats) {
    document.getElementById('active-mentors').textContent = stats.activeMentors || 0;
    document.getElementById('completed-sessions').textContent = stats.completedSessions || 0;
    document.getElementById('upcoming-sessions').textContent = stats.upcomingSessions || 0;
    document.getElementById('unread-messages').textContent = stats.unreadMessages || 0;
}

async function loadUpcomingSessions() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/sessions/upcoming`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            renderUpcomingSessions(data.data.sessions);
        }
    } catch (error) {
        console.error('Error loading upcoming sessions:', error);
    }
}

function renderUpcomingSessions(sessions) {
    const container = document.getElementById('student-upcoming-sessions');
    
    if (!sessions || sessions.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted">
                <i class="fas fa-calendar fa-3x mb-3"></i>
                <p>No upcoming sessions scheduled</p>
                <button class="btn btn-primary" onclick="showSection('mentors')">
                    Find a Mentor
                </button>
            </div>
        `;
        return;
    }

    const sessionsHTML = sessions.map(session => `
        <div class="session-item mb-3 p-3 border rounded">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h6>${session.title || 'Mentoring Session'}</h6>
                    <p class="text-muted mb-1">
                        <i class="fas fa-user me-1"></i>${session.mentor.firstName} ${session.mentor.lastName}
                    </p>
                    <p class="text-muted mb-0">
                        <i class="fas fa-clock me-1"></i>${formatDateTime(session.scheduledAt)}
                    </p>
                </div>
                <div>
                    <button class="btn btn-primary btn-sm" onclick="joinSession('${session._id}')">
                        Join Session
                    </button>
                </div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = sessionsHTML;
}

function getApiBaseUrl() {
    return window.location.origin + '/api';
}

async function loadRecentActivity() {
    const container = document.getElementById('student-recent-activity');
    
    try {
        // Load available sessions from mentors
        const token = localStorage.getItem('token');
        const response = await fetch(`${getApiBaseUrl()}/session-notifications/available-sessions`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            renderAvailableSessions(data.data);
        } else {
            container.innerHTML = `
                <div class="text-center text-muted">
                    <i class="fas fa-history fa-2x mb-2"></i>
                    <p>No session notifications available</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading session notifications:', error);
        container.innerHTML = `
            <div class="text-center text-muted">
                <i class="fas fa-exclamation-circle fa-2x mb-2 text-warning"></i>
                <p>Unable to load session notifications</p>
            </div>
        `;
    }
}

function renderAvailableSessions(sessions) {
    const container = document.getElementById('student-recent-activity');
    
    if (!sessions || sessions.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted">
                <i class="fas fa-bell fa-2x mb-2"></i>
                <p>No new session notifications</p>
            </div>
        `;
        return;
    }

    const sessionsHTML = sessions.slice(0, 3).map(session => `
        <div class="notification-item mb-3 p-3 border rounded bg-light">
            <div class="d-flex justify-content-between align-items-start">
                <div class="flex-grow-1">
                    <div class="d-flex align-items-center mb-2">
                        <i class="fas fa-bell text-primary me-2"></i>
                        <strong>New Session Available!</strong>
                    </div>
                    <h6 class="mb-1">${session.title}</h6>
                    <div class="text-muted small mb-2">
                        <div><i class="fas fa-user me-1"></i>Mentor: ${session.mentorId?.firstName || 'Unknown'} ${session.mentorId?.lastName || ''}</div>
                        <div><i class="fas fa-calendar me-1"></i>${new Date(session.scheduledAt).toLocaleDateString()}</div>
                        <div><i class="fas fa-clock me-1"></i>${new Date(session.scheduledAt).toLocaleTimeString()}</div>
                        <div><i class="fas fa-hourglass-half me-1"></i>${session.duration} minutes</div>
                        ${session.isGroupSession ? `<div><i class="fas fa-users me-1"></i>Group Session (${session.students.length}/${session.maxParticipants})</div>` : ''}
                    </div>
                    ${session.description ? `<p class="text-muted small mb-2">${session.description}</p>` : ''}
                </div>
                <div class="ms-3">
                    <div class="btn-group-vertical">
                        <button class="btn btn-outline-primary btn-sm mb-1" onclick="viewSessionDetails('${session._id}')">
                            <i class="fas fa-eye me-1"></i>View
                        </button>
                        <button class="btn btn-primary btn-sm" onclick="joinSessionNotification('${session._id}', '${session.title}')">
                            <i class="fas fa-plus me-1"></i>Join
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = sessionsHTML + 
        (sessions.length > 3 ? `
            <div class="text-center mt-3">
                <button class="btn btn-outline-primary btn-sm" onclick="showAllAvailableSessions()">
                    View All Available Sessions (${sessions.length})
                </button>
            </div>
        ` : '');
}

async function joinSessionNotification(sessionId, sessionTitle) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${getApiBaseUrl()}/session-notifications/join-session/${sessionId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        
        if (response.ok) {
            showNotification(`Successfully joined "${sessionTitle}"! Check your messages for meeting details.`, 'success');
            
            // Refresh the available sessions and upcoming sessions
            loadRecentActivity();
            loadUpcomingSessions();
            
        } else {
            showNotification(data.message || 'Error joining session', 'error');
        }
        
    } catch (error) {
        console.error('Error joining session:', error);
        showNotification('Error joining session. Please try again.', 'error');
    }
}

async function viewSessionDetails(sessionId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${getApiBaseUrl()}/sessions/${sessionId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const session = await response.json();
            
            // Create modal with session details
            const modalHTML = `
                <div class="modal fade" id="sessionDetailsModal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Session Details</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="row">
                                    <div class="col-md-6">
                                        <h6>Session Information</h6>
                                        <p><strong>Title:</strong> ${session.title || 'Mentoring Session'}</p>
                                        <p><strong>Description:</strong> ${session.description || 'No description provided'}</p>
                                        <p><strong>Date & Time:</strong> ${formatDateTime(session.scheduledAt || session.date)}</p>
                                        <p><strong>Duration:</strong> ${session.duration || 60} minutes</p>
                                    </div>
                                    <div class="col-md-6">
                                        <h6>Mentor Information</h6>
                                        <p><strong>Name:</strong> ${session.mentor?.firstName || ''} ${session.mentor?.lastName || ''}</p>
                                        <p><strong>Email:</strong> ${session.mentor?.email || 'N/A'}</p>
                                        <p><strong>Skills:</strong> ${session.mentor?.skills?.join(', ') || 'N/A'}</p>
                                    </div>
                                </div>
                                ${session.meetLink ? `
                                    <div class="mt-3">
                                        <h6>Meeting Link</h6>
                                        <div class="input-group">
                                            <input type="text" class="form-control" value="${session.meetLink}" readonly>
                                            <button class="btn btn-outline-secondary" onclick="navigator.clipboard.writeText('${session.meetLink}')">
                                                <i class="fas fa-copy"></i>
                                            </button>
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                                <button type="button" class="btn btn-success" onclick="joinSessionNotification('${sessionId}', '${session.title}')">
                                    <i class="fas fa-video me-1"></i>Join Session
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Remove existing modal
            const existingModal = document.getElementById('sessionDetailsModal');
            if (existingModal) existingModal.remove();
            
            // Add modal to body
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            
            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('sessionDetailsModal'));
            modal.show();
            
        } else {
            showNotification('Failed to load session details', 'error');
        }
    } catch (error) {
        console.error('Error loading session details:', error);
        showNotification('Error loading session details', 'error');
    }
}

function showAllAvailableSessions() {
    // Create modal to show all available sessions
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'availableSessionsModal';
    modal.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">
                        <i class="fas fa-calendar-check me-2"></i>Available Sessions
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div id="allAvailableSessionsList">
                        <div class="text-center">
                            <i class="fas fa-spinner fa-spin fa-2x"></i>
                            <p>Loading sessions...</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Show modal
    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();
    
    // Load all sessions
    loadAllAvailableSessions();
    
    // Remove modal from DOM when hidden
    modal.addEventListener('hidden.bs.modal', () => {
        modal.remove();
    });
}

async function loadAllAvailableSessions() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${getApiBaseUrl()}/session-notifications/available-sessions`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            renderAllAvailableSessions(data.data);
        } else {
            document.getElementById('allAvailableSessionsList').innerHTML = `
                <div class="text-center text-muted">
                    <i class="fas fa-exclamation-circle fa-2x mb-2"></i>
                    <p>Unable to load sessions</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading all available sessions:', error);
        document.getElementById('allAvailableSessionsList').innerHTML = `
            <div class="text-center text-muted">
                <i class="fas fa-exclamation-circle fa-2x mb-2"></i>
                <p>Error loading sessions</p>
            </div>
        `;
    }
}

function renderAllAvailableSessions(sessions) {
    const container = document.getElementById('allAvailableSessionsList');
    
    if (!sessions || sessions.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted">
                <i class="fas fa-calendar fa-3x mb-3"></i>
                <p>No sessions available at this time</p>
            </div>
        `;
        return;
    }

    const sessionsHTML = sessions.map(session => `
        <div class="card mb-3">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <h5 class="card-title">${session.title}</h5>
                        <div class="row text-muted small mb-2">
                            <div class="col-md-6">
                                <div><i class="fas fa-user me-1"></i><strong>Mentor:</strong> ${session.mentor.firstName} ${session.mentor.lastName}</div>
                                <div><i class="fas fa-star me-1"></i><strong>Rating:</strong> ${session.mentor.rating || 'New'}/5</div>
                                <div><i class="fas fa-tag me-1"></i><strong>Subject:</strong> ${session.subject}</div>
                            </div>
                            <div class="col-md-6">
                                <div><i class="fas fa-calendar me-1"></i><strong>Date:</strong> ${new Date(session.date).toLocaleDateString()}</div>
                                <div><i class="fas fa-clock me-1"></i><strong>Time:</strong> ${new Date(session.date).toLocaleTimeString()}</div>
                                <div><i class="fas fa-hourglass-half me-1"></i><strong>Duration:</strong> ${session.duration} minutes</div>
                                ${session.isGroupSession ? `<div><i class="fas fa-users me-1"></i><strong>Group:</strong> ${session.students.length}/${session.maxParticipants} participants</div>` : ''}
                            </div>
                        </div>
                        ${session.description ? `<p class="card-text">${session.description}</p>` : ''}
                    </div>
                    <div class="ms-3">
                        <button class="btn btn-primary" onclick="joinSessionNotification('${session._id}', '${session.title}')">
                            <i class="fas fa-plus me-1"></i>Join Session
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = sessionsHTML;
}

async function loadRecommendedMentors() {
    const container = document.getElementById('recommended-mentors');
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/mentors/recommended`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            renderRecommendedMentors(data.data.mentors);
        } else {
            container.innerHTML = `
                <div class="text-center text-muted">
                    <i class="fas fa-user-tie fa-2x mb-2"></i>
                    <p>Complete your profile to get personalized recommendations</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading recommended mentors:', error);
        container.innerHTML = `
            <div class="text-center text-muted">
                <i class="fas fa-user-tie fa-2x mb-2"></i>
                <p>Complete your profile to get personalized recommendations</p>
            </div>
        `;
    }
}

function renderRecommendedMentors(mentors) {
    const container = document.getElementById('recommended-mentors');
    
    if (!mentors || mentors.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted">
                <i class="fas fa-user-tie fa-2x mb-2"></i>
                <p>No recommendations available</p>
            </div>
        `;
        return;
    }

    const mentorsHTML = mentors.slice(0, 3).map(mentor => `
        <div class="mentor-card mb-2 p-2 border rounded">
            <div class="d-flex align-items-center">
                <div class="flex-grow-1">
                    <h6 class="mb-1">${mentor.firstName} ${mentor.lastName}</h6>
                    <small class="text-muted">${mentor.skills ? mentor.skills.slice(0, 2).join(', ') : 'Multiple skills'}</small>
                    <div class="text-warning small">
                        ${'★'.repeat(Math.floor(mentor.rating || 4))}${'☆'.repeat(5 - Math.floor(mentor.rating || 4))}
                    </div>
                </div>
                <button class="btn btn-outline-primary btn-sm" onclick="viewMentorProfile('${mentor._id}')">
                    View
                </button>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = mentorsHTML;
}

async function loadMentors() {
    const container = document.getElementById('mentors-grid');
    container.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin"></i> Loading mentors...</div>';
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/mentors/recommended`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            renderMentorsGrid(data.data.mentors);
        } else {
            container.innerHTML = '<div class="text-center text-muted">Failed to load mentors</div>';
        }
    } catch (error) {
        console.error('Error loading mentors:', error);
        container.innerHTML = '<div class="text-center text-muted">Error loading mentors</div>';
    }
}

function renderMentorsGrid(mentors) {
    const container = document.getElementById('mentors-grid');
    
    if (!mentors || mentors.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted">
                <i class="fas fa-users fa-3x mb-3"></i>
                <p>No mentors available at the moment</p>
            </div>
        `;
        return;
    }

    const mentorsHTML = `
        <div class="row">
            ${mentors.map(mentor => `
                <div class="col-md-6 col-lg-4 mb-4">
                    <div class="card mentor-card h-100">
                        <div class="card-body">
                            <div class="d-flex align-items-center mb-3">
                                <div class="mentor-avatar me-3">
                                    <i class="fas fa-user-circle fa-3x text-primary"></i>
                                </div>
                                <div>
                                    <h5 class="card-title mb-1">${mentor.firstName} ${mentor.lastName}</h5>
                                    <div class="text-warning small">
                                        ${'★'.repeat(Math.floor(mentor.rating || 4))}${'☆'.repeat(5 - Math.floor(mentor.rating || 4))}
                                        <span class="text-muted">(${mentor.totalReviews || 0})</span>
                                    </div>
                                </div>
                            </div>
                            <p class="card-text text-muted small">${mentor.bio || 'Experienced mentor ready to help you succeed.'}</p>
                            <div class="mb-3">
                                <strong>Skills:</strong>
                                <div class="mt-1">
                                    ${mentor.skills ? mentor.skills.slice(0, 3).map(skill => 
                                        `<span class="badge bg-light text-dark me-1">${skill}</span>`
                                    ).join('') : '<span class="text-muted">Not specified</span>'}
                                </div>
                            </div>
                            <div class="d-flex justify-content-between align-items-center">
                                <div class="text-primary font-weight-bold">
                                    ${mentor.hourlyRate ? `$${mentor.hourlyRate}/hr` : 'Rate not set'}
                                </div>
                                <div>
                                    <button class="btn btn-outline-primary btn-sm me-2" onclick="viewMentorProfile('${mentor._id}')">
                                        View Profile
                                    </button>
                                    <button class="btn btn-primary btn-sm" onclick="requestSession('${mentor._id}', '${mentor.firstName} ${mentor.lastName}')">
                                        Request Session
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    
    container.innerHTML = mentorsHTML;
}

function searchMentors() {
    const searchTerm = document.getElementById('mentor-search').value;
    console.log('Searching for mentors:', searchTerm);
    loadMentors(); // For now, just reload all mentors
}

async function loadStudentSessions() {
    const upcomingContainer = document.getElementById('student-sessions-upcoming');
    const pastContainer = document.getElementById('student-sessions-past');
    
    upcomingContainer.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
    pastContainer.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
    
    // Placeholder implementation
    setTimeout(() => {
        upcomingContainer.innerHTML = '<div class="text-muted">No upcoming sessions</div>';
        pastContainer.innerHTML = '<div class="text-muted">No past sessions</div>';
    }, 1000);
}

function loadStudentMessages() {
    const container = document.getElementById('student-conversations-list');
    container.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin"></i> Loading conversations...</div>';
    
    // Placeholder implementation
    setTimeout(() => {
        container.innerHTML = '<div class="text-muted p-3">No conversations yet</div>';
    }, 1000);
}

function loadStudentDocuments() {
    const container = document.getElementById('student-documents-table');
    container.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin"></i> Loading documents...</div>';
    
    // Placeholder implementation - this would integrate with the documents system
    setTimeout(() => {
        container.innerHTML = `
            <div class="text-center">
                <button class="btn btn-primary" onclick="window.location.href='documents.html'">
                    Manage Documents
                </button>
            </div>
        `;
    }, 1000);
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    
    const profileData = {
        firstName: document.getElementById('student-firstName').value,
        lastName: document.getElementById('student-lastName').value,
        bio: document.getElementById('student-bio').value,
        interests: document.getElementById('student-interests').value.split(',').map(s => s.trim()).filter(s => s),
        experienceLevel: document.getElementById('student-level').value
    };

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/auth/profile`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(profileData)
        });

        if (response.ok) {
            showNotification('Profile updated successfully', 'success');
            currentUser = { ...currentUser, ...profileData };
            updateUserDisplay();
        } else {
            showNotification('Failed to update profile', 'error');
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        showNotification('Error updating profile', 'error');
    }
}

async function viewMentorProfile(mentorId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/auth/profile/${mentorId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            const mentor = data.data;
            
            const modalHTML = `
                <div class="modal fade" id="mentorProfileModal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">
                                    <i class="fas fa-user-graduate me-2"></i>
                                    ${mentor.firstName} ${mentor.lastName}
                                </h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="row">
                                    <div class="col-md-4 text-center">
                                        <div class="profile-avatar mb-3">
                                            <i class="fas fa-user-circle fa-5x text-primary"></i>
                                        </div>
                                        <div class="mentor-rating mb-2">
                                            <div class="stars">
                                                ${Array.from({length: 5}, (_, i) => 
                                                    `<i class="fas fa-star ${i < Math.floor(mentor.rating || 4.5) ? 'text-warning' : 'text-muted'}"></i>`
                                                ).join('')}
                                            </div>
                                            <small class="text-muted">${mentor.rating || 4.5}/5 (${mentor.reviewCount || 12} reviews)</small>
                                        </div>
                                        <div class="mentor-price">
                                            <strong class="text-success fs-4">$${mentor.hourlyRate || 25}</strong>
                                            <span class="text-muted">/hour</span>
                                        </div>
                                    </div>
                                    <div class="col-md-8">
                                        <div class="mentor-info">
                                            <h6 class="mb-2">About</h6>
                                            <p class="text-muted mb-3">${mentor.bio || 'Experienced mentor ready to help students achieve their learning goals.'}</p>
                                            
                                            <h6 class="mb-2">Skills & Expertise</h6>
                                            <div class="skills-container mb-3">
                                                ${(mentor.skills || ['Programming', 'Tutoring', 'Mathematics']).map(skill => 
                                                    `<span class="badge bg-light text-primary border me-1 mb-1">${skill}</span>`
                                                ).join('')}
                                            </div>
                                            
                                            ${mentor.experience ? `
                                                <h6 class="mb-2">Experience</h6>
                                                <p class="text-muted mb-3">${mentor.experience} years of tutoring experience</p>
                                            ` : ''}
                                            
                                            ${mentor.education && mentor.education.length > 0 ? `
                                                <h6 class="mb-2">Education</h6>
                                                <div class="education-list">
                                                    ${mentor.education.map(edu => `
                                                        <div class="education-item mb-2">
                                                            <strong>${edu.degree || 'Degree'}</strong>
                                                            <br><small class="text-muted">${edu.institution || 'University'} ${edu.year ? `(${edu.year})` : ''}</small>
                                                        </div>
                                                    `).join('')}
                                                </div>
                                            ` : ''}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                                <button type="button" class="btn btn-primary" onclick="requestSession('${mentorId}', '${mentor.firstName} ${mentor.lastName}')">
                                    <i class="fas fa-calendar-plus me-1"></i>Book Session
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Remove existing modal
            const existingModal = document.getElementById('mentorProfileModal');
            if (existingModal) existingModal.remove();
            
            // Add modal to body
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            
            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('mentorProfileModal'));
            modal.show();
            
        } else {
            showNotification('Failed to load mentor profile', 'error');
        }
    } catch (error) {
        console.error('Error loading mentor profile:', error);
        showNotification('Error loading mentor profile', 'error');
    }
}

function requestSession(mentorId, mentorName) {
    // Create and show session request modal
    const modalHTML = `
        <div class="modal fade" id="sessionRequestModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Request Session with ${mentorName}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="session-request-form">
                            <input type="hidden" id="mentor-id" value="${mentorId}">
                            
                            <div class="mb-3">
                                <label for="session-subject" class="form-label">Subject *</label>
                                <input type="text" class="form-control" id="session-subject" required 
                                       placeholder="e.g., JavaScript Basics, Calculus Help">
                            </div>
                            
                            <div class="row mb-3">
                                <div class="col-md-6">
                                    <label for="preferred-date" class="form-label">Preferred Date *</label>
                                    <input type="date" class="form-control" id="preferred-date" required 
                                           min="${new Date().toISOString().split('T')[0]}">
                                </div>
                                <div class="col-md-6">
                                    <label for="preferred-time" class="form-label">Preferred Time *</label>
                                    <input type="time" class="form-control" id="preferred-time" required>
                                </div>
                            </div>
                            
                            <div class="mb-3">
                                <label for="session-duration" class="form-label">Duration (minutes)</label>
                                <select class="form-control" id="session-duration">
                                    <option value="30">30 minutes</option>
                                    <option value="60" selected>60 minutes</option>
                                    <option value="90">90 minutes</option>
                                    <option value="120">120 minutes</option>
                                </select>
                            </div>
                            
                            <div class="mb-3">
                                <label for="session-notes" class="form-label">Additional Notes</label>
                                <textarea class="form-control" id="session-notes" rows="3" 
                                          placeholder="Any specific topics or questions you'd like to cover..."></textarea>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" onclick="submitSessionRequest()">
                            <i class="fas fa-calendar-plus me-1"></i>Send Request
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal
    const existingModal = document.getElementById('sessionRequestModal');
    if (existingModal) existingModal.remove();
    
    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('sessionRequestModal'));
    modal.show();
}

async function submitSessionRequest() {
    const mentorId = document.getElementById('mentor-id').value;
    const preferredDate = document.getElementById('preferred-date').value;
    const preferredTime = document.getElementById('preferred-time').value;
    const duration = document.getElementById('session-duration').value;
    const subject = document.getElementById('session-subject').value;
    const notes = document.getElementById('session-notes').value;

    if (!preferredDate || !preferredTime || !subject) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        
        // Combine date and time into proper datetime
        const scheduledAt = new Date(`${preferredDate}T${preferredTime}`);
        
        const response = await fetch('/api/session-requests', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                mentorId,
                scheduledAt: scheduledAt.toISOString(),
                duration: parseInt(duration),
                subject,
                notes,
                status: 'pending'
            })
        });

        const result = await response.json();
        
        if (response.ok) {
            showNotification('Session request sent successfully!', 'success');
            const modal = bootstrap.Modal.getInstance(document.getElementById('sessionRequestModal'));
            modal.hide();
            document.getElementById('session-request-form').reset();
        } else {
            showNotification(result.message || 'Failed to send session request', 'error');
        }
    } catch (error) {
        console.error('Error submitting session request:', error);
        showNotification('Error sending session request', 'error');
    }
}

function joinSession(sessionId) {
    alert(`Joining session ${sessionId}...`);
}

function showUploadModal() {
    window.location.href = 'documents.html';
}

function formatDateTime(dateString) {
    return new Date(dateString).toLocaleString();
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString();
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show`;
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.insertBefore(notification, document.body.firstChild);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

async function loadNotifications() {
    const container = document.getElementById('session-notifications');
    const countBadge = document.getElementById('notification-count');
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/session-notifications/available-sessions`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            const sessions = data.data || [];
            
            countBadge.textContent = sessions.length;
            
            if (sessions.length === 0) {
                container.innerHTML = `
                    <div class="text-center text-muted py-4">
                        <i class="fas fa-bell fa-2x mb-2"></i>
                        <p>No new session notifications</p>
                    </div>
                `;
            } else {
                renderNotifications(sessions);
            }
        } else {
            container.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-exclamation-triangle fa-2x mb-2"></i>
                    <p>Error loading notifications</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
        container.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-exclamation-triangle fa-2x mb-2"></i>
                <p>Error loading notifications</p>
            </div>
        `;
    }
}

function renderNotifications(sessions) {
    const container = document.getElementById('session-notifications');
    
    const notificationsHTML = sessions.map(session => `
        <div class="notification-item border rounded p-3 mb-3 bg-light">
            <div class="d-flex justify-content-between align-items-start">
                <div class="flex-grow-1">
                    <div class="d-flex align-items-center mb-2">
                        <i class="fas fa-bell text-primary me-2"></i>
                        <strong class="text-primary">New Session Available!</strong>
                        <span class="badge bg-primary ms-2">New</span>
                    </div>
                    <h6 class="mb-2">${session.title}</h6>
                    <div class="text-muted small mb-2">
                        <div><i class="fas fa-user me-1"></i>Mentor: ${session.mentorId?.firstName || 'Unknown'} ${session.mentorId?.lastName || ''}</div>
                        <div><i class="fas fa-calendar me-1"></i>${new Date(session.scheduledAt).toLocaleDateString()}</div>
                        <div><i class="fas fa-clock me-1"></i>${new Date(session.scheduledAt).toLocaleTimeString()}</div>
                        <div><i class="fas fa-hourglass-half me-1"></i>${session.duration} minutes</div>
                    </div>
                    ${session.description ? `<p class="text-muted small mb-2">${session.description}</p>` : ''}
                </div>
                <div class="ms-3">
                    <div class="btn-group-vertical">
                        <button class="btn btn-primary btn-sm" onclick="joinSessionNotification('${session._id}', '${session.title}')">
                            <i class="fas fa-plus me-1"></i>Join Session
                        </button>
                        <button class="btn btn-outline-secondary btn-sm mt-1" onclick="dismissNotification('${session._id}')">
                            <i class="fas fa-times me-1"></i>Dismiss
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = notificationsHTML;
}

async function joinSessionNotification(sessionId, sessionTitle) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/session-notifications/join-session/${sessionId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        
        if (response.ok) {
            showNotification(`Successfully joined session: ${sessionTitle}`, 'success');
            loadNotifications(); // Refresh notifications
            loadUpcomingSessions(); // Refresh upcoming sessions
        } else {
            showNotification(data.message || 'Error joining session', 'error');
        }
    } catch (error) {
        console.error('Error joining session:', error);
        showNotification('Error joining session', 'error');
    }
}

function dismissNotification(sessionId) {
    // Remove the notification from display
    const notificationElement = document.querySelector(`[onclick*="${sessionId}"]`).closest('.notification-item');
    if (notificationElement) {
        notificationElement.remove();
        
        // Update count
        const countBadge = document.getElementById('notification-count');
        const currentCount = parseInt(countBadge.textContent) - 1;
        countBadge.textContent = Math.max(0, currentCount);
        
        // Check if no notifications left
        const container = document.getElementById('session-notifications');
        if (container.children.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-bell fa-2x mb-2"></i>
                    <p>No new session notifications</p>
                </div>
            `;
        }
    }
}

function markAllNotificationsAsRead() {
    const container = document.getElementById('session-notifications');
    const countBadge = document.getElementById('notification-count');
    
    container.innerHTML = `
        <div class="text-center text-muted py-4">
            <i class="fas fa-check-circle fa-2x mb-2 text-success"></i>
            <p>All notifications marked as read</p>
        </div>
    `;
    
    countBadge.textContent = '0';
    showNotification('All notifications marked as read', 'success');
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'landing.html';
}