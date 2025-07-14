// Mentor Dashboard JavaScript
const API_BASE_URL = window.location.origin + '/api';
let currentUser = null;

function getApiBaseUrl() {
    return API_BASE_URL;
}

document.addEventListener('DOMContentLoaded', function() {
    checkAuthentication();
    setupEventHandlers();
    loadMentorDashboard();
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
    const profileForm = document.getElementById('mentor-profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', handleProfileUpdate);
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
            
            if (currentUser.role !== 'mentor') {
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
        const mentorNameEl = document.getElementById('mentor-name');
        if (mentorNameEl) {
            mentorNameEl.textContent = `${currentUser.firstName} ${currentUser.lastName}`;
        }
        
        const greetingEl = document.getElementById('mentor-greeting');
        if (greetingEl) {
            greetingEl.textContent = `Welcome back, ${currentUser.firstName}!`;
        }
        
        updateProfileForm();
    }
}

function updateProfileForm() {
    if (!currentUser) return;
    
    const firstNameEl = document.getElementById('mentor-firstName');
    const lastNameEl = document.getElementById('mentor-lastName');
    const bioEl = document.getElementById('mentor-bio');
    const skillsEl = document.getElementById('mentor-skills');
    const rateEl = document.getElementById('mentor-rate');
    
    if (firstNameEl) firstNameEl.value = currentUser.firstName || '';
    if (lastNameEl) lastNameEl.value = currentUser.lastName || '';
    if (bioEl) bioEl.value = currentUser.bio || '';
    if (skillsEl) skillsEl.value = currentUser.skills ? currentUser.skills.join(', ') : '';
    if (rateEl) rateEl.value = currentUser.hourlyRate || '';
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
            loadMentorDashboard();
            break;
        case 'students':
            loadMyStudents();
            break;
        case 'sessions':
            loadMentorSessions();
            break;
        case 'documents':
            loadStudentDocuments();
            break;
        case 'messages':
            loadMentorMessages();
            loadAllUsersForMessaging();
            break;
        case 'availability':
            loadAvailability();
            break;
        case 'profile':
            updateProfileForm();
            break;
    }
}

async function loadMentorDashboard() {
    try {
        const token = localStorage.getItem('token');
        
        // Load mentor stats
        const response = await fetch(`${API_BASE_URL}/mentors/stats`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            updateMentorStats(data.data);
        }
        
        loadTodaysSchedule();
        loadStudentRequests();
    } catch (error) {
        console.error('Error loading mentor dashboard:', error);
    }
}

function updateMentorStats(stats) {
    document.getElementById('active-students').textContent = stats.activeStudents || 0;
    document.getElementById('completed-sessions').textContent = stats.completedSessions || 0;
    document.getElementById('upcoming-sessions').textContent = stats.upcomingSessions || 0;
    document.getElementById('mentor-rating').textContent = (stats.averageRating || 0).toFixed(1);
}

async function loadTodaysSchedule() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/sessions/today`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            renderTodaysSchedule(data.data || []);
        } else {
            const errorData = await response.json();
            showErrorModal('Load Schedule Error', errorData.message || 'Failed to load today\'s schedule');
            renderTodaysSchedule([]);
        }
    } catch (error) {
        console.error('Error loading today\'s schedule:', error);
        showErrorModal('Network Error', 'Unable to connect to server. Please check your connection.');
        renderTodaysSchedule([]);
    }
}

function renderTodaysSchedule(sessions) {
    const container = document.getElementById('todays-schedule');
    
    // Ensure sessions is an array
    if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted">
                <i class="fas fa-calendar fa-3x mb-3"></i>
                <p>No sessions scheduled for today</p>
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
                        <i class="fas fa-user me-1"></i>${session.student.firstName} ${session.student.lastName}
                    </p>
                    <p class="text-muted mb-0">
                        <i class="fas fa-clock me-1"></i>${formatTime(session.scheduledAt)}
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

async function loadStudentRequests() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/sessions/requests`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            renderStudentRequests(data.data.requests);
        }
    } catch (error) {
        console.error('Error loading student requests:', error);
    }
}

