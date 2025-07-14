// Mentors Search Page JavaScript
const API_BASE_URL = window.location.origin + '/api';
let currentUser = null;
let currentMentors = [];
let currentPage = 1;
let totalPages = 1;
let currentView = 'grid';

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    checkAuthentication();
    initializeEventListeners();
    loadMentors();
});

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
            currentUser = data.data;
            updateUserDisplay();
        } else {
            localStorage.removeItem('authToken');
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = 'login.html';
    }
}

function updateUserDisplay() {
    const userNameElements = document.querySelectorAll('#user-name');
    userNameElements.forEach(element => {
        element.textContent = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'User';
    });
}

function initializeEventListeners() {
    // Search form
    const searchForm = document.getElementById('search-filters');
    searchForm.addEventListener('submit', handleSearch);

    // Real-time search
    const searchQuery = document.getElementById('search-query');
    let searchTimeout;
    searchQuery.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            loadMentors();
        }, 500);
    });

    // Filter changes
    const filterInputs = document.querySelectorAll('#search-filters input, #search-filters select');
    filterInputs.forEach(input => {
        input.addEventListener('change', () => {
            currentPage = 1;
            loadMentors();
        });
    });
}

function handleSearch(e) {
    e.preventDefault();
    currentPage = 1;
    loadMentors();
}

async function loadMentors() {
    const loadingState = document.getElementById('loading-state');
    const mentorsContainer = document.getElementById('mentors-container');
    
    loadingState.classList.remove('d-none');
    mentorsContainer.classList.add('d-none');

    try {
        const filters = getSearchFilters();
        const queryParams = new URLSearchParams({
            page: currentPage,
            limit: 12,
            ...filters
        });

        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/search/mentors?${queryParams}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            currentMentors = data.data.mentors || [];
            totalPages = data.data.pagination.pages || 1;
            
            renderMentors(currentMentors);
            renderPagination();
            updateResultsCount(data.data.pagination.total || 0);
        } else {
            throw new Error('Failed to load mentors');
        }
    } catch (error) {
        console.error('Load mentors error:', error);
        renderError();
    } finally {
        loadingState.classList.add('d-none');
        mentorsContainer.classList.remove('d-none');
    }
}

function getSearchFilters() {
    const filters = {};
    
    const query = document.getElementById('search-query').value.trim();
    if (query) filters.q = query;
    
    const skills = Array.from(document.querySelectorAll('#skill-filters input:checked')).map(cb => cb.value);
    if (skills.length > 0) filters.skills = skills.join(',');
    
    const minPrice = document.getElementById('min-price').value;
    if (minPrice) filters.minPrice = minPrice;
    
    const maxPrice = document.getElementById('max-price').value;
    if (maxPrice) filters.maxPrice = maxPrice;
    
    const minRating = document.getElementById('min-rating').value;
    if (minRating) filters.minRating = minRating;
    
    const location = document.getElementById('location').value.trim();
    if (location) filters.location = location;
    
    return filters;
}

