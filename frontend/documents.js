// Document management JavaScript
const API_BASE_URL = window.location.origin + '/api';
let currentUser = null;

document.addEventListener('DOMContentLoaded', function() {
    checkAuthentication();
    setupEventHandlers();
    loadUserDocuments();
});

function setupEventHandlers() {
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', handleFileUpload);
    }
}

async function checkAuthentication() {
    const token = localStorage.getItem('token');
    const currentUserData = localStorage.getItem('user');
    
    if (token) {
        // Check if we have user data from pending approval login
        if (currentUserData) {
            try {
                currentUser = JSON.parse(currentUserData);
                updateUserDisplay();
                
                // If user is already approved, redirect to role-specific dashboard
                if (currentUser.isApproved || currentUser.role === 'admin') {
                    redirectToDashboard(currentUser.role);
                    return;
                }
                
                // For pending users, stay on documents page to allow uploads
                return;
            } catch (error) {
                console.error('Error parsing current user data:', error);
            }
        }
        
        // Fallback: try to get profile from API (use pending-friendly endpoint)
        try {
            const response = await fetch(`${API_BASE_URL}/auth/profile-pending`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                currentUser = data.data;
                updateUserDisplay();
                
                // If user is already approved, redirect to role-specific dashboard
                if (currentUser.isApproved || currentUser.role === 'admin') {
                    redirectToDashboard(currentUser.role);
                }
            } else if (response.status === 403) {
                // User has pending approval - this is expected for document upload page
                console.log('User has pending approval status - allowing document access');
                return;
            } else {
                localStorage.removeItem('authToken');
                localStorage.removeItem('currentUser');
                localStorage.removeItem('pendingUser');
                window.location.href = 'login.html';
            }
        } catch (error) {
            console.error('Auth check error:', error);
            // Don't redirect immediately - user might have pending approval
            if (currentUserData) {
                try {
                    currentUser = JSON.parse(currentUserData);
                    updateUserDisplay();
                } catch (e) {
                    window.location.href = 'login.html';
                }
            } else {
                window.location.href = 'login.html';
            }
        }
    } else {
        const pendingUser = localStorage.getItem('pendingUser');
        if (pendingUser) {
            currentUser = JSON.parse(pendingUser);
            updateUserDisplay();
        } else {
            window.location.href = 'login.html';
        }
    }
}

function updateUserDisplay() {
    const userNameElement = document.getElementById('current-user-name');
    if (userNameElement && currentUser) {
        userNameElement.textContent = `${currentUser.firstName} ${currentUser.lastName}`;
    }
}

function showUploadModal(documentType) {
    const modal = document.getElementById('uploadModal');
    const documentTypeInput = document.getElementById('documentType');
    const documentTypeDisplay = document.getElementById('documentTypeDisplay');
    
    documentTypeInput.value = documentType;
    documentTypeDisplay.value = documentType === 'offer' ? 'Offer Letter' : 'Resume';
    
    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();
}

async function handleFileUpload(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const file = formData.get('document');
    const documentType = formData.get('documentType');
    
    if (!file) {
        showErrorModal('No File Selected', 'Please select a file to upload.');
        return;
    }
    
    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
        showErrorModal('File Too Large', 'Please select a file smaller than 5MB.');
        return;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Uploading...';
    submitBtn.disabled = true;
    
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/documents/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const data = await response.json();
        
        if (response.ok && data.success) {
            showSuccessModal('Upload Successful', 'Your document has been uploaded and will be reviewed by our admin team.');
            
            // Close upload modal and reload documents
            const uploadModal = bootstrap.Modal.getInstance(document.getElementById('uploadModal'));
            uploadModal.hide();
            
            setTimeout(() => {
                loadUserDocuments();
            }, 1000);
        } else {
            showErrorModal('Upload Failed', data.message || 'Failed to upload document. Please try again.');
        }
    } catch (error) {
        console.error('Upload error:', error);
        showErrorModal('Upload Error', 'Network error occurred. Please check your connection and try again.');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

async function loadUserDocuments() {
    if (!currentUser) return;
    
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    
    try {
        const response = await fetch(`${API_BASE_URL}/documents`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                renderDocumentsTable(data.data.documents || []);
            } else {
                renderDocumentsTable([]);
            }
        } else if (response.status === 404) {
            renderDocumentsTable([]);
        } else {
            console.error('Failed to load documents');
            renderDocumentsTable([]);
        }
    } catch (error) {
        console.error('Error loading documents:', error);
        renderDocumentsTable([]);
    }
}

