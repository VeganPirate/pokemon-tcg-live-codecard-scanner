const scannedCodes = JSON.parse(localStorage.getItem("codes")) || [];

const codeList = document.getElementById("code-list");
const startBtn = document.getElementById("start-btn");
const stopBtn = document.getElementById("stop-btn");

let scanner = null;
let lastScan = null;

renderCodes();

function renderCodes() {
  codeList.innerHTML = "";

  scannedCodes.forEach(code => {
    const li = document.createElement("li");
    li.textContent = code;
    codeList.appendChild(li);
  });
}

function saveCodes() {
  localStorage.setItem("codes", JSON.stringify(scannedCodes));
}

function onScanSuccess(decodedText) {
  // Prevent duplicate rapid scans
  if (decodedText === lastScan) return;

  lastScan = decodedText;

  if (!scannedCodes.includes(decodedText)) {
    scannedCodes.push(decodedText);
    saveCodes();
    renderCodes();
    console.log("Scanned:", decodedText);
  }

  // Small cooldown so same card doesn't spam
  setTimeout(() => {
    lastScan = null;
  }, 2000);
}

startBtn.addEventListener("click", async () => {
  if (scanner) return;

  scanner = new Html5Qrcode("reader");

  try {
    const devices = await Html5Qrcode.getCameras();

    if (!devices || devices.length === 0) {
      throw new Error("No camera found");
    }

    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);

    let cameraConfig;

    if (isMobile) {
      cameraConfig = { facingMode: "environment" };
    } else {
      // desktop → pick first available webcam
      cameraConfig = devices[0].id;
    }

    await scanner.start(
      cameraConfig,
      {
        fps: 10,
        qrbox: { width: 250, height: 250 }
      },
      onScanSuccess
    );

  } catch (err) {
    console.error(err);
    alert("Could not start camera");
  }
});

stopBtn.addEventListener("click", async () => {
  if (!scanner) return;

  await scanner.stop();
  await scanner.clear();
  scanner = null;
});