// --- Player State & Elements ---
let currentAudio = null; // Holds the current Audio object
let isPlaying = false; // Declare isPlaying ONCE globally
let currentTrackId = null; // Keep track of the playing track ID
let tracksList = []; // Will store all track data
let currentTrackIndex = -1; 
let userVolume = 0.7; // Store user's preferred volume globally
let isShuffleActive = false; // Track if shuffle mode is active
let isRepeatActive = false; // Track if repeat mode is active
let originalTracksList = []; // Store the original order of tracks
let shuffledTracksList = [];


function getCSRFToken() {
    let csrfToken = null;
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        const parts = cookie.trim().split('=');
        if (parts[0] === 'csrftoken') {
            csrfToken = decodeURIComponent(parts[1]);
            break;
        }
    }
    if (!csrfToken) {
        const metaTag = document.querySelector('meta[name="csrf-token"]');
        if (metaTag) csrfToken = metaTag.getAttribute('content');
    }
    return csrfToken;
}
// This function should be called both on initial load and if content is dynamically updated
function setupArtistCardListeners() {
    console.log("Setting up artist card listeners...");
    const artistCards = document.querySelectorAll('.artist-card');
    console.log(`Found ${artistCards.length} artist cards`);
    
    artistCards.forEach(card => {
        // Remove any existing listeners to prevent duplicates
        card.removeEventListener('click', handleArtistCardClick);
        // Add the click event listener
        card.addEventListener('click', handleArtistCardClick);
    });
}

// Separate function for the click handler to make it easier to manage
function handleArtistCardClick(event) {
    const card = this;
    const artistId = card.getAttribute('data-artist-id');
    const artistName = card.querySelector('.artist-name')?.textContent || 'Unknown Artist';
    
    console.log(`Clicked artist: ${artistName} (ID: ${artistId})`);
    
    if (artistId) {
        // Navigate to the artist profile page
        window.location.href = `/artist/${artistId}/`;
    } else {
        console.warn("Artist ID not found on clicked card:", card);
    }
}

// Setup playlist card listeners
function setupPlaylistCardListeners() {
    console.log("Setting up playlist card listeners...");
    const playlistCards = document.querySelectorAll('.card-grid .card');
    console.log(`Found ${playlistCards.length} playlist cards`);
    
    playlistCards.forEach(card => {
        // Remove existing listener if any
        card.removeEventListener('click', handlePlaylistCardClick);
        // Add the click event listener
        card.addEventListener('click', handlePlaylistCardClick);
    });
}

// Handle playlist card clicks
function handlePlaylistCardClick(event) {
    const card = this;
    const playlistId = card.getAttribute('data-playlist-id');
    const playlistTitle = card.querySelector('.card-title')?.textContent || 'Unknown Playlist';
    const isDeezerPlaylist = card.getAttribute('data-deezer-playlist') === 'true';

    console.log(`Clicked playlist: ${playlistTitle} (ID: ${playlistId}), Deezer: ${isDeezerPlaylist}`);

    if (playlistId) {
        let url = isDeezerPlaylist ? `/deezer_playlist/${playlistId}/` : `/playlist/${playlistId}/`;
        window.location.href = url;
        event.preventDefault(); // Prevent default if there's any other onclick behavior
    } else {
        console.warn("Playlist ID not found on clicked card:", card);
    }
}

