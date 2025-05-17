document.addEventListener('DOMContentLoaded', function() {
    const searchInputField = document.getElementById('search-input-field');
    const resultsContainer = document.getElementById('live-search-results-container');
    const searchForm = document.getElementById('search-form'); 

    let debounceTimer;

    if (!searchInputField || !resultsContainer || !searchForm) {
        console.error("Search page specific elements (input, results container, or form) not found.");
        return;
    }

    searchForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const query = searchInputField.value.trim();
        if (query) {
            performLiveSearch(query); 
        } else {
            clearResults();
            showInitialBrowseContent();
        }
    });

    searchInputField.addEventListener('input', function() {
        clearTimeout(debounceTimer);
        const query = this.value.trim();

        if (query.length === 0) {
            clearResults();
            showInitialBrowseContent();
            return;
        }

        if (query.length < 2) { 
            return;
        }

        debounceTimer = setTimeout(() => {
            performLiveSearch(query);
        }, 500); 
    });

    async function performLiveSearch(query) {
        console.log(`Performing live search for: ${query}`);
        resultsContainer.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Searching...</p>';

        const searchUrl = window.appUrls && window.appUrls.ajaxSearch 
                          ? `${window.appUrls.ajaxSearch}?q=${encodeURIComponent(query)}`
                          : `/api/search/?q=${encodeURIComponent(query)}`; 

        try {
            const response = await fetch(searchUrl); 
            if (!response.ok) {
                let errorMsg = `HTTP error! status: ${response.status}`;
                try {
                    const errData = await response.json();
                    errorMsg = errData.error || errorMsg;
                } catch (e) { /* Ignore if response isn't JSON */ }
                throw new Error(errorMsg);
            }
            const data = await response.json();
            renderResults(data, query);
        } catch (error) {
            console.error("Error during live search:", error);
            resultsContainer.innerHTML = `<p style="color: var(--text-muted); text-align: center;">Error fetching results: ${error.message}. Please try again.</p>`;
        }
    }

    function renderResults(data, query) {
        clearResults();

        if (!data || ((!data.tracks || data.tracks.length === 0) && (!data.artists || data.artists.length === 0))) {
            resultsContainer.innerHTML = `<p style="color: var(--text-muted); text-align: center;">No results found for "${query}".</p>`;
            return;
        }

        let contentHtml = '';

        if (data.artists && data.artists.length > 0) {
            contentHtml += `<h3 class="section-header" style="font-size: 20px; margin-top: 24px;">Artists</h3>`;
            contentHtml += `<div class="search-results-grid artist-grid">`; 
            data.artists.forEach(artist => {
                const imageUrl = artist.picture_medium || 'https://placehold.co/160x160/555555/CCCCCC?text=?';
                contentHtml += `
                    <div class="artist-card" data-artist-id="${artist.id}">
                        <div class="artist-image" style="background-image: url('${imageUrl}');"></div>
                        <div class="artist-name">${artist.name}</div>
                        <div class="artist-subtitle">Artist</div>
                    </div>
                `;
            });
            contentHtml += `</div>`;
        }

        if (data.tracks && data.tracks.length > 0) {
            contentHtml += `<h3 class="section-header" style="font-size: 20px; margin-top: 24px;">Songs</h3>`;
            contentHtml += `<div class="track-list">`;
            data.tracks.forEach((track, index) => {
                const imageUrl = track.album_cover_medium || 'https://placehold.co/40x40/333333/CCCCCC?text=?';
                const isLikedClass = track.is_liked ? 'active' : '';
                const likeTitle = track.is_liked ? 'Unlike' : 'Like';
                const playFunction = 'playTrackGlobal'; 

                contentHtml += `
                    <div class="track-item" 
                         data-track-id="${track.id}"
                         data-track-title="${escapeJsString(track.title)}"
                         data-track-artist="${escapeJsString(track.artist_name)}"
                         data-track-imageurl="${track.album_cover_medium || ''}"
                         data-track-audiourl="${track.preview_url || ''}"
                         data-track-duration-formatted="${track.duration_formatted || '0:00'}"
                         data-is-liked="${track.is_liked}"
                         onclick="${playFunction}('${track.id}', '${escapeJsString(track.title)}', '${escapeJsString(track.artist_name)}', '${track.album_cover_medium || ''}', '${track.preview_url || ''}', '${track.duration_formatted || '0:00'}')">
                        <div class="track-number">${index + 1}</div>
                        <div class="track-image" style="background-image: url('${imageUrl}');"></div>
                        <div class="track-info">
                            <div class="track-title">${track.title}</div>
                            <div class="track-artist">${track.artist_name}</div>
                        </div>
                        <div class="track-duration">${track.duration_formatted || '-'}</div>
                        <div class="track-icons" style="display: flex; align-items: center; gap: 10px;">
                            <button class="like-button ${isLikedClass}" data-track-id="${track.id}" onclick="event.stopPropagation();" title="${likeTitle} this song">
                                <svg class="heart-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24">
                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                                </svg>
                            </button>
                            <button class="add-to-playlist-button" data-track-id="${track.id}" title="Add to playlist">
                                <svg class="add-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                            </button>
                        </div>
                    </div>
                `;
            });
            contentHtml += `</div>`;
        }

        resultsContainer.innerHTML = contentHtml;

        if (typeof buildTracksListFromPage === 'function') {
            buildTracksListFromPage('#live-search-results-container .track-item', 'Search Results Live');
        }
        setupDynamicElementListeners('#live-search-results-container');
    }

    function clearResults() {
        resultsContainer.innerHTML = '';
    }

    function showInitialBrowseContent() {
        const newReleasesUrl = (window.appUrls && window.appUrls.newReleases) ? window.appUrls.newReleases : '/new-releases/';
        const initialContent = `
            <h2 class="section-header">Browse all</h2>
            <div class="card-grid browse-cards">
                <a href="https://www.deezer.com/explore/podcasts" target="_blank" class="card-link-wrapper">
                    <div class="card" style="background-color: #e13300;"><div class="card-title" style="font-size: 20px; padding-top: 10px;">Podcasts</div></div>
                </a>
                <a href="https://www.deezer.com/us/personalized" target="_blank" class="card-link-wrapper">
                    <div class="card" style="background-color: #1e3264;"><div class="card-title" style="font-size: 20px; padding-top: 10px;">Made For You</div></div>
                </a>
                <a href="https://www.deezer.com/explore/charts" target="_blank" class="card-link-wrapper">
                    <div class="card" style="background-color: #8d67ab;"><div class="card-title" style="font-size: 20px; padding-top: 10px;">Charts</div></div>
                </a>
                <a href="${newReleasesUrl}" class="card-link-wrapper">
                    <div class="card" style="background-color: #ba5d07;"><div class="card-title" style="font-size: 20px; padding-top: 10px;">New Releases</div></div>
                </a>
            </div>`;
        if (resultsContainer) resultsContainer.innerHTML = initialContent;
    }
    
    function escapeJsString(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
    }

    function setupDynamicElementListeners(containerSelector) {
        const container = document.querySelector(containerSelector);
        if (!container) {
            console.warn("Search.js: Dynamic element container not found:", containerSelector);
            return;
        }
        console.log("Search.js: Setting up dynamic element listeners for container:", containerSelector);

        container.querySelectorAll('.like-button').forEach(button => {
            button.removeEventListener('click', window.handleLikeSong); 
            button.addEventListener('click', window.handleLikeSong);
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

        if (typeof window.setupAddToPlaylistButtons === 'function') {
            console.log("Search.js: Calling window.setupAddToPlaylistButtons() for dynamic content.");
            window.setupAddToPlaylistButtons(); 
            const dynamicAddButtons = container.querySelectorAll('.add-to-playlist-button');
            console.log(`Search.js DEBUG: Found ${dynamicAddButtons.length} .add-to-playlist-button in dynamic container.`);
            dynamicAddButtons.forEach(btn => {
                console.log('Search.js DEBUG: Dynamic Add button for track', btn.dataset.trackId, 'has listenerAttached:', btn.dataset.listenerAttached);
            });
        } else {
            console.warn("Search.js: window.setupAddToPlaylistButtons is not defined. Modal may not work for dynamic items.");
        }

        container.querySelectorAll('.artist-card').forEach(card => {
            card.removeEventListener('click', handleArtistCardClick); 
            card.addEventListener('click', handleArtistCardClick);
        });
    }

    function handleArtistCardClick(event) {
        const artistId = this.getAttribute('data-artist-id');
        if (artistId) {
            window.location.href = `/artist/${artistId}/`;
        } else {
            console.warn("Search.js: Artist ID not found on clicked card:", this);
        }
    }
    
    setupDynamicElementListeners('#live-search-results-container');

    if (!searchInputField.value.trim()) {
        showInitialBrowseContent();
    }
});
