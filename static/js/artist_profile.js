let currentAudio = window.currentAudio || null;
let isPlaying = window.isPlaying || false;
let currentTrackId = window.currentTrackId || null;
let tracksList = window.tracksList || []; 
let currentTrackIndex = window.currentTrackIndex || -1;
let isShuffleActive = window.isShuffleActive || false;
let isRepeatActive = window.isRepeatActive || false;
let originalTracksList = window.originalTracksList || [];
let unmutedVolume = 0.7; 


function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

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


function updatePlayerUI(playing) {
    const playIcon = document.getElementById('play-icon');
    const pauseIcon = document.getElementById('pause-icon');
    const playPauseButton = document.querySelector('.play-pause');

    window.isPlaying = playing; 
    isPlaying = playing; 

    if (playing) {
        if (playIcon) playIcon.style.display = 'none';
        if (pauseIcon) pauseIcon.style.display = 'block';
        if (playPauseButton) playPauseButton.title = 'Pause';
    } else {
        if (playIcon) playIcon.style.display = 'block';
        if (pauseIcon) pauseIcon.style.display = 'none';
        if (playPauseButton) playPauseButton.title = 'Play';
    }
}


function updateVolumeUI() {
    const volumeLevel = document.getElementById('volume-level');
    const volumeIcon = document.getElementById('volume-icon');
    const volumeMuteIcon = document.getElementById('volume-mute-icon');

    if (!volumeLevel || !volumeIcon || !volumeMuteIcon) return;
    const audio = window.currentAudio;
    
    const volToShow = audio && !audio.muted ? audio.volume : unmutedVolume;
    const mutedState = audio ? audio.muted : (unmutedVolume === 0); 

    if (mutedState) {
        volumeIcon.style.display = 'none';
        volumeMuteIcon.style.display = 'block';
        volumeLevel.style.width = '0%';
    } else {
        volumeIcon.style.display = 'block';
        volumeMuteIcon.style.display = 'none';
        volumeLevel.style.width = `${volToShow * 100}%`;
    }
}



function playTrackInternal(id, title, artistName, imageUrl, audioUrl, durationFormatted = "0:00") {
    console.log(`Player: playTrackInternal called! ID: ${id}, Title: ${title}, Duration: ${durationFormatted}`);
    console.log(`Player: Attempting to play audio from URL: "${audioUrl}" for track "${title}"`);

    const trackIndex = window.tracksList.findIndex(track => String(track.id) === String(id));
    if (trackIndex !== -1) {
        window.currentTrackIndex = trackIndex;
        currentTrackIndex = trackIndex; 
    } else {
        console.warn(`Player: Track ${id} ('${title}') not found in current window.tracksList.`);
        window.currentTrackIndex = -1; 
        currentTrackIndex = -1;
    }

    const playerTitleEl = document.querySelector('.now-playing-title');
    const playerArtistEl = document.querySelector('.now-playing-artist');
    const playerImageEl = document.querySelector('.now-playing-image');
    const totalTimeEl = document.getElementById('total-time');

    if (!playerTitleEl || !playerArtistEl || !playerImageEl) {
        console.error("Player: Essential player UI elements not found!");
        return;
    }

    playerTitleEl.textContent = title;
    playerArtistEl.textContent = artistName;
    playerImageEl.style.backgroundImage = `url('${imageUrl || 'https://placehold.co/56x56/333333/CCCCCC?text=?'}')`;
    playerImageEl.style.backgroundSize = 'cover'; 
    playerImageEl.style.backgroundPosition = 'center';
    playerImageEl.style.backgroundRepeat = 'no-repeat';

    if (!audioUrl || audioUrl === 'null' || audioUrl === 'None') {
        console.warn(`Player: No valid audio URL for track: ${title}.`);
        playerArtistEl.textContent = artistName + " (Preview N/A)";
        if (window.currentAudio) window.currentAudio.pause();
        updatePlayerUI(false);
        if (document.getElementById('progress')) document.getElementById('progress').style.width = '0%';
        if (document.getElementById('current-time')) document.getElementById('current-time').textContent = formatTime(0);
        if (totalTimeEl) totalTimeEl.textContent = durationFormatted || formatTime(0);
        
        window.currentTrackId = id; 
        currentTrackId = id; 
        return;
    }

    if (window.currentAudio && String(window.currentTrackId) === String(id) && window.currentAudio.paused) {
        window.currentAudio.play().then(() => updatePlayerUI(true)).catch(e => console.error("Player: Audio resume error:", e));
        return;
    }

    if (window.currentAudio) {
        window.currentAudio.pause();
        window.currentAudio.src = ""; 
        window.currentAudio.removeEventListener('timeupdate', updateProgress);
        window.currentAudio.removeEventListener('loadedmetadata', setTotalTime);
        window.currentAudio.removeEventListener('ended', handleTrackEnd);
        window.currentAudio.removeEventListener('error', handleAudioError);
        window.currentAudio.removeEventListener('play', handleAudioPlay);
        window.currentAudio.removeEventListener('pause', handleAudioPause);
        window.currentAudio.load(); 
    }

    const newAudio = new Audio(audioUrl);
    window.currentAudio = newAudio; 
    currentAudio = newAudio;      

    window.currentTrackId = id;   
    currentTrackId = id;        

    
    
    if (typeof unmutedVolume !== 'undefined') {
        newAudio.volume = unmutedVolume;
        
        updateVolumeUI(); 
    } else {
        
        newAudio.volume = 0.7; 
    }


    newAudio.addEventListener('timeupdate', updateProgress);
    newAudio.addEventListener('loadedmetadata', setTotalTime);
    newAudio.addEventListener('ended', handleTrackEnd);
    newAudio.addEventListener('error', handleAudioError);
    newAudio.addEventListener('play', handleAudioPlay);
    newAudio.addEventListener('pause', handleAudioPause);
    if (window.isRepeatActive) newAudio.loop = true;

    if (totalTimeEl && durationFormatted && durationFormatted !== "0:00") {
        totalTimeEl.textContent = durationFormatted;
    } else if (totalTimeEl) {
        totalTimeEl.textContent = "0:00";
    }
    
    newAudio.play()
        .then(() => updatePlayerUI(true))
        .catch(e => {
            console.error("Player: Audio playback error on initial play:", e);
            updatePlayerUI(false);
            if (totalTimeEl) totalTimeEl.textContent = "Error";
        });
}