function renderStudentRequests(requests) {
    const container = document.getElementById('student-requests');
    
    if (requests.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted">
                <i class="fas fa-user-plus fa-2x mb-2"></i>
                <p>No new requests</p>
            </div>
        `;
        return;
    }

    const requestsHTML = requests.slice(0, 3).map(request => `
        <div class="request-item mb-2 p-2 border rounded">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <small class="fw-bold">${request.student.firstName}</small>
                    <small class="text-muted d-block">${formatDate(request.createdAt)}</small>
                </div>
                <div>
                    <button class="btn btn-success btn-sm" onclick="acceptRequest('${request._id}')">
                        <i class="fas fa-check"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = requestsHTML;
}

async function loadMyStudents() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/mentors/students`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            renderMyStudents(data.data.students);
        }
    } catch (error) {
        console.error('Error loading students:', error);
    }
}

function renderMyStudents(students) {
    const container = document.getElementById('students-list');
    
    if (students.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted">
                <i class="fas fa-user-graduate fa-3x mb-3"></i>
                <p>No students assigned yet</p>
            </div>
        `;
        return;
    }

    const studentsHTML = students.map(student => `
        <div class="card mb-3">
            <div class="card-body">
                <div class="row align-items-center">
                    <div class="col-md-6">
                        <h5>${student.firstName} ${student.lastName}</h5>
                        <p class="text-muted mb-0">${student.email}</p>
                    </div>
                    <div class="col-md-3">
                        <small class="text-muted">Sessions</small>
                        <div>${student.sessionCount || 0}</div>
                    </div>
                    <div class="col-md-3 text-end">
                        <button class="btn btn-outline-primary btn-sm me-2" onclick="messageStudent('${student._id}')">
                            <i class="fas fa-envelope"></i>
                        </button>
                        <button class="btn btn-primary btn-sm" onclick="scheduleSession('${student._id}')">
                            <i class="fas fa-calendar-plus"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = studentsHTML;
}

async function loadMentorSessions() {
    console.log('Loading mentor sessions...');
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/sessions`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('Sessions API response:', data);
            const sessions = Array.isArray(data.data) ? data.data : [];
            renderMentorSessions(sessions);
        } else {
            console.error('Failed to load sessions');
            renderEmptySessions();
        }
    } catch (error) {
        console.error('Error loading sessions:', error);
        renderEmptySessions();
    }
}

