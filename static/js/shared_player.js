let currentAudio = window.currentAudio || null;
let isPlaying = window.isPlaying || false;
let currentTrackId = window.currentTrackId || null;
let tracksList = window.tracksList || []; 
let currentTrackIndex = window.currentTrackIndex || -1;
let isShuffleActive = window.isShuffleActive || false;
let isRepeatActive = window.isRepeatActive || false;
let originalTracksList = window.originalTracksList || [];
let unmutedVolume = window.unmutedVolume || 0.7; 


function showFloatingNotification(message, type = 'info') {
    const messagesContainer = document.querySelector('.messages-container');
    if (!messagesContainer) {
        console.error('Messages container not found for floating notification.');
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
    alertDiv.style.opacity = '1';
    alertDiv.innerHTML = `
        <span>${message}</span>
        <button type="button" class="close-alert" data-dismiss="alert" aria-label="Close" style="background:none; border:none; color:white; font-size:1.5rem; line-height:1; opacity:0.8; padding: 0 0 0 15px; cursor:pointer;">
            <span aria-hidden="true">&times;</span>
        </button>
    `;
    messagesContainer.appendChild(alertDiv);
    setTimeout(function() {
        alertDiv.style.transition = 'opacity 0.5s ease';
        alertDiv.style.opacity = '0';
        setTimeout(function() { alertDiv.remove(); }, 500);
    }, 5000);
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
        default: return '#6c757d';
    }
}


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
    const volToShow = audio && !audio.muted ? audio.volume : window.unmutedVolume;
    const mutedState = audio ? audio.muted : (window.unmutedVolume === 0); 
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


async function handlePlayTrackWithFreshUrl(deezerId, title, artistName, imageUrl, durationFormatted) {
    console.log(`SharedPlayer: handlePlayTrackWithFreshUrl called for ID: ${deezerId}, Title: ${title}`);
    
    const playerTitleEl = document.querySelector('.now-playing-title');
    if (playerTitleEl) playerTitleEl.textContent = `Loading ${title}...`;

    try {
        const response = await fetch(`/api/song/${deezerId}/fresh_preview/`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({})); 
            const errorMessage = errorData.error || errorData.message || `Failed to get fresh preview (HTTP ${response.status})`;
            console.error(`SharedPlayer: Error fetching fresh preview for ${deezerId}: ${errorMessage}`);
            showFloatingNotification(errorMessage, 'error');
            playTrackGlobal(deezerId, title, artistName, imageUrl, null, durationFormatted); 
            return;
        }
        const data = await response.json();
        if (data.preview_url) {
            console.log(`SharedPlayer: Got fresh preview URL for ${deezerId}: ${data.preview_url}`);
            playTrackGlobal(deezerId, title, artistName, imageUrl, data.preview_url, durationFormatted);
        } else {
            console.warn(`SharedPlayer: No fresh preview URL returned for ${deezerId}. Message: ${data.message}`);
            showFloatingNotification(data.message || `Preview not available for "${title}"`, 'info');
            playTrackGlobal(deezerId, title, artistName, imageUrl, null, durationFormatted);
        }
    } catch (error) {
        console.error(`SharedPlayer: Network or other error fetching fresh preview for ${deezerId}:`, error);
        showFloatingNotification('Error loading song preview. Please try again.', 'error');
        playTrackGlobal(deezerId, title, artistName, imageUrl, null, durationFormatted);
    }
}




