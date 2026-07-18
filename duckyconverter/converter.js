class ConversionError extends Error {}

function escapeStr(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function substituteDefines(line, defines) {
  const names = Object.keys(defines);
  if (!names.length) return line;
  names.sort((a, b) => b.length - a.length);
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(^|[^A-Za-z0-9_#])${escaped}(?![A-Za-z0-9_])`, "g");
    line = line.replace(pattern, (m, pre) => pre + defines[name]);
  }
  return line;
}

function parseDuckyscript(text) {
  const lines = text.split(/\r?\n/);
  const commands = [];
  const warnings = [];
  let defaultDelay = 0;
  let pendingStringDelay = null;
  let lastCommand = null;
  const defines = {};
  const ifStack = [];

  for (let raw of lines) {
    let line = raw.trim();
    if (!line) continue;
    line = substituteDefines(line, defines);

    const spaceIdx = line.indexOf(" ");
    const keyword = (spaceIdx === -1 ? line : line.slice(0, spaceIdx)).toUpperCase();
    const rest = spaceIdx === -1 ? "" : line.slice(spaceIdx + 1);

    if (keyword === "IF") {
      const parentSkip = ifStack.length > 0 && !ifStack[ifStack.length - 1].taken;
      if (!parentSkip) {
        const condition = rest.replace(/\bTHEN\s*$/i, "").trim();
        warnings.push(`IF condition "${condition}" cannot be evaluated statically; assuming true (the ELSE branch, if any, is dropped) in line: ${line}`);
      }
      ifStack.push({ parentSkip, taken: !parentSkip });
      continue;
    }

    if (keyword === "ELSE") {
      if (!ifStack.length) throw new ConversionError("ELSE without matching IF");
      const frame = ifStack[ifStack.length - 1];
      if (!frame.parentSkip) frame.taken = false;
      continue;
    }

    if (keyword === "END_IF") {
      if (!ifStack.length) throw new ConversionError("END_IF without matching IF");
      ifStack.pop();
      continue;
    }

    if (ifStack.length && !ifStack[ifStack.length - 1].taken) {
      continue;
    }

    if (keyword === "REM") {
      continue;
    }

    if (keyword === "EXTENSION") {
      continue;
    }

    if (keyword === "DEFINE") {
      const parts = rest.trim().split(/\s+/);
      if (parts.length < 2) throw new ConversionError("Invalid DEFINE syntax: " + line);
      const name = parts[0];
      const value = parts.slice(1).join(" ");
      defines[name] = value;
      continue;
    }

    if (keyword === "DEFAULT_DELAY" || keyword === "DEFAULTDELAY") {
      const ms = parseInt(rest.trim(), 10);
      if (Number.isNaN(ms)) throw new ConversionError("Invalid DEFAULT_DELAY value: " + rest);
      defaultDelay = ms;
      continue;
    }

    if (keyword === "STRING_DELAY" || keyword === "STRINGDELAY") {
      const ms = parseInt(rest.trim(), 10);
      if (Number.isNaN(ms)) throw new ConversionError("Invalid STRING_DELAY value: " + rest);
      pendingStringDelay = ms;
      continue;
    }

    if (keyword === "DELAY") {
      const ms = parseInt(rest.trim(), 10);
      if (Number.isNaN(ms)) throw new ConversionError("Invalid DELAY value: " + rest);
      const cmd = { kind: "delay", ms };
      commands.push(cmd);
      lastCommand = cmd;
      continue;
    }

    if (keyword === "STRING" || keyword === "STRINGLN") {
      const cmd = {
        kind: keyword === "STRING" ? "string" : "stringln",
        text: rest,
        perCharDelay: pendingStringDelay,
      };
      commands.push(cmd);
      lastCommand = cmd;
      pendingStringDelay = null;
      continue;
    }

    if (keyword === "REPEAT") {
      const n = parseInt(rest.trim(), 10);
      if (Number.isNaN(n)) throw new ConversionError("Invalid REPEAT value: " + rest);
      if (!lastCommand) throw new ConversionError("REPEAT used with no prior command to repeat");
      for (let i = 0; i < n; i++) commands.push(lastCommand);
      continue;
    }

    const tokens = line.split(/\s+/);
    const cmd = { kind: "keycombo", tokens };
    commands.push(cmd);
    lastCommand = cmd;
  }

  if (ifStack.length) throw new ConversionError("Unclosed IF: missing END_IF");

  return { commands, defaultDelay, warnings };
}

function generateIno(commands, defaultDelay, warnings) {
  const body = [];
  const emit = (line, indent = 1) => body.push("  ".repeat(indent) + line);

  for (const cmd of commands) {
    if (cmd.kind === "delay") {
      emit(`delay(${cmd.ms});`);
    } else if (cmd.kind === "string" || cmd.kind === "stringln") {
      const escaped = escapeStr(cmd.text);
      if (cmd.perCharDelay) {
        emit("{");
        emit(`const char* s = "${escaped}";`, 2);
        emit(`for (size_t idx = 0; s[idx] != '\\0'; idx++) {`, 2);
        emit(`Keyboard.print(s[idx]);`, 3);
        emit(`delay(${cmd.perCharDelay});`, 3);
        emit(`}`, 2);
        emit("}");
      } else {
        emit(`Keyboard.print("${escaped}");`);
      }
      if (cmd.kind === "stringln") {
        emit("Keyboard.press(KEY_RETURN);");
        emit("delay(5);");
        emit("Keyboard.release(KEY_RETURN);");
      }
      if (defaultDelay) emit(`delay(${defaultDelay});`);
    } else if (cmd.kind === "keycombo") {
      const tokens = cmd.tokens;
      const mods = tokens.filter(isModifier);
      const keys = tokens.filter((t) => !isModifier(t));

      const resolvedKeys = [];
      const unknown = [];
      for (const k of keys) {
        const r = resolveKey(k);
        if (r === null) unknown.push(k);
        else resolvedKeys.push(r);
      }

      if (unknown.length) {
        warnings.push(`Could not resolve key token(s) "${unknown.join(", ")}" in line: ${tokens.join(" ")}`);
      }

      const pressTargets = mods.map((m) => MODIFIER_KEYS[m.toUpperCase()]).concat(resolvedKeys);

      if (!pressTargets.length) {
        warnings.push(`No resolvable keys in line: ${tokens.join(" ")}`);
        continue;
      }

      emit("{");
      for (const t of pressTargets) emit(`Keyboard.press(${t});`, 2);
      emit("delay(5);", 2);
      for (const t of [...pressTargets].reverse()) emit(`Keyboard.release(${t});`, 2);
      emit("}");

      if (defaultDelay) emit(`delay(${defaultDelay});`);
    }
  }

  const bodyStr = body.length ? body.join("\n") : "  ";

  return `#include <Keyboard.h>

const unsigned long STARTUP_DELAY_MS = 2000;

void setup() {
  delay(STARTUP_DELAY_MS);
  Keyboard.begin();

  runPayload();

  Keyboard.end();
}

void loop() {
}

void runPayload() {
${bodyStr}
}
`;
}

function convert(text) {
  const { commands, defaultDelay, warnings } = parseDuckyscript(text);
  const sketch = generateIno(commands, defaultDelay, warnings);
  return { sketch, warnings };
}
