<?php

namespace App\Models;

use App\Enums\TreatmentType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Collection;

/**
 * TreatmentLog model representing a medical intervention or observation
 * recorded by camp medical staff for a camper.
 *
 * All fields are encrypted at rest because they may contain PHI.
 */
class TreatmentLog extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'camper_id',
        'medical_visit_id',
        'recorded_by',
        'treatment_date',
        'treatment_time',
        'type',
        'title',
        'description',
        'outcome',
        'medication_given',
        'dosage_given',
        'follow_up_required',
        'follow_up_notes',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * PHI fields are encrypted at rest for HIPAA compliance.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'treatment_date'    => 'date',
            'treatment_time'    => 'string',
            'type'              => TreatmentType::class,
            'title'             => 'encrypted',
            'description'       => 'encrypted',
            'outcome'           => 'encrypted',
            'medication_given'  => 'encrypted',
            'dosage_given'      => 'encrypted',
            'follow_up_required' => 'boolean',
            'follow_up_notes'   => 'encrypted',
        ];
    }

    /**
     * Get the camper this treatment log belongs to.
     */
    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }

    /**
     * Get the medical staff member who recorded this treatment.
     */
    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    /**
     * Get the medical visit this treatment occurred during (if any).
     *
     * Treatments may exist as standalone records (medical_visit_id = null)
     * or be linked to the visit encounter that prompted them.
     */
    public function medicalVisit(): BelongsTo
    {
        return $this->belongsTo(MedicalVisit::class);
    }

    /**
     * Check whether the given medication name conflicts with any of
     * the camper's known allergens.
     *
     * Returns the matching allergen strings so the caller can build a
     * human-readable warning. Uses a case-insensitive substring match
     * because medication names rarely exactly equal an allergen label
     * (e.g. "Amoxicillin 500mg" should match allergen "Penicillin").
     *
     * @param  Collection<int, \App\Models\Allergy>  $allergies
     */
    public static function detectAllergyConflicts(string $medicationName, Collection $allergies): array
    {
        $lowerMed = mb_strtolower($medicationName);
        $conflicts = [];

        foreach ($allergies as $allergy) {
            $lowerAllergen = mb_strtolower($allergy->allergen ?? '');
            if ($lowerAllergen && (
                str_contains($lowerMed, $lowerAllergen) ||
                str_contains($lowerAllergen, $lowerMed)
            )) {
                $conflicts[] = [
                    'allergen'  => $allergy->allergen,
                    'severity'  => $allergy->severity->value,
                    'reaction'  => $allergy->reaction,
                    'treatment' => $allergy->treatment,
                ];
            }
        }

        return $conflicts;
    }
}