async function handleLikeSong(event) {
    event.stopPropagation(); 
    const button = event.currentTarget;
    const trackId = button.dataset.trackId;
    const csrfToken = getCSRFToken();
    const likeUrl = window.appUrls && window.appUrls.likeSong ? window.appUrls.likeSong : '/song/like/';

    if (!trackId || !csrfToken) {
        showFloatingNotification("Could not process like: missing info.", 'error');
        return;
    }
    
    const textSpan = button.querySelector('.like-button-text'); 
    const svgIcon = button.querySelector('svg');

    try {
        const response = await fetch(likeUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
            body: JSON.stringify({ deezer_id: trackId })
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: "Server error." }));
            showFloatingNotification(`Error: ${errorData.error || response.statusText}`, 'error');
            return;
        }
        const data = await response.json();
        const trackItem = button.closest('.track-item');

        if (data.liked) {
            if (textSpan) textSpan.textContent = 'Unlike';
            if (svgIcon) { svgIcon.setAttribute('fill', 'var(--primary)'); svgIcon.setAttribute('stroke', 'var(--primary)'); }
            button.classList.add('active'); 
            button.title = "Unlike this song";
            if (trackItem) trackItem.dataset.isLiked = 'true';
            showFloatingNotification(`Liked "${data.song_title || 'the song'}".`, 'success');
        } else {
            if (textSpan) textSpan.textContent = 'Like';
            if (svgIcon) { svgIcon.setAttribute('fill', 'none'); svgIcon.setAttribute('stroke', 'currentColor');}
            button.classList.remove('active');
            button.title = "Like this song";
            if (trackItem) trackItem.dataset.isLiked = 'false';
        }
    } catch (error) {
        console.error('Player: Network/other error during like song:', error);
        showFloatingNotification('An error occurred while liking/unliking. Please try again.', 'error');
    }
}

// Call the setup function when the document is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Set up artist card listeners
    setupArtistCardListeners();
    
    // Set up playlist card listeners
    setupPlaylistCardListeners();
    
    // Rest of your existing DOMContentLoaded code...
    buildTracksList();
    
    // Setup player controls
    const playPauseButton = document.querySelector('.play-pause');
    if (playPauseButton) {
        playPauseButton.addEventListener('click', togglePlayPause);
    }
    
    // Set up progress bar for seeking
    const progressBarContainer = document.getElementById('progress-bar');
    if (progressBarContainer) {
        progressBarContainer.addEventListener('click', handleProgressBarClick);
    }
    
    // Set up Next/Previous buttons
    const nextButton = document.querySelector('.control-button[title="Next"]');
    if (nextButton) {
        nextButton.addEventListener('click', playNextTrack);
    }
    
    const prevButton = document.querySelector('.control-button[title="Previous"]');
    if (prevButton) {
        prevButton.addEventListener('click', playPreviousTrack);
    }
    const shuffleButton = document.querySelector('.control-button[title="Shuffle"]');
    if (shuffleButton) {
        shuffleButton.addEventListener('click', toggleShuffle);
    }
    
    // Set up repeat button
    const repeatButton = document.querySelector('.control-button[title="Repeat"]');
    if (repeatButton) {
        repeatButton.addEventListener('click', toggleRepeat);
    }
    
    // Volume control setup
    setupVolumeControl();

    // Setup Like Buttons
    document.querySelectorAll('.like-button').forEach(button => {
        button.addEventListener('click', handleLikeSong);
        const trackItem = button.closest('.track-item');
        const textSpan = button.querySelector('.like-button-text');
        const svgIcon = button.querySelector('svg');

        // Initialize button state based on data-is-liked from the parent .track-item,
        // but only if the data-is-liked attribute is present on the track item.
        if (trackItem && trackItem.dataset.isLiked !== undefined) {
            if (trackItem.dataset.isLiked === 'true') {
                if (textSpan) textSpan.textContent = 'Unlike';
                if (svgIcon) {
                    svgIcon.setAttribute('fill', 'var(--primary)');
                    svgIcon.setAttribute('stroke', 'var(--primary)');
                }
                button.classList.add('active');
                button.title = "Unlike this song";
            } else {
                if (textSpan) textSpan.textContent = 'Like';
                if (svgIcon) {
                    svgIcon.setAttribute('fill', 'none');
                    svgIcon.setAttribute('stroke', 'currentColor');
                }
                button.classList.remove('active');
                button.title = "Like this song";
            }
        }
    });
});

// Function to toggle shuffle mode
function toggleShuffle() {
    const shuffleButton = document.querySelector('.control-button[title="Shuffle"]');
    
    // Toggle the state
    isShuffleActive = !isShuffleActive;
    
    if (isShuffleActive) {
        // Add active class to the button (for styling)
        if (shuffleButton) shuffleButton.classList.add('active');
        
        // Store original tracks list if we haven't already
        if (originalTracksList.length === 0) {
            originalTracksList = [...tracksList];
        }
        
        // Create a shuffled copy of the tracks
        shuffleTracksList();
        
        console.log("Shuffle mode enabled");
    } else {
        // Remove active class
        if (shuffleButton) shuffleButton.classList.remove('active');
        
        // Restore original tracks order
        if (originalTracksList.length > 0) {
            tracksList = [...originalTracksList];
            
            // Update current track index to match the new order
            if (currentTrackId) {
                currentTrackIndex = tracksList.findIndex(track => track.id === currentTrackId);
            }
        }
        
        console.log("Shuffle mode disabled");
    }
}

