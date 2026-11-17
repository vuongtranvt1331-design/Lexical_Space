// Decode the local PNG sheet once. Each CSS border image then owns its four
// fixed corners; labels, prices and clocks stay in their original DOM nodes.
const faces = ['main', 'accent', 'gold', 'quiet', 'accept', 'danger', 'ivory', 'blue'];
const states = ['idle', 'hover', 'pressed', 'disabled'];
const width = 96, height = 40;

async function loadActionFrames() {
  const root = document.documentElement;
  const sheet = new Image();
  sheet.src = new URL('./assets/action-buttons.png', document.baseURI).href;
  await sheet.decode();
  const rows = root.dataset.suiteModule === 'quick-drawn' ? faces.length : 4;
  if (sheet.naturalWidth !== width * states.length || sheet.naturalHeight !== height * rows) {
    throw new Error('Invalid action button sheet dimensions');
  }

  const tile = document.createElement('canvas');
  tile.width = width;
  tile.height = height;
  const ctx = tile.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  function renderPalette() {
    const style = getComputedStyle(root);
    const channels = key => style.getPropertyValue(key).trim().slice(1).match(/../g).map(pair => parseInt(pair, 16));
    const hubColors = root.dataset.suiteModule === 'arcade' ? {
      primary: channels('--hub-play'), secondary: channels('--hub-soft'), rim: channels('--hub-accent'),
      surface: channels('--hub-card'), line: channels('--hub-line'), ink: channels('--hub-ink')
    } : null;
    const mix = (a, b, amount) => a.map((v, i) => v + (b[i] - v) * amount);
    const declarations = [];
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < states.length; column++) {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(sheet, column * width, row * height, width, height, 0, 0, width, height);
        if (hubColors) {
          const pixels = ctx.getImageData(0, 0, width, height);
          // Map the sprite's fill, bevel and rim to the chosen theme, keeping its alpha mask.
          const data = pixels.data;
          const center = (Math.floor(height / 2) * width + Math.floor(width / 2)) * 4;
          const tone = i => data[i] + data[i + 1] + data[i + 2];
          const baseTone = tone(center);
          let rimTone = baseTone;
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3]) rimTone = Math.max(rimTone, tone(i));
          }
          const base = row === 0 ? hubColors.primary : hubColors.secondary;
          const fill = [base, mix(base, hubColors.surface, .07), mix(base, hubColors.ink, .10), hubColors.surface][column];
          const rim = column === 3 ? hubColors.line : hubColors.rim;
          for (let i = 0; i < data.length; i += 4) {
            if (!data[i + 3]) continue;
            const relief = (tone(i) - baseTone) / Math.max(1, rimTone - baseTone);
            for (let ch = 0; ch < 3; ch++) data[i + ch] = fill[ch] + (rim[ch] - fill[ch]) * relief;
          }
          ctx.putImageData(pixels, 0, 0);
        }
        declarations.push(['--frame-' + faces[row] + '-' + states[column], 'url("' + tile.toDataURL('image/png') + '")']);
      }
    }
    for (const [name, value] of declarations) root.style.setProperty(name, value);
  }
  renderPalette();
  if (root.dataset.suiteModule === 'arcade') {
    new MutationObserver(renderPalette).observe(root, { attributes:true, attributeFilter:['data-arcade-theme'] });
  }
  if (['quick-drawn', 'poker'].includes(root.dataset.suiteModule)) {
    const observer = new ResizeObserver(entries => {
      for (const {target} of entries) {
        const w = target.offsetWidth, h = target.offsetHeight;
        if (w < 28 || h < 16) continue;
        const row = faces.indexOf(target.dataset.actionFace);
        const panel = document.createElement('canvas');
        panel.width = w; panel.height = h;
        const brush = panel.getContext('2d');
        brush.imageSmoothingEnabled = false;
        const sx = [0,14,width-14,width], sy = [0,8,height-8,height];
        const dx = [0,14,w-14,w], dy = [0,8,h-8,h];
        for (let c = 0; c < states.length; c++) {
          brush.clearRect(0,0,w,h);
          for (let y=0; y<3; y++) for (let x=0; x<3; x++) {
            brush.drawImage(sheet,c*width+sx[x],row*height+sy[y],sx[x+1]-sx[x],sy[y+1]-sy[y],
              dx[x],dy[y],dx[x+1]-dx[x],dy[y+1]-dy[y]);
          }
          target.style.setProperty('--action-'+states[c], 'url("'+panel.toDataURL()+'")');
        }
        target.dataset.singleFrame = '';
      }
    });
    document.querySelectorAll('#lobby .game-menu-column [data-action-face], [data-enter-casino]').forEach(button => observer.observe(button));
  }
  root.dataset.actionArt = 'ready';
}

loadActionFrames().catch(() => { document.documentElement.dataset.actionArt = 'fallback'; });