function renderMentors(mentors) {
    const container = document.getElementById('mentors-container');
    
    if (mentors.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-search fa-3x text-muted mb-3"></i>
                <h5>No mentors found</h5>
                <p class="text-muted">Try adjusting your search filters</p>
                <button class="btn btn-primary" onclick="clearFilters()">Clear Filters</button>
            </div>
        `;
        return;
    }

    if (currentView === 'grid') {
        renderGridView(mentors);
    } else {
        renderListView(mentors);
    }
}

function renderGridView(mentors) {
    const container = document.getElementById('mentors-container');
    container.innerHTML = `
        <div class="row g-4">
            ${mentors.map(mentor => `
                <div class="col-md-6 col-lg-4">
                    <div class="card mentor-card h-100 shadow-sm">
                        <div class="card-body">
                            <div class="d-flex align-items-center mb-3">
                                <div class="mentor-avatar me-3 bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style="width: 60px; height: 60px; font-size: 24px; font-weight: bold;">
                                    ${mentor.firstName ? mentor.firstName.charAt(0).toUpperCase() : 'M'}
                                </div>
                                <div class="flex-grow-1">
                                    <h5 class="card-title mb-1">${mentor.firstName} ${mentor.lastName}</h5>
                                    <div class="mentor-rating text-warning mb-1">
                                        ${'★'.repeat(Math.floor(mentor.rating || 4))}${'☆'.repeat(5 - Math.floor(mentor.rating || 4))}
                                        <span class="ms-1 text-muted small">(${mentor.totalReviews || 0} reviews)</span>
                                    </div>
                                    <p class="text-muted small mb-0">
                                        <i class="fas fa-map-marker-alt me-1"></i>${mentor.location || 'Remote'}
                                    </p>
                                </div>
                            </div>
                            
                            <p class="card-text mb-3">${(mentor.bio || 'Experienced mentor ready to help you learn').substring(0, 120)}...</p>
                            
                            <div class="mentor-skills mb-3">
                                ${(mentor.skills || []).slice(0, 4).map(skill => 
                                    `<span class="badge bg-light text-primary border me-1 mb-1">${skill}</span>`
                                ).join('')}
                                ${mentor.skills && mentor.skills.length > 4 ? `<span class="text-muted small">+${mentor.skills.length - 4} more</span>` : ''}
                            </div>
                            
                            <div class="d-flex justify-content-between align-items-center">
                                <div class="mentor-price">
                                    <strong class="text-success fs-5">$${mentor.hourlyRate || 25}</strong>
                                    <span class="text-muted">/hour</span>
                                </div>
                                <div>
                                    <button class="btn btn-outline-primary btn-sm me-2" onclick="viewMentorProfile('${mentor._id}')">
                                        <i class="fas fa-eye me-1"></i>View
                                    </button>
                                    <button class="btn btn-primary btn-sm" onclick="requestSession('${mentor._id}', '${mentor.firstName} ${mentor.lastName}')">
                                        <i class="fas fa-calendar-plus me-1"></i>Book
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderListView(mentors) {
    const container = document.getElementById('mentors-container');
    container.innerHTML = `
        <div class="list-group">
            ${mentors.map(mentor => `
                <div class="list-group-item mentor-list-item">
                    <div class="d-flex align-items-center">
                        <div class="mentor-avatar me-3 bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style="width: 50px; height: 50px; font-weight: bold;">
                            ${mentor.firstName ? mentor.firstName.charAt(0).toUpperCase() : 'M'}
                        </div>
                        <div class="flex-grow-1">
                            <div class="d-flex justify-content-between align-items-start">
                                <div>
                                    <h6 class="mb-1">${mentor.firstName} ${mentor.lastName}</h6>
                                    <div class="mentor-rating text-warning mb-1">
                                        ${'★'.repeat(Math.floor(mentor.rating || 4))}${'☆'.repeat(5 - Math.floor(mentor.rating || 4))}
                                        <span class="ms-1 text-muted small">(${mentor.totalReviews || 0})</span>
                                    </div>
                                    <p class="text-muted small mb-2">${(mentor.bio || '').substring(0, 100)}...</p>
                                    <div class="mentor-skills">
                                        ${(mentor.skills || []).slice(0, 5).map(skill => 
                                            `<span class="badge bg-light text-primary border me-1">${skill}</span>`
                                        ).join('')}
                                    </div>
                                </div>
                                <div class="text-end">
                                    <div class="mentor-price mb-2">
                                        <strong class="text-success">$${mentor.hourlyRate || 25}/hr</strong>
                                    </div>
                                    <div>
                                        <button class="btn btn-outline-primary btn-sm me-2" onclick="viewMentorProfile('${mentor._id}')">
                                            View Profile
                                        </button>
                                        <button class="btn btn-primary btn-sm" onclick="requestSession('${mentor._id}', '${mentor.firstName} ${mentor.lastName}')">
                                            Book Session
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderPagination() {
    const pagination = document.getElementById('pagination');
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let paginationHTML = '';
    
    // Previous button
    paginationHTML += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage - 1})">Previous</a>
        </li>
    `;
    
    // Page numbers
    for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
        paginationHTML += `
            <li class="page-item ${i === currentPage ? 'active' : ''}">
                <a class="page-link" href="#" onclick="changePage(${i})">${i}</a>
            </li>
        `;
    }
    
    // Next button
    paginationHTML += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage + 1})">Next</a>
        </li>
    `;
    
    pagination.innerHTML = paginationHTML;
}

function changePage(page) {
    if (page < 1 || page > totalPages || page === currentPage) return;
    currentPage = page;
    loadMentors();
    window.scrollTo(0, 0);
}

function updateResultsCount(total) {
    const resultsCount = document.getElementById('results-count');
    resultsCount.textContent = `${total} mentor${total !== 1 ? 's' : ''} found`;
}

function changeView(view) {
    currentView = view;
    const gridBtn = document.getElementById('grid-view');
    const listBtn = document.getElementById('list-view');
    
    if (view === 'grid') {
        gridBtn.classList.add('active');
        listBtn.classList.remove('active');
    } else {
        listBtn.classList.add('active');
        gridBtn.classList.remove('active');
    }
    
    renderMentors(currentMentors);
}

function clearFilters() {
    document.getElementById('search-filters').reset();
    currentPage = 1;
    loadMentors();
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
    document.getElementById('mentor-id').value = mentorId;
    document.querySelector('#sessionRequestModal .modal-title').textContent = `Request Session with ${mentorName}`;
    
    const modal = new bootstrap.Modal(document.getElementById('sessionRequestModal'));
    modal.show();
}

async function submitSessionRequest() {
    const mentorId = document.getElementById('mentor-id').value;
    const subject = document.getElementById('session-subject').value;
    const description = document.getElementById('session-description').value;
    const preferredTime = document.getElementById('preferred-time').value;
    const duration = document.getElementById('session-duration').value;

    if (!subject || !description || !preferredTime || !duration) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }

    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/sessions/request`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                mentorId,
                subject,
                description,
                preferredTime,
                duration: parseFloat(duration)
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showNotification('Session request sent successfully!', 'success');
            const modal = bootstrap.Modal.getInstance(document.getElementById('sessionRequestModal'));
            modal.hide();
            document.getElementById('session-request-form').reset();
        } else {
            showNotification(data.message || 'Failed to send session request', 'error');
        }
    } catch (error) {
        console.error('Session request error:', error);
        showNotification('Network error. Please try again.', 'error');
    }
}

function renderError() {
    const container = document.getElementById('mentors-container');
    container.innerHTML = `
        <div class="text-center py-5">
            <i class="fas fa-exclamation-triangle fa-3x text-warning mb-3"></i>
            <h5>Unable to load mentors</h5>
            <p class="text-muted">Please check your connection and try again</p>
            <button class="btn btn-primary" onclick="loadMentors()">Retry</button>
        </div>
    `;
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 1050; max-width: 400px;';
    
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'landing.html';
}