<x-mail::layout>
{{-- Header --}}
<x-slot:header>
<x-mail::header :url="config('app.frontend_url', config('app.url'))">
Camp Burnt Gin
</x-mail::header>
</x-slot:header>

{{-- Body --}}
{!! $slot !!}

{{-- Subcopy --}}
@isset($subcopy)
<x-slot:subcopy>
<x-mail::subcopy>
{!! $subcopy !!}
</x-mail::subcopy>
</x-slot:subcopy>
@endisset

{{-- Footer --}}
<x-slot:footer>
<x-mail::footer>
© {{ date('Y') }} Camp Burnt Gin · 1628 Old Wire Rd, Gaston, SC 29053

You are receiving this email because you have an account with Camp Burnt Gin. [Manage notification preferences]({{ config('app.frontend_url', config('app.url')) }}/settings).
</x-mail::footer>
</x-slot:footer>
</x-mail::layout>
