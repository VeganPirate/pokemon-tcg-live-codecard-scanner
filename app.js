const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const qrResult = document.getElementById('qr-result');
const ocrResult = document.getElementById('ocr-result');
const ocrToggle = document.getElementById('ocr-toggle');

let lastScannedValue = null;
let isOcrRunning = false;
let videoTrack = null;

const BOX_W = 0.2;  // 50% width
const BOX_H = 2.5;  // 2.5x height
const X_OFFSET_DOWN = -0.05; 
const X_OFFSET_UP = 0.85;

if (!('BarcodeDetector' in window)) {
    qrResult.textContent = 'Error: BarcodeDetector API not supported in this browser.';
    qrResult.style.color = '#FF4444';
    ocrResult.textContent = 'Please use on a mobile device.';
} else {
    const barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });
    startCamera();

    async function startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    facingMode: "environment",
                    // Force a high-resolution stream (4K or 1080p)
                    width: { ideal: 3840 },
                    height: { ideal: 2160 },
                    advanced: [{ focusMode: "continuous" }]
                }
            });
            video.srcObject = stream;
            videoTrack = stream.getVideoTracks()[0];
            video.onloadedmetadata = () => {
                video.play();
                // Match canvas to the actual high-res stream
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                requestAnimationFrame(scanLoop);
            };
        } catch (err) {
            qrResult.textContent = 'Camera error: ' + err.message;
        }
    }

    async function kickAutofocus() {
        if (videoTrack && videoTrack.getCapabilities().focusMode) {
            try {
                // Re-applying the constraint often forces the lens to reset/seek
                await videoTrack.applyConstraints({
                    advanced: [{ focusMode: "continuous" }]
                });
            } catch (e) { console.warn("Refocus failed", e); }
        }
    }

    function scanLoop() {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            barcodeDetector.detect(video).then(barcodes => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                if (barcodes.length > 0) {
                    const qr = barcodes[0];
                    const p = qr.cornerPoints;
                    
                    drawSimplifiedBoxes(p);

                    // OCR Logic: Only trigger if the QR content is actually new
                    // Inside your scanLoop
                    if (qr.rawValue !== lastScannedValue && !isOcrRunning) {
                        lastScannedValue = qr.rawValue;
                        qrResult.textContent = `New QR: ${qr.rawValue}`;
                        
                        // Save to Supabase immediately if logged in (from auth.js)
                        if (window.saveToSupabase) {
                            window.saveToSupabase(qr.rawValue);
                        }
                        
                        // 1. Kick the autofocus
                        kickAutofocus(); 
                        
                        // 2. Wrap the OCR in an async timeout to allow lens to settle
                        setTimeout(() => {
                            // Double check the QR is still in view before starting heavy OCR
                            processOCR(p, qr.rawValue);
                        }, 800); // 800ms is the "sweet spot" for most mobile lenses
                    }
                }
            });
        }
        requestAnimationFrame(scanLoop);
    }

    async function processOCR(p, qrValue) {
        isOcrRunning = true;
        ocrResult.textContent = "OCR: Enhancing text...";

        const vX = { x: p[1].x - p[0].x, y: p[1].y - p[0].y };
        const vY = { x: p[3].x - p[0].x, y: p[3].y - p[0].y };

        const regions = [
            { 
                name: "Bottom", 
                origin: { x: p[3].x + (vX.x * X_OFFSET_DOWN), y: p[3].y + (vX.y * 0) }, 
                w: BOX_W, 
                h: BOX_H,
                r: -1
            },
            { 
                name: "Top", 
                origin: { x: p[0].x + (vX.x * X_OFFSET_UP), y: p[0].y + (vX.y * 0) }, 
                w: BOX_W, 
                h: -BOX_H,
                r:  1
            }
        ];

        const worker = await Tesseract.createWorker('eng');
        await worker.setParameters({
            tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT, // Better for short phrases/labels
        });

        let results = [];

        for (const reg of regions) {
            // Use the new Binarized extraction
            const cropCanvas = extractAndBinarize(reg.origin, vX, vY, reg.w, reg.h, reg.r);
            //document.body.appendChild(cropCanvas);
            
            try {
                const { data: { text } } = await worker.recognize(cropCanvas);
                if (text.trim().length > 3) {
                    results.push(text.trim());
                }
            } catch (e) { console.error(e); }
        }

        await worker.terminate();
        
        // Simple filter: often the QR code string is also read. 
        // We want to display lines that contain spaces (likely set names)
        const setNames = results.join('\n');
        ocrResult.textContent = setNames || "OCR: Could not read set name";
        isOcrRunning = false;

        // Update the Supabase record with OCR results if possible (from auth.js)
        if (setNames && window.updateOcrInSupabase) {
            window.updateOcrInSupabase(qrValue, setNames);
        }
    }



    function extractAndBinarize(origin, vX, vY, wScale, hScale, rotation) {
        const tempCanvas = document.createElement('canvas');
        const qrWidth = Math.sqrt(vX.x**2 + vX.y**2);
        const qrHeight = Math.sqrt(vY.x**2 + vY.y**2);
        
        const scale = 2;
        // Swap width and height for the canvas if we are rotating to horizontal
        tempCanvas.width = qrHeight * Math.abs(hScale) * scale;
        tempCanvas.height = qrWidth * Math.abs(wScale) * scale;
        
        const tCtx = tempCanvas.getContext('2d');
        tCtx.filter = 'grayscale(1) contrast(4) brightness(0.9)';
        
        tCtx.save();
        tCtx.scale(scale, scale);

        // MOVE & ROTATE:
        // We want the 'height' of your box to become the 'width' of the OCR image
        tCtx.translate(tempCanvas.width / (scale * 2), tempCanvas.height / (scale * 2));
        tCtx.rotate(-Math.atan2(vX.y, vX.x) + rotation * Math.PI / 2); // Add 90 degrees
        tCtx.translate(-origin.x - (vX.x * wScale / 2), -origin.y - (vY.y * hScale / 2));
        
        tCtx.drawImage(video, 0, 0);
        tCtx.restore();

        // Binarization logic
        const imageData = tCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
            const val = avg > 115 ? 255 : 0;
            data[i] = data[i+1] = data[i+2] = val;
        }
        tCtx.putImageData(imageData, 0, 0);
        return tempCanvas;
    }

    function drawSimplifiedBoxes(p) {
        const vX = { x: p[1].x - p[0].x, y: p[1].y - p[0].y };
        const vY = { x: p[3].x - p[0].x, y: p[3].y - p[0].y };

        // Main QR
        drawPoly(p, "white", 2);

        const downOrigin = { x: p[3].x + (vX.x * X_OFFSET_DOWN), y: p[3].y + (vX.y * 0) };
        drawBox(downOrigin, vX, vY, BOX_W, BOX_H, "#FF4444");

        const upOrigin = { x: p[0].x + (vX.x * X_OFFSET_UP), y: p[0].y + (vX.y * 0) };
        drawBox(upOrigin, vX, vY, BOX_W, -BOX_H, "#4444FF");
    }

    function drawBox(origin, vX, vY, wScale, hScale, color) {
        ctx.beginPath();
        ctx.moveTo(origin.x, origin.y);
        ctx.lineTo(origin.x + (vX.x * wScale), origin.y + (vX.y * wScale));
        ctx.lineTo(origin.x + (vX.x * wScale) + (vY.x * hScale), origin.y + (vX.y * wScale) + (vY.y * hScale));
        ctx.lineTo(origin.x + (vY.x * hScale), origin.y + (vY.y * hScale));
        ctx.closePath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.fillStyle = color + "44"; // Transparency
        ctx.fill();
    }

    function drawPoly(pts, color, width) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        pts.forEach(pt => ctx.lineTo(pt.x, pt.y));
        ctx.closePath();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.stroke();
    }
}

