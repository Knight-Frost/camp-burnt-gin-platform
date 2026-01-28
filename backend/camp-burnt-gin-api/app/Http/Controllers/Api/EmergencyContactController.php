<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\EmergencyContact\StoreEmergencyContactRequest;
use App\Http\Requests\EmergencyContact\UpdateEmergencyContactRequest;
use App\Models\EmergencyContact;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Controller for managing emergency contact resources.
 *
 * This controller handles CRUD operations for emergency contacts.
 * All actions are protected by EmergencyContactPolicy authorization.
 */
class EmergencyContactController extends Controller
{
    /**
     * Display a listing of emergency contacts.
     *
     * Accessible by administrators and medical providers only.
     * Parents access their children's contacts via show endpoint.
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', EmergencyContact::class);

        $contacts = EmergencyContact::with('camper')->paginate(15);

        return response()->json([
            'data' => $contacts->items(),
            'meta' => [
                'current_page' => $contacts->currentPage(),
                'last_page' => $contacts->lastPage(),
                'per_page' => $contacts->perPage(),
                'total' => $contacts->total(),
            ],
        ]);
    }

    /**
     * Store a newly created emergency contact.
     */
    public function store(StoreEmergencyContactRequest $request): JsonResponse
    {
        $this->authorize('create', EmergencyContact::class);

        $contact = EmergencyContact::create($request->validated());
        $contact->load('camper');

        return response()->json([
            'message' => 'Emergency contact created successfully.',
            'data' => $contact,
        ], Response::HTTP_CREATED);
    }

    /**
     * Display the specified emergency contact.
     */
    public function show(EmergencyContact $emergencyContact): JsonResponse
    {
        $this->authorize('view', $emergencyContact);

        $emergencyContact->load('camper');

        return response()->json([
            'data' => $emergencyContact,
        ]);
    }

    /**
     * Update the specified emergency contact.
     */
    public function update(UpdateEmergencyContactRequest $request, EmergencyContact $emergencyContact): JsonResponse
    {
        $this->authorize('update', $emergencyContact);

        $emergencyContact->update($request->validated());

        return response()->json([
            'message' => 'Emergency contact updated successfully.',
            'data' => $emergencyContact,
        ]);
    }

    /**
     * Remove the specified emergency contact.
     */
    public function destroy(EmergencyContact $emergencyContact): JsonResponse
    {
        $this->authorize('delete', $emergencyContact);

        $emergencyContact->delete();

        return response()->json([
            'message' => 'Emergency contact deleted successfully.',
        ]);
    }
}
