/* Creation to Captivity: renders content/*.json into a single scrolling page.
   All copy comes from content/; nothing theological is hard-coded here except the
   centuries shown beside each author's name. */
(function () {
  "use strict";

  var ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
  var CENTURY = {
    "St. Athanasius the Apostolic": "4th century",
    "St. Cyril of Alexandria": "5th century",
    "Clement of Alexandria": "2nd–3rd century",
    "St. Antony the Great": "3rd–4th century",
    "St. Macarius the Great (the Egyptian)": "4th century",
    "St. Ephrem the Syrian": "4th century",
    "St. Ambrose of Milan": "4th century",
    "Fr. Tadros Y. Malaty": "modern commentary"
  };
  var SVGNS = "http://www.w3.org/2000/svg";

  function getJSON(url) {
    return fetch(url, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(url + " " + r.status);
      return r.json();
    });
  }
  function getText(url) {
    return fetch(url, { cache: "no-cache" }).then(function (r) { return r.ok ? r.text() : ""; });
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function sentence(s) { return /[.!?”"]$/.test(s) ? s : s + "."; }

  /* ---------- tiny markdown: ## headings, - bullets, paragraphs, **bold**, *em* ---------- */
  function inline(s) {
    return esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
  }
  function mdSections(md) {
    var sections = [], cur = null;
    md.split(/\r?\n/).forEach(function (line) {
      var h = /^##\s+(.*)$/.exec(line);
      if (h) { cur = { title: h[1].trim(), lines: [] }; sections.push(cur); }
      else if (cur) cur.lines.push(line);
    });
    return sections.map(function (s) {
      var html = "", list = false;
      s.lines.forEach(function (l) {
        var b = /^\s*-\s+(.*)$/.exec(l);
        if (b) { if (!list) { html += "<ul>"; list = true; } html += "<li>" + inline(b[1]) + "</li>"; }
        else { if (list) { html += "</ul>"; list = false; } if (l.trim()) html += "<p>" + inline(l.trim()) + "</p>"; }
      });
      if (list) html += "</ul>";
      return { title: s.title, html: html };
    });
  }
  function notesHTML(md) {
    if (!md) return "";
    return '<div class="notes">' + mdSections(md).map(function (s) {
      var here = /storylines here/i.test(s.title);
      return '<div class="' + (here ? "threads-here" : "") + '"><h3>' + esc(s.title) + "</h3>" + s.html + "</div>";
    }).join("") + "</div>";
  }

  /* ---------- quotes ---------- */
  function quoteHTML(q) {
    var commentator = q.voice === "commentator";
    var century = CENTURY[q.father] ? " · " + CENTURY[q.father] : "";
    var flag = "";
    if (q.note) {
      flag = '<details class="flag"><summary>Attribution note</summary><p>' +
        esc(q.note.replace(/^MACARIUS FLAG:\s*/, "")) + "</p></details>";
    }
    return '<figure class="quote' + (commentator ? " commentator" : "") + '">' +
      "<blockquote>" + esc(q.quote) + "</blockquote>" +
      '<figcaption><span class="who">' + esc(q.father) + "</span>" + esc(century) +
      (document.body.getAttribute("data-mode") === "teacher"
        ? "<br>" + esc(q.work) + (q.scripture && q.scripture.charAt(0) !== "(" ? " · on " + esc(q.scripture) : "") + flag
        : "") +
      "</figcaption></figure>";
  }
  function quotesFor(all, id) {
    var qs = all.filter(function (q) { return q.attaches_to === id; });
    return qs.length ? '<div class="quotes">' + qs.map(quoteHTML).join("") + "</div>" : "";
  }

  /* ---------- scripture ---------- */
  var CHEVRON = '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M5 2l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function passageHTML(p) {
    return '<div class="passage"><span class="pref">' + esc(p.reference) + "</span><p>" +
      p.verses.map(function (v) {
        return '<sup>' + esc(v.verse.split(":")[1]) + "</sup>" + esc(v.text);
      }).join(" ") + "</p></div>";
  }
  function passagesFor(scripture, id) {
    var ps = scripture.passages.filter(function (p) { return p.attaches_to === id; });
    if (!ps.length) return "";
    return '<details class="passages"><summary>' + CHEVRON + "Read the passage" + (ps.length > 1 ? "s" : "") +
      "</summary>" + ps.map(passageHTML).join("") +
      '<p class="translation-note">' + esc(scripture.translation) + "</p></details>";
  }

  /* ---------- arc chart (inline SVG, no library) ---------- */
  function el(name, attrs, text) {
    var n = document.createElementNS(SVGNS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }
  // Monotone cubic (Fritsch–Carlson): passes through every point and never overshoots,
  // so the dips and peaks in the data are exactly what is drawn.
  function monotone(ys) {
    var n = ys.length, d = [], m = [];
    for (var i = 0; i < n - 1; i++) d.push(ys[i + 1] - ys[i]);
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
      var a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { var t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    var out = [];
    for (i = 0; i < n - 1; i++) {
      for (var k = 0; k < 16; k++) {
        var t2 = k / 16, h00 = 2 * t2 * t2 * t2 - 3 * t2 * t2 + 1, h10 = t2 * t2 * t2 - 2 * t2 * t2 + t2,
          h01 = -2 * t2 * t2 * t2 + 3 * t2 * t2, h11 = t2 * t2 * t2 - t2 * t2;
        out.push([i + t2, h00 * ys[i] + h10 * m[i] + h01 * ys[i + 1] + h11 * m[i + 1]]);
      }
    }
    out.push([n - 1, ys[n - 1]]);
    return out;
  }
  function eraRanges(points, eras) {
    return eras.map(function (e) {
      var idx = points.map(function (p, i) { return p.era === e.id ? i : -1; }).filter(function (i) { return i >= 0; });
      return { era: e, lo: idx[0], hi: idx[idx.length - 1] };
    });
  }
  function wrapWords(text, maxChars) {
    var words = text.split(" "), lines = [""];
    words.forEach(function (w) {
      var cur = lines[lines.length - 1];
      if ((cur + " " + w).trim().length > maxChars && cur) lines.push(w); else lines[lines.length - 1] = (cur + " " + w).trim();
    });
    return lines;
  }

  // opts: { mini, highlight } for the small per-era arcs;
  //       { guess: { values: {index: value}, revealed: bool } } for the "Guess the arc" game.
  function drawArc(host, points, eras, opts) {
    opts = opts || {};
    // Scale chart text with the page's root size so labels stay readable on a TV.
    var S = Math.max(1, parseFloat(getComputedStyle(document.documentElement).fontSize) / 16);
    var fs = function (px) { return Math.round(px * S); };
    var W = Math.max(280, Math.round(host.clientWidth || 320));
    var vertical = !opts.mini && W < 620;
    var n = points.length, ranges = eraRanges(points, eras);
    var guess = opts.guess || null, showReal = !guess || guess.revealed;
    var svg, geo, inv;

    if (!vertical) {
      var H = opts.mini ? Math.round(96 * S) : Math.round(420 * S), padL = opts.mini ? 6 : fs(28), padR = opts.mini ? 6 : fs(28);
      var top = opts.mini ? 10 : fs(96), bottom = opts.mini ? 10 : fs(56);
      var step = (W - padL - padR) / (n - 1);
      geo = {
        x: function (t) { return padL + t * step; },
        y: function (t, v) { return top + (100 - v) / 100 * (H - top - bottom); }
      };
      inv = function (sx, sy) { return 100 - (sy - top) / (H - top - bottom) * 100; };
      svg = el("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img" });
      ranges.forEach(function (r, i) {
        var x0 = r.lo === 0 ? 0 : geo.x(r.lo - 0.5), x1 = r.hi === n - 1 ? W : geo.x(r.hi + 0.5);
        var g = el("g", { "class": "arc-band" });
        var rect = el("rect", { x: x0, y: 0, width: x1 - x0, height: H, "class": i % 2 ? "band-b" : "band-a" });
        if (opts.mini && opts.highlight && r.era.id !== opts.highlight) rect.setAttribute("class", "band-none");
        if (!opts.mini) {
          var a = el("a", { href: "#" + r.era.id, "aria-label": "Era " + ROMAN[i] + ": " + r.era.title });
          a.appendChild(rect); g.appendChild(a);
          var cx = (x0 + x1) / 2, lines = wrapWords(r.era.title, Math.max(8, Math.floor((x1 - x0) / (8.5 * S))));
          g.appendChild(el("text", { x: cx, y: fs(24), "text-anchor": "middle", "class": "arc-band-num", "font-size": fs(12) }, ROMAN[i]));
          lines.slice(0, 3).forEach(function (ln, j) {
            g.appendChild(el("text", { x: cx, y: fs(44) + j * fs(17), "text-anchor": "middle", "class": "arc-band-label", "font-size": fs(16) }, ln));
          });
        } else g.appendChild(rect);
        svg.appendChild(g);
      });
      if (!opts.mini) {
        svg.appendChild(el("text", { x: W - 12, y: geo.y(0, 100) - 6, "text-anchor": "end", "class": "arc-axis", "font-size": fs(12) }, "Nearer to God"));
        svg.appendChild(el("text", { x: 12, y: H - 10, "class": "arc-axis", "font-size": fs(12) }, "Farther"));
      }
    } else {
      var bandHead = fs(46), rowH = fs(42), padT = fs(36), padB = 20, padX = fs(22);
      var ys = [], y = padT;
      points.forEach(function (p, i) {
        if (i === 0 || points[i - 1].era !== p.era) y += bandHead;
        ys.push(y); y += rowH;
      });
      var Hv = y - rowH + padB + 10;
      var plotW = W - padX * 2;
      geo = {
        x: function (t, v) { return padX + v / 100 * plotW; },
        y: function (t) { var i = Math.floor(t), f = t - i; return i >= n - 1 ? ys[n - 1] : ys[i] + f * (ys[i + 1] - ys[i]); }
      };
      inv = function (sx) { return (sx - padX) / plotW * 100; };
      svg = el("svg", { viewBox: "0 0 " + W + " " + Hv, width: W, height: Hv, role: "img" });
      svg.appendChild(el("text", { x: padX, y: 18, "class": "arc-axis", "font-size": fs(12) }, "Farther"));
      svg.appendChild(el("text", { x: W - padX, y: 18, "text-anchor": "end", "class": "arc-axis", "font-size": fs(12) }, "Nearer to God"));
      ranges.forEach(function (r, i) {
        var y0 = ys[r.lo] - bandHead + 4, y1 = r.hi === n - 1 ? Hv : ys[r.hi + 1] - bandHead + 4;
        var g = el("g", { "class": "arc-band" });
        var a = el("a", { href: "#" + r.era.id, "aria-label": "Era " + ROMAN[i] + ": " + r.era.title });
        a.appendChild(el("rect", { x: 0, y: y0, width: W, height: y1 - y0, "class": i % 2 ? "band-b" : "band-a" }));
        g.appendChild(a);
        g.appendChild(el("text", { x: 12, y: y0 + fs(26), "class": "arc-band-label", "font-size": fs(18) }, ROMAN[i] + " · " + r.era.title));
        svg.appendChild(g);
      });
    }
    function pt(t, v) { return [geo.x(t, v), geo.y(t, v)]; }

    // Faded guesses stay visible after the reveal so the class can compare.
    var guessGroup = null;
    if (guess) {
      guessGroup = el("g", { "class": guess.revealed ? "guesses revealed" : "guesses" });
      var labeled = [];
      points.forEach(function (p, i) { if (p.label) labeled.push(i); });
      var line = el("polyline", { "class": "guess-line", points: "" });
      guessGroup.appendChild(line);
      var redrawLine = function () {
        line.setAttribute("points", labeled.map(function (i) { return pt(i, guess.values[i]).join(","); }).join(" "));
      };
      // Alternate labels above/below so neighbours never collide, even when dots line up.
      var labelDy = function (i) { return labeled.indexOf(i) % 2 ? fs(40) : -fs(22); };
      labeled.forEach(function (i) {
        var c = pt(i, guess.values[i]);
        var g = el("g", { "class": "guess", "data-i": i });
        var dot = el("circle", { cx: c[0], cy: c[1], r: fs(13), "class": "guess-dot", tabindex: guess.revealed ? -1 : 0,
          role: "slider", "aria-label": points[i].label + ": drag to where the class thinks it goes",
          "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": Math.round(guess.values[i]) });
        g.appendChild(dot);
        if (!guess.revealed) {
          g.appendChild(el("text", vertical
            ? { x: c[0], y: c[1] - fs(18), "text-anchor": "middle", "class": "arc-point-label", "font-size": fs(15) }
            : { x: c[0], y: c[1] + labelDy(i), "text-anchor": "middle", "class": "arc-point-label", "font-size": fs(15) }, points[i].label));
        }
        guessGroup.appendChild(g);
      });
      redrawLine();

      if (!guess.revealed) {
        var dragging = null;
        var toSvg = function (evt) {
          var m = svg.getScreenCTM(), p = svg.createSVGPoint();
          p.x = evt.clientX; p.y = evt.clientY;
          return p.matrixTransform(m.inverse());
        };
        var setVal = function (g, v) {
          var i = +g.getAttribute("data-i");
          guess.values[i] = Math.max(0, Math.min(100, v));
          var c = pt(i, guess.values[i]), dot = g.querySelector("circle"), txt = g.querySelector("text");
          dot.setAttribute("cx", c[0]); dot.setAttribute("cy", c[1]);
          dot.setAttribute("aria-valuenow", Math.round(guess.values[i]));
          if (txt) { txt.setAttribute("x", c[0]); txt.setAttribute("y", vertical ? c[1] - fs(18) : c[1] + labelDy(i)); }
          redrawLine();
        };
        guessGroup.addEventListener("pointerdown", function (evt) {
          var g = evt.target.closest && evt.target.closest(".guess");
          if (!g) return;
          dragging = g; g.classList.add("dragging");
          svg.setPointerCapture(evt.pointerId);
          evt.preventDefault();
        });
        svg.addEventListener("pointermove", function (evt) {
          if (!dragging) return;
          var p = toSvg(evt);
          setVal(dragging, inv(p.x, p.y));
        });
        var end = function () { if (dragging) dragging.classList.remove("dragging"); dragging = null; };
        svg.addEventListener("pointerup", end);
        svg.addEventListener("pointercancel", end);
        guessGroup.addEventListener("keydown", function (evt) {
          var g = evt.target.closest && evt.target.closest(".guess");
          if (!g) return;
          var i = +g.getAttribute("data-i"), d = { ArrowUp: 5, ArrowRight: 5, ArrowDown: -5, ArrowLeft: -5 }[evt.key];
          if (d) { setVal(g, guess.values[i] + d); evt.preventDefault(); }
        });
      }
    }

    if (showReal) {
      var curvePts = monotone(points.map(function (p) { return p.value; }));
      var d = curvePts.map(function (c, i) {
        return (i ? "L" : "M") + geo.x(c[0], c[1]).toFixed(1) + " " + geo.y(c[0], c[1]).toFixed(1);
      }).join(" ");
      var curve = el("path", { d: d, "class": opts.mini && opts.highlight ? "arc-curve dim" : "arc-curve" });
      if (guessGroup) svg.appendChild(guessGroup);
      svg.appendChild(curve);
      if (guess && guess.animate) {
        // Draw the real line in, left to right (Web Animations API; line stays fully drawn if unsupported).
        guess.animate = false;
        requestAnimationFrame(function () {
          if (!curve.animate || !curve.getTotalLength) return;
          var len = curve.getTotalLength();
          curve.style.strokeDasharray = len;
          var anim = curve.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 2400, easing: "ease-in-out" });
          anim.onfinish = function () { curve.style.strokeDasharray = ""; };
        });
      }

      if (opts.mini && opts.highlight) {
        var r0 = ranges.filter(function (r) { return r.era.id === opts.highlight; })[0];
        var from = Math.max(0, r0.lo - (r0.lo ? 0.5 : 0)), to = Math.min(n - 1, r0.hi + (r0.hi < n - 1 ? 0.5 : 0));
        var seg = curvePts.filter(function (c) { return c[0] >= from - 1e-9 && c[0] <= to + 1e-9; });
        svg.appendChild(el("path", {
          d: seg.map(function (c, i) { return (i ? "L" : "M") + geo.x(c[0], c[1]).toFixed(1) + " " + geo.y(c[0], c[1]).toFixed(1); }).join(" "),
          "class": "arc-curve"
        }));
      }

      if (!opts.mini) {
        points.forEach(function (p, i) {
          if (!p.label) return;
          var px = geo.x(i, p.value), py = geo.y(i, p.value);
          svg.appendChild(el("circle", { cx: px, cy: py, r: fs(5.5), "class": "arc-dot" }));
          var prev = points[i - 1] ? points[i - 1].value : -1, next = points[i + 1] ? points[i + 1].value : -1;
          var peak = p.value >= prev && p.value >= next, valley = p.value <= prev && p.value <= next;
          if (!vertical) {
            // Peaks label above, valleys below; on a slope, use the open side of the line.
            var lx = px, ly, anchor = "middle", g1 = fs(10);
            if (i === 0) { anchor = "start"; lx = px + g1; ly = py - fs(12); }
            else if (i === n - 1) { anchor = "end"; ly = py + fs(28); }
            else if (peak) ly = py - fs(14);
            else if (valley) ly = py + fs(28);
            else if (next > prev) { anchor = "start"; lx = px + g1; ly = py + fs(20); }
            else { anchor = "start"; lx = px + g1; ly = py - fs(10); }
            svg.appendChild(el("text", { x: lx, y: ly, "text-anchor": anchor, "class": "arc-point-label", "font-size": fs(15) }, p.label));
          } else {
            var right = p.value < 55;
            svg.appendChild(el("text", { x: right ? px + fs(12) : px - fs(12), y: py + 5, "text-anchor": right ? "start" : "end", "class": "arc-point-label", "font-size": fs(16) }, p.label));
          }
        });
      }
    } else if (guessGroup) {
      svg.appendChild(guessGroup);
    }

    var desc = "Line chart of nearness to God across the four eras. " +
      points.filter(function (p) { return p.label; }).map(function (p) { return p.label + " " + p.value; }).join(", ") +
      ". Eden and the Temple sit at nearly the same height; the lowest point is the exile.";
    svg.setAttribute("aria-label", opts.mini ? "This era's stretch of the arc" :
      (guess && !guess.revealed ? "Guess the arc: drag each point up or down, then reveal the real line." : desc));
    if (guess && !guess.revealed) svg.setAttribute("role", "group");
    host.innerHTML = "";
    host.appendChild(svg);
  }

  /* ---------- page ---------- */
  // Two modes share this code: "class" (no speaker notes) and "teacher" (with them).
  var MODE = document.body.getAttribute("data-mode") === "teacher" ? "teacher" : "class";

  function speaker(inner) {
    if (MODE !== "teacher" || !inner) return "";
    return '<aside class="speaker"><p class="speaker-label">Speaker notes</p>' + inner + "</aside>";
  }
  function byId(quotes, id) { return quotes.filter(function (q) { return q.id === id; })[0]; }
  function verseFrom(scripture, ref, verse) {
    for (var i = 0; i < scripture.passages.length; i++) {
      var vs = scripture.passages[i].verses;
      for (var j = 0; j < vs.length; j++) {
        if (vs[j].verse === verse && scripture.passages[i].reference.split(" ").slice(0, -1).join(" ") === ref.split(" ").slice(0, -1).join(" ")) return vs[j].text;
      }
    }
    return null;
  }

  function momentsHTML(moments, threads) {
    if (!moments || !moments.length) return "";
    var name = {};
    threads.forEach(function (t) { name[t.id] = t.name; });
    var open = MODE === "teacher";
    return '<div class="moments"><p class="label">Which storyline is this?</p>' +
      '<p class="moment-key">' + threads.map(function (t) { return '<span class="chip ' + esc(t.id) + '">' + esc(t.name) + "</span>"; }).join("") + "</p>" +
      '<div class="moment-grid">' + moments.map(function (m) {
        return '<button type="button" class="moment' + (open ? " open" : "") + '" aria-expanded="' + open + '">' +
          '<span class="moment-text">' + esc(m.text) + "</span>" +
          '<span class="moment-answer ' + esc(m.thread) + '">' + esc(name[m.thread]) + "</span></button>";
      }).join("") + "</div></div>";
  }

  var BOOKS = { eras: {}, art: {} };
  var ICONS = {
    "thread-mercy": '<svg class="thread-icon" viewBox="0 0 32 32" width="34" height="34" aria-hidden="true"><path d="M16 27C6 19 4 13 4 9.5A6.5 6.5 0 0 1 16 7a6.5 6.5 0 0 1 12 2.5C28 13 26 19 16 27z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    "thread-sacrifice": '<svg class="thread-icon" viewBox="0 0 32 32" width="34" height="34" aria-hidden="true"><path d="M5 27h22M8 27V19h16v8M16 17c-4-3-4-6-1-10 0 3 5 4 5 8 0 1.5-1 2-2 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    "thread-dwelling": '<svg class="thread-icon" viewBox="0 0 32 32" width="34" height="34" aria-hidden="true"><path d="M3 27L16 5l13 22zM12 27l4-9 4 9M16 5v-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  function booksHTML(part) {
    return '<hr class="section-rule"><section id="books"><div class="wide"><p class="eyebrow">Where we are reading</p><h2>The books in each era</h2><div class="books-grid">' +
      part.eras.map(function (e, i) {
        var art = BOOKS.art[e.id], list = BOOKS.eras[e.id] || [];
        return '<a class="book-card" href="#' + esc(e.id) + '">' +
          (art ? '<img src="images/' + esc(e.id) + '.jpg" alt="" loading="lazy" style="object-position:' + esc(art.pos) + '">' : "") +
          '<span class="era-num">ERA ' + ROMAN[i] + "</span>" +
          '<span class="book-era-title">' + esc(e.title) + "</span>" +
          ["story", "wisdom", "retold", "prophet"].map(function (k) {
            var bs = list.filter(function (b) { return b.kind === k; });
            if (!bs.length) return "";
            return '<span class="spine-group">' + (BOOKS.kinds && BOOKS.kinds[k] ? '<span class="spine-label">' + esc(BOOKS.kinds[k]) + "</span>" : "") +
              '<span class="spines">' + bs.map(function (b) {
                return '<span class="spine ' + k + '">' + esc(b.name) + (b.range ? "<small>" + esc(b.range) + "</small>" : "") + "</span>";
              }).join("") + "</span></span>";
          }).join("") + "</a>";
      }).join("") + "</div>" + (BOOKS.later ? '<p class="books-later">' + esc(BOOKS.later) + "</p>" : "") + "</div></section>";
  }

  function renderPart(part, arc, quotes, scripture, notes, cls) {
    var eras = part.eras, threads = part.threads, h = "";
    var wbe = scripture.translation.split(" (")[0];

    h += '<header class="opening wrap">' +
      '<p class="eyebrow">' + esc(part.part_label) + (MODE === "teacher" ? " · Teacher edition" : "") + "</p>" +
      "<h1>" + esc(part.title) + "</h1>" +
      '<p class="span">' + esc(part.opening.span) + "</p>" +
      '<p class="framing">' + esc(part.opening.framing.charAt(0).toUpperCase() + part.opening.framing.slice(1)) + "</p>" +
      '<svg class="ornament" width="120" height="14" viewBox="0 0 120 14" aria-hidden="true"><path d="M0 7h50M70 7h50" stroke="currentColor" stroke-width="1"/><path d="M60 1v12M55 5h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' +
      "</header>";

    h += booksHTML(part);

    h += '<hr class="section-rule"><section id="storylines"><div class="wrap"><p class="eyebrow">Three storylines</p><h2>Look for these in every era</h2><div class="chains">';
    threads.forEach(function (t, i) {
      var c = cls.threads[t.id];
      h += '<article class="chain-card" id="' + esc(t.id) + '"><h3>' + (ICONS[t.id] || "") + esc(t.name) + "</h3>" +
        '<p class="short">' + esc(c.short) + "</p>" +
        '<ol class="chain' + (c.chain_repeats ? " repeats" : "") + '">' + c.chain.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol>" +
        (c.chain_repeats ? '<p class="repeat-note">…and around again</p>' : "") +
        speaker('<p><span class="label">What it says</span>' + esc(sentence(t.says)) + "</p>" +
          '<p><span class="label">Background</span>' + esc(sentence(t.note)) + "</p>" +
          quotesFor(quotes, t.id) + notesHTML(notes[t.id])) +
        "</article>";
    });
    h += "</div></div></section>";

    eras.forEach(function (e, i) {
      var c = cls.eras[e.id];
      var vt = verseFrom(scripture, c.verse_ref, c.verse);
      var featured = byId(quotes, c.quote);
      var others = quotes.filter(function (q) { return q.attaches_to === e.id && q.id !== c.quote; });
      h += '<hr class="section-rule"><section id="' + esc(e.id) + '"><div class="wrap">' +
        '<div class="era-intro">' +
        (BOOKS.art[e.id] ? '<figure class="era-art"><img src="images/' + esc(e.id) + '.jpg" alt="' + esc(BOOKS.art[e.id].alt) + '" loading="lazy">' +
          "<figcaption>Gustave Doré, <em>" + esc(BOOKS.art[e.id].title) + "</em></figcaption></figure>" : "") +
        '<div class="era-intro-text"><div class="era-head"><span class="era-num">ERA ' + ROMAN[i] + "</span><h2>" + esc(e.title) + "</h2>" +
        '<span class="era-span">' + esc(e.span) + "</span></div>" +
        '<p class="summary">' + esc(c.summary) + "</p></div></div>" +
        (MODE === "teacher" ? '<div class="mini-arc" data-arc="' + esc(e.id) + '"></div>' : "") +
        '<ul class="beats">' + c.beats.map(function (b) { return "<li>" + esc(b) + "</li>"; }).join("") + "</ul>" +
        (vt ? '<blockquote class="verse"><p>' + esc(vt) + "</p><cite>" + esc(c.verse_ref) + "</cite></blockquote>" : "") +
        (featured ? '<div class="quotes">' + quoteHTML(featured) + "</div>" : "") +
        '<p class="question"><span class="label">Think about it</span>' + esc(c.question) + "</p>" +
        (MODE === "class"
          ? '<button type="button" class="reveal" aria-expanded="false">Tap to reveal the lesson</button>' +
            '<p class="takeaway" hidden>' + esc(e.takeaway) + "</p>"
          : '<p class="takeaway">' + esc(e.takeaway) + "</p>") +
        momentsHTML(c.moments, threads) +
        speaker(
          '<p><span class="label">Spiritual theme</span>' + esc(sentence(e.theme)) + "</p>" +
          '<p><span class="label">Key verse: ' + esc(e.key_verse.passage) + "</span>" + esc(sentence(e.key_verse.why)) + "</p>" +
          '<div><span class="label">Full timeline</span><ul>' + e.beats.map(function (b) { return "<li>" + esc(b) + "</li>"; }).join("") + "</ul></div>" +
          passagesFor(scripture, e.id) +
          (others.length ? '<div class="quotes">' + others.map(quoteHTML).join("") + "</div>" : "") +
          notesHTML(notes[e.id])) +
        "</div></section>";
    });

    h += '<hr class="section-rule"><section id="arc"><div class="wide"><p class="eyebrow">The big picture</p><h2>How close to God?</h2>' +
      (MODE === "class"
        ? '<p class="arc-intro">You have seen all four eras. Where does each moment go? Drag the dots up or down, then reveal the real line.</p>'
        : '<p class="arc-intro">One line from Eden to exile. Tap an era to jump to it.</p>') +
      '<figure class="arc-figure"><div data-arc="full"></div></figure>' +
      (MODE === "class"
        ? '<div class="arc-controls"><button type="button" class="btn primary" id="arc-reveal">Reveal the real line</button>' +
          '<button type="button" class="btn" id="arc-reset" hidden>Try again</button></div>' +
          '<p class="arc-caption" id="arc-caption" hidden>The Temple and Eden sit at nearly the same height. The bottom of the chart is exile, not the Fall.</p>'
        : "") +
      speaker("<p>Two things to point out on the chart: the Temple and Eden sit at nearly the same height, and the bottom of the chart is exile, not the Fall.</p>") +
      "</div></section>";

    var john = scripture.passages.filter(function (p) { return p.attaches_to === "closing"; })[0];
    var closingQuote = byId(quotes, cls.closing.quote);
    var line = esc(part.closing.line).replace("the Word becomes flesh and dwells among us.", "<em>the Word becomes flesh and dwells among us.</em>");
    h += '<section class="closing" id="closing"><div class="wrap"><p class="eyebrow">The end of Part One</p>' +
      '<p class="line">' + line + "</p>" +
      (john ? '<p class="john">' + esc(john.verses.map(function (v) { return v.text; }).join(" ")) + "<cite>" + esc(john.reference) + "</cite></p>" : "") +
      (closingQuote ? '<div class="quotes">' + quoteHTML(closingQuote) + "</div>" : "") +
      speaker("<p>" + esc(part.closing.payoff) + "</p>" +
        quotesFor(quotes.filter(function (q) { return q.id !== cls.closing.quote; }), "closing")) +
      '<p class="next-part">Part Two picks up in exile</p></div></section>';
    return h;
  }

  function renderNav(part) {
    var nav = document.getElementById("nav");
    var links = [["#books", "The books"], ["#storylines", "Storylines"]];
    part.eras.forEach(function (e, i) { links.push(["#" + e.id, ROMAN[i] + " · " + e.title]); });
    links.push(["#arc", "How close to God?"]);
    links.push(["#closing", "The end"]);
    nav.innerHTML = links.map(function (l) { return '<a href="' + l[0] + '">' + esc(l[1]) + "</a>"; }).join("");

    if ("IntersectionObserver" in window) {
      var anchors = nav.querySelectorAll("a");
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          anchors.forEach(function (a) {
            var on = a.getAttribute("href") === "#" + en.target.id;
            a.classList.toggle("active", on);
            if (on && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: a.offsetLeft - 16, behavior: "smooth" });
          });
        });
      }, { rootMargin: "-45% 0px -50% 0px" });
      document.querySelectorAll("main section[id]").forEach(function (s) { io.observe(s); });
    }
  }

  var GUESS = null;
  function freshGuess(points) {
    var v = {};
    points.forEach(function (p, i) { if (p.label) v[i] = 50; });
    return { values: v, revealed: false };
  }
  function drawAll(arc, eras) {
    if (MODE === "class" && !GUESS) GUESS = freshGuess(arc.points);
    document.querySelectorAll("[data-arc]").forEach(function (host) {
      var which = host.getAttribute("data-arc");
      drawArc(host, arc.points, eras, which === "full" ? (GUESS ? { guess: GUESS } : {}) : { mini: true, highlight: which });
    });
  }
  function wireInteractions(arc, eras) {
    var reveal = document.getElementById("arc-reveal"), reset = document.getElementById("arc-reset"), cap = document.getElementById("arc-caption");
    if (reveal) {
      reveal.addEventListener("click", function () {
        GUESS.revealed = true; GUESS.animate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        reveal.hidden = true; reset.hidden = false; cap.hidden = false;
        drawAll(arc, eras);
      });
      reset.addEventListener("click", function () {
        GUESS = freshGuess(arc.points);
        reveal.hidden = false; reset.hidden = true; cap.hidden = true;
        drawAll(arc, eras);
      });
    }
    document.getElementById("app").addEventListener("click", function (evt) {
      var r = evt.target.closest(".reveal");
      if (r) {
        var t = r.nextElementSibling, open = r.getAttribute("aria-expanded") !== "true";
        t.hidden = !open; r.setAttribute("aria-expanded", String(open));
        r.textContent = open ? "Hide the lesson" : "Tap to reveal the lesson";
        return;
      }
      var m = evt.target.closest(".moment");
      if (m && MODE === "class") {
        var o = !m.classList.contains("open");
        m.classList.toggle("open", o); m.setAttribute("aria-expanded", String(o));
      }
    });
  }

  getJSON("content/parts.json").then(function (reg) {
    var p = reg.parts[0];
    return Promise.all([getJSON(p.content), getJSON(p.arc), getJSON("content/quotes.json"), getJSON("content/scripture.json"), getJSON(p.class), getJSON("content/books.json")])
      .then(function (r) {
        var part = r[0], ids = part.eras.map(function (e) { return e.id; }).concat(part.threads.map(function (t) { return t.id; }));
        var notesP = MODE === "teacher"
          ? Promise.all(ids.map(function (id) { return getText("content/notes/" + id + ".md"); }))
          : Promise.resolve([]);
        BOOKS = r[5];
        return notesP.then(function (mds) {
          var notes = {}; ids.forEach(function (id, i) { notes[id] = mds[i] || ""; });
          document.getElementById("app").innerHTML = renderPart(part, r[1], r[2].quotes, r[3], notes, r[4]);
          document.getElementById("footer").innerHTML =
            "<p>Illustrations: Gustave Doré (1832–1883), Bible engravings, public domain, via Wikimedia Commons.</p>" +
            "<p>Historical outline: Fr. Tadros Y. Malaty, <em>A Historical Map of the Old Testament</em>.</p>" +
            "<p>Quotations are copied word for word from the church's commentary library. Scripture: " + esc(r[3].translation) + ".</p>" +
            (r[3].copyright ? "<p>" + esc(r[3].copyright) + "</p>" : "") +
            (MODE === "teacher" ? '<p><a href="/">Open the class version (no speaker notes)</a></p>' : "");
          renderNav(part);
          drawAll(r[1], part.eras);
          wireInteractions(r[1], part.eras);
          var t;
          window.addEventListener("resize", function () { clearTimeout(t); t = setTimeout(function () { drawAll(r[1], part.eras); }, 120); });
          if (location.hash) { var target = document.querySelector(location.hash); if (target) target.scrollIntoView(); }
        });
      });
  }).catch(function (err) {
    document.getElementById("app").innerHTML = '<p class="loading">Could not load the study content. ' + esc(err.message) + "</p>";
  });
})();
