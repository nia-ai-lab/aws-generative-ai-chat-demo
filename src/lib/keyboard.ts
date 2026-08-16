export interface EnterKeyState {
  key: string;
  shiftKey: boolean;
  isComposing: boolean;
  keyCode: number;
}

export function shouldSendOnKeyDown(state: EnterKeyState): boolean {
  return (
    state.key === 'Enter' &&
    !state.shiftKey &&
    !state.isComposing &&
    state.keyCode !== 229
  );
}
