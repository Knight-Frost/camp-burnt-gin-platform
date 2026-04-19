<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Risk Engine Tables — Phase 18 (Dynamic Risk Engine)
 *
 * Replaces all hardcoded constants in SpecialNeedsRiskAssessmentService with
 * three database tables that medical staff can configure via the admin UI:
 *
 *  risk_factors    — individual scoring conditions (what earns points and how many)
 *  risk_rules      — conditional bonus rules (IF condition A AND B THEN +N pts)
 *  risk_thresholds — supervision level and complexity tier cutoffs
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── risk_factors ─────────────────────────────────────────────────────────
        // Each row describes one detectable medical/behavioral condition.
        // The `key` matches the PHP detection logic in SpecialNeedsRiskAssessmentService.
        // Medical staff can adjust `points` and toggle `is_active` without code changes.
        Schema::create('risk_factors', function (Blueprint $table) {
            $table->id();
            // Machine-readable identifier — matches constant names in old service.
            $table->string('key', 100)->unique();
            // Human-readable label for UI display.
            $table->string('label', 255);
            // Groups factors in the UI: medical | behavioral | physical | feeding | allergy
            $table->string('category', 50);
            // Points added to risk score when this factor is detected.
            // 0 = flag-only (still shows in breakdown but doesn't score).
            $table->unsignedSmallInteger('points')->default(0);
            // Whether each occurrence adds points (true for diagnosis severity counts).
            $table->boolean('per_item')->default(false);
            // Which data source this factor reads from (for UI tooltips and drill-down).
            $table->string('source_model', 100)->nullable();
            // Tooltip shown to medical staff explaining the factor's clinical significance.
            $table->text('tooltip')->nullable();
            // Disabled factors are skipped during calculation but preserved for history.
            $table->boolean('is_active')->default(true);
            // Display order within category.
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        // ── risk_rules ───────────────────────────────────────────────────────────
        // Conditional bonus rules: IF a combination of factors is present, add extra points.
        // Stored as JSON so the medical team can define complex clinical logic without code.
        Schema::create('risk_rules', function (Blueprint $table) {
            $table->id();
            $table->string('name', 255);
            $table->text('description')->nullable();
            // JSON array of condition objects: [{"factor_key": "seizures", "present": true}, ...]
            // All conditions must match for the rule to fire (AND logic).
            $table->json('conditions');
            // Points added when all conditions are met.
            $table->smallInteger('points_adjustment');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // ── risk_thresholds ──────────────────────────────────────────────────────
        // Defines the score boundaries for supervision levels and complexity tiers.
        // Medical staff can raise or lower thresholds to match camp capacity.
        Schema::create('risk_thresholds', function (Blueprint $table) {
            $table->id();
            // 'supervision' or 'complexity'
            $table->string('threshold_type', 50);
            // e.g. 'Standard', 'Enhanced', 'OneToOne' for supervision
            $table->string('level_value', 100);
            // Human-readable label for UI.
            $table->string('label', 255);
            // Score range: min_score <= score <= max_score → this level applies.
            // null max_score means "anything above min_score".
            $table->unsignedSmallInteger('min_score');
            $table->unsignedSmallInteger('max_score')->nullable();
            // For supervision: staffing ratio description (e.g. "1:6").
            $table->string('staffing_ratio', 50)->nullable();
            // For complexity: intervention description.
            $table->string('intervention_description', 255)->nullable();
            // Display order within type.
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('risk_thresholds');
        Schema::dropIfExists('risk_rules');
        Schema::dropIfExists('risk_factors');
    }
};
