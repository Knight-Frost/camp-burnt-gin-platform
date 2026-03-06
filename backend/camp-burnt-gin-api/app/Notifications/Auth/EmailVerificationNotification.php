<?php

namespace App\Notifications\Auth;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\URL;

/**
 * Notification for email address verification.
 *
 * Sends a signed verification link to the user's email address.
 * Implements email verification requirement for new registrations.
 */
class EmailVerificationNotification extends Notification
{
    use Queueable;

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $signedUrl = URL::temporarySignedRoute(
            'verification.verify',
            now()->addHours(24),
            ['id' => $notifiable->getKey(), 'hash' => sha1($notifiable->getEmailForVerification())]
        );

        // Replace the backend base URL with the frontend verification page URL.
        $parsed    = parse_url($signedUrl);
        $query     = $parsed['query'] ?? '';
        $verifyUrl = config('app.frontend_url').'/verify-email?'.$query
            .'&id='.$notifiable->getKey()
            .'&hash='.sha1($notifiable->getEmailForVerification());

        return (new MailMessage)
            ->subject('Verify Your Email Address - Camp Burnt Gin')
            ->greeting('Welcome, '.$notifiable->name.'!')
            ->line('Thank you for registering with Camp Burnt Gin. Please verify your email address to activate your account.')
            ->action('Verify Email Address', $verifyUrl)
            ->line('This verification link will expire in 24 hours.')
            ->line('If you did not create an account, no further action is required.')
            ->salutation('Camp Burnt Gin');
    }
}
