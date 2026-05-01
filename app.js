const imageSrc = "test-card.jpg";

// =======================
// CONFIG
// =======================
const ocrOffset = {
  x: 1.2,
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
function detectQR(canvas) {
  const ctx = canvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const code = jsQR(imageData.data, imageData.width, imageData.height);

  if (!code) return null;

  return {
    text: code.data,
    corners: code.location
  };
}

// =======================
// QR BOX FROM CORNERS
// =======================
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

  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys)
  };
}

// =======================
// MAIN
// =======================
async function run() {
  const { canvas, ctx } = await loadImageToCanvas(imageSrc);

  console.log("Image:", canvas.width, canvas.height);

  const qr = detectQR(canvas);

  if (!qr || !qr.corners) {
    console.warn("No QR detected");
    return;
  }

  const corners = qr.corners;

  console.log("QR corners:", corners);

  // =========================
  // DRAW QR AS POLYGON (CORRECT)
  // =========================
  ctx.strokeStyle = "red";
  ctx.lineWidth = 3;

  function drawLine(a, b) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  drawLine(corners.topLeftCorner, corners.topRightCorner);
  drawLine(corners.topRightCorner, corners.bottomRightCorner);
  drawLine(corners.bottomRightCorner, corners.bottomLeftCorner);
  drawLine(corners.bottomLeftCorner, corners.topLeftCorner);

  // =========================
  // BUILD QR BOX (ONLY FOR OFFSET BASELINE)
  // =========================
  const xs = [
    corners.topLeftCorner.x,
    corners.topRightCorner.x,
    corners.bottomLeftCorner.x,
    corners.bottomRightCorner.x
  ];

  const ys = [
    corners.topLeftCorner.y,
    corners.topRightCorner.y,
    corners.bottomLeftCorner.y,
    corners.bottomRightCorner.y
  ];

  const qrBox = {
    x: Math.min(...xs),
    y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys)
  };

  // =========================
  // OCR BOX (still approximate)
  // =========================
  const ocrBox = {
    x: qrBox.x + qrBox.w * ocrOffset.x,
    y: qrBox.y + qrBox.h * ocrOffset.y,
    w: qrBox.w * ocrOffset.w,
    h: qrBox.h * ocrOffset.h
  };

  drawBox(ctx, ocrBox.x, ocrBox.y, ocrBox.w, ocrBox.h, "lime", "OCR");

  // =========================
  // OCR
  // =========================
  const cropped = cropRegion(
    canvas,
    ocrBox.x,
    ocrBox.y,
    ocrBox.w,
    ocrBox.h
  );

  const result = await Tesseract.recognize(
    cropped,
    "eng",
    { logger: m => console.log(m) }
  );

  console.log("===== OCR RESULT =====");
  console.log(result.data.text);
}

run();