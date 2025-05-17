# music/signals.py
from django.db.models.signals import post_save
from django.contrib.auth.models import User
from django.dispatch import receiver
from .models import UserProfile

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """
    Signal handler to create a UserProfile instance automatically
    when a new User is created.
    """
    if created:
        UserProfile.objects.create(user=instance)
        print(f"UserProfile created for {instance.username}") # For debugging

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    """
    Signal handler to save the UserProfile instance automatically
    when a User instance is saved.
    """
    try:
        instance.userprofile.save()
        print(f"UserProfile saved for {instance.username}") # For debugging
    except UserProfile.DoesNotExist:
        # This can happen if a User was created before this signal was in place.
        # Or if UserProfile creation failed for some reason.
        UserProfile.objects.create(user=instance)
        print(f"UserProfile was missing, created and saved for {instance.username}")

