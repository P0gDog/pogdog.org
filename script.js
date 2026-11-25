(function(){
  "use strict";

  var bootTime = Date.now();
  var HOME = ["home","guest"];

  var vfs = {
    type:"dir",
    children:{
      home:{ type:"dir", children:{
        guest:{ type:"dir", children:{
          "about.txt":{ type:"file", content:
            "pogdog\n" +
            "-------\n" +
            "dev / cybersec / sysadmin / linux\n" +
            "Welcome to my site! It's a permanent work in progress and I use the domain mainly for hosting projects and servers.\n\n" +
            "Run `ls` to look around, or `help` for a list of commands.\n" +
            "I was inspired by https://terminal.phthallo.com. Check it out if you like this style of site!"
          },
          "contact.txt":{ type:"file", content:
            "email:   pogdog@pogdog.org\n" +
            "discord: pogdog7\n" +
            "github:  https://github.com/P0gDog\n\n" +
            "PGP key available at ~/pgp-key.txt"
          },
          "pgp-key.txt":{ type:"file", fetchPath:"pgp-key.txt" },
          "projects.txt":{ type:"file", content:
            "Most of my stuff is private. You can find some stuff on my GitHub in the contact file.\n" +
            "I've been making webports as of late. They're all on my GitHub."
          },
          ".secret":{ type:"file", content:
            "you found a secret! sadly there isn't really anthing here\n(nice work with -a though)"
          }
        }}
      }}
    }
  };

  var state = { cwd: HOME.slice(), history: [], histIdx: -1 };

  var out = document.getElementById("output");
  var body = document.getElementById("body");
  var input = document.getElementById("cmdInput");
  var promptEl = document.getElementById("promptEl");

  function esc(s){
    return String(s).replace(/[&<>]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;"}[c]; });
  }

  function linkify(escapedText){
    return escapedText.replace(/https?:\/\/[^\s<]+/g, function(url){
      var trail = "";
      var m = url.match(/[).,!?:;]+$/);
      if (m){ trail = m[0]; url = url.slice(0, -trail.length); }
      return '<a class="termlink" href="' + url + '" target="_blank" rel="noopener noreferrer">' + url + '</a>' + trail;
    });
  }

  function print(html){
    var div = document.createElement("div");
    div.className = "line";
    div.innerHTML = html;
    out.appendChild(div);
    scrollDown();
  }
  function printText(text){ print(linkify(esc(text))); }
  function scrollDown(){ body.scrollTop = body.scrollHeight; }

  function pathStr(arr){ return "/" + arr.join("/"); }
  function promptPath(){
    var p = pathStr(state.cwd);
    var homeStr = pathStr(HOME);
    if (p === homeStr) return "~";
    if (p.indexOf(homeStr + "/") === 0) return "~" + p.slice(homeStr.length);
    return p;
  }
  function renderPrompt(){
    promptEl.innerHTML =
      '<span class="green">guest</span><span class="dim">@</span><span class="green">pogdog.org</span>' +
      '<span class="dim">:</span><span class="accent2">' + esc(promptPath()) + '</span><span class="dim">$</span> ';
  }

  function resolvePath(argPath){
    var parts;
    var start;
    if (!argPath || argPath === "") return state.cwd.slice();
    if (argPath === "~") return HOME.slice();
    if (argPath.charAt(0) === "~") argPath = pathStr(HOME) + argPath.slice(1);
    if (argPath.charAt(0) === "/") { start = []; parts = argPath.split("/"); }
    else { start = state.cwd.slice(); parts = argPath.split("/"); }
    for (var i=0;i<parts.length;i++){
      var p = parts[i];
      if (p === "" || p === ".") continue;
      if (p === "..") { if (start.length) start.pop(); continue; }
      start.push(p);
    }
    return start;
  }

  function getNode(pathArr){
    var node = vfs;
    for (var i=0;i<pathArr.length;i++){
      if (!node || node.type !== "dir" || !node.children || !node.children[pathArr[i]]) return null;
      node = node.children[pathArr[i]];
    }
    return node;
  }

  function fetchText(path){
    return fetch(path).then(function(r){
      if (!r.ok) throw new Error("http " + r.status);
      return r.text();
    });
  }

  // ---- commands ----

  var COMMANDS = {
    help: function(){
      printText([
        "available commands:",
        "  help                 show this message",
        "  ls [-a] [path]       list directory contents",
        "  cd [path]            change directory",
        "  cat <file...>        print file contents",
        "  pwd                  print working directory",
        "  open <file>          open a file/link in a new tab",
        "  echo [text]          print text",
        "  date                 print current date/time",
        "  history              show command history",
        "  clear                clear the screen",
        "  fastfetch            replay the system info banner",
        "there might be a few hidden commands, too ;)"
      ].join("\n"));
    },
    ls: function(args){
      var showAll = false;
      var pathArgs = [];
      args.forEach(function(a){
        if (a === "-a" || a === "-la" || a === "-al") showAll = true;
        else pathArgs.push(a);
      });
      var target = pathArgs.length ? resolvePath(pathArgs[0]) : state.cwd.slice();
      var node = getNode(target);
      if (!node){ printText("ls: cannot access '" + (pathArgs[0]||"") + "': No such file or directory"); return; }
      if (node.type !== "dir"){ printText(pathArgs[0]); return; }
      var names = Object.keys(node.children).filter(function(n){
        return showAll || n.charAt(0) !== ".";
      });
      var dirs = names.filter(function(n){ return node.children[n].type === "dir"; }).sort();
      var files = names.filter(function(n){ return node.children[n].type !== "dir"; }).sort();
      var htmlParts = [];
      dirs.forEach(function(n){ htmlParts.push('<span class="accent2">' + esc(n) + '/</span>'); });
      files.forEach(function(n){
        var f = node.children[n];
        var cls = f.link ? "green" : "";
        htmlParts.push(cls ? '<span class="' + cls + '">' + esc(n) + '</span>' : esc(n));
      });
      if (!htmlParts.length) return;
      print(htmlParts.join("  "));
    },
    cd: function(args){
      var target = args[0] ? resolvePath(args[0]) : HOME.slice();
      var node = getNode(target);
      if (!node){ printText("cd: no such file or directory: " + args[0]); return; }
      if (node.type !== "dir"){ printText("cd: not a directory: " + args[0]); return; }
      state.cwd = target;
      renderPrompt();
    },
    pwd: function(){ printText(pathStr(state.cwd)); },
    whoami: function(){ printText("guest"); },
    echo: function(args){ printText(args.join(" ")); },
    date: function(){ printText(new Date().toString()); },
    history: function(){
      state.history.forEach(function(h,i){ printText("  " + (i+1) + "  " + h); });
    },
    clear: function(){ out.innerHTML = ""; },
    cat: function(args){
      if (!args.length){ printText("usage: cat <file...>"); return Promise.resolve(); }
      return args.reduce(function(chain, a){
        return chain.then(function(){
          var target = resolvePath(a);
          var node = getNode(target);
          if (!node){ printText("cat: " + a + ": No such file or directory"); return; }
          if (node.type === "dir"){ printText("cat: " + a + ": Is a directory"); return; }
          if (node.fetchPath){
            return fetchText(node.fetchPath).then(function(text){
              printText(text);
            }).catch(function(){
              printText("cat: " + a + ": could not load file");
            });
          }
          printText(node.content || "");
        });
      }, Promise.resolve());
    },
    open: function(args){
      if (!args.length){ printText("usage: open <file>"); return; }
      var target = resolvePath(args[0]);
      var node = getNode(target);
      if (!node){ printText("open: " + args[0] + ": No such file or directory"); return; }
      if (node.type === "dir"){ printText("open: " + args[0] + ": is a directory"); return; }
      if (!node.link){ printText("open: " + args[0] + ": nothing to open"); return; }
      printText("opening " + node.link + " ...");
      window.open(node.link, "_blank", "noopener");
    },
    banner: function(){ printBanner(); },
    neofetch: function(){ printFastfetch(); },
    fastfetch: function(){ printFastfetch(); },
    reboot: function(){
      out.innerHTML = "";
      boot();
    },
    sudo: function(args){
      sudoTries++;
      if (sudoTries >= 3){
        printText("three times? really?");
      } else {
        printText("blud is NOT opsec");
      }
    },
    rm: function(args){
      if (args.join(" ").indexOf("-rf") !== -1 && args.indexOf("/") !== -1){
        printText("rm: it's cute that you tried. nice try.");
        return;
      }
      printText("rm: permission denied (this filesystem is read-only, and also fake)");
    },
    vim: function(){ printText("~\n~\n~ -- INSERT --\n\n(just kidding. did i getcha? no? alright...)"); },
    nano: function(){ COMMANDS.vim(); },
    sl: function(){ printText("you ment ls, right?"); },
    pacman: function(){ printText("hiya fellow arch user"); },
    apt: function(){ printText("ew switch to arch"); }
  };

  var sudoTries = 0;

  function commandNames(){ return Object.keys(COMMANDS); }

  // ---- fastfetch / banner ----

  var FONT = {
    P: ["█████","█   █","█████","█    ","█    "],
    O: [" ███ ","█   █","█   █","█   █"," ███ "],
    G: [" ███ ","█    ","█  ██","█   █"," ███ "],
    D: ["████ ","█   █","█   █","█   █","████ "]
  };
  function bannerText(word){
    var rows = ["","","","",""];
    for (var i=0;i<word.length;i++){
      var g = FONT[word.charAt(i)] || ["     ","     ","     ","     ","     "];
      for (var r=0;r<5;r++) rows[r] += g[r] + " ";
    }
    return rows.join("\n");
  }
  function printBanner(){
    print('<pre class="banner">' + esc(bannerText("POGDOG")) + '</pre>');
  }

  function fmtUptime(){
    var s = Math.floor((Date.now() - bootTime) / 1000);
    var m = Math.floor(s/60); s = s%60;
    var h = Math.floor(m/60); m = m%60;
    var parts = [];
    if (h) parts.push(h + "h");
    parts.push(m + "m");
    parts.push(s + "s");
    return parts.join(" ");
  }

  function printFastfetch(){
    var swatches1 = "";
    var colors = ["#000","#f27878","#7ee787","#e8c87e","#6fd3e8","#a48cf2","#7ee7e8","#d9dbe3"];
    colors.forEach(function(c){ swatches1 += '<span style="background:' + c + '"></span>'; });

    var info =
      '<div><span class="k">guest</span><span class="dim">@</span><span class="k">pogdog.org</span></div>' +
      '<div class="dim">' + new Array(21).join("-") + '</div>' +
      '<div><span class="k">OS:</span> Arch Linux x86_64</div>' +
      '<div><span class="k">Host:</span> pogdog.org</div>' +
      '<div><span class="k">Kernel:</span> Linux 6.8.9-arch1-1</div>' +
      '<div><span class="k">Uptime:</span> ' + fmtUptime() + '</div>' +
      '<div><span class="k">Shell:</span> bash 5.2.26</div>' +
      '<div><span class="k">Terminal:</span> Konsole 24.02.2</div>' +
      '<div><span class="k">Locale:</span> en_US.UTF-8</div>' +
      '<div style="margin-top:6px" class="swatches">' + swatches1 + '</div>';

    print(
      '<div class="fastfetch">' +
        '<div class="info">' + info + '</div>' +
      '</div>'
    );
  }

  // ---- input handling ----

  function tokenize(str){
    return str.trim().split(/\s+/).filter(Boolean);
  }

  function runCommand(raw){
    var trimmed = raw.trim();
    if (trimmed !== ""){ state.history.push(trimmed); }
    state.histIdx = state.history.length;
    var tokens = tokenize(trimmed);
    if (!tokens.length) return Promise.resolve();
    var cmd = tokens[0];
    var args = tokens.slice(1);
    if (!COMMANDS[cmd]){
      printText(cmd + ": command not found");
      return Promise.resolve();
    }
    return Promise.resolve(COMMANDS[cmd](args));
  }

  function echoInputLine(text){
    print(
      '<span class="green">guest</span><span class="dim">@</span><span class="green">pogdog.org</span>' +
      '<span class="dim">:</span><span class="accent2">' + esc(promptPath()) + '</span><span class="dim">$</span> ' +
      esc(text)
    );
  }

  var busy = false;

  document.getElementById("inputForm").addEventListener("submit", function(e){
    e.preventDefault();
    if (busy) return;
    var val = input.value;
    input.value = "";
    echoInputLine(val);
    busy = true;
    Promise.resolve(runCommand(val)).then(function(){
      renderPrompt();
      busy = false;
      scrollDown();
      input.focus();
    });
  });

  input.addEventListener("keydown", function(e){
    if (e.key === "ArrowUp"){
      e.preventDefault();
      if (state.histIdx > 0){ state.histIdx--; input.value = state.history[state.histIdx] || ""; }
    } else if (e.key === "ArrowDown"){
      e.preventDefault();
      if (state.histIdx < state.history.length - 1){
        state.histIdx++; input.value = state.history[state.histIdx] || "";
      } else {
        state.histIdx = state.history.length; input.value = "";
      }
    } else if (e.key === "Tab"){
      e.preventDefault();
      var tokens = tokenize(input.value);
      var isFirst = input.value.slice(-1) !== " " && tokens.length <= 1;
      var frag = tokens.length ? tokens[tokens.length-1] : "";
      var candidates;
      if (isFirst){
        candidates = commandNames().filter(function(n){ return n.indexOf(frag) === 0; });
      } else {
        var node = getNode(state.cwd);
        candidates = node && node.type === "dir" ? Object.keys(node.children).filter(function(n){
          return n.charAt(0) !== "." && n.indexOf(frag) === 0;
        }) : [];
      }
      if (candidates.length === 1){
        var completion = candidates[0];
        if (isFirst) input.value = completion + " ";
        else {
          tokens[tokens.length-1] = completion;
          input.value = tokens.join(" ");
        }
      } else if (candidates.length > 1){
        echoInputLine(input.value);
        printText(candidates.join("  "));
      }
    } else if (e.key === "l" && e.ctrlKey){
      e.preventDefault();
      out.innerHTML = "";
    }
  });

  document.getElementById("body").addEventListener("click", function(){
    input.focus();
  });

  // ---- boot sequence ----

  function boot(){
    renderPrompt();
    printBanner();
    printFastfetch();
    print('<span class="dim">Type \'help\' to see available commands.</span>');
    input.focus();
  }

  boot();
})();
