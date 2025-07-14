// Admin Dashboard JavaScript
const API_BASE_URL = window.location.origin + '/api';
let currentUser = null;

document.addEventListener('DOMContentLoaded', function() {
    // Simplified authentication flow
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (!token || user.role !== 'admin') {
        window.location.href = 'landing.html';
        return;
    }
    
    currentUser = user;
    setupEventHandlers();
    updateUserDisplay();
    loadAdminDashboard();
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

    // User role filter
    const roleFilter = document.getElementById('user-role-filter');
    if (roleFilter) {
        roleFilter.addEventListener('change', filterUsers);
    }
}

// Removed checkAuthentication function - handled in DOMContentLoaded

function updateUserDisplay() {
    if (currentUser) {
        const adminNameEl = document.getElementById('admin-name');
        if (adminNameEl) {
            adminNameEl.textContent = `${currentUser.firstName} ${currentUser.lastName}`;
        }
    }
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
            loadAdminDashboard();
            break;
        case 'users':
            loadAllUsers();
            break;
        case 'pending':
            loadPendingUsers();
            break;
        case 'analytics':
            loadAnalytics();
            break;
    }
}

async function loadAdminDashboard() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/admin/dashboard`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            updateDashboardStats(data.data);
        }
    } catch (error) {
        console.error('Error loading admin dashboard:', error);
    }
}

function updateDashboardStats(stats) {
    document.getElementById('total-users').textContent = stats.totalUsers || 0;
    document.getElementById('pending-users').textContent = stats.pendingUsers || 0;
    document.getElementById('total-mentors').textContent = stats.totalMentors || 0;
    document.getElementById('total-students').textContent = stats.totalStudents || 0;
}

async function loadAllUsers() {
    try {
        const token = localStorage.getItem('token');
        const roleFilter = document.getElementById('user-role-filter').value;
        const queryParam = roleFilter ? `?role=${roleFilter}` : '';
        
        const response = await fetch(`${API_BASE_URL}/admin/users${queryParam}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            renderUsersTable(data.data.users);
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function renderUsersTable(users) {
    const container = document.getElementById('users-table-container');
    
    const tableHTML = `
        <div class="table-responsive">
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Registered</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(user => `
                        <tr>
                            <td>${user.firstName} ${user.lastName}</td>
                            <td>${user.email}</td>
                            <td><span class="badge bg-${getRoleBadgeColor(user.role)}">${user.role}</span></td>
                            <td><span class="badge bg-${user.isApproved ? 'success' : 'warning'}">${user.isApproved ? 'Approved' : 'Pending'}</span></td>
                            <td>${formatDate(user.createdAt)}</td>
                            <td>
                                <div class="btn-group btn-group-sm">
                                    ${!user.isApproved ? `
                                        <button class="btn btn-success" onclick="approveUser('${user._id}')">
                                            <i class="fas fa-check"></i>
                                        </button>
                                        <button class="btn btn-danger" onclick="rejectUser('${user._id}')">
                                            <i class="fas fa-times"></i>
                                        </button>
                                    ` : ''}
                                    <button class="btn btn-outline-primary" onclick="viewUserDetails('${user._id}')">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = tableHTML;
}

async function loadPendingUsers() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/admin/users/pending`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            renderPendingUsers(data.data.users);
        }
    } catch (error) {
        console.error('Error loading pending users:', error);
    }
}

function renderPendingUsers(users) {
    const container = document.getElementById('pending-users-container');
    
    if (users.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted">
                <i class="fas fa-check-circle fa-3x mb-3"></i>
                <p>No pending approvals</p>
            </div>
        `;
        return;
    }

    const cardsHTML = users.map(user => `
        <div class="card mb-3">
            <div class="card-body">
                <div class="row align-items-start">
                    <div class="col-md-4">
                        <h5>${user.firstName} ${user.lastName}</h5>
                        <p class="text-muted mb-1">${user.email}</p>
                        <span class="badge bg-${getRoleBadgeColor(user.role)}">${user.role}</span>
                        <div class="mt-2">
                            <small class="text-muted">Registered: ${formatDate(user.createdAt)}</small>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="document-section">
                            <h6 class="mb-2">Document Verification</h6>
                            <div class="row g-2">
                                <div class="col-6">
                                    <button class="btn btn-outline-primary btn-sm w-100" onclick="downloadDocument('${user._id}', 'resume')">
                                        <i class="fas fa-eye me-1"></i>View Resume
                                    </button>
                                </div>
                                <div class="col-6">
                                    <button class="btn btn-outline-secondary btn-sm w-100" onclick="downloadDocument('${user._id}', 'offer')">
                                        <i class="fas fa-eye me-1"></i>View Offer
                                    </button>
                                </div>
                            </div>
                            <div class="row g-2 mt-1">
                                <div class="col-6">
                                    <button class="btn btn-success btn-sm w-100" onclick="approveDocument('${user._id}', 'resume')">
                                        <i class="fas fa-check me-1"></i>✓ Resume
                                    </button>
                                </div>
                                <div class="col-6">
                                    <button class="btn btn-success btn-sm w-100" onclick="approveDocument('${user._id}', 'offer')">
                                        <i class="fas fa-check me-1"></i>✓ Offer
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4 text-end">
                        <div class="d-flex flex-column gap-2">
                            <button class="btn btn-warning" onclick="approveUser('${user._id}')">
                                <i class="fas fa-user-check me-1"></i>Approve User
                            </button>
                            <button class="btn btn-danger" onclick="rejectUser('${user._id}')">
                                <i class="fas fa-times me-1"></i>Reject User
                            </button>
                            <button class="btn btn-outline-danger" onclick="deleteUser('${user._id}')">
                                <i class="fas fa-trash me-1"></i>Delete User
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = cardsHTML;
}

async function approveUser(userId) {
    if (!confirm('Are you sure you want to approve this user?')) return;
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/approve`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'approve',
                reason: 'Account approved by admin'
            })
        });

        if (response.ok) {
            showNotification('User approved successfully', 'success');
            loadPendingUsers();
            loadAdminDashboard();
        } else {
            showNotification('Failed to approve user', 'error');
        }
    } catch (error) {
        console.error('Error approving user:', error);
        showNotification('Error approving user', 'error');
    }
}

