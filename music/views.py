from django.shortcuts import render, redirect, get_object_or_404
from django.http import HttpResponse, JsonResponse, Http404
from django.contrib.auth.models import User
from django.contrib import messages, auth
from django.contrib.auth.decorators import login_required
from .models import Song, UserProfile, Playlist 
from .forms import PlaylistForm 
import requests
import json
import logging 

logger = logging.getLogger(__name__) 

DEEZER_API_URL = "https://api.deezer.com"

def format_duration_helper(seconds_str):
    """Helper function to format seconds string into M:SS. Handles None or invalid."""
    try:
        seconds = int(seconds_str) 
        if seconds < 0:
            return "0:00"
        minutes = seconds // 60
        secs = seconds % 60
        return f"{minutes}:{secs:02d}"
    except (ValueError, TypeError):
        return "0:00" 

def get_or_create_song(deezer_id_str): 
    """
    Retrieves a song from the database by its Deezer ID (string) or creates it
    by fetching details (including duration) from the Deezer API.
    """
    if not deezer_id_str:
        logger.error("get_or_create_song called with empty or None deezer_id_str")
        return None
    try:
        song = Song.objects.get(deezer_id=str(deezer_id_str))
        logger.info(f"Song '{song.title}' (Deezer ID: {deezer_id_str}) found in DB.")
        return song
    except Song.DoesNotExist:
        logger.info(f"Song with Deezer ID {deezer_id_str} not in DB. Fetching from Deezer...")
        track_endpoint = f"{DEEZER_API_URL}/track/{deezer_id_str}"
        try:
            response = requests.get(track_endpoint, timeout=10)
            response.raise_for_status() 
            track_data = response.json()
            if track_data.get('id') == 0 or 'error' in track_data:
                error_details = track_data.get('error', {'message': 'Track not found by Deezer (id was 0 or error field present)'})
                logger.error(f"Deezer API error for track {deezer_id_str}: {error_details}")
                return None
            title = track_data.get('title_short') or track_data.get('title')
            artist_name = track_data.get('artist', {}).get('name')
            album_cover_url = track_data.get('album', {}).get('cover_medium', '') 
            preview_url = track_data.get('preview', '') 
            duration_seconds_api = track_data.get('duration')
            if not title or not artist_name:
                logger.error(f"Missing essential data (title or artist) for Deezer track {deezer_id_str}. Title: {title}, Artist: {artist_name}")
                return None
            album_cover_url = album_cover_url[:499] if album_cover_url else ''
            preview_url = preview_url[:499] if preview_url else ''
            duration_to_save = None
            if duration_seconds_api is not None:
                try:
                    duration_to_save = int(duration_seconds_api)
                except (ValueError, TypeError):
                    logger.warning(f"Could not convert duration '{duration_seconds_api}' to int for track {deezer_id_str}. Saving duration as None.")
            song = Song.objects.create(
                deezer_id=str(deezer_id_str), 
                title=title,
                artist_name=artist_name,
                album_cover_url=album_cover_url,
                preview_url=preview_url,
                duration=duration_to_save
            )
            logger.info(f"Song '{title}' (Deezer ID: {deezer_id_str}) created in DB with duration: {duration_to_save}s.")
            return song
        except requests.exceptions.HTTPError as http_err:
            logger.error(f"HTTP error fetching song {deezer_id_str} from Deezer API: {http_err}. Response: {response.text if 'response' in locals() and hasattr(response, 'text') else 'N/A'}")
            return None
        except requests.exceptions.RequestException as e: 
            logger.error(f"Request error fetching song {deezer_id_str} from Deezer API: {e}")
            return None
        except json.JSONDecodeError:
            logger.error(f"Error decoding JSON for song {deezer_id_str} from Deezer API. Response: {response.text if 'response' in locals() and hasattr(response, 'text') else 'N/A'}")
            return None
        except Exception as e: 
            logger.error(f"An unexpected error occurred in get_or_create_song (API fetch part) for {deezer_id_str}: {e}", exc_info=True)
            return None
    except Exception as e: 
        logger.error(f"Database or other error during get_or_create_song for {deezer_id_str}: {e}", exc_info=True)
        return None

@login_required(login_url='login')
def like_song_view(request):
    if request.method == 'POST':
        try:
            deezer_id_from_request = None
            if request.content_type == 'application/json':
                data = json.loads(request.body)
                deezer_id_from_request = data.get('deezer_id')
            else:
                deezer_id_from_request = request.POST.get('deezer_id')
            if not deezer_id_from_request:
                logger.warning(f"User {request.user.username} - Like song request: Deezer ID not provided.")
                return JsonResponse({'error': 'Deezer ID not provided'}, status=400)
            deezer_id_str = str(deezer_id_from_request) 
            logger.info(f"User {request.user.username} attempting to like/unlike song with Deezer ID: {deezer_id_str}")
            song = get_or_create_song(deezer_id_str) 
            if not song:
                logger.error(f"User {request.user.username} - Failed to get/create song (Deezer ID: {deezer_id_str}) in like_song_view.")
                return JsonResponse({'error': 'Song data could not be retrieved or created. Please try again.'}, status=404)
            user_profile, created_profile = UserProfile.objects.get_or_create(user=request.user)
            if created_profile:
                logger.info(f"UserProfile created for user {request.user.username} during like action.")
            action_taken = ''
            is_liked_after_action = False
            if user_profile.liked_songs.filter(pk=song.pk).exists(): 
                user_profile.liked_songs.remove(song)
                is_liked_after_action = False
                action_taken = 'unliked'
                logger.info(f"User {request.user.username} unliked song '{song.title}' (ID: {song.deezer_id})")
            else:
                user_profile.liked_songs.add(song)
                is_liked_after_action = True
                action_taken = 'liked'
                logger.info(f"User {request.user.username} liked song '{song.title}' (ID: {song.deezer_id})")
            return JsonResponse({
                'liked': is_liked_after_action,
                'action': action_taken,
                'song_id': song.deezer_id,
                'title': song.title 
            })
        except json.JSONDecodeError:
            logger.error(f"User {request.user.username} - Like song request: Invalid JSON data.", exc_info=True)
            return JsonResponse({'error': 'Invalid JSON data provided.'}, status=400)
        except Exception as e:
            logger.error(f"Unexpected error in like_song_view for user {request.user.username}, Deezer ID {deezer_id_from_request if 'deezer_id_from_request' in locals() else 'N/A'}: {e}", exc_info=True)
            return JsonResponse({'error': 'An internal server error occurred while processing your request.'}, status=500)
    logger.warning(f"User {request.user.username} - Like song request: Invalid request method ({request.method}).")
    return JsonResponse({'error': 'Invalid request method. Only POST is allowed.'}, status=405)

