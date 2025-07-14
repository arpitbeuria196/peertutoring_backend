// Authentication JavaScript for login and register pages
const API_BASE_URL = window.location.origin + '/api';

document.addEventListener('DOMContentLoaded', function() {
    // Check URL parameters for pre-selecting role
    const urlParams = new URLSearchParams(window.location.search);
    const role = urlParams.get('role');
    
    if (role === 'mentor') {
        const mentorRadio = document.getElementById('mentor');
        if (mentorRadio) mentorRadio.checked = true;
    }

    // Set up form handlers
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }

    // Setup password toggle functionality
    setupPasswordToggle();
    
    // Setup username checking
    const usernameInput = document.getElementById('username');
    const checkUsernameBtn = document.getElementById('checkUsername');
    
    if (usernameInput && checkUsernameBtn) {
        // Check username on input change (with debounce)
        let usernameTimeout;
        usernameInput.addEventListener('input', function() {
            clearTimeout(usernameTimeout);
            usernameTimeout = setTimeout(() => {
                if (this.value.length >= 3) {
                    checkUsernameAvailability(this.value);
                }
            }, 500);
        });
        
        // Check username on button click
        checkUsernameBtn.addEventListener('click', function() {
            const username = usernameInput.value.trim();
            if (username.length >= 3) {
                checkUsernameAvailability(username);
            }
        });
    }

    // Check if user is already authenticated
    const token = localStorage.getItem('token');
    if (token) {
        // Redirect to appropriate page based on user status
        checkUserStatus();
    }
});

async function handleLogin(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const loginData = {
        login: formData.get('login'),
        password: formData.get('password')
    };

    const submitButton = e.target.querySelector('button[type="submit"]');
    showLoading(submitButton, 'Logging in...');
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(loginData)
        });

        const data = await response.json();
        hideLoading(submitButton, 'Login');

        if (response.ok && data.success) {
            // Store auth token and user data
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // Show success modal and redirect immediately
            showSuccessModal('Login Successful!', 'Redirecting...');
            
            // Role-based dashboard redirect
            setTimeout(async () => {
                if (data.user.isApproved || data.user.role === 'admin') {
                    try {
                        const dashboardResponse = await fetch(`${API_BASE_URL}/dashboard/redirect`, {
                            method: 'GET',
                            headers: {
                                'Authorization': `Bearer ${data.token}`,
                                'Content-Type': 'application/json'
                            }
                        });

                        if (dashboardResponse.ok) {
                            const dashboardData = await dashboardResponse.json();
                            console.log('Redirecting to role-based dashboard:', dashboardData.data.redirectPath);
                            window.location.href = dashboardData.data.redirectPath;
                        } else {
                            // Fallback to role-based redirect
                            const role = data.user.role;
                            if (role === 'admin') {
                                window.location.href = 'admin-dashboard.html';
                            } else if (role === 'mentor') {
                                window.location.href = 'mentor-dashboard.html';
                            } else {
                                window.location.href = 'student-dashboard.html';
                            }
                        }
                    } catch (error) {
                        console.error('Dashboard redirect error:', error);
                        // Basic fallback
                        window.location.href = 'dashboard.html';
                    }
                } else {
                    console.log('Redirecting to documents - user needs approval');
                    window.location.href = 'documents.html';
                }
            }, 1000);
        } else {
            console.log('Login failed:', response.status, data);
            if (response.status === 403 && data.code === 'ACCOUNT_PENDING_APPROVAL') {
                // Store token and user data for pending users to allow document upload
                if (data.token) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('authToken', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    localStorage.setItem('currentUser', JSON.stringify(data.user));
                    localStorage.setItem('pendingUser', JSON.stringify(data.user));
                    
                    showSuccessModal('Account Pending Approval', 'Please upload your required documents while we review your account.');
                    
                    setTimeout(() => {
                        window.location.href = 'documents.html';
                    }, 2000);
                } else {
                    showError('Your account is pending approval. Please contact an administrator.');
                }
            } else {
                showError(data.message || 'Login failed. Please check your credentials.');
            }
        }
    } catch (error) {
        hideLoading(submitButton, 'Login');
        console.error('Login error:', error);
        showError('Network error. Please check your connection and try again.');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    
    const registerData = {
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        username: formData.get('username'),
        email: formData.get('email'),
        password: formData.get('password'),
        role: formData.get('role')
    };

    const submitButton = e.target.querySelector('button[type="submit"]');
    showLoading(submitButton, 'Creating account...');
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(registerData)
        });

        const data = await response.json();
        hideLoading(submitButton, 'Continue');

        if (response.ok && data.success) {
            // Store user data for document upload consistently
            localStorage.setItem('token', data.token);
            localStorage.setItem('authToken', data.token); // Backup storage
            localStorage.setItem('user', JSON.stringify(data.user));
            
            console.log('Registration successful, token stored:', data.token);
            
            // Show success modal with clear next steps
            showSuccessModal('Registration Successful!', 'Your account has been created. Please upload your required documents (offer letter and resume) for verification before you can access the platform.');
            
            // Redirect to document upload after user acknowledgment
            setTimeout(() => {
                window.location.href = 'documents.html';
            }, 3000);
        } else {
            // Show validation errors properly
            if (data.errors && Array.isArray(data.errors)) {
                const errorMessages = data.errors.map(err => err.msg).join(', ');
                showError(`Validation errors: ${errorMessages}`);
            } else {
                showError(data.message || 'Registration failed. Please try again.');
            }
        }
    } catch (error) {
        hideLoading(submitButton, 'Continue');
        console.error('Registration error:', error);
        showError('Network error. Please check your connection and try again.');
    }
}

