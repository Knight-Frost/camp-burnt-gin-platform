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
 * FormTemplateController — CRUD for downloadable application form templates.
 *
 * Form templates are PDF or Word documents (consent forms, medical release
 * forms, etc.) that applicants download, fill out, and upload back as
 * camper documents. Super admins upload and manage these templates here.
 *
 * Files are stored on the `local` disk (server filesystem, not public) so
 * they are never directly accessible via a URL — downloads must go through
 * the download() endpoint which streams the file through Laravel.
 *
 * All routes for this controller are restricted to the super_admin role.
 *
 * Storage constants:
 *   DISK = 'local'           → files live in storage/app (not public)
 *   DIR  = 'form-templates'  → subdirectory within that disk
 */
class FormTemplateController extends Controller
{
    // All files are stored on the non-public 'local' disk for security.
    private const DISK = 'local';
    // Subdirectory within the local disk where template files are stored.
    private const DIR  = 'form-templates';

    // ── Index ──────────────────────────────────────────────────────────────────

    /**
     * List all form templates.
     *
     * GET /api/form-templates
     *
     * Returns all templates ordered newest-first. Each template is formatted
     * through format() so the response shape is consistent across endpoints.
     * Note: file URLs are not included — use the download() endpoint to retrieve files.
     */
    public function index(): JsonResponse
    {
        // orderByDesc gives the most recently uploaded templates at the top of the list.
        $templates = FormTemplate::orderByDesc('created_at')->get();

        return response()->json([
            'data' => $templates->map(fn (FormTemplate $t) => $this->format($t)),
        ]);
    }

    // ── Store ─────────────────────────────────────────────────────────────────

    /**
     * Upload a new form template.
     *
     * POST /api/form-templates
     *
     * Accepts PDF, DOC, or DOCX files up to 20 MB. The file is stored in the
     * local (non-public) disk and a FormTemplate record is created with the
     * path, original filename, and file type.
     *
     * Step-by-step:
     *   1. Validate name, file (type + size), and optional session_id.
     *   2. Determine the file type from the extension (pdf or docx).
     *   3. Store the file in the form-templates subdirectory on the local disk.
     *   4. Create the database record with all relevant metadata.
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name'       => ['required', 'string', 'max:200'],
            // Accept PDF and Word formats; max 20 MB (20480 KB).
            'file'       => ['required', 'file', 'mimes:pdf,doc,docx', 'max:20480'],
            // Optionally tie this template to a specific camp session.
            'session_id' => ['nullable', 'integer', 'exists:camp_sessions,id'],
        ]);

        $file        = $request->file('file');
        // Preserve the original filename so admins see a recognizable name in the download.
        $fileName    = $file->getClientOriginalName();
        $extension   = strtolower($file->getClientOriginalExtension());
        // Normalize doc/docx extensions to 'docx' for a simple two-type system.
        $fileType    = $extension === 'pdf' ? 'pdf' : 'docx';
        // store() moves the file to storage/app/form-templates/ and returns its path.
        $storagePath = $file->store(self::DIR, self::DISK);

        $template = FormTemplate::create([
            // Track who uploaded this template for accountability.
            'created_by'   => $request->user()->id,
            'name'         => $request->input('name'),
            'file_name'    => $fileName,
            'storage_path' => $storagePath,
            'file_type'    => $fileType,
            // New templates are active by default — admins can deactivate them later.
            'is_active'    => true,
            // Version starts at 1; future versions would require a separate upload.
            'version'      => 1,
            'session_id'   => $request->input('session_id'),
        ]);

        return response()->json(['data' => $this->format($template)], 201);
    }

    // ── Update (patch is_active / name) ───────────────────────────────────────

    /**
     * Update a form template's name or active status.
     *
     * PATCH /api/form-templates/{formTemplate}
     *
     * Only the name and is_active flag can be patched — the file itself cannot
     * be replaced (upload a new template instead). Both fields are optional.
     */
    public function update(Request $request, FormTemplate $formTemplate): JsonResponse
    {
        $request->validate([
            // Set to false to hide the template from applicants without deleting it.
            'is_active' => ['sometimes', 'boolean'],
            'name'      => ['sometimes', 'string', 'max:200'],
        ]);

        // only() ensures raw request fields never leak into the update() call.
        $formTemplate->update($request->only(['is_active', 'name']));

        // fresh() re-reads the record so the response reflects the DB state post-save.
        return response()->json(['data' => $this->format($formTemplate->fresh())]);
    }

    // ── Destroy ───────────────────────────────────────────────────────────────

    /**
     * Delete a form template and its file.
     *
     * DELETE /api/form-templates/{formTemplate}
     *
     * Removes the physical file from the local disk first, then deletes the
     * database record. Returns 204 No Content on success (no body needed).
     */
    public function destroy(FormTemplate $formTemplate): Response
    {
        // Delete the file from disk before removing the DB record to avoid orphaned files.
        Storage::disk(self::DISK)->delete($formTemplate->storage_path);
        $formTemplate->delete();

        // 204 No Content is the conventional response for a successful DELETE with no body.
        return response()->noContent();
    }

    // ── Download ──────────────────────────────────────────────────────────────

    /**
     * Stream a form template file as a download.
     *
     * GET /api/form-templates/{formTemplate}/download
     *
     * abort_unless() sends a 404 if the file is missing from disk — this can
     * happen if a file was manually deleted outside Laravel. The download is
     * served with the original filename so the browser saves it correctly.
     */
    public function download(FormTemplate $formTemplate): StreamedResponse
    {
        // Abort with 404 if the file doesn't exist on disk — prevents a confusing empty download.
        abort_unless(
            Storage::disk(self::DISK)->exists($formTemplate->storage_path),
            404,
            'File not found.'
        );

        // download() streams the file through Laravel so it never needs to be in a public folder.
        return Storage::disk(self::DISK)->download(
            $formTemplate->storage_path,
            // Use the original filename so the download dialog shows something meaningful.
            $formTemplate->file_name
        );
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Format a FormTemplate model into the API response shape.
     *
     * Centralising the format keeps index(), store(), and update() consistent.
     * Notably, storage_path and created_by are omitted — the client doesn't
     * need the internal path, and creator ID is an internal detail.
     */
    private function format(FormTemplate $t): array
    {
        return [
            'id'         => $t->id,
            'name'       => $t->name,
            'file_name'  => $t->file_name,
            // 'pdf' or 'docx' — the frontend uses this to show the correct file type icon.
            'file_type'  => $t->file_type,
            // false means the template is hidden from applicants (still stored on disk).
            'is_active'  => $t->is_active,
            'version'    => $t->version,
            // null if not tied to a specific session (applies to all sessions).
            'session_id' => $t->session_id,
            'created_at' => $t->created_at->toISOString(),
            'updated_at' => $t->updated_at->toISOString(),
        ];
    }
}