function updateProgress() {
    if (!window.currentAudio || isNaN(window.currentAudio.duration) || window.currentAudio.duration <= 0) return;
    const percentage = (window.currentAudio.currentTime / window.currentAudio.duration) * 100;
    const progressBar = document.getElementById('progress');
    const currentTimeEl = document.getElementById('current-time');
    if (progressBar) progressBar.style.width = `${percentage}%`;
    if (currentTimeEl) currentTimeEl.textContent = formatTime(window.currentAudio.currentTime);
}

function setTotalTime() {
    const totalTimeEl = document.getElementById('total-time');
    if (!window.currentAudio || isNaN(window.currentAudio.duration) || window.currentAudio.duration <= 0) {
        if (totalTimeEl) totalTimeEl.textContent = "0:00";
        return;
    }
    if (totalTimeEl) totalTimeEl.textContent = formatTime(window.currentAudio.duration);
}

function handleTrackEnd() {
    console.log("Player: Track ended.");
    const activeTrackList = window.tracksList || [];
    const currentIdx = window.currentTrackIndex !== -1 ? window.currentTrackIndex : -1;

    if (window.isRepeatActive && window.currentTrackId && currentIdx !== -1 && activeTrackList[currentIdx]) {
        const currentTrack = activeTrackList[currentIdx];
        playTrackInternal(currentTrack.id, currentTrack.title, currentTrack.artist, currentTrack.imageUrl, currentTrack.audioUrl, currentTrack.duration_formatted);
        return;
    }
    playNextTrack();
}

function handleAudioError(e) {
    console.error("Player: Audio Error Event:", e);
    if (window.currentAudio) {
        console.error("Player: Audio Error Code:", window.currentAudio.error?.code);
        console.error("Player: Audio Network State:", window.currentAudio.networkState);
    }
    updatePlayerUI(false);
    if (document.getElementById('total-time')) document.getElementById('total-time').textContent = "Error";
}
function handleAudioPlay() { updatePlayerUI(true); }
function handleAudioPause() { updatePlayerUI(false); }


function playNextTrack() {
    const activeTrackList = window.tracksList || [];
    if (activeTrackList.length === 0) { updatePlayerUI(false); return; }
    let nextIndex = (window.currentTrackIndex !== -1 ? window.currentTrackIndex : -1) + 1;

    if (nextIndex >= activeTrackList.length) {
        if (window.isRepeatActive && activeTrackList.length > 0) { nextIndex = 0; } 
        else {
            updatePlayerUI(false);
            if(document.getElementById('progress')) document.getElementById('progress').style.width = '0%';
            if(document.getElementById('current-time')) document.getElementById('current-time').textContent = formatTime(0);
            return;
        }
    }
    const nextTrack = activeTrackList[nextIndex];
    if (nextTrack) {
        playTrackInternal(nextTrack.id, nextTrack.title, nextTrack.artist, nextTrack.imageUrl, nextTrack.audioUrl, nextTrack.duration_formatted);
    } else { updatePlayerUI(false); }
}

