import { localFrench } from './study-language.js';
// Live accessors are installed by the application entry point.
export const context = {};
export const GUEST_PROFILE = 'Guest';
export const canSyncProfile = username => Boolean(!localFrench && username && username !== GUEST_PROFILE);