function renderMentorSessions(sessions) {
    const upcomingContainer = document.querySelector('#sessions-section .row .col-md-6:first-child .card-body');
    const pastContainer = document.querySelector('#sessions-section .row .col-md-6:last-child .card-body');
    
    if (!upcomingContainer || !pastContainer) return;
    
    // Ensure sessions is always an array
    const sessionsArray = Array.isArray(sessions) ? sessions : [];
    
    const now = new Date();
    const upcoming = sessionsArray.filter(session => new Date(session.scheduledAt) > now);
    const past = sessionsArray.filter(session => new Date(session.scheduledAt) <= now);
    
    // Render upcoming sessions
    if (upcoming.length === 0) {
        upcomingContainer.innerHTML = '<p class="text-muted">No upcoming sessions</p>';
    } else {
        upcomingContainer.innerHTML = upcoming.map(session => `
            <div class="session-item border-bottom pb-2 mb-2">
                <h6 class="mb-1">${session.title}</h6>
                <small class="text-muted">
                    ${formatDateTime(session.scheduledAt)} • ${session.duration} min
                </small>
                <div class="mt-1">
                    <span class="badge bg-${getStatusColor(session.status)}">${session.status}</span>
                    ${session.studentId ? `<small class="text-muted ms-2">with ${session.studentId.firstName} ${session.studentId.lastName}</small>` : '<small class="text-muted ms-2">Open session</small>'}
                </div>
                <div class="mt-2">
                    <button class="btn btn-sm btn-primary" onclick="window.open('${session.meetLink || session.meetingLink || session.googleMeetLink || '#'}', '_blank')">
                        <i class="fas fa-video me-1"></i>Join
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    // Render past sessions
    if (past.length === 0) {
        pastContainer.innerHTML = '<p class="text-muted">No past sessions</p>';
    } else {
        pastContainer.innerHTML = past.map(session => `
            <div class="session-item border-bottom pb-2 mb-2">
                <h6 class="mb-1">${session.title}</h6>
                <small class="text-muted">
                    ${formatDateTime(session.scheduledAt)} • ${session.duration} min
                </small>
                <div class="mt-1">
                    <span class="badge bg-${getStatusColor(session.status)}">${session.status}</span>
                    ${session.studentId ? `<small class="text-muted ms-2">with ${session.studentId.firstName} ${session.studentId.lastName}</small>` : '<small class="text-muted ms-2">Open session</small>'}
                </div>
            </div>
        `).join('');
    }
}

function renderEmptySessions() {
    const upcomingContainer = document.querySelector('#sessions-section .row .col-md-6:first-child .card-body');
    const pastContainer = document.querySelector('#sessions-section .row .col-md-6:last-child .card-body');
    
    if (upcomingContainer) upcomingContainer.innerHTML = '<p class="text-muted">No upcoming sessions</p>';
    if (pastContainer) pastContainer.innerHTML = '<p class="text-muted">No past sessions</p>';
}

function getStatusColor(status) {
    switch(status) {
        case 'scheduled': return 'primary';
        case 'active': return 'success';
        case 'completed': return 'secondary';
        case 'cancelled': return 'danger';
        default: return 'secondary';
    }
}

async function loadStudentDocuments() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/documents`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            renderStudentDocuments(data.documents || []);
        } else {
            document.getElementById('student-documents-list').innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-exclamation-triangle fa-3x text-warning mb-3"></i>
                    <p class="text-muted">Unable to load student documents</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading student documents:', error);
        document.getElementById('student-documents-list').innerHTML = `
            <div class="text-center py-4">
                <i class="fas fa-exclamation-triangle fa-3x text-danger mb-3"></i>
                <p class="text-muted">Error loading documents</p>
            </div>
        `;
    }
}

function renderStudentDocuments(documents) {
    const container = document.getElementById('student-documents-list');
    
    if (documents.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4">
                <i class="fas fa-file-alt fa-3x text-muted mb-3"></i>
                <p class="text-muted">No student documents found</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="table-responsive">
            <table class="table table-hover">
                <thead>
                    <tr>
                        <th>Student</th>
                        <th>Document Type</th>
                        <th>Upload Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${documents.map(doc => `
                        <tr>
                            <td>
                                <div class="d-flex align-items-center">
                                    <i class="fas fa-user-circle me-2"></i>
                                    <span>${doc.userId?.firstName || 'Unknown'} ${doc.userId?.lastName || 'User'}</span>
                                </div>
                            </td>
                            <td>
                                <span class="badge bg-info">${doc.documentType || 'Document'}</span>
                            </td>
                            <td>${formatDate(doc.uploadDate)}</td>
                            <td>
                                <span class="badge ${doc.status === 'approved' ? 'bg-success' : doc.status === 'rejected' ? 'bg-danger' : 'bg-warning'}">
                                    ${doc.status}
                                </span>
                            </td>
                            <td>
                                <button class="btn btn-sm btn-outline-primary" onclick="downloadDocument('${doc._id}')">
                                    <i class="fas fa-download"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function loadAllUsersForMessaging() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/users/all`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            renderUsersList(data.users || []);
        } else {
            document.getElementById('users-list').innerHTML = `
                <div class="text-center py-3">
                    <i class="fas fa-exclamation-triangle text-warning"></i>
                    <p class="text-muted mb-0">Unable to load users</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading users:', error);
        document.getElementById('users-list').innerHTML = `
            <div class="text-center py-3">
                <i class="fas fa-exclamation-triangle text-danger"></i>
                <p class="text-muted mb-0">Error loading users</p>
            </div>
        `;
    }
}

function renderUsersList(users) {
    const container = document.getElementById('users-list');
    
    if (users.length === 0) {
        container.innerHTML = `
            <div class="text-center py-3">
                <i class="fas fa-users fa-2x text-muted mb-2"></i>
                <p class="text-muted mb-0">No users found</p>
            </div>
        `;
        return;
    }

    const filteredUsers = users.filter(user => user._id !== currentUser._id);
    
    container.innerHTML = filteredUsers.map(user => `
        <a href="#" class="list-group-item list-group-item-action" onclick="selectUserForMessaging('${user._id}', '${user.firstName} ${user.lastName}')">
            <div class="d-flex align-items-center">
                <div class="avatar me-2">
                    <i class="fas fa-user-circle fa-2x text-secondary"></i>
                </div>
                <div>
                    <div class="fw-bold">${user.firstName} ${user.lastName}</div>
                    <small class="text-muted">${user.role}</small>
                </div>
            </div>
        </a>
    `).join('');
}

let selectedUserId = null;
let selectedUserName = null;

function selectUserForMessaging(userId, userName) {
    selectedUserId = userId;
    selectedUserName = userName;
    
    // Update UI
    document.querySelector('#messages-section .card-header h5').textContent = `Conversation with ${userName}`;
    document.getElementById('message-input').disabled = false;
    document.getElementById('send-message-btn').disabled = false;
    
    // Load messages with this user
    loadMessagesWithUser(userId);
}

async function loadMessagesWithUser(userId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/messages/conversation/${userId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            renderMessages(data.messages || []);
        } else {
            document.getElementById('messages-container').innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-comments fa-3x text-muted mb-3"></i>
                    <p class="text-muted">No messages yet. Start the conversation!</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading messages:', error);
        document.getElementById('messages-container').innerHTML = `
            <div class="text-center py-4">
                <i class="fas fa-exclamation-triangle fa-3x text-danger mb-3"></i>
                <p class="text-muted">Error loading messages</p>
            </div>
        `;
    }
}

function renderMessages(messages) {
    const container = document.getElementById('messages-container');
    
    if (messages.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4">
                <i class="fas fa-comments fa-3x text-muted mb-3"></i>
                <p class="text-muted">No messages yet. Start the conversation!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = messages.map(message => `
        <div class="message ${message.sender === currentUser._id ? 'sent' : 'received'} mb-3">
            <div class="message-content p-3 rounded ${message.sender === currentUser._id ? 'bg-primary text-white ms-auto' : 'bg-light'}" style="max-width: 80%;">
                <p class="mb-1">${message.content}</p>
                <small class="opacity-75">${formatDateTime(message.sentAt)}</small>
            </div>
        </div>
    `).join('');
    
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
    if (!selectedUserId || !selectedUserName) {
        showNotification('Please select a user to message', 'warning');
        return;
    }

    const messageInput = document.getElementById('message-input');
    const content = messageInput.value.trim();
    
    if (!content) {
        showNotification('Please enter a message', 'warning');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/messages/send`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                receiverId: selectedUserId,
                content: content
            })
        });

        if (response.ok) {
            messageInput.value = '';
            loadMessagesWithUser(selectedUserId);
            showNotification('Message sent successfully', 'success');
        } else {
            showNotification('Failed to send message', 'error');
        }
    } catch (error) {
        console.error('Error sending message:', error);
        showNotification('Error sending message', 'error');
    }
}