def _add_is_liked_status_to_tracks(request, tracks_list):
    if request.user.is_authenticated and tracks_list:
        try:
            user_profile, created = UserProfile.objects.get_or_create(user=request.user)
            if created:
                logger.info(f"UserProfile created for {request.user.username} in _add_is_liked_status_to_tracks")
            liked_song_deezer_ids = set(user_profile.liked_songs.values_list('deezer_id', flat=True))
            logger.debug(f"_add_is_liked_status_to_tracks: Liked song Deezer IDs for user {request.user.username}: {liked_song_deezer_ids}")
        except Exception as e: 
            logger.error(f"Error accessing UserProfile or liked_songs for {request.user.username}: {e}", exc_info=True)
            liked_song_deezer_ids = set()
            logger.debug(f"_add_is_liked_status_to_tracks: Liked song Deezer IDs set to empty due to error.")
        for i, track in enumerate(tracks_list):
            logger.debug(f"_add_is_liked_status_to_tracks: Processing track {i}: Type: {type(track)}, Content (first 100 chars): {str(track)[:100]}")
            if isinstance(track, dict) and 'id' in track: 
                track_id_str = str(track['id'])
                track['is_liked'] = track_id_str in liked_song_deezer_ids
                logger.debug(f"_add_is_liked_status_to_tracks: Track ID {track_id_str} is_liked: {track['is_liked']}")
            elif hasattr(track, 'deezer_id'): 
                 track_id_str = str(track.deezer_id)
                 track.is_liked = track_id_str in liked_song_deezer_ids
                 logger.debug(f"_add_is_liked_status_to_tracks: Track ID {track_id_str} is_liked: {track.is_liked}")
            else:
                if isinstance(track, dict): track['is_liked'] = False
                logger.warning(f"Track object in _add_is_liked_status_to_tracks has unexpected structure: {track}")
                logger.debug(f"_add_is_liked_status_to_tracks: Assigned is_liked=False due to unexpected structure.")
    elif tracks_list: 
        for track in tracks_list:
            if isinstance(track, dict): track['is_liked'] = False
            elif hasattr(track, 'deezer_id'): track.is_liked = False 
    return tracks_list

@login_required(login_url='login') 
def index(request):
    top_artists_list = get_top_artists(limit=10)
    top_tracks_list = get_top_tracks(limit=10)
    top_playlists_list = get_top_playlists(limit=8)
    top_tracks_list = _add_is_liked_status_to_tracks(request, top_tracks_list)
    playlists = []
    if request.user.is_authenticated:
        playlists = Playlist.objects.filter(user=request.user).order_by('-id')
    context = {
        'top_artists': top_artists_list,
        'top_tracks': top_tracks_list,
        'top_playlists': top_playlists_list,
        'playlists': playlists, 
    }
    return render(request , 'index.html', context)

def search_view(request):
    query = request.GET.get('q', None)
    context = {'query': query, 'has_results': False}
    if query:
        search_results_dict = search_deezer(query) 
        if search_results_dict:
            if 'tracks' in search_results_dict:
                search_results_dict['tracks'] = _add_is_liked_status_to_tracks(request, search_results_dict['tracks'])
            context.update(search_results_dict)
            context['has_results'] = any(bool(search_results_dict.get(key)) for key in ['tracks', 'artists', 'albums'])
    else: 
        context['api_error'] = True if query else False 
    user_playlists = []
    if request.user.is_authenticated:
        user_playlists = Playlist.objects.filter(user=request.user).order_by('-id')
    context['playlists'] = user_playlists
    return render(request, 'search.html', context)

def artist_profile_view(request, artist_id):
    artist_data = get_artist_details(artist_id) 
    if artist_data is None:
        raise Http404("Artist not found or error fetching details from Deezer.")
    logger.debug(f"Artist Profile View: Before adding is_liked, top_tracks type: {type(artist_data.get('top_tracks'))}, count: {len(artist_data.get('top_tracks', []))}")
    if artist_data.get('top_tracks'):
        artist_data['top_tracks'] = _add_is_liked_status_to_tracks(request, artist_data['top_tracks'])
        logger.debug(f"Artist Profile View: After adding is_liked, top_tracks count: {len(artist_data.get('top_tracks', []))}")
        if artist_data['top_tracks']:
            logger.debug(f"Artist Profile View: Sample track after adding is_liked: {artist_data['top_tracks'][0]}")
    context = {'artist': artist_data}
    user_playlists = []
    if request.user.is_authenticated:
        user_playlists = Playlist.objects.filter(user=request.user).order_by('-id')
    context['playlists'] = user_playlists
    return render(request, 'artist_profile.html', context)