// Function to create a shuffled version of the tracks list
function shuffleTracksList() {
    // Create a copy of the original list
    shuffledTracksList = [...tracksList];
    
    // Fisher-Yates shuffle algorithm
    for (let i = shuffledTracksList.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledTracksList[i], shuffledTracksList[j]] = [shuffledTracksList[j], shuffledTracksList[i]];
    }
    
    // Update the main tracks list to use the shuffled order
    tracksList = shuffledTracksList;
    
    // Update current track index to match the new shuffled order
    if (currentTrackId) {
        currentTrackIndex = tracksList.findIndex(track => track.id === currentTrackId);
    }
    
    console.log("Tracks have been shuffled, new order:", tracksList.map(t => t.title));
}

// Function to toggle repeat mode
function toggleRepeat() {
    const repeatButton = document.querySelector('.control-button[title="Repeat"]');
    
    // Toggle the state
    isRepeatActive = !isRepeatActive;
    
    if (isRepeatActive) {
        // Add active class to the button (for styling)
        if (repeatButton) repeatButton.classList.add('active');
        console.log("Repeat mode enabled");
    } else {
        // Remove active class
        if (repeatButton) repeatButton.classList.remove('active');
        console.log("Repeat mode disabled");
    }
}

// Modify the handleTrackEnd function to incorporate repeat functionality
function handleTrackEnd() {
    console.log("Track ended.");
    
    // If repeat is active, replay the current track
    if (isRepeatActive && currentTrackId) {
        console.log("Repeat mode active, replaying current track");
        
        // Get the current track and replay it
        const currentTrack = tracksList[currentTrackIndex];
        if (currentTrack) {
            playTrack(
                currentTrack.id, 
                currentTrack.title, 
                currentTrack.artist, 
                currentTrack.imageUrl, 
                currentTrack.audioUrl
            );
            return;
        }
    }
    
    // Normal next track behavior (keep your existing code)
    console.log("Moving to next track");
    
    // Find the next track in the list
    if (currentTrackIndex >= 0 && currentTrackIndex < tracksList.length - 1) {
        // Play the next track
        currentTrackIndex++;
        const nextTrack = tracksList[currentTrackIndex];
        console.log(`Auto-playing next track: ${nextTrack.title} (index: ${currentTrackIndex})`);
        playTrack(
            nextTrack.id, 
            nextTrack.title, 
            nextTrack.artist, 
            nextTrack.imageUrl, 
            nextTrack.audioUrl
        );
    } else {
        // No next track available, reset player
        console.log("No next track available. Playback stopped.");
        const progressBar = document.getElementById('progress');
        const currentTimeEl = document.getElementById('current-time');
        
        updatePlayerUI(false);
        if(progressBar) progressBar.style.width = '0%';
        if(currentTimeEl) currentTimeEl.textContent = formatTime(0);
    }
}