async function rejectUser(userId) {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/approve`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'reject',
                reason: reason
            })
        });

        if (response.ok) {
            showNotification('User rejected', 'success');
            loadPendingUsers();
            loadAdminDashboard();
        } else {
            showNotification('Failed to reject user', 'error');
        }
    } catch (error) {
        console.error('Error rejecting user:', error);
        showNotification('Error rejecting user', 'error');
    }
}

function loadAnalytics() {
    const container = document.getElementById('analytics-section');
    // Placeholder for analytics implementation
    console.log('Loading analytics...');
}

function refreshUserList() {
    loadAllUsers();
}

function filterUsers() {
    loadAllUsers();
}

function getRoleBadgeColor(role) {
    switch (role) {
        case 'admin': return 'danger';
        case 'mentor': return 'primary';
        case 'student': return 'success';
        default: return 'secondary';
    }
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString();
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show`;
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    // Add to page
    document.body.insertBefore(notification, document.body.firstChild);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

async function downloadDocument(userId, documentType) {
    try {
        const token = localStorage.getItem('token');
        
        // Use the new view endpoint to open document in new tab
        const viewUrl = `${API_BASE_URL}/documents/view/${userId}/${documentType}`;
        
        // Open document in new tab with auth headers
        const newTab = window.open('about:blank', '_blank');
        
        fetch(viewUrl, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        }).then(response => {
            if (response.ok) {
                return response.blob();
            } else {
                throw new Error('Document not found');
            }
        }).then(blob => {
            const url = window.URL.createObjectURL(blob);
            newTab.location = url;
            showNotification(`${documentType} document opened for review`, 'success');
        }).catch(error => {
            newTab.close();
            showNotification(`No ${documentType} document found for this user`, 'warning');
        });
        
    } catch (error) {
        console.error('Error viewing document:', error);
        showNotification('Error viewing document. Please try again.', 'error');
    }
}

