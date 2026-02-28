<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('form_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->string('name');
            $table->string('file_name');
            $table->string('storage_path');
            $table->enum('file_type', ['pdf', 'docx', 'online'])->default('pdf');
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('version')->default(1);
            $table->foreignId('session_id')->nullable()->constrained('camp_sessions')->nullOnDelete();
            $table->timestamps();

            $table->index('is_active');
            $table->index('session_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('form_templates');
    }
};
