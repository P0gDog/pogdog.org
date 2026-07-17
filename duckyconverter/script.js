(function () {
  const input = document.getElementById("d2a-input");
  const output = document.getElementById("d2a-output");
  const copyBtn = document.getElementById("d2a-copy");
  const downloadBtn = document.getElementById("d2a-download");
  const warningsWrap = document.getElementById("d2a-warnings-wrap");
  const warningsBody = document.getElementById("d2a-warnings-body");

  let currentSketch = "";
  let copyResetTimer = null;

  function render() {
    const text = input.value;
    if (!text.trim()) {
      output.innerHTML = '<div class="d2a-empty">Output will appear here as you type.</div>';
      currentSketch = "";
      copyBtn.disabled = true;
      downloadBtn.disabled = true;
      warningsWrap.style.display = "none";
      return;
    }
    try {
      const { sketch, warnings } = convert(text);
      output.textContent = sketch;
      currentSketch = sketch;
      copyBtn.disabled = false;
      downloadBtn.disabled = false;

      if (warnings.length) {
        warningsWrap.style.display = "block";
        warningsBody.innerHTML = warnings
          .map((w) => `<div class="d2a-warning-row">${w.replace(/</g, "&lt;")}</div>`)
          .join("");
      } else {
        warningsWrap.style.display = "none";
      }
    } catch (e) {
      output.textContent = "";
      currentSketch = "";
      copyBtn.disabled = true;
      downloadBtn.disabled = true;
      warningsWrap.style.display = "block";
      warningsBody.innerHTML = `<div class="d2a-warning-row">${(e.message || String(e)).replace(/</g, "&lt;")}</div>`;
    }
  }

  input.addEventListener("input", render);

  copyBtn.addEventListener("click", async () => {
    if (!currentSketch) return;
    try {
      await navigator.clipboard.writeText(currentSketch);
    } catch (e) {
      const textarea = document.createElement("textarea");
      textarea.value = currentSketch;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    clearTimeout(copyResetTimer);
    const originalLabel = "Copy";
    copyBtn.textContent = "Copied!";
    copyResetTimer = setTimeout(() => {
      copyBtn.textContent = originalLabel;
    }, 1500);
  });

  downloadBtn.addEventListener("click", () => {
    const sketch = currentSketch;
    const blob = new Blob([sketch], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "payload.ino";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  render();
})();
