/**
 * Sample Demo Package Generator
 * Generates synthetic product packaging images using browser Canvas
 * so examiners and judges can test the full pipeline with 1 click without needing local files.
 */

function createCanvasBlob(width, height, drawFn) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    drawFn(ctx, width, height);
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/jpeg', 0.92);
  });
}

export async function createDemoPackageFiles(type = 'parle_g') {
  if (type === 'parle_g') {
    // 1. Front Panel
    const frontBlob = await createCanvasBlob(600, 450, (ctx, w, h) => {
      // Packaging background (yellowish golden biscuits packaging)
      ctx.fillStyle = '#FFEB3B';
      ctx.fillRect(0, 0, w, h);

      // Header Banner
      ctx.fillStyle = '#D32F2F';
      ctx.fillRect(20, 20, w - 40, 60);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 26px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PARLE-G ORIGINAL GLUCOSE BISCUITS', w / 2, 58);

      // Product Image simulation
      ctx.fillStyle = '#F57F17';
      ctx.fillRect(160, 100, 280, 160);
      ctx.fillStyle = '#FFF9C4';
      ctx.font = 'bold 20px Inter, sans-serif';
      ctx.fillText('CRISPY & WHOLESOME', w / 2, 190);

      // Key Declarations on Front Panel
      ctx.textAlign = 'left';
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 22px Inter, sans-serif';
      ctx.fillText('NET WEIGHT: 250 g', 40, 320);

      ctx.fillStyle = '#B71C1C';
      ctx.font = 'bold 22px Inter, sans-serif';
      ctx.fillText('M.R.P. ₹ 30.00', 40, 360);
      ctx.font = '14px Inter, sans-serif';
      ctx.fillStyle = '#333333';
      ctx.fillText('(INCL. OF ALL TAXES)', 200, 360);

      ctx.font = '16px Inter, sans-serif';
      ctx.fillText('UNIT SALE PRICE: ₹ 0.12 / g', 40, 395);

      // Veg logo green square + circle
      ctx.strokeStyle = '#2E7D32';
      ctx.lineWidth = 3;
      ctx.strokeRect(w - 70, 320, 40, 40);
      ctx.fillStyle = '#2E7D32';
      ctx.beginPath();
      ctx.arc(w - 50, 340, 12, 0, Math.PI * 2);
      ctx.fill();
    });

    // 2. Back Panel
    const backBlob = await createCanvasBlob(600, 550, (ctx, w, h) => {
      // Packaging background (clean white label)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#CCCCCC';
      ctx.lineWidth = 2;
      ctx.strokeRect(10, 10, w - 20, h - 20);

      ctx.fillStyle = '#1A237E';
      ctx.font = 'bold 20px Inter, sans-serif';
      ctx.fillText('MANDATORY STATUTORY DECLARATIONS', 30, 45);

      ctx.fillStyle = '#333333';
      ctx.font = '15px Inter, sans-serif';

      ctx.fillText('COMMODITY: BISCUITS', 30, 85);
      ctx.fillText('MFD. DATE: 07/2026', 30, 120);
      ctx.fillText('BEST BEFORE: 6 MONTHS FROM PACKAGING', 30, 155);

      ctx.font = 'bold 15px Inter, sans-serif';
      ctx.fillText('MANUFACTURED BY:', 30, 195);
      ctx.font = '14px Inter, sans-serif';
      ctx.fillText('PARLE PRODUCTS PVT. LTD.', 30, 220);
      ctx.fillText('NORTH LEVEL CROSSING, VILE PARLE EAST,', 30, 245);
      ctx.fillText('MUMBAI - 400057, MAHARASHTRA, INDIA', 30, 270);

      ctx.font = 'bold 15px Inter, sans-serif';
      ctx.fillText('FOR CONSUMER COMPLAINTS / FEEDBACK:', 30, 315);
      ctx.font = '14px Inter, sans-serif';
      ctx.fillText('CALL TOLL FREE: 1800-22-7799', 30, 340);
      ctx.fillText('EMAIL: CS@PARLE.BIZ', 30, 365);

      ctx.font = 'bold 15px Inter, sans-serif';
      ctx.fillText('COUNTRY OF ORIGIN: INDIA', 30, 410);

      // Barcode simulation
      ctx.fillStyle = '#000000';
      for (let x = 30; x < 280; x += (x % 5 === 0 ? 8 : 4)) {
        ctx.fillRect(x, 440, (x % 3 === 0 ? 3 : 2), 60);
      }
      ctx.font = '12px monospace';
      ctx.fillText('8 901719 101015', 80, 520);
    });

    const frontFile = new File([frontBlob], 'parle_g_front_panel.jpg', { type: 'image/jpeg' });
    const backFile = new File([backBlob], 'parle_g_back_panel.jpg', { type: 'image/jpeg' });

    return [
      { file: frontFile, panel: 'FRONT', preview: URL.createObjectURL(frontBlob) },
      { file: backFile, panel: 'BACK', preview: URL.createObjectURL(backBlob) },
    ];
  }

  // Fallback single sample
  const singleBlob = await createCanvasBlob(500, 350, (ctx, w, h) => {
    ctx.fillStyle = '#E8F5E9';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1B5E20';
    ctx.font = 'bold 22px Inter, sans-serif';
    ctx.fillText('BRITANNIA PREMIUM BISCUITS', 30, 50);
    ctx.fillStyle = '#000000';
    ctx.font = '16px Inter, sans-serif';
    ctx.fillText('NET WT: 100 g', 30, 100);
    ctx.fillText('MRP: Rs. 25.00 (INCL. TAXES)', 30, 140);
    ctx.fillText('MFD: 08/2026', 30, 180);
    ctx.fillText('MFG BY: BRITANNIA INDUSTRIES LTD, MUMBAI', 30, 220);
  });
  const file = new File([singleBlob], 'britannia_sample.jpg', { type: 'image/jpeg' });
  return [{ file, panel: 'FRONT', preview: URL.createObjectURL(singleBlob) }];
}
