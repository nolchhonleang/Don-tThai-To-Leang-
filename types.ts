export enum GameState {
  MENU = 'MENU',
  LOADING = 'LOADING',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER'
}

export const DONT_THAI_TO_LEANG_BG_URL = "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Flag_of_Thailand.svg/800px-Flag_of_Thailand.svg.png";

export interface Entity {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VisionResult {
  isPinching: boolean;
  x: number; // 0 to 1 normalized position
  y: number; // 0 to 1 normalized position
}