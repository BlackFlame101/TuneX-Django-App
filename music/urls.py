from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('search/', views.search_view, name='search'),
    path('artist/<int:artist_id>/', views.artist_profile_view, name='artist_profile'),
    path('deezer_playlist/<int:playlist_id>/', views.deezer_playlist_detail_view, name='deezer_playlist_detail'),

    path('login/', views.login_view, name='login'),
    path('signup/', views.signup_view, name='signup'),
    path('logout/', views.logout_view, name='logout'),

    path('new-releases/', views.new_releases_view, name='new_releases'),
    path('song/like/', views.like_song_view, name='like_song'),
    path('songs/liked/', views.liked_songs_list_view, name='liked_songs'),

    path('playlists/create/', views.create_playlist_view, name='create_playlist'),
    path('playlists/my/', views.my_playlists_view, name='my_playlists'),
    path('playlist/<int:playlist_id>/', views.user_playlist_detail_view, name='user_playlist_detail'),
    path('playlist/<int:playlist_id>/add_song/', views.add_song_to_playlist_view, name='add_song_to_playlist'),
    path('playlist/<int:playlist_id>/remove_song/', views.remove_song_from_playlist_view, name='remove_song_from_playlist'),
    path('api/song/<str:deezer_id_str>/fresh_preview/', views.get_fresh_preview_url_view, name='get_fresh_preview_url'),
    path('api/user_playlists/', views.list_user_playlists_view, name='list_user_playlists'),
    path('api/add_to_playlists/', views.add_song_to_playlists_view, name='add_song_to_playlists'),
    path('api/search/', views.ajax_search_view, name='ajax_search'), 
]
