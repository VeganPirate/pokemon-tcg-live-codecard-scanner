async function runOCRFromImage() {
  const img = new Image();
  img.src = "test-card.jpg";

  img.onload = async () => {
    console.log("Image loaded, running OCR...");

    const result = await Tesseract.recognize(
      img,
      "eng",
      {
        logger: m => console.log(m)
      }
    );

    console.log("OCR RESULT:");
    console.log(result.data.text);
  };
}

runOCRFromImage();