async function approveDocument(userId, documentType) {
    if (!confirm(`Are you sure you want to approve the ${documentType} document for this user?`)) return;
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/admin/documents/approve`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: userId,
                documentType: documentType,
                status: 'approved'
            })
        });

        if (response.ok) {
            showNotification(`${documentType} document approved successfully`, 'success');
            loadPendingUsers(); // Refresh the list
        } else {
            showNotification(`Failed to approve ${documentType} document`, 'error');
        }
    } catch (error) {
        console.error('Error approving document:', error);
        showNotification('Error approving document', 'error');
    }
}

async function viewUserDetails(userId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/auth/profile/${userId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            const user = data.data;
            
            const modalHTML = `
                <div class="modal fade" id="userDetailsModal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">
                                    <i class="fas fa-user me-2"></i>
                                    ${user.firstName} ${user.lastName} - User Details
                                </h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="row">
                                    <div class="col-md-6">
                                        <h6 class="mb-3">Basic Information</h6>
                                        <div class="user-info">
                                            <p><strong>Name:</strong> ${user.firstName} ${user.lastName}</p>
                                            <p><strong>Email:</strong> ${user.email}</p>
                                            <p><strong>Username:</strong> ${user.username}</p>
                                            <p><strong>Role:</strong> <span class="badge bg-${getRoleBadgeColor(user.role)}">${user.role}</span></p>
                                            <p><strong>Status:</strong> 
                                                <span class="badge ${user.isApproved ? 'bg-success' : 'bg-warning'}">
                                                    ${user.isApproved ? 'Approved' : 'Pending Approval'}
                                                </span>
                                            </p>
                                            <p><strong>Registered:</strong> ${formatDate(user.createdAt)}</p>
                                            <p><strong>Last Active:</strong> ${user.lastActive ? formatDate(user.lastActive) : 'Never'}</p>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <h6 class="mb-3">Profile Information</h6>
                                        <div class="profile-info">
                                            ${user.bio ? `<p><strong>Bio:</strong> ${user.bio}</p>` : ''}
                                            ${user.phone ? `<p><strong>Phone:</strong> ${user.phone}</p>` : ''}
                                            ${user.location ? `<p><strong>Location:</strong> ${user.location}</p>` : ''}
                                            ${user.hourlyRate ? `<p><strong>Hourly Rate:</strong> $${user.hourlyRate}</p>` : ''}
                                            ${user.skills && user.skills.length > 0 ? `
                                                <p><strong>Skills:</strong></p>
                                                <div class="skills-container">
                                                    ${user.skills.map(skill => `<span class="badge bg-light text-primary border me-1 mb-1">${skill}</span>`).join('')}
                                                </div>
                                            ` : ''}
                                        </div>
                                        
                                        <h6 class="mb-3 mt-4">Documents</h6>
                                        <div class="documents-info">
                                            ${user.role === 'admin' ? `
                                                <div class="admin-documents-notice">
                                                    <p><strong>Admin Account:</strong> 
                                                        <span class="badge bg-success">Auto-Verified</span>
                                                    </p>
                                                    <small class="text-muted">
                                                        <i class="fas fa-info-circle me-1"></i>
                                                        Administrator accounts do not require document verification
                                                    </small>
                                                </div>
                                            ` : user.documents ? `
                                                ${user.documents.resumeDocument ? `
                                                    <p><strong>Resume:</strong> 
                                                        <span class="badge ${user.documents.resumeDocument.verified ? 'bg-success' : 'bg-warning'}">
                                                            ${user.documents.resumeDocument.verified ? 'Verified' : 'Pending'}
                                                        </span>
                                                        <button class="btn btn-sm btn-outline-primary ms-2" onclick="downloadDocument('${userId}', 'resume')">
                                                            <i class="fas fa-download"></i> View
                                                        </button>
                                                    </p>
                                                ` : ''}
                                                ${user.documents.offerDocument ? `
                                                    <p><strong>Offer Letter:</strong> 
                                                        <span class="badge ${user.documents.offerDocument.verified ? 'bg-success' : 'bg-warning'}">
                                                            ${user.documents.offerDocument.verified ? 'Verified' : 'Pending'}
                                                        </span>
                                                        <button class="btn btn-sm btn-outline-primary ms-2" onclick="downloadDocument('${userId}', 'offer')">
                                                            <i class="fas fa-download"></i> View
                                                        </button>
                                                    </p>
                                                ` : ''}
                                            ` : `
                                                <p class="text-muted">
                                                    <i class="fas fa-info-circle me-1"></i>
                                                    No documents uploaded
                                                </p>
                                            `}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                                ${user.role !== 'admin' && !user.isApproved ? `
                                    <button type="button" class="btn btn-success" onclick="approveUser('${userId}')">
                                        <i class="fas fa-check me-1"></i>Approve User
                                    </button>
                                    <button type="button" class="btn btn-danger" onclick="rejectUser('${userId}')">
                                        <i class="fas fa-times me-1"></i>Reject User
                                    </button>
                                ` : ''}
                                ${user.role !== 'admin' ? `
                                    <button type="button" class="btn btn-outline-danger" onclick="deleteUser('${userId}')">
                                        <i class="fas fa-trash me-1"></i>Delete User
                                    </button>
                                ` : `
                                    <button type="button" class="btn btn-outline-warning" disabled>
                                        <i class="fas fa-shield-alt me-1"></i>Protected Admin Account
                                    </button>
                                `}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Remove existing modal
            const existingModal = document.getElementById('userDetailsModal');
            if (existingModal) existingModal.remove();
            
            // Add modal to body
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            
            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('userDetailsModal'));
            modal.show();
            
        } else {
            showNotification('Failed to load user details', 'error');
        }
    } catch (error) {
        console.error('Error loading user details:', error);
        showNotification('Error loading user details', 'error');
    }
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to permanently delete this user? This action cannot be undone.')) {
        return;
    }
    
    const reason = prompt('Please provide a reason for deletion (required):');
    if (!reason || reason.trim().length < 10) {
        showNotification('Deletion reason must be at least 10 characters long', 'error');
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason: reason.trim() })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('User deleted successfully', 'success');
            refreshUserList();
        } else {
            showNotification(data.message || 'Failed to delete user', 'error');
        }
    } catch (error) {
        console.error('Delete user error:', error);
        showNotification('Error deleting user', 'error');
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'landing.html';
}