// Modify buildTracksList to store the original order
function buildTracksList() {
    tracksList = [];
    console.log("Building tracks list...");
    
    // Get all track items from the page
    const trackElements = document.querySelectorAll('.track-item');
    console.log(`Found ${trackElements.length} track elements on the page`);
    
    trackElements.forEach((trackElement, index) => {
        // Extract the onclick attribute to get the track data
        const onclickAttr = trackElement.getAttribute('onclick');
        if (onclickAttr && onclickAttr.startsWith('playTrack(')) {
            try {
                // Parse the arguments from the onclick attribute with more robust regex
                // This handles different formats of the playTrack function call
                const regex = /playTrack\(['"]([^'"]*)['"]\s*,\s*['"]([^'"]*)['"]\s*,\s*['"]([^'"]*)['"]\s*,\s*['"]([^'"]*)['"]\s*,\s*([^)]*)\)/;
                const match = onclickAttr.match(regex);
                
                if (match && match.length >= 6) {
                    const audioUrl = match[5].trim();
                    const cleanedAudioUrl = audioUrl === 'null' || audioUrl === 'None' ? null : audioUrl.replace(/['"]/g, '');
                    
                    const track = {
                        id: match[1],
                        title: match[2],
                        artist: match[3],
                        imageUrl: match[4],
                        audioUrl: cleanedAudioUrl
                    };
                    
                    tracksList.push(track);
                    console.log(`Added track: ${track.title} by ${track.artist} (ID: ${track.id})`);
                } else {
                    console.warn(`Failed to parse track data from onclick: ${onclickAttr}`);
                }
            } catch (e) {
                console.error(`Error parsing track at index ${index}:`, e);
            }
        }
    });
    
    console.log(`Built tracks list with ${tracksList.length} tracks`);
    console.log(tracksList); // Debug: Log the entire tracks list
    
    // Store original track list for shuffle functionality
    originalTracksList = [...tracksList];
}

// --- Helper Functions ---
function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

// --- Update Player UI Function ---
function updatePlayerUI(playing) {
    // Get elements fresh each time to avoid undefined errors
    const playIcon = document.getElementById('play-icon');
    const pauseIcon = document.getElementById('pause-icon');
    const playPauseButton = document.querySelector('.play-pause');
    
    // Update global state without redeclaring
    isPlaying = playing;
    
    // Update UI elements if they exist
    if (playing) {
        if(playIcon) playIcon.style.display = 'none';
        if(pauseIcon) pauseIcon.style.display = 'block';
        if(playPauseButton) playPauseButton.title = 'Pause';
    } else {
        if(playIcon) playIcon.style.display = 'block';
        if(pauseIcon) pauseIcon.style.display = 'none';
        if(playPauseButton) playPauseButton.title = 'Play';
    }
}

// --- Audio Event Handlers ---
function updateProgress() {
    if (!currentAudio || isNaN(currentAudio.duration) || currentAudio.duration <= 0) return;
    const percentage = (currentAudio.currentTime / currentAudio.duration) * 100;
    const progressBar = document.getElementById('progress');
    const currentTimeEl = document.getElementById('current-time');
    
    if(progressBar) progressBar.style.width = `${percentage}%`;
    if(currentTimeEl) currentTimeEl.textContent = formatTime(currentAudio.currentTime);
}

function setTotalTime() {
    const totalTimeEl = document.getElementById('total-time');
    if (!currentAudio || isNaN(currentAudio.duration) || currentAudio.duration <= 0) {
        if(totalTimeEl) totalTimeEl.textContent = "0:00";
        return;
    }
    if(totalTimeEl) totalTimeEl.textContent = formatTime(currentAudio.duration);
}


// --- Main Play Function ---
function playTrack(id, title, artist, imageUrl, audioUrl) {
    console.log(`playTrack function called! ID: ${id}, Title: ${title}`);
    
    // Update the current track index when a new track is played
    const trackIndex = tracksList.findIndex(track => track.id === id);
    console.log(`Track index found: ${trackIndex} (Previous index: ${currentTrackIndex})`);
    
    if (trackIndex !== -1) {
        currentTrackIndex = trackIndex;
    } else {
        console.warn(`Track ${id} not found in tracks list. This might cause issues with next/previous.`);
    }
    
    // Get DOM elements when needed
    const playerTitleEl = document.querySelector('.now-playing-title');
    const playerArtistEl = document.querySelector('.now-playing-artist');
    const playerImageEl = document.querySelector('.now-playing-image');
    const progressBar = document.getElementById('progress');
    const currentTimeEl = document.getElementById('current-time');
    const totalTimeEl = document.getElementById('total-time');

    // Check if player elements exist
    if (!playerTitleEl || !playerArtistEl || !playerImageEl) {
        console.error("Essential player UI elements not found!");
        return;
    }

    console.log(`Attempting to play track: ${title} by ${artist} (ID: ${id})`);
    console.log(`Audio URL: ${audioUrl}`);

    // Check if a valid audio URL is provided
    if (!audioUrl || audioUrl === 'null' || audioUrl === 'None') {
        console.warn("No valid audio URL provided for this track.");
        playerTitleEl.textContent = title;
        playerArtistEl.textContent = artist + " (Preview N/A)";
        
        if (imageUrl) {
            playerImageEl.style.backgroundImage = `url('${imageUrl}')`;
        } else {
            playerImageEl.style.backgroundImage = `url('https://placehold.co/56x56/333333/CCCCCC?text=?')`;
        }
        playerImageEl.style.backgroundSize = 'cover';
        playerImageEl.innerHTML = '';
        
        if (currentAudio) {
            currentAudio.pause();
        }
        
        updatePlayerUI(false);
        if(progressBar) progressBar.style.width = '0%';
        if(currentTimeEl) currentTimeEl.textContent = formatTime(0);
        if(totalTimeEl) totalTimeEl.textContent = formatTime(0);
        currentTrackId = id;
        return;
    }

    // Update Player Display
    playerTitleEl.textContent = title;
    playerArtistEl.textContent = artist;
    
    if (imageUrl) {
        playerImageEl.style.backgroundImage = `url('${imageUrl}')`;
    } else {
        playerImageEl.style.backgroundImage = `url('https://placehold.co/56x56/333333/CCCCCC?text=?')`;
    }
    playerImageEl.style.backgroundSize = 'cover';
    playerImageEl.innerHTML = '';

    // Handle Resume Play case
    if (currentAudio && currentTrackId === id && currentAudio.paused) {
        currentAudio.play().then(() => {
            updatePlayerUI(true);
            console.log("Resumed playback.");
        }).catch(e => console.error("Audio resume error:", e));
        return;
    }

    // Clean up existing audio if any
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.removeEventListener('timeupdate', updateProgress);
        currentAudio.removeEventListener('loadedmetadata', setTotalTime);
        currentAudio.removeEventListener('ended', handleTrackEnd);
        currentAudio.removeEventListener('error', handleAudioError);
        currentAudio.removeEventListener('play', handleAudioPlay);
        currentAudio.removeEventListener('pause', handleAudioPause);
    }

    // Create a new Audio object for the new track
    currentAudio = new Audio(audioUrl);
    currentTrackId = id;
    
    // Apply the user's volume setting to the new audio object
    currentAudio.volume = userVolume;
    currentAudio.muted = false; // Ensure it's not muted by default

    // Add event listeners
    currentAudio.addEventListener('timeupdate', updateProgress);
    currentAudio.addEventListener('loadedmetadata', setTotalTime);
    currentAudio.addEventListener('ended', handleTrackEnd);
    currentAudio.addEventListener('error', handleAudioError);
    currentAudio.addEventListener('play', handleAudioPlay);
    currentAudio.addEventListener('pause', handleAudioPause);

    // Attempt to play
    currentAudio.play().then(() => {
        updatePlayerUI(true);
        console.log("Playback started with volume:", currentAudio.volume);
    }).catch(e => {
        console.error("Audio playback error on initial play:", e);
        updatePlayerUI(false);
    });
}

