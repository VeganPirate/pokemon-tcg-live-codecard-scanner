const imageSrc = "test-card.jpg";

// ===== CONFIG (tune these later) =====
const ocrOffset = {
  x: 180,   // right of QR
  y: -20,   // slightly above QR
  w: 420,
  h: 140
};

// ===== LOAD IMAGE =====
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

      document.body.appendChild(canvas);

      resolve({ canvas, ctx, img });
    };
  });
}

// ===== DRAW BOX =====
function drawBox(ctx, x, y, w, h, color, label) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);

  if (label) {
    ctx.fillStyle = color;
    ctx.font = "16px Arial";
    ctx.fillText(label, x, y - 5);
  }
}

// ===== CROPPING =====
function cropRegion(sourceCanvas, x, y, w, h) {
  const cropCanvas = document.createElement("canvas");
  const ctx = cropCanvas.getContext("2d");

  cropCanvas.width = w;
  cropCanvas.height = h;

  ctx.drawImage(sourceCanvas, x, y, w, h, 0, 0, w, h);

  document.body.appendChild(cropCanvas);

  return cropCanvas;
}

// ===== QR DETECTION =====
async function detectQR(canvas) {
  const codeReader = new Html5Qrcode("reader-temp");

  // Html5Qrcode needs a real element, so create hidden one
  const tempDiv = document.createElement("div");
  tempDiv.id = "reader-temp";
  tempDiv.style.display = "none";
  document.body.appendChild(tempDiv);

  return new Promise((resolve, reject) => {
    Html5Qrcode.getCameras().then(() => {

      codeReader.scanFile(canvas, true)
        .then(decodedText => {
          resolve(decodedText);
        })
        .catch(err => {
          console.warn("QR not found:", err);
          resolve(null);
        });

    }).catch(reject);
  });
}

// ===== MAIN PIPELINE =====
async function run() {
  const { canvas, ctx } = await loadImageToCanvas(imageSrc);

  console.log("Image loaded:", canvas.width, canvas.height);

  // 1. Try QR detection (we’ll approximate position visually later)
  let qrData = null;

  try {
    qrData = await Html5Qrcode.scanFile(canvas, true);
  } catch (e) {
    console.log("QR scan failed (expected sometimes)");
  }

  // ===== FALLBACK QR BOX (manual estimate if detection fails) =====
  const qrBox = {
    x: canvas.width * 0.1,
    y: canvas.height * 0.3,
    w: 180,
    h: 180
  };

  // 2. Draw QR box
  drawBox(ctx, qrBox.x, qrBox.y, qrBox.w, qrBox.h, "red", "QR");

  // 3. Compute OCR region relative to QR
  const ocrBox = {
    x: qrBox.x + ocrOffset.x,
    y: qrBox.y + ocrOffset.y,
    w: ocrOffset.w,
    h: ocrOffset.h
  };

  drawBox(ctx, ocrBox.x, ocrBox.y, ocrBox.w, ocrBox.h, "lime", "OCR");

  // 4. Crop OCR region
  const cropped = cropRegion(canvas, ocrBox.x, ocrBox.y, ocrBox.w, ocrBox.h);

  // 5. OCR
  const result = await Tesseract.recognize(
    cropped,
    "eng",
    {
      logger: m => console.log(m)
    }
  );

  console.log("===== OCR RESULT =====");
  console.log(result.data.text);

  console.log("===== QR RESULT =====");
  console.log(qrData || "No QR detected");
}

run();