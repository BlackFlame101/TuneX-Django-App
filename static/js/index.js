let currentAudio = null; 
let isPlaying = false; 
let currentTrackId = null; 
let tracksList = []; 
let currentTrackIndex = -1; 
let userVolume = 0.7; 
let isShuffleActive = false; 
let isRepeatActive = false; 
let originalTracksList = []; 
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

function setupArtistCardListeners() {
    console.log("Setting up artist card listeners...");
    const artistCards = document.querySelectorAll('.artist-card');
    console.log(`Found ${artistCards.length} artist cards`);
    
    artistCards.forEach(card => {
        
        card.removeEventListener('click', handleArtistCardClick);
        
        card.addEventListener('click', handleArtistCardClick);
    });
}


function handleArtistCardClick(event) {
    const card = this;
    const artistId = card.getAttribute('data-artist-id');
    const artistName = card.querySelector('.artist-name')?.textContent || 'Unknown Artist';
    
    console.log(`Clicked artist: ${artistName} (ID: ${artistId})`);
    
    if (artistId) {
        
        window.location.href = `/artist/${artistId}/`;
    } else {
        console.warn("Artist ID not found on clicked card:", card);
    }
}


function setupPlaylistCardListeners() {
    console.log("Setting up playlist card listeners...");
    const playlistCards = document.querySelectorAll('.card-grid .card');
    console.log(`Found ${playlistCards.length} playlist cards`);
    
    playlistCards.forEach(card => {
        
        card.removeEventListener('click', handlePlaylistCardClick);
        
        card.addEventListener('click', handlePlaylistCardClick);
    });
}


function handlePlaylistCardClick(event) {
    const card = this;
    const playlistId = card.getAttribute('data-playlist-id');
    const playlistTitle = card.querySelector('.card-title')?.textContent || 'Unknown Playlist';
    const isDeezerPlaylist = card.getAttribute('data-deezer-playlist') === 'true';

    console.log(`Clicked playlist: ${playlistTitle} (ID: ${playlistId}), Deezer: ${isDeezerPlaylist}`);

    if (playlistId) {
        let url = isDeezerPlaylist ? `/deezer_playlist/${playlistId}/` : `/playlist/${playlistId}/`;
        window.location.href = url;
        event.preventDefault(); 
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


document.addEventListener('DOMContentLoaded', function() {
    
    setupArtistCardListeners();
    
    
    setupPlaylistCardListeners();
    
    
    buildTracksList();
    
    
    const playPauseButton = document.querySelector('.play-pause');
    if (playPauseButton) {
        playPauseButton.addEventListener('click', togglePlayPause);
    }
    
    
    const progressBarContainer = document.getElementById('progress-bar');
    if (progressBarContainer) {
        progressBarContainer.addEventListener('click', handleProgressBarClick);
    }
    
    
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
    
    
    const repeatButton = document.querySelector('.control-button[title="Repeat"]');
    if (repeatButton) {
        repeatButton.addEventListener('click', toggleRepeat);
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


function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}


function updatePlayerUI(playing) {
    
    const playIcon = document.getElementById('play-icon');
    const pauseIcon = document.getElementById('pause-icon');
    const playPauseButton = document.querySelector('.play-pause');
    
    
    isPlaying = playing;
    
    
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



function playTrack(id, title, artist, imageUrl, audioUrl) {
    console.log(`playTrack function called! ID: ${id}, Title: ${title}`);
    
    
    const trackIndex = tracksList.findIndex(track => track.id === id);
    console.log(`Track index found: ${trackIndex} (Previous index: ${currentTrackIndex})`);
    
    if (trackIndex !== -1) {
        currentTrackIndex = trackIndex;
    } else {
        console.warn(`Track ${id} not found in tracks list. This might cause issues with next/previous.`);
    }
    
    
    const playerTitleEl = document.querySelector('.now-playing-title');
    const playerArtistEl = document.querySelector('.now-playing-artist');
    const playerImageEl = document.querySelector('.now-playing-image');
    const progressBar = document.getElementById('progress');
    const currentTimeEl = document.getElementById('current-time');
    const totalTimeEl = document.getElementById('total-time');

    
    if (!playerTitleEl || !playerArtistEl || !playerImageEl) {
        console.error("Essential player UI elements not found!");
        return;
    }

    console.log(`Attempting to play track: ${title} by ${artist} (ID: ${id})`);
    console.log(`Audio URL: ${audioUrl}`);

    
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

    
    playerTitleEl.textContent = title;
    playerArtistEl.textContent = artist;
    
    if (imageUrl) {
        playerImageEl.style.backgroundImage = `url('${imageUrl}')`;
    } else {
        playerImageEl.style.backgroundImage = `url('https://placehold.co/56x56/333333/CCCCCC?text=?')`;
    }
    playerImageEl.style.backgroundSize = 'cover';
    playerImageEl.innerHTML = '';

    
    if (currentAudio && currentTrackId === id && currentAudio.paused) {
        currentAudio.play().then(() => {
            updatePlayerUI(true);
            console.log("Resumed playback.");
        }).catch(e => console.error("Audio resume error:", e));
        return;
    }

    
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.removeEventListener('timeupdate', updateProgress);
        currentAudio.removeEventListener('loadedmetadata', setTotalTime);
        currentAudio.removeEventListener('ended', handleTrackEnd);
        currentAudio.removeEventListener('error', handleAudioError);
        currentAudio.removeEventListener('play', handleAudioPlay);
        currentAudio.removeEventListener('pause', handleAudioPause);
    }

    
    currentAudio = new Audio(audioUrl);
    currentTrackId = id;
    
    
    currentAudio.volume = userVolume;
    currentAudio.muted = false; 

    
    currentAudio.addEventListener('timeupdate', updateProgress);
    currentAudio.addEventListener('loadedmetadata', setTotalTime);
    currentAudio.addEventListener('ended', handleTrackEnd);
    currentAudio.addEventListener('error', handleAudioError);
    currentAudio.addEventListener('play', handleAudioPlay);
    currentAudio.addEventListener('pause', handleAudioPause);

    
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




function setupVolumeControl() {
    const volumeButton = document.querySelector('.volume-button');
    const volumeIcon = document.getElementById('volume-icon');
    const volumeMuteIcon = document.getElementById('volume-mute-icon');
    const volumeBar = document.getElementById('volume-bar');
    
    if (volumeButton && volumeBar) {
        let isMuted = false;
        
        
        volumeBar.addEventListener('click', function(e) {
            if (!currentAudio) return;
            
            const rect = volumeBar.getBoundingClientRect();
            const clickPos = e.clientX - rect.left;
            const newVolume = Math.max(0, Math.min(1, clickPos / rect.width));
            
            
            userVolume = newVolume;
            
            
            currentAudio.volume = newVolume;
            currentAudio.muted = false;
            
            console.log(`Volume set to: ${newVolume.toFixed(2)}`);
            updateVolumeUI();
        });
        
        
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
