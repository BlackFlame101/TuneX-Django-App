let isShuffleActive = false; 
let isRepeatActive = false; 
let originalTracksList = []; 
let shuffledTracksList = []; 

document.addEventListener('DOMContentLoaded', function() {     
    const shuffleButton = document.querySelector('.control-button[title="Shuffle"]');
    if (shuffleButton) {
        shuffleButton.addEventListener('click', toggleShuffle);
    }
    
    const repeatButton = document.querySelector('.control-button[title="Repeat"]');
    if (repeatButton) {
        repeatButton.addEventListener('click', toggleRepeat);
    }
});

function toggleShuffle() {
    const shuffleButton = document.querySelector('.control-button[title="Shuffle"]');
    
    
    isShuffleActive = !isShuffleActive;
    
    if (isShuffleActive) {
        
        if (shuffleButton) shuffleButton.classList.add('active');
        
        if (originalTracksList.length === 0) {
            originalTracksList = [...tracksList];
        }
        
        shuffleTracksList();
        
        console.log("Shuffle mode enabled");
    } else {
        if (shuffleButton) shuffleButton.classList.remove('active');  
        
        if (originalTracksList.length > 0) {
            tracksList = [...originalTracksList];  
            
            if (currentTrackId) {
                currentTrackIndex = tracksList.findIndex(track => track.id === currentTrackId);
            }
        }
        
        console.log("Shuffle mode disabled");
    }
}


function shuffleTracksList() {
    
    shuffledTracksList = [...tracksList];
    
    
    for (let i = shuffledTracksList.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledTracksList[i], shuffledTracksList[j]] = [shuffledTracksList[j], shuffledTracksList[i]];
    }
    
    
    tracksList = shuffledTracksList;
    
    
    if (currentTrackId) {
        currentTrackIndex = tracksList.findIndex(track => track.id === currentTrackId);
    }
    
    console.log("Tracks have been shuffled, new order:", tracksList.map(t => t.title));
}


function toggleRepeat() {
    const repeatButton = document.querySelector('.control-button[title="Repeat"]');
    
    
    isRepeatActive = !isRepeatActive;
    
    if (isRepeatActive) {
        
        if (repeatButton) repeatButton.classList.add('active');
        console.log("Repeat mode enabled");
    } else {
        
        if (repeatButton) repeatButton.classList.remove('active');
        console.log("Repeat mode disabled");
    }
}


function handleTrackEnd() {
    console.log("Track ended.");
    
    
    if (isRepeatActive && currentTrackId) {
        console.log("Repeat mode active, replaying current track");
        
        
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
    
    
    console.log("Moving to next track");
    
    
    if (currentTrackIndex >= 0 && currentTrackIndex < tracksList.length - 1) {
        
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
        
        console.log("No next track available. Playback stopped.");
        const progressBar = document.getElementById('progress');
        const currentTimeEl = document.getElementById('current-time');
        
        updatePlayerUI(false);
        if(progressBar) progressBar.style.width = '0%';
        if(currentTimeEl) currentTimeEl.textContent = formatTime(0);
    }
}


function buildTracksList() {
    tracksList = [];
    console.log("Building tracks list...");
    
    
    const trackElements = document.querySelectorAll('.track-item');
    console.log(`Found ${trackElements.length} track elements on the page`);
    
    trackElements.forEach((trackElement, index) => {
        
        const onclickAttr = trackElement.getAttribute('onclick');
        if (onclickAttr && onclickAttr.startsWith('playTrack(')) {
            try { 
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
    console.log(tracksList); 
    
    
    originalTracksList = [...tracksList];
}