def deezer_playlist_detail_view(request, playlist_id):
    playlist_data = get_deezer_playlist_details(playlist_id)
    if playlist_data is None:
        raise Http404("Deezer playlist not found or error fetching details.")
    if playlist_data.get('tracks'):
        playlist_data['tracks'] = _add_is_liked_status_to_tracks(request, playlist_data['tracks'])
    context = {
        'playlist': playlist_data,
        'is_deezer_playlist': True
        }
    user_playlists = []
    if request.user.is_authenticated:
        user_playlists = Playlist.objects.filter(user=request.user).order_by('-id')
    context['playlists'] = user_playlists
    return render(request, 'playlist_details.html', context)

def login_view(request):
    if request.user.is_authenticated:
        return redirect('index')
    if request.method == 'POST':
        username = request.POST.get('username','').strip()
        password = request.POST.get('password','')
        user = auth.authenticate(request, username=username, password=password)
        if user is not None:
            auth.login(request, user)
            next_url = request.POST.get('next') or request.GET.get('next') or '/'
            if not next_url.startswith('/'): next_url = '/' 
            messages.success(request, f"Welcome back, {user.username}!")
            return redirect(next_url)
        else:
            messages.error(request, 'Invalid username or password. Please try again.')
            return render(request, 'login.html', {'username': username}) 
    return render(request, 'login.html')

def signup_view(request):
    if request.user.is_authenticated:
        return redirect('index')
    if request.method == 'POST':
        email = request.POST.get('email','').strip()
        username = request.POST.get('username','').strip()
        password = request.POST.get('password','')
        password2 = request.POST.get('password2','')
        if not all([email, username, password, password2]):
            messages.error(request, 'All fields are required.')
            return render(request, 'signup.html', request.POST)
        if password != password2:
            messages.error(request, 'Passwords do not match.')
            return render(request, 'signup.html', request.POST)
        if User.objects.filter(username=username).exists():
            messages.error(request, 'Username already taken. Please choose another.')
            return render(request, 'signup.html', request.POST)
        if User.objects.filter(email=email).exists():
            messages.error(request, 'Email already registered. Please use a different email or log in.')
            return render(request, 'signup.html', request.POST)
        try:
            user = User.objects.create_user(username=username, email=email, password=password)
            auth.login(request, user) 
            messages.success(request, f"Account created successfully! Welcome, {username}!")
            return redirect('/')
        except Exception as e:
            logger.error(f"Error during signup for {username}: {e}", exc_info=True)
            messages.error(request, 'An error occurred during signup. Please try again.')
            return render(request, 'signup.html', request.POST)
    return render(request, 'signup.html')

@login_required(login_url='login')
def logout_view(request):
    auth.logout(request)
    messages.info(request, "You have been successfully logged out.")
    return redirect('login')

@login_required(login_url='login')
def liked_songs_list_view(request):
    user_profile, created = UserProfile.objects.get_or_create(user=request.user)
    liked_songs_list = user_profile.liked_songs.all().order_by('title')
    for song in liked_songs_list:
        song.is_liked = True
    context = {'liked_songs': liked_songs_list}
    user_playlists = []
    if request.user.is_authenticated:
        user_playlists = Playlist.objects.filter(user=request.user).order_by('-id')
    context['playlists'] = user_playlists
    return render(request, 'liked_songs.html', context)

@login_required(login_url='login')
def create_playlist_view(request):
    if request.method == 'POST':
        form = PlaylistForm(request.POST)
        if form.is_valid():
            playlist = form.save(commit=False)
            playlist.user = request.user
            playlist.save()
            messages.success(request, f"Playlist '{playlist.name}' created successfully!")
            return redirect('user_playlist_detail', playlist_id=playlist.id)
        else:
            messages.error(request, "Please correct the errors in the form.")
    else:
        form = PlaylistForm()
    user_playlists = []
    if request.user.is_authenticated:
        user_playlists = Playlist.objects.filter(user=request.user).order_by('-id')
    context = {'form': form, 'playlists': user_playlists}
    return render(request, 'create_playlist.html', context)

@login_required(login_url='login')
def my_playlists_view(request):
    playlists = Playlist.objects.filter(user=request.user).order_by('-id')
    context = {'playlists': playlists}
    return render(request, 'my_playlists.html', context)

@login_required(login_url='login')
def user_playlist_detail_view(request, playlist_id):
    playlist = get_object_or_404(Playlist, pk=playlist_id, user=request.user)
    playlist_songs_qs = playlist.songs.all().order_by('title')
    playlist_songs_list = list(playlist_songs_qs) 
    playlist_songs_list = _add_is_liked_status_to_tracks(request, playlist_songs_list)
    context = {
        'playlist': playlist,
        'playlist_songs': playlist_songs_list, 
        'is_deezer_playlist': False
    }
    user_playlists = []
    if request.user.is_authenticated:
        user_playlists = Playlist.objects.filter(user=request.user).order_by('-id')
    context['playlists'] = user_playlists
    return render(request, 'user_playlist_detail.html', context)

@login_required(login_url='login')
def add_song_to_playlist_view(request, playlist_id):
    if request.method == 'POST':
        try:
            if request.content_type == 'application/json':
                data = json.loads(request.body)
                deezer_id_from_request = data.get('deezer_id')
            else:
                deezer_id_from_request = request.POST.get('deezer_id')
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON data'}, status=400)
        if not deezer_id_from_request:
            return JsonResponse({'error': 'Deezer ID not provided for song'}, status=400)
        song = get_or_create_song(str(deezer_id_from_request))
        if not song:
            return JsonResponse({'error': 'Song could not be found or created from Deezer'}, status=404)
        try:
            playlist = Playlist.objects.get(pk=playlist_id, user=request.user)
        except Playlist.DoesNotExist:
            return JsonResponse({'error': 'Playlist not found or you do not own it'}, status=404)
        
        response_data = {}
        if playlist.songs.filter(pk=song.pk).exists():
            response_data = {'success': False, 'message': f"'{song.title}' is already in '{playlist.name}'.", 'song_id': song.deezer_id}
        else:
            playlist.songs.add(song)
            playlist.update_cover_image() 
            response_data = {'success': True, 'message': f"Added '{song.title}' to '{playlist.name}'", 'song_id': song.deezer_id}
        return JsonResponse(response_data)
    return JsonResponse({'error': 'Invalid request method. Only POST is allowed.'}, status=405)

