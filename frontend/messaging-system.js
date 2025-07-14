// Universal Messaging System for MentorHub with WebSocket support
class MessagingSystem {
    constructor() {
        this.currentUser = null;
        this.selectedUser = null;
        this.users = [];
        this.messages = [];
        this.conversationId = null;
        this.socket = null;
        this.typingTimer = null;
        this.onlineUsers = new Set();
        // Don't auto-init in constructor, init manually
    }

    async init() {
        await this.loadCurrentUser();
        this.initializeSocket();
        this.createMessagingModal();
        this.attachEventListeners();
    }

    initializeSocket() {
        const token = localStorage.getItem('token');
        if (!token) return;

        // Initialize Socket.io connection
        this.socket = io({
            auth: {
                token: token
            }
        });

        // Socket event listeners
        this.socket.on('connect', () => {
            console.log('Connected to WebSocket server');
            this.showNotification('Connected to real-time messaging', 'success');
        });

        this.socket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error);
            this.showNotification('Failed to connect to messaging server', 'error');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from WebSocket server');
            this.showNotification('Disconnected from real-time messaging', 'warning');
        });

        this.socket.on('new_message', (messageData) => {
            // Only handle if it's for current conversation
            if (this.conversationId && messageData.conversationId === this.conversationId) {
                this.addMessageToChat(messageData);
                this.playNotificationSound();
            }
        });

        this.socket.on('new_message_notification', (notificationData) => {
            if (this.selectedUser && notificationData.senderId === this.selectedUser.userId) {
                // Update conversation but don't show if modal is closed
                if (document.getElementById('messagingModal').style.display !== 'none') {
                    this.showNotification(`New message from ${notificationData.senderName}`, 'info');
                }
            } else {
                this.showNotification(`New message from ${notificationData.senderName}: ${notificationData.content}`, 'info');
            }
            this.updateUnreadCount();
        });

        this.socket.on('user_typing', (data) => {
            if (this.conversationId === data.conversationId && data.userId !== this.currentUser._id) {
                this.showTypingIndicator(data.userName);
            }
        });

        this.socket.on('user_stop_typing', (data) => {
            if (this.conversationId === data.conversationId) {
                this.hideTypingIndicator();
            }
        });

        this.socket.on('messages_read', (data) => {
            if (this.conversationId === data.conversationId) {
                this.markMessagesAsRead();
            }
        });

        this.socket.on('user_online', (userData) => {
            this.onlineUsers.add(userData.userId);
            this.updateUserOnlineStatus(userData.userId, true);
        });

        this.socket.on('user_offline', (userData) => {
            this.onlineUsers.delete(userData.userId);
            this.updateUserOnlineStatus(userData.userId, false);
        });

        this.socket.on('online_users', (users) => {
            this.onlineUsers = new Set(users.map(u => u.userId));
            this.updateAllUserOnlineStatus();
        });

        this.socket.on('new_notification', (notificationData) => {
            this.showNotification(`${notificationData.title}: ${notificationData.message}`, 'info');
            this.updateNotificationBadge();
        });

        this.socket.on('new_session_available', (sessionData) => {
            this.showNotification(`New session available: ${sessionData.title} by ${sessionData.mentorName}`, 'info');
        });
    }

    async loadCurrentUser() {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await fetch(`${window.location.origin}/api/auth/profile`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.currentUser = data.data || data;
            }
        } catch (error) {
            console.error('Error loading current user:', error);
        }
    }

    createMessagingModal() {
        const modalHTML = `
            <div id="messagingModal" class="messaging-modal">
                <div class="messaging-container">
                    <div class="user-list-panel">
                        <div class="user-list-header">
                            <h5><i class="fas fa-comments me-2"></i>Messages</h5>
                            <div class="d-flex gap-1">
                                <button class="btn btn-sm btn-primary" onclick="messagingSystem.showNewMessageModal()" title="New Message">
                                    <i class="fas fa-plus"></i>
                                </button>
                                <button class="btn btn-sm btn-light" onclick="messagingSystem.closeModal()">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        </div>
                        <div class="user-search">
                            <div class="input-group input-group-sm">
                                <span class="input-group-text">
                                    <i class="fas fa-search text-muted"></i>
                                </span>
                                <input type="text" id="userSearch" class="form-control" placeholder="Search users..." onkeyup="messagingSystem.filterUsers()">
                            </div>
                        </div>
                        <div class="users-list" id="usersList">
                            <div class="text-center p-3">
                                <i class="fas fa-spinner fa-spin"></i>
                                <p class="mt-2 mb-0">Loading users...</p>
                            </div>
                        </div>
                    </div>
                    <div class="chat-panel">
                        <div class="chat-header" id="chatHeader">
                            <div class="d-flex align-items-center">
                                <i class="fas fa-user-circle me-2 fs-4 text-muted"></i>
                                <span class="text-muted">Select a user to start messaging</span>
                            </div>
                        </div>
                        <div class="chat-messages" id="chatMessages">
                            <div class="text-center p-5 text-muted">
                                <i class="fas fa-comments fs-1 mb-3"></i>
                                <h5>Start a Conversation</h5>
                                <p>Select a user from the list to begin messaging</p>
                            </div>
                        </div>
                        <div class="message-input-area" id="messageInputArea" style="display: none;">
                            <input type="text" id="messageInput" class="message-input" placeholder="Type your message..." onkeypress="messagingSystem.handleKeyPress(event)" onkeyup="messagingSystem.handleTyping(event)">
                            <button class="send-button" onclick="messagingSystem.sendMessage()">
                                <i class="fas fa-paper-plane"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if present
        const existingModal = document.getElementById('messagingModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    attachEventListeners() {
        // Close modal when clicking outside
        document.addEventListener('click', (e) => {
            const modal = document.getElementById('messagingModal');
            if (e.target === modal) {
                this.closeModal();
            }
        });
    }

    async openModal() {
        if (!this.currentUser) {
            this.showNotification('Please log in to access messaging', 'error');
            return;
        }

        const modal = document.getElementById('messagingModal');
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        await this.loadUsers();
    }

    closeModal() {
        const modal = document.getElementById('messagingModal');
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    async loadUsers() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${window.location.origin}/api/users/all`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.users = data.users || data.data || [];
                this.renderUsers();
            } else {
                this.showNotification('Failed to load users', 'error');
            }
        } catch (error) {
            console.error('Error loading users:', error);
            this.showNotification('Error loading users', 'error');
        }
    }

    renderUsers() {
        const usersList = document.getElementById('usersList');
        
        if (!this.users || this.users.length === 0) {
            usersList.innerHTML = `
                <div class="text-center p-3 text-muted">
                    <i class="fas fa-users fs-3 mb-2"></i>
                    <p>No users found</p>
                </div>
            `;
            return;
        }

        const currentUserId = this.currentUser?._id || this.currentUser?.data?._id;
        const filteredUsers = this.users.filter(user => user._id !== currentUserId);

        usersList.innerHTML = filteredUsers.map(user => `
            <div class="user-item" onclick="messagingSystem.selectUser('${user._id}', '${user.firstName} ${user.lastName}', '${user.role}')">
                <div class="d-flex align-items-center">
                    <div class="user-avatar me-2">
                        ${(user.firstName?.[0] || 'U').toUpperCase()}
                    </div>
                    <div class="flex-grow-1">
                        <div class="fw-medium">${user.firstName} ${user.lastName}</div>
                        <small class="text-muted">${user.role} • ${user.email}</small>
                    </div>
                    ${user.isOnline ? '<div class="text-success"><i class="fas fa-circle" style="font-size: 0.5rem;"></i></div>' : ''}
                </div>
            </div>
        `).join('');
    }

    filterUsers() {
        const searchTerm = document.getElementById('userSearch').value.toLowerCase();
        const userItems = document.querySelectorAll('.user-item');
        
        userItems.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(searchTerm) ? 'block' : 'none';
        });
    }

    async selectUser(userId, userName, userRole) {
        this.selectedUser = { _id: userId, firstName: userName.split(' ')[0], lastName: userName.split(' ')[1] || '', role: userRole };
        
        // Update UI
        document.querySelectorAll('.user-item').forEach(item => item.classList.remove('active'));
        event.currentTarget.classList.add('active');
        
        // Update chat header
        const chatHeader = document.getElementById('chatHeader');
        chatHeader.innerHTML = `
            <div class="d-flex align-items-center">
                <div class="user-avatar me-2">${userName.split(' ').map(n => n[0]).join('').toUpperCase()}</div>
                <div>
                    <div class="fw-medium">${userName}</div>
                    <small class="text-muted">${userRole}</small>
                </div>
            </div>
            <button class="btn btn-sm btn-outline-secondary" onclick="messagingSystem.clearChat()">
                <i class="fas fa-refresh me-1"></i>Clear
            </button>
        `;
        
        // Show message input area
        document.getElementById('messageInputArea').style.display = 'flex';
        
        // Generate conversation ID
        const currentUserId = this.currentUser?._id || this.currentUser?.data?._id;
        this.conversationId = [currentUserId, userId].sort().join('_');
        
        // Load messages
        await this.loadMessages();
    }

    async loadMessages() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${window.location.origin}/api/messages/conversations/${this.conversationId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.messages = data.messages || data.data || [];
                this.renderMessages();
            } else {
                // If conversation doesn't exist, start with empty messages
                this.messages = [];
                this.renderMessages();
            }
        } catch (error) {
            console.error('Error loading messages:', error);
            this.messages = [];
            this.renderMessages();
        }
    }

    renderMessages() {
        const chatMessages = document.getElementById('chatMessages');
        const currentUserId = this.currentUser?._id || this.currentUser?.data?._id;
        
        if (!this.messages || this.messages.length === 0) {
            chatMessages.innerHTML = `
                <div class="text-center p-4 text-muted">
                    <i class="fas fa-comment-dots fs-2 mb-3"></i>
                    <h6>No messages yet</h6>
                    <p class="mb-0">Start the conversation by sending a message below</p>
                </div>
            `;
            return;
        }

        chatMessages.innerHTML = this.messages.map(message => {
            const isSent = message.senderId === currentUserId;
            const time = new Date(message.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            return `
                <div class="message ${isSent ? 'sent' : 'received'}">
                    <div class="message-content">
                        <div class="message-text">${message.content}</div>
                        <div class="message-time text-muted" style="font-size: 0.75rem; margin-top: 0.25rem;">
                            ${time}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }



    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const content = messageInput.value.trim();
        
        if (!content || !this.selectedUser) return;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${window.location.origin}/api/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    recipientId: this.selectedUser._id,
                    content: content
                })
            });

            if (response.ok) {
                messageInput.value = '';
                await this.loadMessages(); // Reload messages to show the new one
                this.showNotification('Message sent successfully', 'success');
            } else {
                this.showNotification('Failed to send message', 'error');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            this.showNotification('Error sending message', 'error');
        }
    }

    clearChat() {
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = `
            <div class="text-center p-4 text-muted">
                <i class="fas fa-comment-dots fs-2 mb-3"></i>
                <h6>Chat cleared</h6>
                <p class="mb-0">Previous messages are still saved. Refresh to reload conversation history.</p>
            </div>
        `;
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        document.querySelectorAll('.notification').forEach(n => n.remove());
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'} me-2"></i>
                ${message}
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Global messaging system instance
let messagingSystem = null;

// Global function to open messaging modal
function openMessagingModal() {
    if (!messagingSystem) {
        messagingSystem = new MessagingSystem();
        messagingSystem.init().then(() => {
            messagingSystem.openModal();
        }).catch(error => {
            console.error('Failed to initialize messaging system:', error);
        });
    } else {
        messagingSystem.openModal();
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    if (!messagingSystem) {
        messagingSystem = new MessagingSystem();
        messagingSystem.init().catch(error => {
            console.error('Auto-initialization failed:', error);
        });
    }
});