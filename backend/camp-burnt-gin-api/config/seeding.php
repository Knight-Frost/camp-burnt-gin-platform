<?php

/**
 * Seeder configuration for Camp Burnt Gin.
 *
 * These flags control which categories of demo data are seeded
 * in non-production environments. All flags default to enabled.
 *
 * To disable a category, set the corresponding env variable to false:
 *   ENABLE_DEMO_DATA=false
 *   ENABLE_MEDICAL_SEEDS=false
 *   ENABLE_DOCUMENT_SEEDS=false
 *   ENABLE_NOTIFICATION_SEEDS=false
 *
 * None of these flags have any effect in production environments —
 * demo data is never seeded in production regardless of these values.
 */
return [

    /*
     | Enable the full demo data stack: users, campers, applications,
     | conversations, announcements, and calendar events.
     | Disabling this also disables medical, document, and notification seeds.
     */
    'enable_demo_data' => env('ENABLE_DEMO_DATA', true),

    /*
     | Enable medical data: diagnoses, allergies, medications, and
     | treatment logs. Requires enable_demo_data to be true.
     */
    'enable_medical_seeds' => env('ENABLE_MEDICAL_SEEDS', true),

    /*
     | Enable document metadata records (no actual files are created).
     | Requires enable_demo_data to be true.
     */
    'enable_document_seeds' => env('ENABLE_DOCUMENT_SEEDS', true),

    /*
     | Enable database notifications for demo applicant accounts.
     | Requires enable_demo_data to be true.
     */
    'enable_notification_seeds' => env('ENABLE_NOTIFICATION_SEEDS', true),

];
