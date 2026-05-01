function loadImageToCanvas(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = src;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      canvas.width = img.width;
      canvas.height = img.height;

      ctx.drawImage(img, 0, 0);

      resolve({ canvas, ctx, img });
    };
  });
}

function cropRegion(sourceCanvas, x, y, width, height) {
  const cropCanvas = document.createElement("canvas");
  const ctx = cropCanvas.getContext("2d");

  cropCanvas.width = width;
  cropCanvas.height = height;

  ctx.drawImage(
    sourceCanvas,
    x, y, width, height,  // source
    0, 0, width, height    // destination
  );

  return cropCanvas;
}

async function testCropOCR() {
  const { canvas } = await loadImageToCanvas("test-card.jpg");

  // 👇 adjust these until it matches your text area
  const cropped = cropRegion(canvas, 200, 50, 400, 120);

  document.body.appendChild(cropped); // DEBUG: show crop result

  const result = await Tesseract.recognize(
    cropped,
    "eng",
    {
      logger: m => console.log(m)
    }
  );

  console.log("OCR RESULT:");
  console.log(result.data.text);
}

testCropOCR();