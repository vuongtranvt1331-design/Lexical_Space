const TAP_SLOP_PX = 8;

function hasSelectedText(region) {
  const selection = window.getSelection();
  return Boolean(selection?.rangeCount && !selection.isCollapsed && selection.getRangeAt(0).intersectsNode(region));
}

// Observe movement without capturing the pointer or interrupting native scrolling and text selection.
export function trackIntentionalClicks(surface, resolveRegion) {
  let tap;
  surface.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) {
      if (tap) tap.blocked = true;
      return;
    }
    const region = resolveRegion(event.target);
    tap = region && { region, pointerId: event.pointerId, x: event.clientX, y: event.clientY, blocked: hasSelectedText(region) };
  }, { passive: true });
  for (const type of ['pointermove', 'pointerup']) {
    surface.addEventListener(type, event => {
      if (!tap || tap.pointerId !== event.pointerId || tap.released) return;
      if (Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > TAP_SLOP_PX) tap.blocked = true;
      if (type === 'pointerup') tap.released = true;
    }, { passive: true });
  }
  for (const type of ['pointercancel', 'pointerleave']) {
    surface.addEventListener(type, event => {
      if (tap && tap.pointerId === event.pointerId && !tap.released) tap.blocked = true;
    }, { passive: true });
  }
  return event => {
    const previousTap = tap;
    tap = null;
    const region = resolveRegion(event.target);
    if (!region || event.detail > 1 || hasSelectedText(region)) return false;
    // A canceled gesture may not produce a click. Don't let it block a later keyboard activation.
    if (event.detail === 0) return true;
    if (!previousTap) return !window.PointerEvent;
    return previousTap.released && !previousTap.blocked && previousTap.region === region;
  };
}

export function bindMenuScrollDismiss(surface, menu, trigger) {
  if (!surface || !menu) return;
  const isMenuTarget = target => Boolean(target && (menu.contains(target) || trigger?.contains(target)));
  const close = () => {
    if (!menu.classList.contains('hidden')) {
      menu.classList.add('hidden');
    }
  };

  surface.addEventListener('scroll', event => {
    if (isMenuTarget(event.target)) return;
    close();
  }, { capture: true, passive: true });

  surface.addEventListener('wheel', event => {
    if (isMenuTarget(event.target)) return;
    if (event.deltaX || event.deltaY) close();
  }, { passive: true });

  let touchStart = null;
  surface.addEventListener('touchstart', event => {
    if (!event.touches?.length) return;
    const touch = event.touches[0];
    touchStart = { x: touch.clientX, y: touch.clientY, inMenu: isMenuTarget(event.target) };
  }, { passive: true });

  surface.addEventListener('touchmove', event => {
    if (!touchStart || touchStart.inMenu || !event.touches?.length) return;
    const touch = event.touches[0];
    if (Math.hypot(touch.clientX - touchStart.x, touch.clientY - touchStart.y) > TAP_SLOP_PX) {
      close();
    }
  }, { passive: true });

  let pointerStart = null;
  surface.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
    pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY, inMenu: isMenuTarget(event.target) };
  }, { passive: true });

  surface.addEventListener('pointermove', event => {
    if (!pointerStart || pointerStart.id !== event.pointerId || pointerStart.inMenu) return;
    if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > TAP_SLOP_PX) {
      close();
    }
  }, { passive: true });
}