function playPreviousTrack() {
    const activeTrackList = window.tracksList || [];
    if (activeTrackList.length === 0) return;
    let prevIndex = (window.currentTrackIndex !== -1 ? window.currentTrackIndex : 0) - 1;

    if (prevIndex < 0) {
        if (window.isRepeatActive && activeTrackList.length > 0) { prevIndex = activeTrackList.length - 1; } 
        else { return; }
    }
    const prevTrack = activeTrackList[prevIndex];
    if (prevTrack) {
        playTrackInternal(prevTrack.id, prevTrack.title, prevTrack.artist, prevTrack.imageUrl, prevTrack.audioUrl, prevTrack.duration_formatted);
    }
}

function togglePlayPause() {
    const audioToToggle = window.currentAudio;
    const activeTrackList = window.tracksList || [];

    if (!audioToToggle || !audioToToggle.src || audioToToggle.src === window.location.href) {
        if (activeTrackList.length > 0) {
            const firstTrack = activeTrackList[0];
            if (firstTrack) {
                playTrackInternal(firstTrack.id, firstTrack.title, firstTrack.artist, firstTrack.imageUrl, firstTrack.audioUrl, firstTrack.duration_formatted);
            }
        }
        return;
    }
    if (window.isPlaying) audioToToggle.pause();
    else audioToToggle.play().catch(e => console.error("Player: Play error on toggle:", e));
}

function handleProgressBarClick(e) {
    if (!window.currentAudio || isNaN(window.currentAudio.duration) || window.currentAudio.duration <= 0 || !window.currentAudio.seekable || window.currentAudio.seekable.length === 0) return;
    const progressBarEl = e.currentTarget; 
    const bounds = progressBarEl.getBoundingClientRect();
    const clickX = e.clientX - bounds.left;
    const percentage = Math.max(0, Math.min(1, (clickX / bounds.width)));
    const seekTime = percentage * window.currentAudio.duration;
    if (window.currentAudio.seekable.length > 0 && seekTime >= window.currentAudio.seekable.start(0) && seekTime <= window.currentAudio.seekable.end(0)) {
        window.currentAudio.currentTime = seekTime;
    }
}


