const imageSrc = "test-card.jpg";

// =======================
// CONFIG (tune OCR later)
// =======================
const ocrOffset = {
  x: 1.2,   // relative to QR size (NOT pixels)
  y: -0.2,
  w: 2.5,
  h: 0.8
};

// =======================
// LOAD IMAGE
// =======================
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

// =======================
// DRAW BOX
// =======================
function drawBox(ctx, x, y, w, h, color, label) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);

  if (label) {
    ctx.fillStyle = color;
    ctx.font = "16px Arial";
    ctx.fillText(label, x, y - 6);
  }
}

// =======================
// CROPPER
// =======================
function cropRegion(canvas, x, y, w, h) {
  const out = document.createElement("canvas");
  const ctx = out.getContext("2d");

  out.width = w;
  out.height = h;

  ctx.drawImage(canvas, x, y, w, h, 0, 0, w, h);

  document.body.appendChild(out);

  return out;
}

// =======================
// QR DETECTION
// =======================
// returns: {text, corners}
async function detectQR(canvas) {
  try {
    const result = await Html5Qrcode.scanFile(canvas, true);

    return {
      text: result,
      // NOTE: html5-qrcode doesn't always give geometry in scanFile mode
      // so we approximate fallback box below
      corners: null
    };
  } catch (e) {
    console.warn("QR detection failed:", e);
    return null;
  }
}

// =======================
// ESTIMATE QR BOX (fallback)
// =======================
function estimateQRBox(canvas) {
  return {
    x: canvas.width * 0.1,
    y: canvas.height * 0.3,
    w: canvas.width * 0.25,
    h: canvas.width * 0.25
  };
}

// =======================
// ROTATION ESTIMATION (from QR geometry)
// =======================
// NOTE: real angle needs corner detection; this is simplified heuristic
function estimateRotation(qrBox, canvas) {
  const centerX = qrBox.x + qrBox.w / 2;
  const centerY = qrBox.y + qrBox.h / 2;

  const horizontalBias = Math.abs(qrBox.w - qrBox.h);

  // crude heuristic: if QR is "wide", assume rotation
  if (horizontalBias > qrBox.w * 0.2) {
    return 90;
  }

  return 0;
}

// =======================
// SCALE ESTIMATION
// =======================
function estimateScale(qrBox) {
  // QR codes are square → use width as scale reference
  return qrBox.w;
}

// =======================
// MAIN
// =======================
async function run() {
  const { canvas, ctx } = await loadImageToCanvas(imageSrc);

  console.log("Image:", canvas.width, canvas.height);

  // 1. Detect QR
  const qr = await detectQR(canvas);

  let qrBox;

  if (!qr) {
    console.warn("Using fallback QR box");
    qrBox = estimateQRBox(canvas);
  } else {
    console.log("QR TEXT:", qr.text);
    qrBox = estimateQRBox(canvas);
  }

  // 2. Estimate rotation + scale
  const rotation = estimateRotation(qrBox, canvas);
  const scale = estimateScale(qrBox);

  console.log("Estimated rotation:", rotation);
  console.log("Estimated scale:", scale);

  // 3. Draw QR box (RED)
  drawBox(ctx, qrBox.x, qrBox.y, qrBox.w, qrBox.h, "red", "QR");

  // 4. Compute OCR box relative to QR + scale
  const ocrBox = {
    x: qrBox.x + qrBox.w * ocrOffset.x,
    y: qrBox.y + qrBox.h * ocrOffset.y,
    w: qrBox.w * ocrOffset.w,
    h: qrBox.h * ocrOffset.h
  };

  drawBox(ctx, ocrBox.x, ocrBox.y, ocrBox.w, ocrBox.h, "lime", "OCR");

  // 5. Crop OCR region
  const cropped = cropRegion(canvas, ocrBox.x, ocrBox.y, ocrBox.w, ocrBox.h);

  // 6. OCR
  const result = await Tesseract.recognize(
    cropped,
    "eng",
    {
      logger: m => console.log(m)
    }
  );

  console.log("===== OCR RESULT =====");
  console.log(result.data.text);
}

run();