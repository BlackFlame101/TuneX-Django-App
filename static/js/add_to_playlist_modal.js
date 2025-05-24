document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('playlist-selection-modal');
    const playlistListDiv = document.getElementById('playlist-list');
    const cancelButton = document.getElementById('cancel-add-to-playlist');
    const confirmButton = document.getElementById('confirm-add-to-playlist');
    let currentTrackIdForModal = null; 

    function getCsrfToken() {
        const csrfTokenMeta = document.querySelector('meta[name="csrf-token"]');
        return csrfTokenMeta ? csrfTokenMeta.getAttribute('content') : null;
    }

    function showModal() {
        if (modal) modal.style.display = 'flex';
    }

    function hideModal() {
        if (modal) modal.style.display = 'none';
        if (playlistListDiv) playlistListDiv.innerHTML = ''; 
        currentTrackIdForModal = null; 
        if (confirmButton) confirmButton.style.display = 'inline-block';
    }

    function setupAddToPlaylistButtons() {
        if (!modal || !playlistListDiv || !confirmButton || !cancelButton) {
            console.error("Add to Playlist Modal: Essential modal elements not found. Aborting setup.");
            return;
        }

        const addToPlaylistButtons = document.querySelectorAll('.add-to-playlist-button');
        console.log(`Add to Playlist Modal: Running setup. Found ${addToPlaylistButtons.length} total .add-to-playlist-button elements in the document.`);

        addToPlaylistButtons.forEach(button => {
            const trackId = button.dataset.trackId || 'unknown';
            if (button.dataset.listenerAttached === 'true') {
                
                return; 
            }

            console.log(`Add to Playlist Modal: ATTEMPTING TO ATTACH listener to button for track ID ${trackId}.`);
            button.addEventListener('click', function(event) {
                
                console.log('Add to Playlist Modal: CLICK HANDLER FIRED for track ID:', this.getAttribute('data-track-id')); 
                
                event.stopPropagation(); 
                currentTrackIdForModal = this.getAttribute('data-track-id');
                
                if (!currentTrackIdForModal) {
                    console.error("Add to Playlist Modal: data-track-id attribute is missing on the clicked button.");
                    if (typeof showFloatingNotification === 'function') {
                        showFloatingNotification("Cannot add to playlist: Track ID missing.", "error");
                    } else {
                        alert("Cannot add to playlist: Track ID missing.");
                    }
                    return;
                }
                
                const csrfToken = getCsrfToken();
                if (!csrfToken) {
                    console.error("Add to Playlist Modal: CSRF token not found.");
                     if (typeof showFloatingNotification === 'function') {
                        showFloatingNotification("Action cannot be performed: Security token missing.", "error");
                    } else {
                        alert("Action cannot be performed: Security token missing.");
                    }
                    return;
                }
                
                fetch('/api/user_playlists/', { 
                    method: 'GET',
                    headers: {
                        'X-CSRFToken': csrfToken,
                        'X-Requested-With': 'XMLHttpRequest' 
                    }
                })
                .then(response => {
                    if (!response.ok) {
                        return response.json().then(err => {
                            const errorMsg = err.error || `Failed to fetch playlists (HTTP ${response.status})`;
                            console.error('Add to Playlist Modal: Error fetching playlists:', errorMsg);
                            if (typeof showFloatingNotification === 'function') {
                                showFloatingNotification(errorMsg, 'error');
                            }
                            throw new Error(errorMsg);
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('Add to Playlist Modal: Playlists fetched:', data);
                    if (playlistListDiv) playlistListDiv.innerHTML = ''; 
                    
                    if (data.playlists && data.playlists.length > 0) {
                        data.playlists.forEach(playlist => {
                            const playlistItem = document.createElement('div');
                            playlistItem.classList.add('playlist-modal-item'); 
                            playlistItem.innerHTML = `
                                <label for="playlist-check-${playlist.id}" class="flex items-center space-x-2 cursor-pointer hover:bg-gray-700 p-2 rounded">
                                    <input type="checkbox" id="playlist-check-${playlist.id}" value="${playlist.id}" class="form-checkbox h-5 w-5 text-blue-500 rounded border-gray-600 bg-gray-800 focus:ring-blue-400">
                                    <span class="text-gray-200">${playlist.name}</span>
                                </label>
                            `;
                            playlistListDiv.appendChild(playlistItem);
                        });
                        if (confirmButton) confirmButton.style.display = 'inline-block';
                    } else {
                        if (playlistListDiv) playlistListDiv.innerHTML = '<p class="text-gray-400">You have no playlists yet. Create one first!</p>';
                        if (confirmButton) confirmButton.style.display = 'none'; 
                    }
                    showModal();
                })
                .catch(error => {
                    console.error('Add to Playlist Modal: Fetch error for playlists:', error);
                    if (typeof showFloatingNotification === 'function') {
                        showFloatingNotification('Could not load your playlists. Please try again.', 'error');
                    }
                    hideModal(); 
                });
            });
            
            button.dataset.listenerAttached = 'true';
            console.log(`Add to Playlist Modal: Listener successfully ATTACHED to button for track ID ${trackId}.`);
        });
    }

    
    setupAddToPlaylistButtons();

    window.setupAddToPlaylistButtons = setupAddToPlaylistButtons; 

    
    if (cancelButton) {
        cancelButton.addEventListener('click', function() {
            hideModal();
        });
    }

    
    if (confirmButton) {
        confirmButton.addEventListener('click', function() {
            const selectedPlaylistIds = [];
            if (playlistListDiv) {
                playlistListDiv.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
                    selectedPlaylistIds.push(parseInt(checkbox.value));
                });
            }

            if (selectedPlaylistIds.length === 0) {
                if (typeof showFloatingNotification === 'function') {
                    showFloatingNotification('Please select at least one playlist.', 'warning');
                } else {
                    alert('Please select at least one playlist.');
                }
                return;
            }

            if (!currentTrackIdForModal) {
                 console.error('Add to Playlist Modal: No track ID available to add.');
                 if (typeof showFloatingNotification === 'function') {
                    showFloatingNotification('An error occurred. Please try again.', 'error');
                 }
                 hideModal();
                 return;
            }
            
            const csrfToken = getCsrfToken();
            if (!csrfToken) {
                console.error("Add to Playlist Modal: CSRF token not found for confirm action.");
                if (typeof showFloatingNotification === 'function') {
                    showFloatingNotification("Action cannot be performed: Security token missing.", "error");
                }
                hideModal();
                return;
            }

            console.log('Add to Playlist Modal: Adding track', currentTrackIdForModal, 'to playlists:', selectedPlaylistIds);

            fetch('/api/add_to_playlists/', { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({
                    deezer_id: currentTrackIdForModal,
                    playlist_ids: selectedPlaylistIds
                })
            })
            .then(response => {
                 if (!response.ok) {
                     return response.json().then(err => { 
                        const errorMsg = err.error || `Failed to add to playlists (HTTP ${response.status})`;
                        console.error('Add to Playlist Modal: Error adding song to playlists:', errorMsg);
                        throw new Error(errorMsg);
                    });
                 }
                 return response.json();
            })
            .then(data => {
                console.log('Add to Playlist Modal: Add to playlists response:', data);
                let successMessages = [];
                let errorMessages = [];
                let alreadyInMessages = [];

                if (data.results) {
                     for (const playlistId in data.results) {
                         const result = data.results[playlistId];
                         if (result.success) {
                             successMessages.push(result.message);
                         } else {
                             if (result.message && result.message.includes('Already in')) {
                                 alreadyInMessages.push(result.message);
                             } else {
                                 errorMessages.push(result.message || `Error for playlist ID ${playlistId}`);
                             }
                         }
                     }
                }

                let feedback = '';
                if (successMessages.length > 0) {
                     feedback += `Added "${data.song_title || 'the song'}" to relevant playlist(s). `;
                }
                 if (alreadyInMessages.length > 0) {
                     feedback += alreadyInMessages.join(', ') + '. ';
                 }
                if (errorMessages.length > 0) {
                     feedback += `Errors: ${errorMessages.join(', ')}.`;
                }

                if (typeof showFloatingNotification === 'function') {
                    if (feedback.trim()) {
                        showFloatingNotification(feedback.trim(), successMessages.length > 0 ? 'success' : (errorMessages.length > 0 ? 'error' : 'info'));
                    } else if (data.message) { 
                        showFloatingNotification(data.message, 'info');
                    } else {
                        showFloatingNotification('Operation completed.', 'info');
                    }
                }
                hideModal();
            })
            .catch(error => {
                console.error('Add to Playlist Modal: Fetch error on confirm:', error);
                if (typeof showFloatingNotification === 'function') {
                    showFloatingNotification(error.message || 'An error occurred. Please try again.', 'error');
                }
                hideModal();
            });
        });
    }

    if (modal) {
        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                hideModal();
            }
        });
    }
});
