from django.db import models
from django.contrib.auth.models import User
import random # Import the random module

class Song(models.Model):
    deezer_id = models.CharField(max_length=20, unique=True)
    title = models.CharField(max_length=200)
    artist_name = models.CharField(max_length=200)
    album_cover_url = models.URLField(max_length=500, blank=True, null=True) 
    preview_url = models.URLField(max_length=500, blank=True, null=True)  
    duration = models.IntegerField(null=True, blank=True) 

    def __str__(self):
        return f"{self.title} - {self.artist_name}"

    @property
    def duration_formatted(self):
        """Returns the duration in M:SS format."""
        if self.duration is not None and self.duration >= 0:
            minutes = self.duration // 60
            seconds = self.duration % 60
            return f"{minutes}:{seconds:02d}"
        return "0:00" 

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    liked_songs = models.ManyToManyField(Song, related_name='liked_by', blank=True) 

    def __str__(self):
        return self.user.username

class Playlist(models.Model):
    name = models.CharField(max_length=200)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    songs = models.ManyToManyField(Song, blank=True)
    # New field to store the cover image URL
    cover_image_url = models.URLField(max_length=500, blank=True, null=True)

    def __str__(self):
        return self.name

    def update_cover_image(self):
        """
        Updates the playlist's cover_image_url with the album cover
        of a random song in the playlist.
        If the playlist is empty, clears the cover_image_url.
        """
        if self.songs.exists():
            # Get all songs with a valid album_cover_url
            songs_with_covers = self.songs.exclude(album_cover_url__isnull=True).exclude(album_cover_url__exact='')
            if songs_with_covers.exists():
                # Pick a random song from those that have covers
                random_song = random.choice(list(songs_with_covers))
                if self.cover_image_url != random_song.album_cover_url:
                    self.cover_image_url = random_song.album_cover_url
                    self.save(update_fields=['cover_image_url'])
            else:
                # No songs with covers, clear the image
                if self.cover_image_url is not None:
                    self.cover_image_url = None
                    self.save(update_fields=['cover_image_url'])
        else:
            # Playlist is empty, clear the image
            if self.cover_image_url is not None:
                self.cover_image_url = None
                self.save(update_fields=['cover_image_url'])
