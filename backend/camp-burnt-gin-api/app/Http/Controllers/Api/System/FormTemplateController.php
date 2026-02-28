<?php

namespace App\Http\Controllers\Api\System;

use App\Http\Controllers\Controller;
use App\Models\FormTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * FormTemplateController
 *
 * CRUD for application form templates (PDF/Word uploads).
 * All routes are restricted to super_admin role.
 */
class FormTemplateController extends Controller
{
    private const DISK = 'local';
    private const DIR  = 'form-templates';

    // ── Index ──────────────────────────────────────────────────────────────────

    public function index(): JsonResponse
    {
        $templates = FormTemplate::orderByDesc('created_at')->get();

        return response()->json([
            'data' => $templates->map(fn (FormTemplate $t) => $this->format($t)),
        ]);
    }

    // ── Store ─────────────────────────────────────────────────────────────────

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name'       => ['required', 'string', 'max:200'],
            'file'       => ['required', 'file', 'mimes:pdf,doc,docx', 'max:20480'],
            'session_id' => ['nullable', 'integer', 'exists:camp_sessions,id'],
        ]);

        $file        = $request->file('file');
        $fileName    = $file->getClientOriginalName();
        $extension   = strtolower($file->getClientOriginalExtension());
        $fileType    = $extension === 'pdf' ? 'pdf' : 'docx';
        $storagePath = $file->store(self::DIR, self::DISK);

        $template = FormTemplate::create([
            'created_by'   => $request->user()->id,
            'name'         => $request->input('name'),
            'file_name'    => $fileName,
            'storage_path' => $storagePath,
            'file_type'    => $fileType,
            'is_active'    => true,
            'version'      => 1,
            'session_id'   => $request->input('session_id'),
        ]);

        return response()->json(['data' => $this->format($template)], 201);
    }

    // ── Update (patch is_active / name) ───────────────────────────────────────

    public function update(Request $request, FormTemplate $formTemplate): JsonResponse
    {
        $request->validate([
            'is_active' => ['sometimes', 'boolean'],
            'name'      => ['sometimes', 'string', 'max:200'],
        ]);

        $formTemplate->update($request->only(['is_active', 'name']));

        return response()->json(['data' => $this->format($formTemplate->fresh())]);
    }

    // ── Destroy ───────────────────────────────────────────────────────────────

    public function destroy(FormTemplate $formTemplate): Response
    {
        Storage::disk(self::DISK)->delete($formTemplate->storage_path);
        $formTemplate->delete();

        return response()->noContent();
    }

    // ── Download ──────────────────────────────────────────────────────────────

    public function download(FormTemplate $formTemplate): StreamedResponse
    {
        abort_unless(
            Storage::disk(self::DISK)->exists($formTemplate->storage_path),
            404,
            'File not found.'
        );

        return Storage::disk(self::DISK)->download(
            $formTemplate->storage_path,
            $formTemplate->file_name
        );
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private function format(FormTemplate $t): array
    {
        return [
            'id'         => $t->id,
            'name'       => $t->name,
            'file_name'  => $t->file_name,
            'file_type'  => $t->file_type,
            'is_active'  => $t->is_active,
            'version'    => $t->version,
            'session_id' => $t->session_id,
            'created_at' => $t->created_at->toISOString(),
            'updated_at' => $t->updated_at->toISOString(),
        ];
    }
}
