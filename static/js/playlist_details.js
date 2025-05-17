// --- Player State & Elements ---
let currentAudio = null; // Holds the current Audio object
let isPlaying = false; // Declare isPlaying ONCE globally
let currentTrackId = null; // Keep track of the playing track ID
let tracksList = []; // Will store all track data
let currentTrackIndex = -1; 
let userVolume = 0.7; // Store user's preferred volume globally
let isShuffleActive = false;
let isRepeatActive = false;
let originalTracksList = [];
let shuffledTracksList = [];

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
    
    // Volume control setup
    setupVolumeControl();
    const shuffleButton = document.querySelector('.control-button[title="Shuffle"]');
    if (shuffleButton) {
        shuffleButton.addEventListener('click', toggleShuffle);
    }
    
    // Set up repeat button
    const repeatButton = document.querySelector('.control-button[title="Repeat"]');
    if (repeatButton) {
        repeatButton.addEventListener('click', toggleRepeat);
    }

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


// --- Build Playlist Tracks List for Player ---
function buildPlaylistTracksList() {
    tracksList = []; // Reset for the current playlist context
    console.log("PlaylistDetails.js: Building playlist tracks list...");
    // Ensure we are selecting tracks only from the playlist tracks section
    const trackElements = document.querySelectorAll('.playlist-tracks .track-item');
    console.log(`PlaylistDetails.js: Found ${trackElements.length} track elements in playlist.`);

    trackElements.forEach((el, index) => {
        const onclickAttr = el.getAttribute('onclick');
        if (onclickAttr && onclickAttr.startsWith('playTrack(')) {
            try {
                // Robust regex to parse arguments, handling escaped quotes and null/None
                const regex = /playTrack\s*\(\s*['"]([^'"]*)['"]\s*,\s*['"]((?:\\.|[^"\\])*)['"]\s*,\s*['"]((?:\\.|[^"\\])*)['"]\s*,\s*['"]([^'"]*)['"]\s*,\s*(['"]?(?:null|None|[^'"]*)['"]?)\s*\)/;
                const match = onclickAttr.match(regex);

                if (match && match.length >= 6) {
                    const audioUrlRaw = match[5].trim();
                    const cleanedAudioUrl = (audioUrlRaw === 'null' || audioUrlRaw === 'None' || audioUrlRaw === "''" || audioUrlRaw === '""') ? null : audioUrlRaw.replace(/^['"]|['"]$/g, '');

                    tracksList.push({
                        id: match[1],
                        title: match[2].replace(/\\'/g, "'").replace(/\\"/g, '"'), // Unescape
                        artist: match[3].replace(/\\'/g, "'").replace(/\\"/g, '"'), // Unescape
                        imageUrl: match[4],
                        audioUrl: cleanedAudioUrl
                    });
                } else {
                    console.warn(`PlaylistDetails.js: Incorrect args format or match failed for track ${index}:`, onclickAttr);
                }
            } catch (e) {
                console.error(`PlaylistDetails.js: Error parsing track ${index}:`, e, `Onclick: ${onclickAttr}`);
            }
        }
    });
    console.log(`PlaylistDetails.js: Built playlist tracks list with ${tracksList.length} tracks:`, tracksList.length > 0 ? tracksList[0] : 'Empty');
}

// --- Player Functions (Potentially overriding global ones or being playlist-specific) ---
// It's crucial to decide if these functions (playTrack, playNextTrack, etc.)
// should be global (in base.js or a dedicated player.js) or page-specific.
// If they are page-specific, they need to correctly interact with the global player UI elements.

// Assuming playTrack, updatePlayerUI, formatTime, etc., are globally available
// (e.g., from artist_profile.js or a shared player.js if those are loaded first and globally scoped)
// If not, their definitions would need to be included or imported here.

// For this example, we'll redefine playNextTrack and playPreviousTrack to use the playlist's `tracksList`.

function playNextTrackPlaylistContext() { // Renamed to avoid conflict if global exists
    if (tracksList.length === 0) {
        console.log("PlaylistDetails.js: No tracks in this playlist to play next.");
        if (typeof updatePlayerUI === 'function') updatePlayerUI(false);
        return;
    }
    currentTrackIndex = (currentTrackIndex + 1) % tracksList.length; // Loop to start
    const nextTrack = tracksList[currentTrackIndex];
    if (nextTrack) {
        console.log(`PlaylistDetails.js: Playing next track in playlist: ${nextTrack.title}`);
        if (typeof playTrack === 'function') {
            playTrack(nextTrack.id, nextTrack.title, nextTrack.artist, nextTrack.imageUrl, nextTrack.audioUrl);
        } else {
            console.error("PlaylistDetails.js: Global playTrack function is not defined.");
        }
    } else {
        console.log("PlaylistDetails.js: End of playlist or issue finding next track.");
        if (typeof updatePlayerUI === 'function') updatePlayerUI(false); // Stop playback
    }
}

function playPreviousTrackPlaylistContext() { // Renamed
    if (tracksList.length === 0) {
        console.log("PlaylistDetails.js: No tracks in this playlist to play previous.");
        return;
    }
    currentTrackIndex = (currentTrackIndex - 1 + tracksList.length) % tracksList.length; // Loop to end
    const prevTrack = tracksList[currentTrackIndex];
    if (prevTrack) {
        console.log(`PlaylistDetails.js: Playing previous track in playlist: ${prevTrack.title}`);
        if (typeof playTrack === 'function') {
            playTrack(prevTrack.id, prevTrack.title, prevTrack.artist, prevTrack.imageUrl, prevTrack.audioUrl);
        } else {
            console.error("PlaylistDetails.js: Global playTrack function is not defined.");
        }
    } else {
        console.log("PlaylistDetails.js: Start of playlist or issue finding previous track.");
    }
}


// --- DOMContentLoaded Event Listener ---
document.addEventListener('DOMContentLoaded', function() {
    console.log("PlaylistDetails.js: DOMContentLoaded.");
    buildPlaylistTracksList(); // Build this playlist's specific track list

    // Attach or ensure player control event listeners are set up.
    // If player controls are handled globally (e.g., in base.js or a dedicated player.js),
    // you might only need to ensure that the `tracksList` and `currentTrackIndex` used by
    // global next/prev functions are updated or that playlist-specific next/prev are called.

    const nextButton = document.querySelector('.control-button[title="Next"]');
    const prevButton = document.querySelector('.control-button[title="Previous"]');

    if (nextButton) {
        // Remove any existing listener to avoid multiple calls if base.js also adds one
        // This is a common issue with multiple scripts trying to control the same elements.
        // A more robust solution involves a single player manager.
        // nextButton.removeEventListener('click', someGlobalNextFunction); // If you know its name
        nextButton.addEventListener('click', playNextTrackPlaylistContext);
        console.log("PlaylistDetails.js: Attached playlist-specific next button listener.");
    }

    if (prevButton) {
        // prevButton.removeEventListener('click', someGlobalPrevFunction);
        prevButton.addEventListener('click', playPreviousTrackPlaylistContext);
        console.log("PlaylistDetails.js: Attached playlist-specific previous button listener.");
    }

    // Other player controls (play/pause, progress bar, volume) are assumed to be
    // handled by a global script (like artist_profile.js or a shared player.js)
    // that uses window.currentAudio, window.playTrack etc.
    // If those global functions correctly use the `tracksList` and `currentTrackIndex`
    // that this script populates (e.g., by also making them global or passing them),
    // then it should work.

    // Example: if playTrack is global and uses a global currentTrackIndex
    // when a track is played from this page, ensure currentTrackIndex is set correctly.
    // The `playTrack` function itself (if global) would need to update the global `currentTrackIndex`
    // based on the `tracksList` relevant to the page it was called from. This is complex.

    // A simpler model for now: `playTrack` is global. Next/Prev on this page use playlist context.
    // When a track is clicked, the global `playTrack` is called.
    // It needs to know which `tracksList` to use for context if it's going to set `currentTrackIndex`.
    // One way: the `playTrack` function could accept the `tracksList` as an argument,
    // or it could try to find the relevant `tracksList` (e.g., `window.activeTracksList`).

    // For now, the `playTrack` calls from HTML directly invoke the global `playTrack`.
    // The `playNextTrackPlaylistContext` and `playPreviousTrackPlaylistContext` use the local `tracksList`.
    // This means `currentTrackIndex` needs to be updated correctly when `playTrack` is called.
    // The global `playTrack` function (e.g., in artist_profile.js) should be modified:
    // if (window.currentPageTracksList && window.currentPageTracksList.length > 0) {
    //     const trackIndex = window.currentPageTracksList.findIndex(t => t.id === id);
    //     if (trackIndex !== -1) window.currentGlobalTrackIndex = trackIndex;
    // }
    // And this script would set:
    // window.currentPageTracksList = tracksList;
    // window.currentGlobalTrackIndex = currentTrackIndex; // (or manage index locally)

    // This highlights the need for a more centralized player state management.

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

// Make this playlist's track list available globally if needed by a global player
// This is a common pattern but can lead to global namespace pollution.
// Consider an event-based system or a dedicated player state manager.
// window.currentPageTracksList = tracksList;
// window.currentPlaylistTrackIndex = currentTrackIndex; // For global player to use
