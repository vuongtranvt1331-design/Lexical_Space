'use strict';
// Once per document load. Returning to the lobby never triggers the advert.
(()=>{
 const base=new URL('../assets/images/events/',document.currentScript?.src||new URL('./js/event-promo.js',location.href));
 const overlay=document.createElement('div');overlay.className='event-promo';overlay.dataset.eventPromo='';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Sunday, the king plays — Giải đấu cờ vua và từ vựng');
 const card=document.createElement('div');card.className='event-promo-card';
 const poster=document.createElement('img');poster.className='event-promo-poster';poster.src=new URL('Sunday-the-king-plays-poster.png',base);poster.alt='Sunday, the king plays — Giải đấu cờ vua & từ vựng — SUN 22/11 — Tìm ra xứ quân';
 const close=document.createElement('button');close.type='button';close.className='event-promo-close';close.dataset.eventPromoClose='';close.textContent='×';close.setAttribute('aria-label','Đóng thông báo giải đấu');
 const register=document.createElement('button');register.type='button';register.className='event-register-button';register.dataset.eventPromoRegister='';register.setAttribute('aria-label','Đăng kí ngay — đóng thông báo');
 const inscription=document.createElement('img');inscription.src=new URL('dang-ki-ngay-transparent.png',base);inscription.alt='ĐĂNG KÍ NGAY';register.append(inscription);
 card.append(poster);card.append(register);card.append(close);overlay.append(card);document.body.append(overlay);document.body.classList.add('event-promo-open');
 const previous=document.activeElement;
 function dismiss(){if(overlay.hidden)return;overlay.hidden=true;document.body.classList.remove('event-promo-open');if(previous instanceof HTMLElement&&previous!==document.body)previous.focus();else document.querySelector('[data-open-chess]')?.focus()}
 close.onclick=dismiss;register.onclick=dismiss;
 overlay.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();dismiss()}else if(event.key==='Tab'){event.preventDefault();(document.activeElement===close?register:close).focus()}});
 register.focus();
})();