@login_required(login_url='login')
def remove_song_from_playlist_view(request, playlist_id):
    if request.method == 'POST':
        try:
            if request.content_type == 'application/json':
                data = json.loads(request.body)
                deezer_id_from_request = data.get('deezer_id')
            else:
                deezer_id_from_request = request.POST.get('deezer_id')
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON data'}, status=400)
        if not deezer_id_from_request:
            return JsonResponse({'error': 'Deezer ID not provided for song'}, status=400)
        try:
            song = Song.objects.get(deezer_id=str(deezer_id_from_request))
        except Song.DoesNotExist:
             return JsonResponse({'error': 'Song not found in local database. Cannot remove.'}, status=404)
        try:
            playlist = Playlist.objects.get(pk=playlist_id, user=request.user)
        except Playlist.DoesNotExist:
            return JsonResponse({'error': 'Playlist not found or you do not own it'}, status=404)
        
        response_data = {}
        if playlist.songs.filter(pk=song.pk).exists():
            playlist.songs.remove(song)
            playlist.update_cover_image()
            response_data = {'success': True, 'message': f"Removed '{song.title}' from '{playlist.name}'", 'song_id': song.deezer_id}
        else:
            response_data = {'success': False, 'message': f"'{song.title}' was not found in this playlist.", 'song_id': song.deezer_id}
        return JsonResponse(response_data)
    return JsonResponse({'error': 'Invalid request method. Only POST is allowed.'}, status=405)

@login_required(login_url='login')
def list_user_playlists_view(request):
    if request.method == 'GET':
        try:
            user_playlists = Playlist.objects.filter(user=request.user).values('id', 'name').order_by('name')
            playlists_data = list(user_playlists) 
            logger.info(f"User {request.user.username}: Retrieved {len(playlists_data)} playlists for selection.")
            return JsonResponse({'playlists': playlists_data})
        except Exception as e:
            logger.error(f"Error listing user playlists for {request.user.username}: {e}", exc_info=True)
            return JsonResponse({'error': 'An error occurred while retrieving your playlists.'}, status=500)
    logger.warning(f"User {request.user.username}: Invalid request method ({request.method}) for list_user_playlists_view.")
    return JsonResponse({'error': 'Invalid request method. Only GET is allowed.'}, status=405)

@login_required(login_url='login')
def add_song_to_playlists_view(request):
    if request.method == 'POST':
        try:
            if request.content_type != 'application/json':
                 logger.warning(f"User {request.user.username}: add_song_to_playlists_view received non-JSON content type: {request.content_type}")
                 return JsonResponse({'error': 'Invalid content type. Must be application/json.'}, status=415) 
            data = json.loads(request.body)
            deezer_id_from_request = data.get('deezer_id')
            playlist_ids_from_request = data.get('playlist_ids', [])
            if not deezer_id_from_request:
                logger.warning(f"User {request.user.username}: Add song to playlists request: Deezer ID not provided.")
                return JsonResponse({'error': 'Deezer ID not provided'}, status=400)
            if not isinstance(playlist_ids_from_request, list):
                 logger.warning(f"User {request.user.username}: Add song to playlists request: playlist_ids is not a list.")
                 return JsonResponse({'error': 'Invalid data format for playlist_ids. Must be a list.'}, status=400)
            if not playlist_ids_from_request:
                 logger.info(f"User {request.user.username}: Add song to playlists request: No playlist IDs provided.")
                 return JsonResponse({'message': 'No playlists selected.'}, status=200) 
            deezer_id_str = str(deezer_id_from_request)
            logger.info(f"User {request.user.username} attempting to add song (Deezer ID: {deezer_id_str}) to playlists: {playlist_ids_from_request}")
            song = get_or_create_song(deezer_id_str)
            if not song:
                logger.error(f"User {request.user.username}: Failed to get/create song (Deezer ID: {deezer_id_str}) in add_song_to_playlists_view.")
                return JsonResponse({'error': 'Song data could not be retrieved or created. Please try again.'}, status=404)
            results = {}
            user_owned_playlists = Playlist.objects.filter(user=request.user, id__in=playlist_ids_from_request)
            if len(user_owned_playlists) != len(playlist_ids_from_request):
                 owned_ids = set(user_owned_playlists.values_list('id', flat=True))
                 unowned_or_missing_ids = [pid for pid in playlist_ids_from_request if pid not in owned_ids]
                 logger.warning(f"User {request.user.username}: Attempted to add song to playlists not owned or missing: {unowned_or_missing_ids}")
            for playlist in user_owned_playlists:
                try:
                    if playlist.songs.filter(pk=song.pk).exists():
                        results[playlist.id] = {'success': False, 'message': f"Already in '{playlist.name}'"}
                        logger.info(f"User {request.user.username}: Song '{song.title}' (ID: {song.deezer_id}) already in playlist '{playlist.name}' (ID: {playlist.id}).")
                    else:
                        playlist.songs.add(song)
                        playlist.update_cover_image() 
                        results[playlist.id] = {'success': True, 'message': f"Added to '{playlist.name}'"}
                        logger.info(f"User {request.user.username}: Added song '{song.title}' (ID: {song.deezer_id}) to playlist '{playlist.name}' (ID: {playlist.id}).")
                except Exception as add_e:
                    results[playlist.id] = {'success': False, 'message': f"Error adding to '{playlist.name}'"}
                    logger.error(f"User {request.user.username}: Error adding song {song.deezer_id} to playlist {playlist.id}: {add_e}", exc_info=True)
            for requested_id in playlist_ids_from_request:
                 if requested_id not in results:
                      results[requested_id] = {'success': False, 'message': 'Playlist not found or not owned'}
                      logger.warning(f"User {request.user.username}: Reported playlist ID {requested_id} as not found/owned in results.")
            return JsonResponse({'results': results, 'song_title': song.title})
        except json.JSONDecodeError:
            logger.error(f"User {request.user.username}: Add song to playlists request: Invalid JSON data.", exc_info=True)
            return JsonResponse({'error': 'Invalid JSON data provided.'}, status=400)
        except Exception as e:
            logger.error(f"Unexpected error in add_song_to_playlists_view for user {request.user.username}: {e}", exc_info=True)
            return JsonResponse({'error': 'An internal server error occurred while processing your request.'}, status=500)
    logger.warning(f"User {request.user.username}: Invalid request method ({request.method}) for add_song_to_playlists_view.")
    return JsonResponse({'error': 'Invalid request method. Only POST is allowed.'}, status=405)

