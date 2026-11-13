// ── Fixed settings shared by several modules ─────────────────
// Slider options, the grid, the physics constants for both waves, and prop sizes.
// Nothing here changes while the app runs. No imports.

// ── Control-panel options ──
export const AMP_VALUES  = [22, 45, 90];           // px — 1/2/4 grid boxes (no 0; ON/OFF handles that)
export const AMP_LABELS  = ['1', '2', '4'];
export const FREQ_VALUES = [0.25, 0.5, 1.0, 2.0]; // Hz
export const FREQ_LABELS = [
  '<span class="frac"><span class="num">1</span><span class="den">4</span></span>',
  '<span class="frac"><span class="num">1</span><span class="den">2</span></span>',
  '1',
  '2',
];

// ── String layout + grid ──
// Physics — CFL fixed; wave speed set here, never by the speed slider
export const OFFSET  = 110;    // px from left edge before first particle
export const SPACING = 10;     // px between particle centres (was 11; wave speed 264→240 px/s)
// Grid — wave speed = CFL*SPACING*FPS = 0.4*10*60 = 240 px/s
// GRID_W = λ at 2 Hz = 240/2 = 120 = 12*SPACING
// GRID_H = 30 px → minor box = 30×30 (square); divides AMP_VALUES as 1/2/4 boxes
// Major line every 4 minor boxes (120 px wide × 120 px tall)
export const GRID_W    = 120;
export const GRID_H    = 30;
export const GRID_MINOR = GRID_W / 4;  // 30 px — minor grid subdivision
export const CY_OFFSET = 2 * GRID_H;  // shift equilibrium line down 2 boxes

// ── Physics (both waves) ──
// Both sims run the same finite-difference wave equation, one step per frame at full speed.
export const FPS     = 60;
export const DT      = 1 / FPS;
export const CFL     = 0.4;
export const CFL2    = CFL * CFL;
export const MUR     = (CFL - 1) / (CFL + 1); // Mur ABC coefficient, fixed

// The slinky is drawn as a horizontal coil; its wave is LONGITUDINAL, so each
// particle's stored value is a left/right (x) displacement, not up/down.
export const SLINKY_OFF = 80;    // px — left margin, equilibrium x of first particle
export const SLINKY_SP  = 8;     // px — horizontal equilibrium spacing between particles

// Slinky wave speed: twice the string's CFL, so compressions visibly outrun
// the transverse wave. Still ≤ 1, so the finite-difference scheme stays stable.
export const SLINKY_CFL  = CFL * 2;              // = 0.8
export const SLINKY_CFL2 = SLINKY_CFL * SLINKY_CFL;
export const SLINKY_MUR  = (SLINKY_CFL - 1) / (SLINKY_CFL + 1); // Mur absorbing-boundary coeff

// ── Props ──
export const CUP_TW       = 14;     // px — half-width at the rim
export const CUP_BW       = 9;      // px — half-width at the base
export const CUP_H        = 34;     // px — height
export const CUP_FRICTION = 0.9675; // velocity kept per step while coasting

export const TIE_W = 10;  // half-width (px)
export const TIE_H = 36;  // half-height (px)
