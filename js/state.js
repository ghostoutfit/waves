// ── Shared state ──────────────────────────────────────────────
// The canvas, and the settings the control panel changes that several modules read.
// ES-module rule: only this file can reassign these, so each has a setter at the foot;
// everyone else imports the value (a live binding — always current) and calls the setter.
import { AMP_VALUES, FREQ_VALUES } from './config.js';

export const canvas = document.getElementById('canvas');
export const ctx    = canvas.getContext('2d');

// Master view switch — the single most important variable in the app.
// 'wave' = transverse string, 'slinky' = longitudinal slinky. Every
// simulation, render, and input handler branches on it. Defaults to slinky.
export let activeView = 'slinky';

export let selectedAmpValue = AMP_VALUES[0]; // currently-chosen amplitude (22 px)
export let driverOn         = false;         // whether continuous driver is running
export let targetAmplitude  = 0;             // 0 when driver off, selectedAmpValue when on
export let frequency        = FREQ_VALUES[0];

// Slow-mo: speedFactor 0.125 (turtle) → 1.0 (rabbit) steps per display frame.
// simAccum is the leftover fraction of a step, used to interpolate between prev and
// cur so rendering stays smooth below 1 step/frame.
export let speedFactor = 1.0;
export let simAccum    = 0;
export let paused      = false;
export let darkMode    = false;
export let soundEnabled = true;

// Cached layout read: the controls panel's bottom edge. Recomputed only on
// resize so drawSlinky() doesn't force a synchronous reflow every frame.
export let controlsBottom = 0;

export function setActiveView(v)       { activeView = v; }
export function setSelectedAmpValue(v) { selectedAmpValue = v; }
export function setDriverOn(v)         { driverOn = v; }
export function setTargetAmplitude(v)  { targetAmplitude = v; }
export function setFrequency(v)        { frequency = v; }
export function setSpeedFactor(v)      { speedFactor = v; }
export function setSimAccum(v)         { simAccum = v; }
export function setPaused(v)           { paused = v; }
export function setDarkMode(v)         { darkMode = v; }
export function setSoundEnabled(v)     { soundEnabled = v; }
export function setControlsBottom(v)   { controlsBottom = v; }
