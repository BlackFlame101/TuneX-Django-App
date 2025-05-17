// --- Floating Notification System ---
function showFloatingNotification(message, type = 'info') {
    const messagesContainer = document.querySelector('.messages-container');
    if (!messagesContainer) {
        console.error('Messages container not found for floating notification.');
        // Fallback to alert if container is missing
        alert(message);
        return;
    }

    const alertDiv = document.createElement('div');
    alertDiv.classList.add('alert', `alert-${type}`, 'alert-dismissible', 'fade', 'show');
    alertDiv.setAttribute('role', 'alert');
    alertDiv.style.backgroundColor = getNotificationColor(type);
    alertDiv.style.color = 'white';
    alertDiv.style.padding = '12px 18px';
    alertDiv.style.borderRadius = '5px';
    alertDiv.style.marginBottom = '10px';
    alertDiv.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    alertDiv.style.display = 'flex';
    alertDiv.style.justifyContent = 'space-between';
    alertDiv.style.alignItems = 'center';
    alertDiv.style.opacity = '1'; // Start visible

    alertDiv.innerHTML = `
        <span>${message}</span>
        <button type="button" class="close-alert" data-dismiss="alert" aria-label="Close" style="background:none; border:none; color:white; font-size:1.5rem; line-height:1; opacity:0.8; padding: 0 0 0 15px; cursor:pointer;">
            <span aria-hidden="true">&times;</span>
        </button>
    `;

    messagesContainer.appendChild(alertDiv);

    // Auto-dismiss
    setTimeout(function() {
        alertDiv.style.transition = 'opacity 0.5s ease';
        alertDiv.style.opacity = '0';
        setTimeout(function() { alertDiv.remove(); }, 500);
    }, 5000); // 5 seconds

    // Close button functionality
    alertDiv.querySelector('.close-alert').addEventListener('click', function() {
        alertDiv.style.transition = 'opacity 0.5s ease';
        alertDiv.style.opacity = '0';
        setTimeout(function() { alertDiv.remove(); }, 500);
    });
}

function getNotificationColor(type) {
    switch (type) {
        case 'success': return '#28a745';
        case 'error': return '#dc3545';
        case 'info': return '#17a2b8';
        case 'warning': return '#ffc107';
        default: return '#6c757d'; // secondary/default
    }
}

// Expose the function globally
window.showFloatingNotification = showFloatingNotification;