function playTrackGlobal(id, title, artistName, imageUrl, audioUrl, durationFormatted = "0:00") {
    console.log(`SharedPlayer: playTrackGlobal called! ID: ${id}, Title: ${title}, AudioURL (raw): "${audioUrl}", Duration: ${durationFormatted}`);

    const trackIndex = window.tracksList.findIndex(track => String(track.id) === String(id));
    if (trackIndex !== -1) {
        window.currentTrackIndex = trackIndex;
        currentTrackIndex = trackIndex; 
    } else {
        
        
        console.warn(`SharedPlayer: Track ${id} ('${title}') not found in current window.tracksList. Playback will proceed but next/prev might be affected.`);
        window.currentTrackIndex = -1; 
        currentTrackIndex = -1;
    }

    const playerTitleEl = document.querySelector('.now-playing-title');
    const playerArtistEl = document.querySelector('.now-playing-artist');
    const playerImageEl = document.querySelector('.now-playing-image');
    const totalTimeEl = document.getElementById('total-time');

    if (!playerTitleEl || !playerArtistEl || !playerImageEl) {
        console.error("SharedPlayer: Essential player UI elements not found!");
        return;
    }

    playerTitleEl.textContent = title;
    playerArtistEl.textContent = artistName;
    playerImageEl.style.backgroundImage = `url('${imageUrl || 'https://placehold.co/56x56/333333/CCCCCC?text=?'}')`;
    playerImageEl.style.backgroundSize = 'cover';
    playerImageEl.style.backgroundPosition = 'center';
    playerImageEl.style.backgroundRepeat = 'no-repeat';

    let processedAudioUrl = null;
    if (typeof audioUrl === 'string') {
        processedAudioUrl = audioUrl.trim();
    } else if (audioUrl === null || audioUrl === undefined) {
        processedAudioUrl = null; 
    } else {
        console.warn(`SharedPlayer: audioUrl is of unexpected type: ${typeof audioUrl}, value: ${audioUrl}`);
        processedAudioUrl = null; 
    }
    
    const isLikelyValidUrl = processedAudioUrl && (processedAudioUrl.startsWith('http://') || processedAudioUrl.startsWith('https://'));

    if (!processedAudioUrl || processedAudioUrl === 'null' || processedAudioUrl === 'None' || !isLikelyValidUrl) {
        console.warn(`SharedPlayer: Invalid or empty audio URL for track: ${title}. Original: "${audioUrl}", Processed: "${processedAudioUrl}". Displaying Preview N/A.`);
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
    
    console.log(`SharedPlayer: Attempting to play with processed URL: "${processedAudioUrl}" for track "${title}"`);

    if (window.currentAudio && String(window.currentTrackId) === String(id) && window.currentAudio.paused) {
        window.currentAudio.play().then(() => updatePlayerUI(true)).catch(e => console.error("SharedPlayer: Audio resume error:", e));
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
    
    console.log(`SharedPlayer: FINAL URL before new Audio(): "${processedAudioUrl}" (type: ${typeof processedAudioUrl}) for track "${title}"`);
    const newAudio = new Audio(processedAudioUrl); 
    window.currentAudio = newAudio;
    currentAudio = newAudio;
    window.currentTrackId = id;
    currentTrackId = id;

    if (typeof window.unmutedVolume !== 'undefined') {
        newAudio.volume = window.unmutedVolume;
        updateVolumeUI();
    } else {
        newAudio.volume = 0.7;
        window.unmutedVolume = 0.7;
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
            console.error("SharedPlayer: Audio playback error on initial play:", e);
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
    console.log("SharedPlayer: Track ended.");
    const activeTrackList = window.tracksList || [];
    const currentIdx = window.currentTrackIndex !== -1 ? window.currentTrackIndex : -1;
    if (window.isRepeatActive && window.currentTrackId && currentIdx !== -1 && activeTrackList[currentIdx] && window.currentAudio && window.currentAudio.loop) {
        
        
        console.log("SharedPlayer: Single track repeat (loop=true) handled by browser.");
        return; 
    }
    console.log("SharedPlayer: Moving to next track.");
    playNextTrack();
}

function handleAudioError(e) {
    console.error("SharedPlayer: Audio Error Event:", e);
    const audio = e.target; 
    if (audio && audio.error) {
        console.error("SharedPlayer: Audio Error Code:", audio.error.code);
        switch (audio.error.code) {
            case MediaError.MEDIA_ERR_ABORTED:
                console.error("SharedPlayer: Playback aborted.");
                break;
            case MediaError.MEDIA_ERR_NETWORK:
                console.error("SharedPlayer: Network error.");
                showFloatingNotification("Network error playing audio.", 'error');
                break;
            case MediaError.MEDIA_ERR_DECODE:
                console.error("SharedPlayer: Audio decoding error.");
                showFloatingNotification("Audio decoding error.", 'error');
                break;
            case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                console.error("SharedPlayer: Source not supported.");
                showFloatingNotification("Audio format not supported or source unavailable.", 'error');
                break;
            default:
                console.error("SharedPlayer: Unknown audio error.");
                showFloatingNotification("Unknown audio error.", 'error');
        }
    } else {
         console.error("SharedPlayer: Unknown audio error (no error object).");
         showFloatingNotification("Unknown audio error.", 'error');
    }
    console.error("SharedPlayer: Audio Network State:", audio ? audio.networkState : 'N/A');
    console.error("SharedPlayer: Current audio src:", audio ? audio.src : 'N/A'); 
    updatePlayerUI(false);
    if (document.getElementById('total-time')) document.getElementById('total-time').textContent = "Error";
}
function handleAudioPlay() { updatePlayerUI(true); }
function handleAudioPause() { updatePlayerUI(false); }


function playNextTrack() {
    const activeTrackList = window.tracksList || [];
    if (activeTrackList.length === 0) {
        updatePlayerUI(false);
        console.log("SharedPlayer: No tracks in list to play next.");
        return;
    }
    let nextIndex = (window.currentTrackIndex !== -1 ? window.currentTrackIndex : -1) + 1;
    if (nextIndex >= activeTrackList.length) {
        if (window.isRepeatActive && activeTrackList.length > 0) { 
            nextIndex = 0;
            console.log("SharedPlayer: Reached end, looping to start (repeat playlist).");
        } else { 
            updatePlayerUI(false);
            if(document.getElementById('progress')) document.getElementById('progress').style.width = '0%';
            if(document.getElementById('current-time')) document.getElementById('current-time').textContent = formatTime(0);
            console.log("SharedPlayer: Reached end of list. Playback stopped.");
            return;
        }
    }
    
    const nextTrack = activeTrackList[nextIndex];
    if (nextTrack) {
        
        
        if (!nextTrack.audioUrl || nextTrack.audioUrl === 'null' || nextTrack.audioUrl === 'None') {
            console.log(`SharedPlayer: Next track "${nextTrack.title}" has no/stale URL in list, fetching fresh.`);
            handlePlayTrackWithFreshUrl(nextTrack.id, nextTrack.title, nextTrack.artist, nextTrack.imageUrl, nextTrack.duration_formatted);
        } else {
            console.log(`SharedPlayer: Next track "${nextTrack.title}" has URL in list, playing directly.`);
            playTrackGlobal(nextTrack.id, nextTrack.title, nextTrack.artist, nextTrack.imageUrl, nextTrack.audioUrl, nextTrack.duration_formatted);
        }
    } else {
        console.error("SharedPlayer: Error finding next track object.");
        updatePlayerUI(false);
    }
}

function playPreviousTrack() {
    const activeTrackList = window.tracksList || [];
    if (activeTrackList.length === 0) {
        console.log("SharedPlayer: No tracks in list to play previous.");
        return;
    }
    let prevIndex = (window.currentTrackIndex !== -1 ? window.currentTrackIndex : 0) - 1;
    if (prevIndex < 0) {
        if (window.isRepeatActive && activeTrackList.length > 0) { 
            prevIndex = activeTrackList.length - 1; 
            console.log("SharedPlayer: Reached start, looping to end (repeat playlist).");
        } else { 
            console.log("SharedPlayer: At the beginning of the list.");
            if (window.currentAudio) window.currentAudio.currentTime = 0; 
            return;
        }
    }

    const prevTrack = activeTrackList[prevIndex];
    if (prevTrack) {
        if (!prevTrack.audioUrl || prevTrack.audioUrl === 'null' || prevTrack.audioUrl === 'None') {
            console.log(`SharedPlayer: Previous track "${prevTrack.title}" has no/stale URL in list, fetching fresh.`);
            handlePlayTrackWithFreshUrl(prevTrack.id, prevTrack.title, prevTrack.artist, prevTrack.imageUrl, prevTrack.duration_formatted);
        } else {
            console.log(`SharedPlayer: Previous track "${prevTrack.title}" has URL in list, playing directly.`);
            playTrackGlobal(prevTrack.id, prevTrack.title, prevTrack.artist, prevTrack.imageUrl, prevTrack.audioUrl, prevTrack.duration_formatted);
        }
    } else {
        console.error("SharedPlayer: Error finding previous track object.");
    }
}

function togglePlayPause() {
    const audioToToggle = window.currentAudio;
    const activeTrackList = window.tracksList || [];
    if (!audioToToggle || !audioToToggle.src || audioToToggle.src === window.location.href) {
        console.log("SharedPlayer: No valid track loaded. Attempting to play first/current track.");
        if (activeTrackList.length > 0) {
            const trackToPlayIndex = window.currentTrackIndex !== -1 ? window.currentTrackIndex : 0;
            const trackToPlay = activeTrackList[trackToPlayIndex];
            if (trackToPlay) {
                
                if (document.querySelector('.playlist-tracks .track-item[data-track-id="' + trackToPlay.id + '"]') || 
                    document.querySelector('body.liked-songs-page .track-item[data-track-id="' + trackToPlay.id + '"]')) { 
                     handlePlayTrackWithFreshUrl(trackToPlay.id, trackToPlay.title, trackToPlay.artist, trackToPlay.imageUrl, trackToPlay.duration_formatted);
                } else {
                    playTrackGlobal(trackToPlay.id, trackToPlay.title, trackToPlay.artist, trackToPlay.imageUrl, trackToPlay.audioUrl, trackToPlay.duration_formatted);
                }
            }
        }
        return;
    }
    if (window.isPlaying) {
        audioToToggle.pause();
        console.log("SharedPlayer: Paused via button.");
    } else {
        audioToToggle.play().then(() => {
            console.log("SharedPlayer: Played via button.");
        }).catch(e => {
            console.error("SharedPlayer: Audio play error on toggle:", e);
            updatePlayerUI(false);
        });
    }
}

function handleProgressBarClick(e) {
    if (!window.currentAudio || isNaN(window.currentAudio.duration) || window.currentAudio.duration <= 0 || !window.currentAudio.seekable || window.currentAudio.seekable.length === 0) {
        console.log("SharedPlayer: Cannot seek.");
        return;
    }
    const progressBarEl = e.currentTarget;
    const bounds = progressBarEl.getBoundingClientRect();
    const clickX = e.clientX - bounds.left;
    const percentage = Math.max(0, Math.min(1, (clickX / bounds.width)));
    const seekTime = percentage * window.currentAudio.duration;
    if (window.currentAudio.seekable.length > 0 && seekTime >= window.currentAudio.seekable.start(0) && seekTime <= window.currentAudio.seekable.end(0)) {
        window.currentAudio.currentTime = seekTime;
        console.log(`SharedPlayer: Seeking to ${formatTime(seekTime)}`);
    } else {
        console.warn("SharedPlayer: Seek time out of bounds.");
    }
}


function buildTracksListFromPage(selector, pageType = "generic") {
    let newTracks = [];
    console.log(`SharedPlayer: Building tracks list for ${pageType} using selector: ${selector}`);
    const trackElements = document.querySelectorAll(selector);
    console.log(`SharedPlayer: Found ${trackElements.length} track elements for ${pageType}.`);

    trackElements.forEach((trackElement) => {
        let trackData = {};
        const onclickAttr = trackElement.getAttribute('onclick');
        
        trackData.id = trackElement.dataset.trackId;
        trackData.title = trackElement.dataset.trackTitle || trackElement.querySelector('.track-title')?.textContent.trim() || "Unknown Title";
        trackData.artist = trackElement.dataset.trackArtist || trackElement.querySelector('.track-artist')?.textContent.trim() || "Unknown Artist";
        trackData.imageUrl = trackElement.dataset.trackImageurl || trackElement.querySelector('.track-image')?.style.backgroundImage.slice(5, -2) || "";
        trackData.duration_formatted = trackElement.dataset.trackDurationFormatted || trackElement.querySelector('.track-duration')?.textContent.trim() || "0:00";
        trackData.is_liked = trackElement.dataset.isLiked === 'true';
        
        
        
        if (pageType === 'User Playlist Details' || pageType === 'Liked Songs Page') {
            trackData.audioUrl = null; 
        } else if (onclickAttr && onclickAttr.includes('playTrackGlobal')) {
             try { 
                const regex = /playTrackGlobal\s*\(\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*['"]?([^'"\s,)]*)['"]?/
                const match = onclickAttr.match(regex);
                if (match && match[5]) {
                    const audioUrlRaw = match[5].trim();
                    trackData.audioUrl = (audioUrlRaw === 'null' || audioUrlRaw === 'None' || audioUrlRaw === "''" || audioUrlRaw === '""') ? null : audioUrlRaw.replace(/^['"]|['"]$/g, '');
                } else {
                    trackData.audioUrl = null; 
                }
            } catch (e) { 
                console.error(`SharedPlayer: Error parsing audioUrl from onclick for pageType ${pageType}:`, e);
                trackData.audioUrl = null;
            }
        } else {
            
            trackData.audioUrl = trackElement.dataset.trackAudiourl || null; 
        }

        if (trackData.id && trackData.title) {
            newTracks.push(trackData);
        } else {
            console.warn("SharedPlayer: Skipped track due to missing ID or title from element:", trackElement);
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
    console.log(`SharedPlayer: Built tracks list for ${pageType} with ${window.tracksList.length} tracks.`);
    if(window.tracksList.length > 0) console.log("SharedPlayer: First track in list:", window.tracksList[0]);
}



function toggleShuffle() {
    const shuffleButton = document.querySelector('.control-button[title="Shuffle"]');
    window.isShuffleActive = !window.isShuffleActive;
    isShuffleActive = window.isShuffleActive;
    if (window.isShuffleActive) {
        if (shuffleButton) shuffleButton.classList.add('active');
        if ((!window.originalTracksList || window.originalTracksList.length === 0) && window.tracksList && window.tracksList.length > 0) {
            window.originalTracksList = [...window.tracksList];
            
        }
        _shuffleCurrentTracksList();
        showFloatingNotification("Shuffle enabled", 'info');
    } else {
        if (shuffleButton) shuffleButton.classList.remove('active');
        if (window.originalTracksList && window.originalTracksList.length > 0) {
            window.tracksList = [...window.originalTracksList];
            
            if (window.currentTrackId) {
                window.currentTrackIndex = window.tracksList.findIndex(track => String(track.id) === String(window.currentTrackId));
                currentTrackIndex = window.currentTrackIndex;
            }
        }
        showFloatingNotification("Shuffle disabled", 'info');
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
        showFloatingNotification("Repeat (single track) enabled", 'info');
    } else {
        if (repeatButton) repeatButton.classList.remove('active');
        if (window.currentAudio) window.currentAudio.loop = false;
        showFloatingNotification("Repeat disabled", 'info');
    }
}


function setupVolumeControl() {
    const volumeButton = document.querySelector('.volume-button');
    const volumeIcon = document.getElementById('volume-icon');
    const volumeMuteIcon = document.getElementById('volume-mute-icon');
    const volumeBar = document.getElementById('volume-bar');
    const volumeLevel = document.getElementById('volume-level');
    if (!volumeButton || !volumeBar || !volumeLevel || !volumeIcon || !volumeMuteIcon) return;
    if (window.unmutedVolume === 0.7 && window.currentAudio) {
         window.unmutedVolume = window.currentAudio.volume;
         if (window.currentAudio.muted) window.unmutedVolume = 0.7;
    }
    if (window.currentAudio) {
        window.currentAudio.volume = window.unmutedVolume;
        window.currentAudio.muted = (window.unmutedVolume === 0);
    }
    updateVolumeUI();
    volumeBar.addEventListener('click', function(e) {
        const rect = volumeBar.getBoundingClientRect();
        let newVolume = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        window.unmutedVolume = newVolume;
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
                audio.volume = window.unmutedVolume > 0 ? window.unmutedVolume : 0.1;
            } else {
                if (audio.volume > 0) window.unmutedVolume = audio.volume;
                audio.muted = true;
            }
        } else {
            window.unmutedVolume = (window.unmutedVolume === 0) ? 0.7 : 0;
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
    const svgIcon = button.querySelector('svg.heart-icon'); 
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
            if (svgIcon) { svgIcon.setAttribute('fill', 'var(--primary)'); svgIcon.setAttribute('stroke', 'var(--primary)'); }
            button.classList.add('active');
            button.title = "Unlike this song";
            if (trackItem) trackItem.dataset.isLiked = 'true';
            showFloatingNotification(`Liked "${data.title || 'the song'}".`, 'success');
        } else {
            if (svgIcon) { svgIcon.setAttribute('fill', 'none'); svgIcon.setAttribute('stroke', 'currentColor');}
            button.classList.remove('active');
            button.title = "Like this song";
            if (trackItem) trackItem.dataset.isLiked = 'false';
            showFloatingNotification(`Unliked "${data.title || 'the song'}".`, 'info');
        }
    } catch (error) {
        console.error('SharedPlayer: Network/other error during like song:', error);
        showFloatingNotification('An error occurred while liking/unliking. Please try again.', 'error');
    }
}


document.addEventListener('DOMContentLoaded', function() {
    console.log("SharedPlayer Script: DOMContentLoaded. Initializing...");
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
        const svgIcon = button.querySelector('svg.heart-icon');
        if (trackItem && trackItem.dataset.isLiked !== undefined && svgIcon) { 
            if (trackItem.dataset.isLiked === 'true') {
                svgIcon.setAttribute('fill', 'var(--primary)'); 
                svgIcon.setAttribute('stroke', 'var(--primary)'); 
                button.classList.add('active');
                button.title = "Unlike this song";
            } else {
                svgIcon.setAttribute('fill', 'none'); 
                svgIcon.setAttribute('stroke', 'currentColor');
                button.classList.remove('active');
                button.title = "Like this song";
            }
        }
    });
    
    
    
    if (document.querySelector('.playlist-tracks .track-item')) { 
        buildTracksListFromPage('.playlist-tracks .track-item', 'User Playlist Details');
    } else if (document.querySelector('h1.main-header')?.textContent.includes('Liked Songs')) { 
        
        
        buildTracksListFromPage('.track-list .track-item', 'Liked Songs Page'); 
    } else if (document.querySelector('.artist-top-tracks .track-item')) { 
        buildTracksListFromPage('.artist-top-tracks .track-item', 'Artist Profile');
    } else if (document.querySelector('.search-results-container .track-list .track-item')) { 
        buildTracksListFromPage('.search-results-container .track-list .track-item', 'Search Results');
    } else if (document.querySelector('.top-tracks-section .track-list .track-item')) { 
        buildTracksListFromPage('.top-tracks-section .track-list .track-item', 'Index Page Top Tracks');
    }
    

    window.handlePlayTrackWithFreshUrl = handlePlayTrackWithFreshUrl; 
    window.playTrackGlobal = playTrackGlobal; 
    window.buildTracksListFromPage = buildTracksListFromPage;
    window.showFloatingNotification = showFloatingNotification; 
    console.log("SharedPlayer Script: Initialization complete. Global functions exposed.");
});
