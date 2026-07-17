const MODIFIER_KEYS = {
  CTRL: "KEY_LEFT_CTRL",
  CONTROL: "KEY_LEFT_CTRL",
  ALT: "KEY_LEFT_ALT",
  SHIFT: "KEY_LEFT_SHIFT",
  GUI: "KEY_LEFT_GUI",
  WINDOWS: "KEY_LEFT_GUI",
  COMMAND: "KEY_LEFT_GUI",
};

const SPECIAL_KEYS = {
  ENTER: "KEY_RETURN",
  RETURN: "KEY_RETURN",
  TAB: "KEY_TAB",
  SPACE: "' '",
  ESCAPE: "KEY_ESC",
  ESC: "KEY_ESC",
  BACKSPACE: "KEY_BACKSPACE",
  DELETE: "KEY_DELETE",
  DEL: "KEY_DELETE",
  UP: "KEY_UP_ARROW",
  UPARROW: "KEY_UP_ARROW",
  DOWN: "KEY_DOWN_ARROW",
  DOWNARROW: "KEY_DOWN_ARROW",
  LEFT: "KEY_LEFT_ARROW",
  LEFTARROW: "KEY_LEFT_ARROW",
  RIGHT: "KEY_RIGHT_ARROW",
  RIGHTARROW: "KEY_RIGHT_ARROW",
  HOME: "KEY_HOME",
  END: "KEY_END",
  INSERT: "KEY_INSERT",
  PAGEUP: "KEY_PAGE_UP",
  PAGEDOWN: "KEY_PAGE_DOWN",
  CAPSLOCK: "KEY_CAPS_LOCK",
  PRINTSCREEN: "KEY_PRINT_SCREEN",
  SCROLLLOCK: "KEY_SCROLL_LOCK",
  PAUSE: "KEY_PAUSE",
  BREAK: "KEY_PAUSE",
  APP: "KEY_MENU",
  MENU: "KEY_MENU",
};
for (let i = 1; i <= 24; i++) SPECIAL_KEYS["F" + i] = "KEY_F" + i;

function isModifier(tok) {
  return Object.prototype.hasOwnProperty.call(MODIFIER_KEYS, tok.toUpperCase());
}

function resolveKey(tok) {
  const up = tok.toUpperCase();
  if (Object.prototype.hasOwnProperty.call(SPECIAL_KEYS, up)) return SPECIAL_KEYS[up];
  if (tok.length === 1) return "'" + tok + "'";
  return null;
}