function renderDocumentsTable(documents) {
    const tbody = document.getElementById('documents-table-body');
    if (!tbody) return;

    if (!documents || documents.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted">
                    <div class="py-4">
                        <i class="fas fa-file-alt fa-3x mb-3 text-muted"></i>
                        <p class="mb-0">No documents uploaded yet</p>
                        <small class="text-muted">Upload your resume and offer letter to get started</small>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    const documentsHTML = documents.map(doc => `
        <tr>
            <td>
                <i class="fas fa-${getDocumentIcon(doc.documentType || doc.type)} me-2"></i>
                ${getDocumentTypeName(doc.documentType || doc.type)}
            </td>
            <td>${doc.originalName || 'Unknown'}</td>
            <td>${formatDate(doc.uploadedAt)}</td>
            <td>${getStatusIcon(doc.verified ? 'approved' : 'pending')}</td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="downloadDocument('${doc._id || doc.id}')" title="Download">
                        <i class="fas fa-download"></i>
                    </button>
                    ${!doc.verified ? `
                        <button class="btn btn-outline-danger" onclick="deleteDocument('${doc.documentType || doc.type}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
    
    tbody.innerHTML = documentsHTML;
}

function getStatusIcon(status) {
    switch (status) {
        case 'approved':
            return '<span class="badge bg-success"><i class="fas fa-check me-1"></i>Approved</span>';
        case 'rejected':
            return '<span class="badge bg-danger"><i class="fas fa-times me-1"></i>Rejected</span>';
        case 'pending':
        default:
            return '<span class="badge bg-warning"><i class="fas fa-clock me-1"></i>Pending</span>';
    }
}

function getDocumentIcon(documentType) {
    switch (documentType) {
        case 'resume':
            return 'file-text';
        case 'legalDocument':
            return 'id-card';
        default:
            return 'file';
    }
}

function getDocumentTypeName(documentType) {
    switch (documentType) {
        case 'resume':
            return 'Resume';
        case 'offer':
            return 'Offer Letter';
        default:
            return documentType;
    }
}

async function downloadDocument(documentId) {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    
    try {
        const response = await fetch(`${API_BASE_URL}/documents/download/${documentId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            
            const contentDisposition = response.headers.get('content-disposition');
            let filename = 'document';
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="(.+)"/);
                if (filenameMatch) {
                    filename = filenameMatch[1];
                }
            }
            
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } else {
            showErrorModal('Download Failed', 'Unable to download the document.');
        }
    } catch (error) {
        console.error('Download error:', error);
        showErrorModal('Download Error', 'Failed to download document.');
    }
}

async function deleteDocument(documentType) {
    if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
        return;
    }
    
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    
    try {
        const response = await fetch(`${API_BASE_URL}/documents/${documentType}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        
        if (response.ok && data.success) {
            showSuccessModal('Document Deleted', 'The document has been successfully deleted.');
            setTimeout(() => {
                loadUserDocuments();
            }, 1000);
        } else {
            showErrorModal('Delete Failed', data.message || 'Unable to delete the document.');
        }
    } catch (error) {
        console.error('Delete error:', error);
        showErrorModal('Delete Error', 'Failed to delete document.');
    }
}

async function checkApprovalStatus() {
    if (!currentUser) return;
    
    showLoadingModal('Checking Status', 'Please wait while we check your approval status...');
    
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        hideLoadingModal();

        if (response.ok) {
            const data = await response.json();
            const user = data.user;
            currentUser = user;
            
            if (user.isApproved) {
                showApprovalModal(
                    'Account Approved!', 
                    'Congratulations! Your account has been approved. You can now access the dashboard.',
                    'success',
                    'Go to Dashboard',
                    () => {
                        redirectToDashboard(user.role);
                    }
                );
            } else {
                showApprovalModal(
                    'Approval Pending', 
                    'Your account is still under review. Please ensure you have uploaded all required documents.',
                    'warning',
                    'Refresh Documents',
                    () => {
                        loadUserDocuments();
                    }
                );
            }
        } else {
            showErrorModal('Error', 'Unable to check approval status. Please try again.');
        }
    } catch (error) {
        hideLoadingModal();
        console.error('Status check error:', error);
        showErrorModal('Error', 'Failed to check approval status.');
    }
}

function redirectToDashboard(role) {
    switch (role) {
        case 'admin':
            window.location.href = 'admin-dashboard.html';
            break;
        case 'mentor':
            window.location.href = 'mentor-dashboard.html';
            break;
        case 'student':
            window.location.href = 'student-dashboard.html';
            break;
        default:
            window.location.href = 'student-dashboard.html';
    }
}

function showSuccessModal(title, message) {
    const modal = document.getElementById('successModal');
    document.getElementById('successTitle').textContent = title;
    document.getElementById('successMessage').textContent = message;
    
    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();
}

function showErrorModal(title, message) {
    const modal = document.getElementById('errorModal');
    document.getElementById('errorTitle').textContent = title;
    document.getElementById('errorMessage').textContent = message;
    
    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();
}

function showLoadingModal(title, message) {
    console.log(`Loading: ${title} - ${message}`);
}

function hideLoadingModal() {
    console.log('Loading modal hidden');
}

function showApprovalModal(title, message, type, actionText, actionCallback) {
    if (confirm(`${title}\n${message}\n\nClick OK to ${actionText}`)) {
        if (actionCallback) actionCallback();
    }
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString();
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'landing.html';
}

// Make functions globally available
window.showUploadModal = showUploadModal;
window.checkApprovalStatus = checkApprovalStatus;
window.downloadDocument = downloadDocument;
window.deleteDocument = deleteDocument;
window.logout = logout;

// Authentication helper functions
function getAuthHeaders() {
    const token = getAuthToken();
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

function getAuthToken() {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken') || '';
    console.log('Getting auth token:', token ? 'Token found' : 'No token found');
    return token;
}