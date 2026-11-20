(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const room = window.SpaceCoop;
  let selectedShip;
  const query = new URLSearchParams(location.search);
  const requested = {boss:Number(query.get('boss')),phase:Number(query.get('phase')),level:Number(query.get('level'))};
  const lab = Number.isInteger(requested.boss) && requested.boss>=1 && requested.boss<=10 && Number.isInteger(requested.phase) && requested.phase>=1 && requested.phase<=(requested.boss===10?3:2) && Number.isInteger(requested.level) && requested.level>=1 && requested.level<=8 ? requested : null;
  const skill = query.get('skill');
  if (lab && skill !== null && /^\d$/.test(skill) && window.SpaceBosses?.catalog?.[lab.boss-1]?.skills?.[Number(skill)]) lab.skillIndex=Number(skill);

  function render(state) {
    if (!state) state = room.state || {};
    const inRoom = !!state.role;

    // Top-left: four-digit input or room badge
    const input = el('roomCodeInput');
    const badge = el('coopRoomBadge');
    if (input) input.hidden = inRoom;
    if (badge) {
      badge.hidden = !inRoom;
      if (inRoom) {
        const codeEl = el('coopCode');
        if (codeEl) codeEl.textContent = state.code || '0000';
      }
    }

    // Top-right: Join Room or Ready / Cancel Ready
    const joinBtn = el('joinRoomBtn');
    const readyBtn = el('readyRoom');
    if (joinBtn) joinBtn.hidden = inRoom;
    if (readyBtn) {
      readyBtn.hidden = !inRoom;
      if (inRoom) {
        const side = state.role === 'host' ? 0 : 1;
        const isReady = !!state.ready?.[side];
        readyBtn.textContent = isReady ? 'Cancel Ready' : 'Ready';
        readyBtn.disabled = !state.connected;
      }
    }

    // Bottom-left: Create Room / Reconnect / Partner status
    const createBtn = el('createRoom');
    const resumeBtn = el('resumeSavedRoom');
    const statusEl = el('coopPartnerStatus');

    if (inRoom) {
      if (createBtn) createBtn.hidden = true;
      if (resumeBtn) resumeBtn.hidden = true;
      if (statusEl) {
        statusEl.hidden = false;
        if (!state.connected) {
          statusEl.textContent = ['error','reconnecting'].includes(state.status) ? 'Reconnecting…' : 'Waiting for wingmate';
        } else {
          const partnerSide = state.role === 'host' ? 1 : 0;
          statusEl.textContent = state.ready?.[partnerSide] ? 'Wingmate · Ready' : 'Wingmate · Waiting';
        }
      }
    } else {
      if (statusEl) statusEl.hidden = true;
      const saved = room.savedRoom;
      if (saved) {
        if (createBtn) createBtn.hidden = true;
        if (resumeBtn) {
          resumeBtn.hidden = false;
          resumeBtn.textContent = 'Reconnect ' + saved.code;
        }
      } else {
        if (resumeBtn) resumeBtn.hidden = true;
        if (createBtn) createBtn.hidden = false;
      }
    }
  }

  function open() {
    window.setHangarView?.('core');
    render(room.state);
  }

  function close() {
    window.setHangarView?.('main');
  }

  el('openCoop')?.addEventListener('click', open);

  el('joinRoomBtn')?.addEventListener('click', () => {
    const val = el('roomCodeInput')?.value.trim();
    if (/^[0-9]{4}$/.test(val)) room.join(val, selectedShip?.());
    else el('roomCodeInput')?.focus();
  });

  el('roomCodeInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = el('roomCodeInput')?.value.trim();
      if (/^[0-9]{4}$/.test(val)) room.join(val, selectedShip?.());
    }
  });

  el('createRoom')?.addEventListener('click', () => room.create(lab, selectedShip?.()));
  el('resumeSavedRoom')?.addEventListener('click', () => room.resumeSaved());

  el('readyRoom')?.addEventListener('click', () => {
    const state = room.state;
    const side = state.role === 'host' ? 0 : 1;
    room.ready(!state.ready?.[side], selectedShip ? selectedShip() : undefined);
  });

  el('leaveRoom')?.addEventListener('click', () => {
    if (room.state?.role) room.leave();
    close();
  });

  // Clicking partner status during reconnect attempt can trigger retry
  el('coopPartnerStatus')?.addEventListener('click', () => {
    if (['error','reconnecting'].includes(room.state?.status)) room.reconnect();
  });

  window.SpaceLobby = {
    open,
    close,
    render,
    init(getShip) {
      selectedShip = getShip;
      if (lab && !room.state?.role) open();
    }
  };
})();
