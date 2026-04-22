/**
 * Render a typed name into a base64 PNG image, mimicking a signature.
 *
 * The application's `signature_data` column expects a `data:image/png;base64,...`
 * payload from the drawn-signature canvas. Before this utility, the typed-
 * signature path stored the plain typed name as text in the same column,
 * producing two different value shapes for what the backend treats as one
 * field (admin review, audit log, encrypted decryption all assume base64).
 *
 * This synthesizes a PNG from the typed name using a hidden canvas drawn
 * with a script font. The result is the same shape as the drawn path —
 * everything downstream (rendering, PDF export, decryption) works identically.
 *
 * @param name The typed name to render. Falsy/empty input returns an empty
 *             1×1 PNG so the caller never has to special-case missing input.
 * @returns A base64 PNG string in `data:image/png;base64,...` format.
 */
export async function typedSignatureToPng(name: string): Promise<string> {
  // Defensive: 1×1 transparent PNG when there's nothing to render. The
  // backend stores the value as encrypted blob either way; better to have
  // a valid PNG than empty text.
  if (!name || !name.trim()) {
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  }

  // Canvas dimensions tuned to match the typical drawn-signature pad
  // (400×120 in SignaturePad component) so admin-side rendering doesn't
  // need a separate code path for typed vs drawn.
  const WIDTH = 400;
  const HEIGHT = 120;

  // OffscreenCanvas in modern browsers; fall back to DOM canvas. Both
  // produce identical PNG output via toDataURL / convertToBlob.
  let canvas: HTMLCanvasElement | OffscreenCanvas;
  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(WIDTH, HEIGHT);
  } else {
    canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
  }

  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) {
    // Canvas 2D context unavailable — extremely rare (private browsing on
    // some mobile WebKit, intentionally-disabled canvas). Throwing here
    // surfaces the problem to handleSubmit's catch block as a real error
    // rather than silently storing a 1×1 transparent PNG that admin
    // reviewers cannot distinguish from a valid signature. Per the
    // 2026-04-22 silent-failure-hunter review.
    throw new Error(
      'Your browser could not render a signature image. Please try the drawn-signature option instead.',
    );
  }

  // White background — matches the drawn signature pad's substrate so
  // composited renders look consistent regardless of sig type.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Script font for "signature feel". Cursive is a CSS generic that resolves
  // to whatever the OS provides (Brush Script MT on macOS, Comic Sans on
  // Windows older systems). Falls back to italic serif if cursive is missing.
  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'italic 48px "Brush Script MT", "Lucida Handwriting", cursive, serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  // Auto-shrink if the name overflows. Loop down by 4px increments until
  // the rendered text fits inside the canvas with 20px horizontal padding.
  let fontSize = 48;
  while (fontSize > 12) {
    ctx.font = `italic ${fontSize}px "Brush Script MT", "Lucida Handwriting", cursive, serif`;
    if (ctx.measureText(name).width <= WIDTH - 40) break;
    fontSize -= 4;
  }

  ctx.fillText(name, WIDTH / 2, HEIGHT / 2);

  // Export. OffscreenCanvas needs convertToBlob; HTMLCanvasElement needs
  // toDataURL. Normalize both to a base64 data URL.
  if (canvas instanceof HTMLCanvasElement) {
    return canvas.toDataURL('image/png');
  }
  // OffscreenCanvas path — convert blob → base64 data URL.
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return await blobToDataUrl(blob);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
