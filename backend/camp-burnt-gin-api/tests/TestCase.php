<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Validation\Rules\Password;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // In tests, skip the HaveIBeenPwned breach check (`->uncompromised()`)
        // to avoid network calls and allow predictable test passwords.
        // Production code retains the full policy via StoreUserRequest.
        Password::defaults(fn () => Password::min(8)->mixedCase()->numbers()->symbols());
    }
}