function handleAudioError(e) {
    console.error("Audio Error Event:", e);
    console.error("Audio Error Code:", currentAudio.error?.code);
    console.error("Audio Network State:", currentAudio.networkState);
    
    const totalTimeEl = document.getElementById('total-time');
    updatePlayerUI(false);
    if(totalTimeEl) totalTimeEl.textContent = "Error";
}

function handleAudioPlay() {
    updatePlayerUI(true);
}

function handleAudioPause() {
    updatePlayerUI(false);
}

function playNextTrack() {
    if (currentTrackIndex >= 0 && currentTrackIndex < tracksList.length - 1) {
        currentTrackIndex++;
        const nextTrack = tracksList[currentTrackIndex];
        console.log(`Playing next track: ${nextTrack.title} (index: ${currentTrackIndex})`);
        playTrack(
            nextTrack.id, 
            nextTrack.title, 
            nextTrack.artist, 
            nextTrack.imageUrl, 
            nextTrack.audioUrl
        );
    } else {
        console.log("No next track available");
    }
}

function playPreviousTrack() {
    if (currentTrackIndex > 0) {
        currentTrackIndex--;
        const prevTrack = tracksList[currentTrackIndex];
        console.log(`Playing previous track: ${prevTrack.title} (index: ${currentTrackIndex})`);
        playTrack(
            prevTrack.id, 
            prevTrack.title, 
            prevTrack.artist, 
            prevTrack.imageUrl, 
            prevTrack.audioUrl
        );
    } else {
        console.log("No previous track available");
    }
}