@login_required(login_url='login') 
def get_fresh_preview_url_view(request, deezer_id_str):
    if request.method == 'GET':
        logger.info(f"User {request.user.username} requesting fresh preview for Deezer ID: {deezer_id_str}")
        track_endpoint = f"{DEEZER_API_URL}/track/{deezer_id_str}"
        try:
            response = requests.get(track_endpoint, timeout=10)
            response.raise_for_status() 
            track_data = response.json()
            if track_data.get('id') == 0 or 'error' in track_data:
                error_details = track_data.get('error', {'message': 'Track not found by Deezer (id was 0 or error field present)'})
                logger.error(f"Deezer API error fetching fresh preview for track {deezer_id_str}: {error_details}")
                return JsonResponse({'error': 'Track not found or Deezer API error.', 'preview_url': None}, status=404)
            preview_url = track_data.get('preview', None) 
            if preview_url and isinstance(preview_url, str) and preview_url.strip():
                logger.info(f"Fresh preview URL for {deezer_id_str}: {preview_url}")
                return JsonResponse({'preview_url': preview_url.strip()})
            else:
                logger.warn(f"No valid preview URL returned from Deezer for track {deezer_id_str}. Raw preview: '{preview_url}'")
                return JsonResponse({'preview_url': None, 'message': 'Preview not available for this track.'})
        except requests.exceptions.HTTPError as http_err:
            logger.error(f"HTTP error fetching fresh preview for {deezer_id_str} from Deezer: {http_err}")
            return JsonResponse({'error': 'Failed to fetch track details from Deezer (HTTP Error).', 'preview_url': None}, status=502) 
        except requests.exceptions.RequestException as e:
            logger.error(f"Request error fetching fresh preview for {deezer_id_str} from Deezer: {e}")
            return JsonResponse({'error': 'Network error while fetching track details.', 'preview_url': None}, status=503) 
        except json.JSONDecodeError:
            logger.error(f"Error decoding JSON for fresh preview of {deezer_id_str} from Deezer.")
            return JsonResponse({'error': 'Invalid response from Deezer API.', 'preview_url': None}, status=500)
        except Exception as e:
            logger.error(f"Unexpected error in get_fresh_preview_url_view for {deezer_id_str}: {e}", exc_info=True)
            return JsonResponse({'error': 'An internal server error occurred.', 'preview_url': None}, status=500)
    return JsonResponse({'error': 'Invalid request method. Only GET is allowed.'}, status=405)

def get_top_artists(limit=10):
    endpoint = f"{DEEZER_API_URL}/chart/0/artists"
    params = {'limit': limit}
    artists_info = []
    processed_artist_ids = set()
    logger.info(f"Requesting top {limit} artists chart from Deezer...")
    try:
        response = requests.get(endpoint, params=params, timeout=10)
        response.raise_for_status()
        response_data = response.json()
        if 'data' in response_data and isinstance(response_data['data'], list):
            for artist_data in response_data['data']:
                 if len(artists_info) >= limit: break
                 if not isinstance(artist_data, dict): continue
                 artist_id = artist_data.get('id')
                 artist_name = artist_data.get('name')
                 if not artist_id or not artist_name: continue
                 if artist_id not in processed_artist_ids:
                     artists_info.append((artist_name, artist_id, artist_data.get('picture_medium')))
                     processed_artist_ids.add(artist_id)
        elif 'error' in response_data:
            logger.error(f"API Error fetching top artists: {response_data.get('error')}")
        else:
            logger.warning("Warning: 'data' key not found or not a list in Deezer Top Artists API response.")
    except requests.exceptions.RequestException as e:
        logger.error(f"Error making Deezer API request for top artists: {e}")
    except json.JSONDecodeError:
        logger.error(f"Error decoding JSON for top artists.")
    except Exception as e:
        logger.error(f"An unexpected error occurred fetching top artists: {e}", exc_info=True)
    return artists_info

