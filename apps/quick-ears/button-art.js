// Extract the four stretchable frames once; glyphs come directly from Arcade Hub.
const sheet = new Image();
sheet.onload = () => {
  if (sheet.width !== 384 || sheet.height !== 32) return;
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ['normal', 'hover', 'pressed', 'disabled'].forEach((state, column) => {
    ctx.clearRect(0, 0, 96, 32);
    ctx.drawImage(sheet, column * 96, 0, 96, 32, 0, 0, 96, 32);
    document.documentElement.style.setProperty('--art-' + state, 'url("' + canvas.toDataURL() + '")');
  });
  document.querySelectorAll('main button:not(#pause), #hub').forEach(button => button.classList.add('sprite-action'));
};
sheet.src = './button-sprites.png';
