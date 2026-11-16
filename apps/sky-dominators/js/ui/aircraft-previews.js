/* js/ui/aircraft-previews.js — ordered classic script; entrypoints declare dependency order. */
function drawCrossHairRotor(ctx, width, height, angle,skinId='factory_default') {
    if(skinId==='phoenix_fire'||skinId==='ornithopter')return; // Animated phoenix wings replace the cosmetic rotor.
    ctx.save();
    // Only the main blades and their center hub overlay the original body.
    ctx.translate(0, -height * .025);
    ctx.save(); ctx.rotate(angle);
    const woodRotor=skinId==='elder_wood'?SkySkins.image(SkySkinCatalog.elderWoodRotor):null;
    if(SkySkins.ready(woodRotor))SkySkins.fit(ctx,woodRotor,0,0,width*.98,width*.98*64/288);
    else {
    ctx.fillStyle = '#0f172a'; ctx.fillRect(-width * .49, -2, width * .98, 4);
    ctx.fillStyle = '#94a3b8'; ctx.fillRect(-width * .48, -2, width * .96, 2);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(-width * .49, -2, 3, 4); ctx.fillRect(width * .49 - 3, -2, 3, 4);
    }
    ctx.restore(); ctx.fillStyle = '#e2e8f0'; ctx.fillRect(-2, -2, 4, 4);
    ctx.restore();
}

function updateCrossHairPreviews(now) {
    // Reuse the game's animation loop for all DOM previews, including Records.
    for (const img of document.querySelectorAll('img')) {
        if(['exalted','celestial','prism_core'].includes(img.dataset.skinId)||img.parentElement?.matches('.exalted-preview,.celestial-preview,.prism-core-preview'))continue;
        const eligible = img.dataset.aircraftKey === 'corsair' || /(?:skin_4\.png|aircraft_4\.png)/.test(img.getAttribute('src') || '');
        let wrap = img.parentElement;
        if (!eligible) {
            img.style.opacity = '';
            if (wrap?.classList.contains('crosshair-preview')) {
                wrap.replaceWith(img);
            }
            continue;
        }
        if (!wrap.classList.contains('crosshair-preview')) {
            const holder = document.createElement('span'); holder.className = 'crosshair-preview';
            img.replaceWith(holder); holder.appendChild(img);
            const overlay = document.createElement('canvas'); overlay.setAttribute('aria-hidden', 'true');
            holder.appendChild(overlay); wrap = holder;
        }
        const overlay = wrap.querySelector('canvas');
        const w = img.clientWidth, h = img.clientHeight;
        if (!w || !h || !img.naturalWidth) continue;
        if (overlay.width !== w || overlay.height !== h) { overlay.width = w; overlay.height = h; }
        const ctx = overlay.getContext('2d'); ctx.clearRect(0, 0, w, h); ctx.imageSmoothingEnabled = false;
        const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
        ctx.save(); ctx.translate(w / 2, h / 2);
        if(img.dataset.skinId==='ornithopter'){
            const drawn=SkyOrnithopter.preview(ctx,img,now,w,h,SkySkins.image,SkySkins.ready);
            img.style.opacity=drawn?'0':'';
        }else{
            img.style.opacity='';
            drawCrossHairRotor(ctx, img.naturalWidth * scale, img.naturalHeight * scale, now * Math.PI * 6 / 1000,img.dataset.skinId);
        }
        ctx.restore();
    }
}
