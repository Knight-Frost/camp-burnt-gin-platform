<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

class TestMail extends Command
{
    protected $signature = 'mail:test {email}';
    protected $description = 'Send a test email to verify mail configuration';

    public function handle(): void
    {
        $email = $this->argument('email');

        $mailer = config('mail.default');
        $host   = config('mail.mailers.smtp.host', 'N/A');
        $port   = config('mail.mailers.smtp.port', 'N/A');
        $from   = config('mail.from.address', 'N/A');

        $this->info("Mailer   : {$mailer}");
        $this->info("SMTP host: {$host}:{$port}");
        $this->info("From     : {$from}");
        $this->info("To       : {$email}");
        $this->newLine();

        try {
            Mail::raw(
                "This is a test email from Camp Burnt Gin.\n\n".
                "Mailer : {$mailer}\n".
                "Host   : {$host}:{$port}\n".
                "From   : {$from}\n\n".
                'If you received this, Gmail SMTP is configured correctly.',
                function ($m) use ($email) {
                    $m->to($email)->subject('Camp Burnt Gin — Mail Config Test');
                }
            );

            $this->info('✓ Test email sent successfully.');
        } catch (\Exception $e) {
            $this->error('✗ Failed to send test email.');
            $this->error($e->getMessage());
            \Log::error('mail:test failed', ['to' => $email, 'error' => $e->getMessage()]);
        }
    }
}
