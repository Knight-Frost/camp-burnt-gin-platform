<?php

namespace App\Http\Controllers\Api\Medical;

use App\Http\Controllers\Controller;
use App\Http\Requests\AssistiveDevice\StoreAssistiveDeviceRequest;
use App\Http\Requests\AssistiveDevice\UpdateAssistiveDeviceRequest;
use App\Models\AssistiveDevice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Controller for managing assistive device resources.
 *
 * This controller handles operations for camper assistive devices,
 * including mobility aids and assistive technology. All actions are
 * protected by AssistiveDevicePolicy.
 */
class AssistiveDeviceController extends Controller
{
    /**
     * Display a listing of assistive devices.
     *
     * Accessible by administrators and medical providers only.
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', AssistiveDevice::class);

        $query = AssistiveDevice::with('camper');

        if ($request->filled('camper_id')) {
            $query->where('camper_id', $request->integer('camper_id'));
        }

        $devices = $query->paginate(15);

        return response()->json([
            'data' => $devices->items(),
            'meta' => [
                'current_page' => $devices->currentPage(),
                'last_page' => $devices->lastPage(),
                'per_page' => $devices->perPage(),
                'total' => $devices->total(),
            ],
        ]);
    }

    /**
     * Store a newly created assistive device.
     */
    public function store(StoreAssistiveDeviceRequest $request): JsonResponse
    {
        $this->authorize('create', AssistiveDevice::class);

        $device = AssistiveDevice::create($request->validated());
        $device->load('camper');

        return response()->json([
            'message' => 'Assistive device created successfully.',
            'data' => $device,
        ], Response::HTTP_CREATED);
    }

    /**
     * Display the specified assistive device.
     */
    public function show(AssistiveDevice $assistiveDevice): JsonResponse
    {
        $this->authorize('view', $assistiveDevice);

        $assistiveDevice->load('camper');

        return response()->json([
            'data' => $assistiveDevice,
        ]);
    }

    /**
     * Update the specified assistive device.
     */
    public function update(UpdateAssistiveDeviceRequest $request, AssistiveDevice $assistiveDevice): JsonResponse
    {
        $this->authorize('update', $assistiveDevice);

        $assistiveDevice->update($request->validated());

        return response()->json([
            'message' => 'Assistive device updated successfully.',
            'data' => $assistiveDevice,
        ]);
    }

    /**
     * Remove the specified assistive device.
     */
    public function destroy(AssistiveDevice $assistiveDevice): JsonResponse
    {
        $this->authorize('delete', $assistiveDevice);

        $assistiveDevice->delete();

        return response()->json([
            'message' => 'Assistive device deleted successfully.',
        ]);
    }
}