async function checkUserStatus() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const response = await fetch(`${API_BASE_URL}/auth/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            const user = data.data;
            
            if (user.isApproved || user.role === 'admin') {
                // Role-based dashboard redirect
                const dashboardMap = {
                    'admin': 'admin-dashboard.html',
                    'mentor': 'mentor-dashboard.html',
                    'student': 'student-dashboard.html'
                };
                window.location.href = dashboardMap[user.role] || 'dashboard.html';
            } else {
                window.location.href = 'documents.html';
            }
        } else {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
    } catch (error) {
        console.error('Status check error:', error);
    }
}

function showLoading(button, text) {
    button.disabled = true;
    button.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${text}`;
}

function hideLoading(button, originalText) {
    button.disabled = false;
    button.innerHTML = originalText;
}

function showSuccessModal(title, message) {
    const modal = document.getElementById('successModal');
    if (modal) {
        const titleElement = document.getElementById('successTitle');
        const messageElement = document.getElementById('successMessage');
        if (titleElement) titleElement.textContent = title;
        if (messageElement) messageElement.textContent = message;
        const bootstrapModal = new bootstrap.Modal(modal);
        bootstrapModal.show();
    } else {
        // Fallback to simple success message
        showSuccess(message);
    }
}

function showSuccess(message) {
    const container = document.getElementById('auth-response');
    if (container) {
        container.className = 'response-container response-success';
        container.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="fas fa-check-circle me-2"></i>
                <div>${message}</div>
            </div>
        `;
        container.style.display = 'block';
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            container.style.display = 'none';
        }, 3000);
    }
}

function showError(message) {
    const container = document.getElementById('auth-response');
    if (container) {
        container.className = 'response-container response-error';
        container.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="fas fa-exclamation-circle me-2"></i>
                <div>${message}</div>
            </div>
        `;
        container.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            container.style.display = 'none';
        }, 5000);
    }
}

// Username availability checking
async function checkUsernameAvailability(username) {
    const validationDiv = document.getElementById('usernameValidation');
    const checkBtn = document.getElementById('checkUsername');
    
    if (!username || username.length < 3) {
        validationDiv.innerHTML = '<span class="text-muted">Username must be at least 3 characters</span>';
        return;
    }
    
    // Show loading state
    checkBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    validationDiv.innerHTML = '<span class="text-muted">Checking availability...</span>';
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/check-username`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            if (data.available) {
                validationDiv.innerHTML = '<span class="text-success"><i class="fas fa-check"></i> Username is available</span>';
            } else {
                validationDiv.innerHTML = '<span class="text-danger"><i class="fas fa-times"></i> Username is already taken</span>';
            }
        } else {
            validationDiv.innerHTML = '<span class="text-warning">Error checking username</span>';
        }
    } catch (error) {
        console.error('Username check error:', error);
        validationDiv.innerHTML = '<span class="text-warning">Error checking username</span>';
    } finally {
        checkBtn.innerHTML = '<i class="fas fa-search"></i>';
    }
}

// Password toggle functionality
function setupPasswordToggle() {
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    const toggleIcon = document.getElementById('toggleIcon');
    
    if (togglePassword && passwordInput && toggleIcon) {
        togglePassword.addEventListener('click', function() {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            // Toggle the eye icon
            if (type === 'password') {
                toggleIcon.classList.remove('fa-eye-slash');
                toggleIcon.classList.add('fa-eye');
            } else {
                toggleIcon.classList.remove('fa-eye');
                toggleIcon.classList.add('fa-eye-slash');
            }
        });
    }
}

function showForgotPassword() {
    window.location.href = 'forgot-password.html';
}

// Make functions globally available
window.showForgotPassword = showForgotPassword;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.checkUsernameAvailability = checkUsernameAvailability;