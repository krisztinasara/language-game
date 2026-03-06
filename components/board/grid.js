const gridCols = 13;
const gridRows = 6;

/**
 * Converts percentage coordinates to pixel coordinates
 * based on the current viewport size.
 */
export function percentToPixels(
  xPercent,
  yPercent,
  viewportWidth = window.innerWidth,
  viewportHeight = window.innerHeight
) {
  return {
    x: viewportWidth * (xPercent / 100),
    y: viewportHeight * (yPercent / 100),
  };
}

/**
 * Converts grid coordinates directly to pixel coordinates.
 */
export function gridToPixels(
  col,
  row,
  viewportWidth = window.innerWidth,
  viewportHeight = window.innerHeight
) {
  const xPercent = (col / (gridCols - 1)) * 100;
  const yPercent = (row / (gridRows - 1)) * 100;
  return percentToPixels(xPercent, yPercent, viewportWidth, viewportHeight);
}

