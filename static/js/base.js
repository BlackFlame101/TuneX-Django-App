// Add these variables to your global state section at the top
let isShuffleActive = false; // Track if shuffle mode is active
let isRepeatActive = false; // Track if repeat mode is active
let originalTracksList = []; // Store the original order of tracks
let shuffledTracksList = []; // Store shuffled version of tracks

// Add this to your DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', function() {
    // ... your existing code ...
    
    // Set up shuffle button
    const shuffleButton = document.querySelector('.control-button[title="Shuffle"]');
    if (shuffleButton) {
        shuffleButton.addEventListener('click', toggleShuffle);
    }
    
    // Set up repeat button
    const repeatButton = document.querySelector('.control-button[title="Repeat"]');
    if (repeatButton) {
        repeatButton.addEventListener('click', toggleRepeat);
    }
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

// Also modify the playNextTrack and playPreviousTrack functions to respect shuffle mode
// (These functions stay mostly the same, as they use the current tracksList order which will be shuffled if shuffle is active)