function showNewMessageModal() {
    // Initialize messaging system if not available
    if (typeof openMessagingModal === 'function') {
        openMessagingModal();
    } else if (window.messagingSystem && typeof window.messagingSystem.openModal === 'function') {
        window.messagingSystem.openModal();
    } else if (typeof MessagingSystem !== 'undefined') {
        // Create new instance if class is available
        if (!window.messagingSystem) {
            window.messagingSystem = new MessagingSystem();
            window.messagingSystem.init().then(() => {
                window.messagingSystem.openModal();
            }).catch(error => {
                console.error('Error initializing messaging:', error);
                showNotification('Failed to open messaging', 'error');
            });
        } else {
            window.messagingSystem.openModal();
        }
    } else {
        // Final fallback
        showNotification('Messaging system not available', 'error');
        console.log('MessagingSystem class not found');
    }
}

function loadMentorMessages() {
    loadAllUsersForMessaging();
}

async function loadAvailability() {
    const container = document.getElementById('availability-calendar');
    console.log('Loading availability calendar...');
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/availability`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            renderAvailabilityCalendar(data.data);
        } else {
            console.error('Failed to load availability');
            renderDefaultAvailabilityCalendar();
        }
    } catch (error) {
        console.error('Error loading availability:', error);
        renderDefaultAvailabilityCalendar();
    }
}

function renderAvailabilityCalendar(availability) {
    const container = document.getElementById('availability-calendar');
    if (!container) return;
    
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    container.innerHTML = `
        <div class="availability-grid">
            ${days.map((day, index) => `
                <div class="day-column">
                    <h6 class="day-header">${dayNames[index]}</h6>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="${day}-available" 
                               ${availability[day]?.available ? 'checked' : ''} 
                               onchange="toggleDayAvailability('${day}')">
                        <label class="form-check-label" for="${day}-available">
                            Available
                        </label>
                    </div>
                    <div class="time-slots" id="${day}-slots" style="display: ${availability[day]?.available ? 'block' : 'none'}">
                        <div class="mb-2">
                            <label class="form-label">Start Time:</label>
                            <input type="time" class="form-control form-control-sm" id="${day}-start" 
                                   value="${availability[day]?.startTime || '09:00'}">
                        </div>
                        <div class="mb-2">
                            <label class="form-label">End Time:</label>
                            <input type="time" class="form-control form-control-sm" id="${day}-end" 
                                   value="${availability[day]?.endTime || '17:00'}">
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        <div class="mt-3">
            <button type="button" class="btn btn-primary" onclick="saveAvailability()">
                <i class="fas fa-save me-2"></i>Save Availability
            </button>
        </div>
    `;
}

function renderDefaultAvailabilityCalendar() {
    const defaultAvailability = {
        monday: { available: false, startTime: '09:00', endTime: '17:00' },
        tuesday: { available: false, startTime: '09:00', endTime: '17:00' },
        wednesday: { available: false, startTime: '09:00', endTime: '17:00' },
        thursday: { available: false, startTime: '09:00', endTime: '17:00' },
        friday: { available: false, startTime: '09:00', endTime: '17:00' },
        saturday: { available: false, startTime: '09:00', endTime: '17:00' },
        sunday: { available: false, startTime: '09:00', endTime: '17:00' }
    };
    renderAvailabilityCalendar(defaultAvailability);
}

function toggleDayAvailability(day) {
    const checkbox = document.getElementById(`${day}-available`);
    const slotsContainer = document.getElementById(`${day}-slots`);
    
    if (checkbox.checked) {
        slotsContainer.style.display = 'block';
    } else {
        slotsContainer.style.display = 'none';
    }
}

async function saveAvailability() {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const availability = {};
    
    days.forEach(day => {
        const available = document.getElementById(`${day}-available`).checked;
        const startTime = document.getElementById(`${day}-start`).value;
        const endTime = document.getElementById(`${day}-end`).value;
        
        availability[day] = {
            available: available,
            startTime: available ? startTime : null,
            endTime: available ? endTime : null
        };
    });
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/availability`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ availability })
        });
        
        if (response.ok) {
            showNotification('Availability updated successfully', 'success');
        } else {
            showNotification('Failed to update availability', 'error');
        }
    } catch (error) {
        console.error('Error saving availability:', error);
        showNotification('Error saving availability', 'error');
    }
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const profileData = {
        firstName: document.getElementById('mentor-firstName').value,
        lastName: document.getElementById('mentor-lastName').value,
        bio: document.getElementById('mentor-bio').value,
        skills: document.getElementById('mentor-skills').value.split(',').map(s => s.trim()).filter(s => s),
        hourlyRate: parseFloat(document.getElementById('mentor-rate').value) || 0
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
            // Update current user data
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

function showCreateSessionModal() {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'createSessionModal';
    modal.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">
                        <i class="fas fa-calendar-plus me-2"></i>Create New Session
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <form id="createSessionForm">
                        <div class="row g-3">
                            <div class="col-12">
                                <label for="sessionTitle" class="form-label">Session Title *</label>
                                <input type="text" class="form-control" id="sessionTitle" required 
                                       placeholder="e.g., JavaScript Fundamentals Workshop">
                            </div>
                            
                            <div class="col-12">
                                <label for="sessionDescription" class="form-label">Description</label>
                                <textarea class="form-control" id="sessionDescription" rows="3" 
                                          placeholder="Brief description of what will be covered in this session..."></textarea>
                            </div>
                            
                            <div class="col-md-6">
                                <label for="sessionDate" class="form-label">Date *</label>
                                <input type="date" class="form-control" id="sessionDate" required>
                            </div>
                            
                            <div class="col-md-6">
                                <label for="sessionTime" class="form-label">Time *</label>
                                <input type="time" class="form-control" id="sessionTime" required>
                            </div>
                            
                            <div class="col-md-6">
                                <label for="sessionDuration" class="form-label">Duration (minutes) *</label>
                                <select class="form-select" id="sessionDuration" required>
                                    <option value="">Select duration</option>
                                    <option value="30">30 minutes</option>
                                    <option value="45">45 minutes</option>
                                    <option value="60">60 minutes</option>
                                    <option value="90">90 minutes</option>
                                    <option value="120">120 minutes</option>
                                </select>
                            </div>
                            
                            <div class="col-md-6">
                                <label for="sessionSubject" class="form-label">Subject</label>
                                <select class="form-select" id="sessionSubject">
                                    <option value="General">General</option>
                                    <option value="Programming">Programming</option>
                                    <option value="Mathematics">Mathematics</option>
                                    <option value="Science">Science</option>
                                    <option value="Languages">Languages</option>
                                    <option value="Business">Business</option>
                                    <option value="Design">Design</option>
                                </select>
                            </div>
                            
                            <div class="col-12">
                                <label for="googleMeetLink" class="form-label">Google Meet Link *</label>
                                <div class="input-group">
                                    <input type="url" class="form-control" id="googleMeetLink" required 
                                           placeholder="https://meet.google.com/xxx-xxxx-xxx">
                                    <button type="button" class="btn btn-outline-primary" onclick="generateMeetLink()">
                                        <i class="fas fa-video me-1"></i>Generate
                                    </button>
                                </div>
                                <div class="form-text">
                                    <i class="fas fa-info-circle me-1"></i>
                                    This link will be shared with all students who receive the notification
                                </div>
                            </div>
                            
                            <div class="col-12">
                                <div class="form-check form-switch">
                                    <input class="form-check-input" type="checkbox" id="isGroupSession">
                                    <label class="form-check-label" for="isGroupSession">
                                        Group Session (multiple students can join)
                                    </label>
                                </div>
                            </div>
                            
                            <div class="col-md-6" id="maxParticipantsGroup" style="display: none;">
                                <label for="maxParticipants" class="form-label">Maximum Participants</label>
                                <input type="number" class="form-control" id="maxParticipants" min="2" max="20" value="5">
                            </div>
                        </div>
                        
                        <div class="alert alert-info mt-3">
                            <i class="fas fa-bell me-2"></i>
                            <strong>Automatic Notifications:</strong> All your previous students will receive a notification about this new session with the meeting details.
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary" onclick="createSession()">
                        <i class="fas fa-calendar-plus me-2"></i>Create Session & Notify Students
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('sessionDate').min = today;
    document.getElementById('sessionDate').value = today;
    
    // Toggle max participants field
    document.getElementById('isGroupSession').addEventListener('change', function() {
        const maxParticipantsGroup = document.getElementById('maxParticipantsGroup');
        maxParticipantsGroup.style.display = this.checked ? 'block' : 'none';
    });
    
    // Show modal
    new bootstrap.Modal(modal).show();
    
    // Remove modal from DOM when hidden
    modal.addEventListener('hidden.bs.modal', () => {
        modal.remove();
    });
}

function generateMeetLink() {
    // Generate a Google Meet-style link format
    const characters = 'abcdefghijklmnopqrstuvwxyz';
    const generateCode = () => {
        let result = '';
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 4; j++) {
                result += characters.charAt(Math.floor(Math.random() * characters.length));
            }
            if (i < 2) result += '-';
        }
        return result;
    };
    
    const meetLink = `https://meet.google.com/${generateCode()}`;
    document.getElementById('googleMeetLink').value = meetLink;
    
    showNotification('Google Meet link generated! You can create an actual meeting at meet.google.com', 'info');
}

async function createSession() {
    try {
        const form = document.getElementById('createSessionForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        
        const sessionData = {
            title: document.getElementById('sessionTitle').value,
            description: document.getElementById('sessionDescription').value,
            date: document.getElementById('sessionDate').value,
            time: document.getElementById('sessionTime').value,
            duration: document.getElementById('sessionDuration').value,
            subject: document.getElementById('sessionSubject').value,
            googleMeetLink: document.getElementById('googleMeetLink').value,
            isGroupSession: document.getElementById('isGroupSession').checked,
            maxParticipants: document.getElementById('maxParticipants').value || 1,
            sessionType: document.getElementById('isGroupSession').checked ? 'group' : 'individual'
        };
        
        const button = document.querySelector('#createSessionModal .btn-primary');
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Creating...';
        button.disabled = true;
        
        const token = localStorage.getItem('token');
        const response = await fetch(`${getApiBaseUrl()}/session-notifications/create-session`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(sessionData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification(`Session created successfully! ${data.data.notificationsSent} students notified.`, 'success');
            
            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('createSessionModal')).hide();
            
            // Refresh data
            loadMentorDashboard();
            
        } else {
            showNotification(data.message || 'Error creating session', 'error');
        }
        
    } catch (error) {
        console.error('Error creating session:', error);
        showNotification('Error creating session. Please try again.', 'error');
    } finally {
        const button = document.querySelector('#createSessionModal .btn-primary');
        if (button) {
            button.innerHTML = '<i class="fas fa-calendar-plus me-2"></i>Create Session & Notify Students';
            button.disabled = false;
        }
    }
}

function joinSession(sessionId) {
    alert(`Joining session ${sessionId}...`);
}

function acceptRequest(requestId) {
    alert(`Accepting request ${requestId}...`);
}

function messageStudent(studentId) {
    alert(`Opening message for student ${studentId}...`);
}

function scheduleSession(studentId) {
    alert(`Scheduling session with student ${studentId}...`);
}

function formatTime(dateString) {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

// Error Modal Functions
function showErrorModal(title, message) {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header bg-danger text-white">
                    <h5 class="modal-title">${title}</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="d-flex align-items-center">
                        <i class="fas fa-exclamation-triangle text-danger me-3 fa-2x"></i>
                        <div>
                            <p class="mb-0">${message}</p>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    
    modal.addEventListener('hidden.bs.modal', () => {
        modal.remove();
    });
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'landing.html';
}