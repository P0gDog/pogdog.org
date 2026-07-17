class ConversionError extends Error {}

function escapeStr(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function parseDuckyscript(text) {
  const lines = text.split(/\r?\n/);
  const commands = [];
  const warnings = [];
  let defaultDelay = 0;
  let pendingStringDelay = null;
  let lastCommand = null;

  for (let raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const spaceIdx = line.indexOf(" ");
    const keyword = (spaceIdx === -1 ? line : line.slice(0, spaceIdx)).toUpperCase();
    const rest = spaceIdx === -1 ? "" : line.slice(spaceIdx + 1);

    if (keyword === "REM") {
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
  const warnings = [];
  const { commands, defaultDelay } = parseDuckyscript(text);
  const sketch = generateIno(commands, defaultDelay, warnings);
  return { sketch, warnings };
}
