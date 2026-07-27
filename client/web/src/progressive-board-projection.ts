export interface ProgressiveBoardPosition {
  left: number;
  top: number;
}

export const PROGRESSIVE_BOARD_LEFT_STEP = 7.1;
export const PROGRESSIVE_BOARD_TOP_STEP = 5.35;
export const PROGRESSIVE_BOARD_TOP_ORIGIN = 15;

export function progressiveBoardPosition(x: number, y: number): ProgressiveBoardPosition {
  return {
    left: 50 + (x - y) * PROGRESSIVE_BOARD_LEFT_STEP,
    top: PROGRESSIVE_BOARD_TOP_ORIGIN + (x + y) * PROGRESSIVE_BOARD_TOP_STEP,
  };
}

export function progressiveBoardSvgPosition(x: number, y: number): { x: number; y: number } {
  const position = progressiveBoardPosition(x, y);
  return { x: position.left * 10, y: position.top * 10 };
}

export function progressiveBoardMidpoint(
  start: { x: number; y: number },
  end: { x: number; y: number },
): ProgressiveBoardPosition {
  return progressiveBoardPosition((start.x + end.x) / 2, (start.y + end.y) / 2);
}
