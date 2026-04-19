<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Strict compliance enforcement
    |--------------------------------------------------------------------------
    |
    | When true, DocumentEnforcementService enforces every compliance rule:
    |  - required document present
    |  - document not expired
    |  - document admin-verified
    |  - document metadata complete (e.g. medical-form exam date)
    |
    | When false, the service runs the "missing document" rule ONLY. Expired,
    | unverified, and incomplete rows flow through silently. This is a
    | deliberate testing bypass so the submission → admin-visibility flow
    | can be exercised without curating fixture dates.
    |
    | PRODUCTION SAFETY: the value is force-overridden to `true` whenever
    | the application environment is "production" — this file cannot
    | accidentally ship a relaxed gate to a customer-facing deploy. See
    | the reads in app/Services/Document/DocumentEnforcementService.php.
    |
    | Driven by APP_COMPLIANCE_CHECKS. Dev / test / staging default = false.
    |
    */

    'strict_enabled' => env('APP_COMPLIANCE_CHECKS', false),
];
