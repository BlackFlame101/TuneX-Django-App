from django.apps import AppConfig

class MusicConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'music'

    def ready(self):
        """
        Import signals when the app is ready.
        """
        import music.signals 
        print("Music app ready, signals imported.") 