def get_top_playlists(limit=10):
    endpoint = f"{DEEZER_API_URL}/chart/0/playlists"
    params = {'limit': limit}
    playlists_info = []
    logger.info(f"Requesting top {limit} playlists chart from Deezer...")
    try:
        response = requests.get(endpoint, params=params, timeout=10)
        response.raise_for_status()
        response_data = response.json()
        if 'data' in response_data and isinstance(response_data['data'], list):
            for playlist_data in response_data['data']:
                 if not isinstance(playlist_data, dict): continue
                 playlist_id = playlist_data.get('id')
                 playlist_title = playlist_data.get('title')
                 if not playlist_id or not playlist_title: continue
                 user_data = playlist_data.get('user')
                 creator_name = user_data.get('name', 'Deezer') if user_data else 'Deezer'
                 description = playlist_data.get('description', '')
                 subtitle = description if description else f"By {creator_name}"
                 playlists_info.append({
                     'id': playlist_id,
                     'title': playlist_title,
                     'picture_medium': playlist_data.get('picture_medium'),
                     'subtitle': subtitle,
                     'link': playlist_data.get('link')
                 })
        elif 'error' in response_data:
            logger.error(f"API Error fetching top playlists: {response_data.get('error')}")
    except requests.exceptions.RequestException as e:
        logger.error(f"Error (Playlists API): {e}")
    except json.JSONDecodeError:
        logger.error(f"Error decoding JSON (Playlists API).")
    except Exception as e:
        logger.error(f"Unexpected error (Playlists API): {e}", exc_info=True)
    return playlists_info

def get_top_tracks(limit=10):
    endpoint = f"{DEEZER_API_URL}/chart/0/tracks"
    params = {'limit': limit}
    tracks_info = []
    logger.info(f"Requesting top {limit} tracks chart from Deezer...")
    try:
        response = requests.get(endpoint, params=params, timeout=10)
        response.raise_for_status()
        response_data = response.json()
        if 'data' in response_data and isinstance(response_data['data'], list):
            for track_data in response_data['data']:
                 if not isinstance(track_data, dict): continue
                 track_id = track_data.get('id')
                 track_title = track_data.get('title_short') or track_data.get('title')
                 artist_data = track_data.get('artist')
                 album_data = track_data.get('album')
                 duration_seconds = track_data.get('duration')
                 if not all([track_id, track_title, artist_data, album_data, duration_seconds is not None]): continue
                 tracks_info.append({
                     'id': track_id,
                     'title': track_title,
                     'artist_name': artist_data.get('name', 'Unknown Artist'),
                     'album_cover_medium': album_data.get('cover_medium'),
                     'duration_formatted': format_duration_helper(duration_seconds),
                     'preview_url': track_data.get('preview'),
                     'duration_seconds': duration_seconds
                 })
        elif 'error' in response_data:
            logger.error(f"API Error fetching top tracks: {response_data.get('error')}")
    except requests.exceptions.RequestException as e:
        logger.error(f"Error (Tracks API): {e}")
    except json.JSONDecodeError:
        logger.error(f"Error decoding JSON (Tracks API).")
    except Exception as e:
        logger.error(f"Unexpected error (Tracks API): {e}", exc_info=True)
    return tracks_info

def search_deezer(query, limit_tracks=10, limit_artists=6, limit_albums=6):
    search_results = {'tracks': [], 'artists': [], 'albums': []}
    search_endpoint = f"{DEEZER_API_URL}/search"
    params = {'q': query, 'limit': max(limit_tracks, limit_artists, limit_albums) + 15} 
    logger.info(f"Searching Deezer for: '{query}'")
    try:
        response = requests.get(search_endpoint, params=params, timeout=15)
        response.raise_for_status()
        data = response.json()
        if 'data' in data and isinstance(data['data'], list):
            for item in data['data']:
                item_type = item.get('type')
                if item_type == 'track' and len(search_results['tracks']) < limit_tracks:
                    artist_data = item.get('artist')
                    album_data = item.get('album')
                    duration_seconds = item.get('duration')
                    if not all([item.get('id'), item.get('title'), artist_data, album_data, duration_seconds is not None]): continue
                    search_results['tracks'].append({
                        'id': item.get('id'),
                        'title': item.get('title_short') or item.get('title'),
                        'artist_name': artist_data.get('name'),
                        'artist_id': artist_data.get('id'),
                        'album_cover_medium': album_data.get('cover_medium'),
                        'duration_formatted': format_duration_helper(duration_seconds),
                        'preview_url': item.get('preview'),
                        'rank': item.get('rank'),
                        'duration_seconds': duration_seconds
                    })
                elif item_type == 'artist' and len(search_results['artists']) < limit_artists:
                    if not item.get('id') or not item.get('name'): continue
                    search_results['artists'].append({
                        'id': item.get('id'),
                        'name': item.get('name'),
                        'picture_medium': item.get('picture_medium'),
                    })
                elif item_type == 'album' and len(search_results['albums']) < limit_albums:
                     artist_data = item.get('artist')
                     if not item.get('id') or not item.get('title') or not artist_data: continue
                     search_results['albums'].append({
                        'id': item.get('id'),
                        'title': item.get('title'),
                        'picture_medium': item.get('cover_medium'),
                        'artist_name': artist_data.get('name'),
                        'artist_id': artist_data.get('id'),
                     })
        elif 'error' in data:
             logger.error(f"Search API Error for query '{query}': {data.get('error')}")
             return None 
        else:
             logger.warning(f"Warning: 'data' key not found or not a list in Deezer Search API response for query '{query}'.")
    except requests.exceptions.RequestException as e:
        logger.error(f"Error making Deezer Search API request for query '{query}': {e}")
        return None
    except json.JSONDecodeError:
        logger.error(f"Error decoding JSON from Deezer Search API for query '{query}'.")
        return None
    except Exception as e:
        logger.error(f"An unexpected error occurred during Deezer search for query '{query}': {e}", exc_info=True)
        return None
    return search_results