// Toggle play/pause
function togglePlayPause() {
    if (!currentAudio || !currentAudio.src || currentAudio.src === window.location.href) {
        console.log("No valid track loaded to play/pause.");
        return;
    }
    
    if (isPlaying) {
        currentAudio.pause();
        console.log("Paused via button.");
    } else {
        if (currentAudio.readyState >= 2) {
            currentAudio.play().then(() => {
                console.log("Played via button.");
            }).catch(e => {
                console.error("Audio play error on button click:", e);
                updatePlayerUI(false);
            });
        } else {
            console.log("Audio not ready to play yet via button.");
        }
    }
}

// Handle progress bar click for seeking
function handleProgressBarClick(e) {
    if (!currentAudio || isNaN(currentAudio.duration) || currentAudio.duration <= 0 || !currentAudio.seekable || currentAudio.seekable.length === 0) {
        console.log("Cannot seek: No audio, duration invalid, or not seekable.");
        return;
    }

    const progressBar = document.getElementById('progress');
    const currentTimeEl = document.getElementById('current-time');
    const bounds = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - bounds.left;
    const percentage = Math.max(0, Math.min(1, (clickX / bounds.width)));
    const seekTime = percentage * currentAudio.duration;

    if (seekTime >= currentAudio.seekable.start(0) && seekTime <= currentAudio.seekable.end(0)) {
        console.log(`Seeking to ${formatTime(seekTime)} (${(percentage * 100).toFixed(1)}%)`);
        currentAudio.currentTime = seekTime;
        
        if(progressBar) progressBar.style.width = `${percentage * 100}%`;
        if(currentTimeEl) currentTimeEl.textContent = formatTime(seekTime);
    } else {
        console.warn(`Seek time ${seekTime} is outside the seekable range (${currentAudio.seekable.start(0)} - ${currentAudio.seekable.end(0)})`);
    }
}



// Setup volume controls
function setupVolumeControl() {
    const volumeButton = document.querySelector('.volume-button');
    const volumeIcon = document.getElementById('volume-icon');
    const volumeMuteIcon = document.getElementById('volume-mute-icon');
    const volumeBar = document.getElementById('volume-bar');
    
    if (volumeButton && volumeBar) {
        let isMuted = false;
        
        // Volume bar click handler
        volumeBar.addEventListener('click', function(e) {
            if (!currentAudio) return;
            
            const rect = volumeBar.getBoundingClientRect();
            const clickPos = e.clientX - rect.left;
            const newVolume = Math.max(0, Math.min(1, clickPos / rect.width));
            
            // Update our global volume variable
            userVolume = newVolume;
            
            // Apply to current audio
            currentAudio.volume = newVolume;
            currentAudio.muted = false;
            
            console.log(`Volume set to: ${newVolume.toFixed(2)}`);
            updateVolumeUI();
        });
        
        // Mute toggle
        volumeButton.addEventListener('click', function() {
            if (!currentAudio) return;
            
            if (currentAudio.muted) {
                currentAudio.muted = false;
                currentAudio.volume = userVolume > 0 ? userVolume : 0.1;
                if (userVolume === 0) {
                    userVolume = 0.1;
                }
            } else {
                currentAudio.muted = true;
            }
            
            console.log(`Mute toggled: ${currentAudio.muted}`);
            updateVolumeUI();
        });
        
        // Update volume UI based on current audio state
        function updateVolumeUI() {
            if (!currentAudio) return;
            
            const volumeLevel = document.getElementById('volume-level');
            if (!volumeLevel) return;
            
            if (currentAudio.muted) {
                volumeIcon.style.display = 'none';
                volumeMuteIcon.style.display = 'block';
                volumeLevel.style.width = '0%';
            } else {
                volumeIcon.style.display = 'block';
                volumeMuteIcon.style.display = 'none';
                volumeLevel.style.width = (currentAudio.volume * 100) + '%';
            }
        }
    }
}