function buildTracksListFromPage(selector, pageType = "generic") {
    let newTracks = [];
    console.log(`Player: Building tracks list for ${pageType} using selector: ${selector}`);
    const trackElements = document.querySelectorAll(selector);
    console.log(`Player: Found ${trackElements.length} track elements for ${pageType}.`);

    trackElements.forEach((trackElement) => {
        let trackData = {};
        const onclickAttr = trackElement.getAttribute('onclick');

        
        console.log(`Player: Processing track element with onclick: ${onclickAttr}`);

        if (onclickAttr && onclickAttr.includes('playTrackGlobal')) { 
             try {
                
                const regex = /playTrackGlobal\s*\(\s*['"]?([^'"\s]+)['"]?\s*,\s*['"]((?:\\.|[^"\\])*)['"]\s*,\s*['"]((?:\\.|[^"\\])*)['"]\s*,\s*['"]([^'"]*)['"]\s*,\s*(['"]?(?:null|None|[^'"]*)['"]?)\s*,\s*(['"]?([^'"]*)['"]?)?\s*\)/;
                const match = onclickAttr.match(regex);
                if (match && match.length >= 6) {
                    const audioUrlRaw = match[5].trim();
                    trackData = {
                        id: match[1],
                        title: match[2].replace(/\\'/g, "'").replace(/\\"/g, '"'),
                        artist: match[3].replace(/\\'/g, "'").replace(/\\"/g, '"'),
                        imageUrl: match[4],
                        audioUrl: (audioUrlRaw === 'null' || audioUrlRaw === 'None' || audioUrlRaw === "''" || audioUrlRaw === '""') ? null : audioUrlRaw.replace(/^['"]|['"]$/g, ''),
                        duration_formatted: match[7] ? match[7].replace(/^['"]|['"]$/g, '') : "0:00",
                        is_liked: trackElement.dataset.isLiked === 'true'
                    };
                } else { 
                    console.warn(`Player: Regex failed to parse onclick for playTrackGlobal: ${onclickAttr}`);
                    return; 
                }
            } catch (e) { console.error(`Player: Error parsing track from onclick at element:`,trackElement, e); return; }
        } else {
            console.warn("Player: Could not find playTrackGlobal in onclick for element:", trackElement, " Attempting data attributes.");
            
            trackData.id = trackElement.dataset.trackId;
            trackData.title = trackElement.dataset.trackTitle || trackElement.querySelector('.track-title')?.textContent.trim() || "Unknown Title";
            trackData.artist = trackElement.dataset.trackArtist || trackElement.querySelector('.track-artist')?.textContent.trim() || "Unknown Artist";
            trackData.imageUrl = trackElement.dataset.trackImageurl || trackElement.querySelector('.track-image')?.style.backgroundImage.slice(5, -2) || "";
            trackData.audioUrl = trackElement.dataset.trackAudiourl;
            trackData.duration_formatted = trackElement.dataset.trackDurationFormatted || trackElement.querySelector('.track-duration')?.textContent.trim() || "0:00";
            trackData.is_liked = trackElement.dataset.isLiked === 'true';
        }
        
        if (trackData.id && trackData.title) {
            newTracks.push(trackData);
        } else {
            console.warn("Player: Skipped track due to missing ID or title from element:", trackElement);
        }
    });

    window.tracksList = [...newTracks];
    window.originalTracksList = [...newTracks];
    tracksList = window.tracksList; 
    originalTracksList = window.originalTracksList; 

    if (window.isShuffleActive) _shuffleCurrentTracksList();
    else {
        if (window.currentTrackId) {
            window.currentTrackIndex = window.tracksList.findIndex(track => String(track.id) === String(window.currentTrackId));
        } else { window.currentTrackIndex = -1; }
        currentTrackIndex = window.currentTrackIndex; 
    }
    console.log(`Player: Built tracks list for ${pageType} with ${window.tracksList.length} tracks. List:`, window.tracksList);
}


function toggleShuffle() {
    const shuffleButton = document.querySelector('.control-button[title="Shuffle"]');
    window.isShuffleActive = !window.isShuffleActive;
    isShuffleActive = window.isShuffleActive; 

    if (window.isShuffleActive) {
        if (shuffleButton) shuffleButton.classList.add('active');
        if ((!window.originalTracksList || window.originalTracksList.length === 0) && window.tracksList && window.tracksList.length > 0) {
            window.originalTracksList = [...window.tracksList];
            originalTracksList = window.originalTracksList; 
        }
        _shuffleCurrentTracksList();
    } else {
        if (shuffleButton) shuffleButton.classList.remove('active');
        if (window.originalTracksList && window.originalTracksList.length > 0) {
            window.tracksList = [...window.originalTracksList];
            tracksList = window.tracksList; 
            if (window.currentTrackId) {
                window.currentTrackIndex = window.tracksList.findIndex(track => String(track.id) === String(window.currentTrackId));
                currentTrackIndex = window.currentTrackIndex; 
            }
        }
    }
}

function _shuffleCurrentTracksList() {
    const baseList = (window.originalTracksList && window.originalTracksList.length > 0) ? window.originalTracksList : window.tracksList;
    if (!baseList || baseList.length === 0) return;

    let tempShuffleList = [...baseList];
    for (let i = tempShuffleList.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tempShuffleList[i], tempShuffleList[j]] = [tempShuffleList[j], tempShuffleList[i]];
    }
    window.tracksList = tempShuffleList; 
    tracksList = window.tracksList;     

    if (window.currentTrackId) {
        window.currentTrackIndex = window.tracksList.findIndex(track => String(track.id) === String(window.currentTrackId));
    } else { window.currentTrackIndex = -1; }
    currentTrackIndex = window.currentTrackIndex; 
}

function toggleRepeat() {
    const repeatButton = document.querySelector('.control-button[title="Repeat"]');
    window.isRepeatActive = !window.isRepeatActive;
    isRepeatActive = window.isRepeatActive; 

    if (window.isRepeatActive) {
        if (repeatButton) repeatButton.classList.add('active');
        if (window.currentAudio) window.currentAudio.loop = true;
    } else {
        if (repeatButton) repeatButton.classList.remove('active');
        if (window.currentAudio) window.currentAudio.loop = false;
    }
}


function setupVolumeControl() {
    const volumeButton = document.querySelector('.volume-button');
    const volumeIcon = document.getElementById('volume-icon');
    const volumeMuteIcon = document.getElementById('volume-mute-icon');
    const volumeBar = document.getElementById('volume-bar');
    const volumeLevel = document.getElementById('volume-level');

    if (!volumeButton || !volumeBar || !volumeLevel || !volumeIcon || !volumeMuteIcon) return;
    
    
    if (unmutedVolume === 0.7 && window.currentAudio) {
         unmutedVolume = window.currentAudio.volume;
         if (window.currentAudio.muted) unmutedVolume = 0.7; 
    } else if (unmutedVolume === 0.7) {
        
        
    }


    
    if (window.currentAudio) { 
        window.currentAudio.volume = unmutedVolume;
        window.currentAudio.muted = (unmutedVolume === 0);
    }
    updateVolumeUI();

    volumeBar.addEventListener('click', function(e) {
        const rect = volumeBar.getBoundingClientRect();
        let newVolume = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        
        
        unmutedVolume = newVolume; 

        if (window.currentAudio) {
            window.currentAudio.volume = newVolume;
            window.currentAudio.muted = false; 
        }
        updateVolumeUI();
    });

    volumeButton.addEventListener('click', function() {
        const audio = window.currentAudio;
        if (audio) {
            if (audio.muted) {
                audio.muted = false;
                
                audio.volume = unmutedVolume > 0 ? unmutedVolume : 0.1; 
            } else {
                
                if (audio.volume > 0) unmutedVolume = audio.volume; 
                audio.muted = true;
            }
        } else { 
            
            unmutedVolume = (unmutedVolume === 0) ? 0.7 : 0;
        }
        updateVolumeUI();
    });

    
    updateVolumeUI();
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


document.addEventListener('DOMContentLoaded', function() {
    console.log("Player Script (artist_profile.js): DOMContentLoaded. Initializing...");

    
    if (document.querySelector('.artist-header')) {
        buildTracksListFromPage('.artist-top-tracks .track-item', 'Artist Profile');
    } else if (document.querySelector('.search-results-container .track-list')) {
        buildTracksListFromPage('.search-results-container .track-list .track-item', 'Search Results');
    } else if (document.querySelector('.playlist-tracks .track-list')) { 
        buildTracksListFromPage('.playlist-tracks .track-list .track-item', 'Playlist Details');
    } else if (document.querySelector('.top-tracks-section .track-list')) { 
        buildTracksListFromPage('.top-tracks-section .track-list .track-item', 'Index Page Top Tracks');
    } else if (document.querySelector('h1.main-header')?.textContent.includes('Liked Songs')) {
         buildTracksListFromPage('.track-list .track-item', 'Liked Songs'); 
    }
    
    
    document.querySelector('.play-pause')?.addEventListener('click', togglePlayPause);
    document.getElementById('progress-bar')?.addEventListener('click', handleProgressBarClick);
    document.querySelector('.control-button[title="Next"]')?.addEventListener('click', playNextTrack);
    document.querySelector('.control-button[title="Previous"]')?.addEventListener('click', playPreviousTrack);
    
    const shuffleButton = document.querySelector('.control-button[title="Shuffle"]');
    if (shuffleButton) {
        shuffleButton.addEventListener('click', toggleShuffle);
        if(window.isShuffleActive) shuffleButton.classList.add('active');
    }
    const repeatButton = document.querySelector('.control-button[title="Repeat"]');
    if (repeatButton) {
        repeatButton.addEventListener('click', toggleRepeat);
        if(window.isRepeatActive) repeatButton.classList.add('active');
        if (window.currentAudio && window.isRepeatActive) window.currentAudio.loop = true;
    }
    setupVolumeControl();

document.querySelectorAll('.like-button').forEach(button => {
    button.addEventListener('click', handleLikeSong); 
    const trackItem = button.closest('.track-item');
    const textSpan = button.querySelector('.like-button-text'); 
    const svgIcon = button.querySelector('svg');

    
    
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

    
    document.querySelectorAll('.add-to-playlist-button').forEach(button => {
        button.addEventListener('click', function(event) {
            event.stopPropagation();
            const trackId = this.dataset.trackId;
            console.log(`Attempting to open "Add to Playlist" modal for track ID: ${trackId}`);        
        });
    });
    
    window.playTrackGlobal = playTrackInternal;
    window.buildTracksListFromPage = buildTracksListFromPage; 

    console.log("Player Script: Initialization complete. playTrackGlobal is now on window.");
});