def get_artist_details(artist_id):
    artist_details = None
    top_tracks = []
    artist_endpoint = f"{DEEZER_API_URL}/artist/{artist_id}"
    logger.info(f"Requesting artist details from: {artist_endpoint}")
    try:
        response_artist = requests.get(artist_endpoint, timeout=10)
        response_artist.raise_for_status()
        artist_data = response_artist.json()
        if 'error' in artist_data:
             logger.error(f"API Error fetching artist details for ID {artist_id}: {artist_data.get('error')}")
             return None
        artist_details = {
            'id': artist_data.get('id'), 'name': artist_data.get('name'),
            'picture_small': artist_data.get('picture_small'), 'picture_medium': artist_data.get('picture_medium'),
            'picture_big': artist_data.get('picture_big'), 'picture_xl': artist_data.get('picture_xl'),
            'nb_album': artist_data.get('nb_album'), 'nb_fan': artist_data.get('nb_fan'),
            'link': artist_data.get('link')
        }
    except requests.exceptions.RequestException as e:
        logger.error(f"Error making Deezer API request for artist details (ID: {artist_id}): {e}")
        return None
    except json.JSONDecodeError:
        logger.error(f"Error decoding JSON for artist details (ID: {artist_id}).")
        return None
    except Exception as e:
        logger.error(f"An unexpected error occurred fetching artist details (ID: {artist_id}): {e}", exc_info=True)
        return None
    if not artist_details: return None
    top_tracks_endpoint = f"{DEEZER_API_URL}/artist/{artist_id}/top"
    params_top = {'limit': 10}
    logger.info(f"Requesting artist top tracks from: {top_tracks_endpoint}")
    try:
        response_tracks = requests.get(top_tracks_endpoint, params=params_top, timeout=10)
        response_tracks.raise_for_status()
        tracks_data = response_tracks.json()
        if 'data' in tracks_data and isinstance(tracks_data['data'], list):
            for track_data in tracks_data['data']:
                 if not isinstance(track_data, dict): continue
                 track_id = track_data.get('id')
                 track_title = track_data.get('title_short') or track_data.get('title')
                 duration_seconds = track_data.get('duration')
                 album_data = track_data.get('album')
                 rank = track_data.get('rank')
                 if not track_id or not track_title or not album_data: continue 
                 top_tracks.append({
                     'id': track_id, 'title': track_title,
                     'artist_name': artist_details.get('name'), 
                     'album_cover_medium': album_data.get('cover_medium'),
                     'duration_formatted': format_duration_helper(duration_seconds), 
                     'preview_url': track_data.get('preview'),
                     'rank': rank, 
                     'duration_seconds': duration_seconds 
                 })
        elif 'error' in tracks_data:
             logger.error(f"API Error fetching artist top tracks for artist ID {artist_id}: {tracks_data.get('error')}")
        else:
             logger.warning(f"Warning: 'data' key not found or not a list in Deezer Artist Top Tracks response for artist ID {artist_id}.")
    except requests.exceptions.RequestException as e:
        logger.error(f"Error for artist top tracks (Artist ID: {artist_id}): {e}")
    except json.JSONDecodeError:
        logger.error(f"Error decoding JSON for artist top tracks (Artist ID: {artist_id}).")
    except Exception as e:
        logger.error(f"Unexpected error fetching artist top tracks (Artist ID: {artist_id}): {e}", exc_info=True)
    artist_details['top_tracks'] = top_tracks
    return artist_details

def get_deezer_playlist_details(playlist_id):
    playlist_details = None
    playlist_endpoint = f"{DEEZER_API_URL}/playlist/{playlist_id}"
    logger.info(f"Requesting Deezer playlist details from: {playlist_endpoint}")
    try:
        response = requests.get(playlist_endpoint, timeout=15)
        response.raise_for_status()
        playlist_data = response.json()
        if 'error' in playlist_data:
             logger.error(f"API Error fetching Deezer playlist details for ID {playlist_id}: {playlist_data.get('error')}")
             return None
        creator_data = playlist_data.get('creator', {})
        tracks_data_list = playlist_data.get('tracks', {}).get('data', [])
        playlist_details = {
            'id': playlist_data.get('id'), 'title': playlist_data.get('title'),
            'description': playlist_data.get('description'),
            'duration_total_formatted': format_duration_helper(playlist_data.get('duration', 0)),
            'nb_tracks': playlist_data.get('nb_tracks'), 'fans': playlist_data.get('fans'),
            'link': playlist_data.get('link'), 'picture_small': playlist_data.get('picture_small'),
            'picture_medium': playlist_data.get('picture_medium'), 'picture_big': playlist_data.get('picture_big'),
            'picture_xl': playlist_data.get('picture_xl'),
            'creator_name': creator_data.get('name', 'Deezer'), 'creator_id': creator_data.get('id'),
            'tracks': []
        }
        for track_data in tracks_data_list:
            if not isinstance(track_data, dict): continue
            track_id = track_data.get('id')
            track_title = track_data.get('title_short') or track_data.get('title')
            artist_data = track_data.get('artist')
            album_data = track_data.get('album')
            duration_seconds = track_data.get('duration')
            if not all([track_id, track_title, artist_data, album_data]): continue
            playlist_details['tracks'].append({
                 'id': track_id, 'title': track_title,
                 'artist_name': artist_data.get('name', 'Unknown Artist'),
                 'album_cover_medium': album_data.get('cover_medium'),
                 'duration_formatted': format_duration_helper(duration_seconds),
                 'preview_url': track_data.get('preview'),
                 'duration_seconds': duration_seconds
             })
        return playlist_details
    except requests.exceptions.RequestException as e:
        logger.error(f"Error (Deezer Playlist Details API ID: {playlist_id}): {e}")
        return None
    except json.JSONDecodeError:
        logger.error(f"Error decoding JSON (Deezer Playlist Details API ID: {playlist_id}).")
        return None
    except Exception as e:
        logger.error(f"Unexpected error (Deezer Playlist Details API ID: {playlist_id}): {e}", exc_info=True)
        return None

