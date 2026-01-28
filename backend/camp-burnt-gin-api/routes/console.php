<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
|--------------------------------------------------------------------------
| Scheduled Tasks
|--------------------------------------------------------------------------
|
| Tasks that run on a schedule to handle background operations.
| FR-29: Incomplete application reminders (weekly)
| FR-23: Provider link expiration handling (daily)
|
*/

Schedule::command('applications:send-reminders --days=7')
    ->weekly()
    ->mondays()
    ->at('09:00')
    ->description('Send reminders for incomplete applications');

Schedule::command('provider-links:handle-expired')
    ->daily()
    ->at('06:00')
    ->description('Process expired medical provider links');
