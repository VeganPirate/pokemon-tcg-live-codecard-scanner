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
function detectQR(canvas) {
  const ctx = canvas.getContext("2d");
  const imageData = ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  );

  const code = jsQR(
    imageData.data,
    imageData.width,
    imageData.height
  );

  if (!code) return null;

  return {
    text: code.data,
    corners: code.location
  };
}

function getQRBox(location) {
  const xs = [
    location.topLeftCorner.x,
    location.topRightCorner.x,
    location.bottomLeftCorner.x,
    location.bottomRightCorner.x
  ];

  const ys = [
    location.topLeftCorner.y,
    location.topRightCorner.y,
    location.bottomLeftCorner.y,
    location.bottomRightCorner.y
  ];

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY
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
  const qr = detectQR(canvas);

  let qrBox;

  if (!qr) {
    console.warn("Using fallback QR box");
    const qrBox = getQRBox(qr.corners);
  } else {
    console.log("QR TEXT:", qr.text);
    const qrBox = getQRBox(qr.corners);
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