def ajax_search_view(request):
    query = request.GET.get('q', None)
    results = {'tracks': [], 'artists': []}
    MAX_ARTISTS_DISPLAY = 5 

    if query and len(query.strip()) > 0:
        logger.info(f"AJAX search initiated for query: '{query}'")
       
        search_results_dict = search_deezer(query, limit_tracks=10, limit_artists=MAX_ARTISTS_DISPLAY, limit_albums=0) 

        if search_results_dict:
            raw_tracks = search_results_dict.get('tracks', [])
            if raw_tracks:
                tracks_copy = list(raw_tracks) 
                results['tracks'] = _add_is_liked_status_to_tracks(request, tracks_copy)

            final_artists_list = []
            processed_artist_ids = set() 

            if results['tracks']: 
                top_track = results['tracks'][0]
                top_track_artist_id = top_track.get('artist_id') 
                top_track_artist_name = top_track.get('artist_name')

                if top_track_artist_id:
                    top_track_artist_id_str = str(top_track_artist_id)
                    found_in_general_search = False
                    
                    original_artists_from_search = search_results_dict.get('artists', [])
                    for artist_from_search in original_artists_from_search:
                        if str(artist_from_search.get('id')) == top_track_artist_id_str:
                            final_artists_list.append(artist_from_search)
                            processed_artist_ids.add(top_track_artist_id_str)
                            found_in_general_search = True
                            logger.info(f"Prioritized top track artist '{top_track_artist_name}' (ID: {top_track_artist_id_str}) from general search.")
                            break 
                    
                    if not found_in_general_search and len(final_artists_list) < MAX_ARTISTS_DISPLAY:
                        logger.info(f"Top track artist (ID: {top_track_artist_id_str}, Name: {top_track_artist_name}) not in general search. Fetching details.")
                        detailed_artist = get_artist_details(top_track_artist_id_str) 
                        if detailed_artist and detailed_artist.get('id'):
                            artist_to_add = {
                                'id': detailed_artist.get('id'),
                                'name': detailed_artist.get('name'),
                                'picture_medium': detailed_artist.get('picture_medium')
                            }
                            final_artists_list.append(artist_to_add)
                            processed_artist_ids.add(str(detailed_artist.get('id')))
                            logger.info(f"Added top track artist '{detailed_artist.get('name')}' after fetching details.")
                        else:
                            logger.warning(f"Could not fetch details for top track artist ID: {top_track_artist_id_str}. Adding without picture if name exists.")
                            if top_track_artist_name: 
                                final_artists_list.append({
                                    'id': top_track_artist_id_str, 
                                    'name': top_track_artist_name, 
                                    'picture_medium': None
                                })
                                processed_artist_ids.add(top_track_artist_id_str)

            original_artists_from_search = search_results_dict.get('artists', [])
            for artist_from_search in original_artists_from_search:
                if len(final_artists_list) >= MAX_ARTISTS_DISPLAY:
                    break
                artist_id_str = str(artist_from_search.get('id'))
                if artist_id_str not in processed_artist_ids:
                    final_artists_list.append(artist_from_search)
                    processed_artist_ids.add(artist_id_str)
            
            results['artists'] = final_artists_list
            
            logger.info(f"AJAX search for '{query}' finalized. Tracks: {len(results['tracks'])}, Artists: {len(results['artists'])}.")
        else:
            logger.warning(f"AJAX search for '{query}' returned no results from search_deezer or an error occurred.")
    else:
        logger.info("AJAX search called with no or empty query.")
    
    return JsonResponse(results)

def get_new_release_albums(limit=20):
    """
    Fetches new album releases from Deezer.
    """
    
    endpoint = f"{DEEZER_API_URL}/editorial/0/releases"
    params = {'limit': limit}
    albums_info = []
    logger.info(f"Requesting {limit} new release albums from Deezer: {endpoint}")

    try:
        response = requests.get(endpoint, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        if 'data' in data and isinstance(data['data'], list):
            for album_data in data['data']:
                if not isinstance(album_data, dict):
                    continue
                
                artist_data = album_data.get('artist', {})
                
                album_info = {
                    'id': album_data.get('id'),
                    'title': album_data.get('title'),
                    'picture_medium': album_data.get('cover_medium'), 
                    'artist_name': artist_data.get('name', 'Various Artists'),
                    'artist_id': artist_data.get('id'),
                    'link': album_data.get('link'),
                    'release_date': album_data.get('release_date') 
                }
                if album_info['id'] and album_info['title']:
                    albums_info.append(album_info)
                else:
                    logger.warning(f"Skipped new release album due to missing ID or title: {album_data}")
            
            logger.info(f"Fetched {len(albums_info)} new release albums.")
        elif 'error' in data:
            logger.error(f"API Error fetching new releases: {data.get('error')}")
        else:
            logger.warning(f"Warning: 'data' key not found or not a list in Deezer New Releases API response. Response: {data}")
            
    except requests.exceptions.RequestException as e:
        logger.error(f"Error making Deezer API request for new releases: {e}")
    except json.JSONDecodeError:
        logger.error(f"Error decoding JSON for new releases.")
    except Exception as e:
        logger.error(f"An unexpected error occurred fetching new releases: {e}", exc_info=True)
        
    return albums_info

def new_releases_view(request):
    """
    Displays a page with new album releases.
    This view will re-use the search.html template but populate it differently.
    """
    new_albums = get_new_release_albums(limit=24) 
    
    context = {
        'query': "New Releases", 
        'new_release_albums': new_albums,
        'has_results': bool(new_albums),
        'results_from_category_click': True, 
        'api_error': not new_albums 
    }
    
    user_playlists = []
    if request.user.is_authenticated:
        user_playlists = Playlist.objects.filter(user=request.user).order_by('-id')
    context['playlists'] = user_playlists
    
    return render(request, 'search.html', context)
