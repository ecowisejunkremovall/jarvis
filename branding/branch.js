/* EcoWise division websites — shared behavior.
   Page sets window.EW = { branch, name, mode: 'quote' | 'signup' | 'account', ... } before loading this file. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var EW = window.EW || {};
  var PHONE = '(512) 369-2644';

  // mobile menu
  var mb = $('menuBtn'); if (mb) mb.addEventListener('click', function () { $('mobile').classList.toggle('open'); });

  function post(url, body) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return { error: 'HTTP ' + r.status }; }); })
      .catch(function () { return { error: 'network' }; });
  }
  function money(n) { n = Number(n) || 0; return '$' + n.toLocaleString(undefined, { maximumFractionDigits: n % 1 ? 2 : 0 }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // resize a photo to a JPEG data URL (max 1280px) — keeps uploads small
  function shrink(file) {
    return new Promise(function (res) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var s = Math.min(1, 1280 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob(function (b) { var fr = new FileReader(); fr.onload = function () { res({ data: fr.result, blob: b }); }; fr.readAsDataURL(b); }, 'image/jpeg', 0.82);
      };
      img.onerror = function () { res(null); }; img.src = url;
    });
  }

  // signature pad
  function sigPad(cv) {
    var ctx, drawing = false, ink = false;
    function setup() { var r = window.devicePixelRatio || 1; cv.width = cv.offsetWidth * r; cv.height = cv.offsetHeight * r; ctx = cv.getContext('2d'); ctx.scale(r, r); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#111'; ink = false; }
    function pos(e) { var r = cv.getBoundingClientRect(), p = e.touches ? e.touches[0] : e; return { x: p.clientX - r.left, y: p.clientY - r.top }; }
    function start(e) { e.preventDefault(); drawing = true; var p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
    function move(e) { if (!drawing) return; e.preventDefault(); var p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); ink = true; }
    function end() { drawing = false; }
    ['mousedown', 'touchstart'].forEach(function (t) { cv.addEventListener(t, start, { passive: false }); });
    ['mousemove', 'touchmove'].forEach(function (t) { cv.addEventListener(t, move, { passive: false }); });
    ['mouseup', 'mouseleave', 'touchend'].forEach(function (t) { cv.addEventListener(t, end); });
    setTimeout(setup, 50);
    return { clear: setup, hasInk: function () { return ink; }, data: function () { return cv.toDataURL('image/png'); } };
  }

  /* ───────── AI QUOTE → ACCEPT → SCHEDULE (trees, terraforms, contracting) ───────── */
  var URLQ = new URLSearchParams(location.search), SRC = (URLQ.get('src') || '').slice(0, 40);
  var shared = { quote: null, photos: [] };            // shared between the page form and the assistant
  function quoteCard(q) {
    return '<p class="muted" style="margin:0">' + esc(EW.name) + ' — our price</p>' +
      '<div class="big">' + money(q.price) + '</div>' +
      '<p class="muted" style="margin:2px 0 8px">Labor, equipment and haul-off/disposal included. ' + esc(EW.priceNote) + '</p>' +
      (q.items && q.items.length ? '<ul>' + q.items.map(function (x) { return '<li>' + esc(x.label) + (x.amount ? ' — <b>' + money(x.amount) + '</b>' : '') + '</li>'; }).join('') + '</ul>' : '') +
      (q.summary ? '<p style="margin:8px 0 0;font-size:14px">' + esc(q.summary) + '</p>' : '') +
      (q.permit_note ? '<p class="muted" style="margin:8px 0 0">' + esc(q.permit_note) + '</p>' : '') +
      (q.needs && q.needs.length ? '<p class="muted" style="margin:8px 0 0"><b>We confirm on the visit:</b> ' + q.needs.map(esc).join(' · ') + '</p>' : '');
  }
  var pickedSlot = null;
  function loadSlots(pre) {
    var box = $('bSlots'); if (!box) return;
    if (pre) return drawSlots(pre);
    box.innerHTML = '<span class="spin"></span> Loading open times…';
    post('/.netlify/functions/branch-chat', { branch: EW.branch, action: 'slots' }).then(function (r) { drawSlots(r && r.slots); });
  }
  function drawSlots(slots) {
    var box = $('bSlots'); pickedSlot = null;
    if (!slots || !slots.length) { box.innerHTML = '<p class="muted">No open times online right now — call or text ' + PHONE + '.</p>'; return; }
    box.innerHTML = slots.slice(0, 5).map(function (d) {
      return '<div class="sday"><b>' + esc(d.day) + '</b><div>' + d.windows.map(function (w) { return '<button type="button" data-d="' + esc(d.date) + '" data-w="' + esc(w) + '" data-l="' + esc(d.day) + '">' + esc(w) + '</button>'; }).join('') + '</div></div>';
    }).join('');
  }
  function showBooking(title) {
    if (!$('bookBox')) return;
    if (title) $('bTitle').textContent = title;
    $('bookBox').classList.remove('hidden'); loadSlots();
    $('bookBox').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  if (EW.mode === 'quote' && $('qGo')) {
    var photos = shared.photos;
    if (URLQ.get('a')) $('qAddr').value = URLQ.get('a').slice(0, 160);           // door-hanger QR: address pre-filled
    if (URLQ.get('d')) $('qDesc').value = URLQ.get('d').slice(0, 400);
    if (SRC === 'hanger' && $('quote')) setTimeout(function () { $('quote').scrollIntoView({ block: 'start' }); }, 300);
    $('qDrop').addEventListener('click', function () { $('qFiles').click(); });
    $('qFiles').addEventListener('change', function (e) {
      var files = Array.prototype.slice.call(e.target.files || [], 0, 3 - photos.length);
      Promise.all(files.map(shrink)).then(function (out) {
        out.filter(Boolean).forEach(function (p) { photos.push(p); });
        $('qThumbs').innerHTML = photos.map(function (p) { return '<img src="' + p.data + '" alt="">'; }).join('');
      });
    });
    $('qGo').addEventListener('click', function () {
      var desc = $('qDesc').value.trim(), addr = $('qAddr').value.trim();
      $('qErr').textContent = '';
      if (!photos.length && desc.length < 10) { $('qErr').textContent = 'Add a photo or describe the job (at least a sentence).'; return; }
      $('qGo').disabled = true; $('qGo').innerHTML = '<span class="spin"></span> Pricing your job…';
      post('/.netlify/functions/branch-quote', { branch: EW.branch, photos: photos.map(function (p) { return p.data; }), description: desc, address: addr, lang: (navigator.language || '').slice(0, 2) === 'es' ? 'es' : 'en' })
        .then(function (q) {
          $('qGo').disabled = false; $('qGo').textContent = 'Get my price';
          if (!q || !q.ok) { $('qErr').textContent = q && q.error === 'busy' ? 'Too many tries — please wait a few minutes or call ' + PHONE + '.' : 'Our estimator is busy right now. Book a free visit below or call ' + PHONE + '.'; showBooking('Book your free on-site visit'); return; }
          setQuote(q);
        });
    });
    $('bSlots').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-d]'); if (!b) return;
      $('bSlots').querySelectorAll('button.on').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on'); pickedSlot = { date: b.getAttribute('data-d'), window: b.getAttribute('data-w'), day: b.getAttribute('data-l') };
    });
    $('bGo').addEventListener('click', function () {
      var name = $('bName').value.trim(), phone = $('bPhone').value.replace(/\D/g, '').slice(-10), email = $('bEmail').value.trim(), addr = $('qAddr').value.trim(), desc = $('qDesc').value.trim();
      $('bErr').textContent = '';
      if (!pickedSlot) { $('bErr').textContent = 'Please pick a time above.'; return; }
      if (name.length < 2 || phone.length !== 10) { $('bErr').textContent = 'Please enter your name and a 10-digit mobile number.'; return; }
      if (addr.length < 6) { $('bErr').textContent = 'Please add the service address (in “Your project” above).'; $('qAddr').focus(); return; }
      if (!$('bConsent').checked) { $('bErr').textContent = 'Please check the box so we can contact you about your visit.'; return; }
      $('bGo').disabled = true; $('bGo').innerHTML = '<span class="spin"></span> Booking…';
      var q = shared.quote;
      var fd = new FormData();
      fd.append('form-name', 'branch-lead'); fd.append('branch', EW.branch); fd.append('name', name); fd.append('phone', phone); fd.append('email', email); fd.append('address', addr);
      fd.append('preferred', pickedSlot.day + ' ' + pickedSlot.window); fd.append('description', desc); fd.append('ai_price', q ? String(q.price) : ''); fd.append('quote_id', q ? q.id : ''); fd.append('source', SRC || 'web');
      photos.forEach(function (p, i) { if (p.blob) fd.append('photo' + (i + 1), p.blob, 'photo' + (i + 1) + '.jpg'); });
      fetch('/', { method: 'POST', body: fd }).catch(function () {});           // backup copy + photos in Netlify Forms
      post('/.netlify/functions/branch-chat', { branch: EW.branch, action: 'book', quote: q, name: name, phone: phone, email: email, address: addr, date: pickedSlot.date, window: pickedSlot.window, consent: true, notes: desc, src: SRC || 'web-' + EW.branch, hp: $('bHp').value, lang: 'en' })
        .then(function (r) {
          $('bGo').disabled = false; $('bGo').textContent = 'Book my free visit';
          if (r && r.ok) { $('bookForm').innerHTML = '<p class="ok">You’re set, ' + esc(name.split(' ')[0]) + '! Free visit: <b>' + esc(r.appointment.day) + ', ' + esc(r.appointment.window) + '</b> at ' + esc(r.appointment.address) + '.</p><p class="muted">Luis will text you to confirm. Questions? Call or text ' + PHONE + '.</p>'; return; }
          if (r && r.error === 'slot_taken') { drawSlots(r.slots); $('bErr').textContent = 'That time was just taken — please pick another.'; return; }
          $('bErr').textContent = (r && r.error === 'quote_invalid') ? 'Please get a new price above and try again.' : 'Could not book online — please call or text ' + PHONE + '.';
        });
    });
  }
  function setQuote(q) {
    shared.quote = q;
    if (!$('qResult')) return;
    $('qResult').innerHTML = quoteCard(q) + '<button class="btn btn-main" id="qAccept" style="width:100%;margin-top:12px">Accept price &amp; schedule my free visit</button>';
    $('qResult').classList.remove('hidden');
    $('qAccept').onclick = function () { showBooking(); };
    $('qResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ───────── BRANCH AGENT — one per website, each with its own look (JARVIS stays on the main junk-removal site) ───────── */
  var A = '/branding/agents/';
  var AGENTS = {
    trees: { n: 'Cedar', role: 'Tree Services', img: A + 'trees.webp', anim: 'leaves',
      hi: { en: 'Hi! I’m Cedar 🌳 Send me a photo of your tree and tell me what you need — removal, trimming or a stump. I’ll give you our price and a time for a free visit.', es: '¡Hola! Soy Cedar 🌳 Mándame una foto de tu árbol y dime qué necesitas — quitarlo, podarlo o el tocón. Te doy nuestro precio y una cita gratis.' },
      tips: { en: ['Hi! I’m Cedar 🌳 Send me a photo of your tree and I’ll price it in a minute.', 'In Austin, trees 19" or wider are protected — I’ll tell you if you need a permit.', 'Our price includes the crew, the equipment and hauling everything away. No surprises.', 'Stump left behind? We grind it below the grass line. 🪵', 'Oaks from Feb to June: we seal every cut to protect against oak wilt.', 'Storm damage? Send me a photo — we move fast. ⛈️', 'Pick a time for a free visit — Luis confirms the price in person.'],
        es: ['¡Hola! Soy Cedar 🌳 Mándame una foto de tu árbol y te doy el precio en un minuto.', 'En Austin los árboles de 19" o más están protegidos — te digo si necesitas permiso.', 'Nuestro precio incluye el equipo, la herramienta y llevarnos todo. Sin sorpresas.', '¿Quedó el tocón? Lo molemos bajo el nivel del pasto. 🪵', 'Encinos de febrero a junio: sellamos cada corte para protegerlos.', '¿Daño por tormenta? Mándame una foto — vamos rápido. ⛈️', 'Escoge un horario para la visita gratis — Luis confirma el precio en persona.'] } },
    bins: { n: 'Splash', role: 'Bin Solutions', img: A + 'bins.webp', anim: 'frames', frames: [A + 'bins-1.webp', A + 'bins-2.webp', A + 'bins-3.webp', A + 'bins-4.webp'],
      hi: { en: 'Bleep bloop! 👽 I’m Splash. Smelly trash carts? We wash and sanitize them right after the City picks up. How many carts do you have and how often do you want them clean?', es: '¡Bip bup! 👽 Soy Splash. ¿Botes de basura apestosos? Los lavamos y desinfectamos justo después de que pasa la Ciudad. ¿Cuántos botes tienes y cada cuánto los quieres limpios?' },
      tips: { en: ['Bleep bloop! 👽 Stinky trash cart? My cleaning ray handles it.', 'We wash your carts right after the City empties them — on your trash day.', 'Hot water, sanitizer, deodorizer. Bye-bye maggots and smell! ✨', '2 carts from $29 a month. No contract — pause anytime.', 'Our wash water never goes down the storm drain. 💧', 'Have a dog? Add pet waste pickup and save 10% on both. 🐾', 'Tap me and I’ll tell you your exact price.'],
        es: ['¡Bip bup! 👽 ¿Bote apestoso? Mi rayo limpiador se encarga.', 'Lavamos tus botes justo después de que la Ciudad los vacía — el día de tu basura.', 'Agua caliente, desinfectante y desodorante. ¡Adiós gusanos y mal olor! ✨', '2 botes desde $29 al mes. Sin contrato — pausa cuando quieras.', 'El agua del lavado nunca va al drenaje. 💧', '¿Tienes perro? Agrega la limpieza de popó y ahorra 10% en los dos. 🐾', 'Tócame y te digo tu precio exacto.'] } },
    petwaste: { n: 'Clifford', role: 'Pet Waste', img: A + 'petwaste.webp', anim: 'scoop',
      hi: { en: 'Woof! 🐾 I’m Clifford, your doggy assistant. How many dogs do you have, and how often should we clean the yard?', es: '¡Guau! 🐾 Soy Clifford, tu asistente perruno. ¿Cuántos perritos tienes y cada cuánto quieres que limpiemos el patio?' },
      tips: { en: ['Woof! 🐾 I’m Clifford. Let’s get your yard clean so you can play again.', 'Weekly yard scooping from $17. Tools disinfected between every yard.', 'We close the gate and send you a photo every visit. 📸', 'Your first cleanup is FREE with a weekly plan! 🎉', 'How many dogs do you have? Tell me and I’ll give you the price.', 'Party coming up? One-time cleanup $85. 🎈', 'Add Bin Solutions and save 10% on both. 🫧'],
        es: ['¡Guau! 🐾 Soy Clifford. Dejemos tu patio limpio para que vuelvas a jugar.', 'Limpieza semanal del patio desde $17. Herramientas desinfectadas en cada casa.', 'Cerramos la puerta y te mandamos foto en cada visita. 📸', '¡La primera limpieza es GRATIS con el plan semanal! 🎉', '¿Cuántos perritos tienes? Dime y te doy el precio.', '¿Viene una fiesta? Limpieza de una vez $85. 🎈', 'Agrega Bin Solutions y ahorra 10% en los dos. 🫧'] } },
    terraforms: { n: 'Ridge', role: 'Terraforms', img: A + 'terraforms.svg', anim: 'svg',
      hi: { en: 'Hey, I’m Ridge 🥾 Tell me about the trail — length, terrain, hiking or bikes — and add a photo of the land. I’ll price it and set up a free site walk.', es: 'Hola, soy Ridge 🥾 Cuéntame del sendero — largo, terreno, para caminar o bici — y manda una foto del terreno. Te doy el precio y una visita gratis.' },
      tips: { en: ['Hey! I’m Ridge 🥾 Got land that needs a trail? Tell me how long.', 'Hand-built singletrack, flow lines, DG walking trails — we build them all.', 'Good trails shed water. We design for drainage so yours lasts.', 'HOA or ranch? I can price your trail by the foot in a minute.', 'Send a photo of the terrain and I’ll estimate it. 📷', 'Free site walk with Luis to confirm the price.'],
        es: ['¡Hola! Soy Ridge 🥾 ¿Tienes terreno que necesita un sendero? Dime qué tan largo.', 'Senderos a mano, líneas para bici, caminos de granito — los hacemos todos.', 'Un buen sendero saca el agua. Lo diseñamos para que dure.', '¿HOA o rancho? Te doy el precio por pie en un minuto.', 'Manda una foto del terreno y te lo estimo. 📷', 'Visita gratis con Luis para confirmar el precio.'] } },
    contracting: { n: 'Mason', role: 'Contracting', img: A + 'contracting.svg', anim: 'svg',
      hi: { en: 'I’m Mason 🔨 What are we tearing out or building? Snap a photo of the space and give me the rough size — I’ll price it and book a free walk-through.', es: 'Soy Mason 🔨 ¿Qué vamos a demoler o construir? Manda una foto del área y el tamaño aproximado — te doy el precio y una visita gratis.' },
      tips: { en: ['I’m Mason 🔨 What are we tearing out today?', 'Demo, haul-off and clean-up in one price — labor and disposal included.', 'Snap a photo of the room and tell me the size. I’ll price it now. 📐', 'Working for a GC? We sub demo and haul-off — insurance certificate on request.', 'Kitchen, bath, flooring — down to the studs and hauled away.', 'Free walk-through to confirm the price.'],
        es: ['Soy Mason 🔨 ¿Qué vamos a demoler hoy?', 'Demolición, retiro y limpieza en un solo precio — mano de obra y botadero incluidos.', 'Manda una foto del cuarto y el tamaño. Te doy el precio ya. 📐', '¿Trabajas para un contratista? Hacemos demolición y retiro — certificado de seguro si lo piden.', 'Cocina, baño, pisos — hasta los postes y nos lo llevamos.', 'Visita gratis para confirmar el precio.'] } },
  };
  var AGT = AGENTS[EW.branch];
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } }
  if (AGT && (EW.mode === 'quote' || EW.mode === 'signup')) {
    var es0 = (navigator.language || '').slice(0, 2) === 'es', L = es0 ? 'es' : 'en';
    var msgs = [{ role: 'assistant', text: AGT.hi[L] }], cPhotos = [], busy = false;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // the animated avatar
    var fab = document.createElement('button'); fab.type = 'button';
    fab.className = 'agent agent-' + AGT.anim; fab.setAttribute('aria-label', (es0 ? 'Hablar con ' : 'Chat with ') + AGT.n);
    var face = AGT.anim === 'frames'
      ? AGT.frames.map(function (f, i) { return '<img class="fr' + (i === 0 ? ' on' : '') + '" src="' + f + '" alt="" ' + (i ? 'loading="lazy"' : '') + '>'; }).join('')
      : '<img class="face" src="' + AGT.img + '" alt="">';
    var extra = AGT.anim === 'leaves' ? '<i class="lf a"></i><i class="lf b"></i><i class="lf c"></i>'
      : AGT.anim === 'scoop' ? '<i class="poop"></i><i class="spark"></i><i class="paw p1"></i><i class="paw p2"></i>' : '';
    fab.innerHTML = '<span class="agent-face">' + face + '</span>' + extra + '<span class="agent-dot" title="online"></span><span class="agent-name">' + AGT.n + '</span>';
    var bub = document.createElement('div'); bub.className = 'agent-bub'; bub.setAttribute('role', 'status');
    bub.innerHTML = '<button class="agent-bub-x" aria-label="Hide">×</button><span class="agent-bub-t"></span>';
    document.body.appendChild(bub); document.body.appendChild(fab);

    // alien: dirty bin → zap → grime lifts → sparkly clean
    if (AGT.anim === 'frames' && !reduce) {
      var fi = 0, frs = fab.querySelectorAll('.fr');
      (function next() { frs[fi].classList.remove('on'); fi = (fi + 1) % frs.length; frs[fi].classList.add('on'); setTimeout(next, fi === 3 ? 2400 : fi === 0 ? 1400 : 1000); })();
    }

    // talking bubble: a new message every 5 seconds, with "typing…" first so it feels alive
    var tips = AGT.tips[L].slice(), ti = 0, bubOff = ss('agentBubOff') === '1', chatOpen = false;
    var hr = new Date().getHours(), hello = es0 ? (hr < 12 ? '¡Buenos días! ☀️ ' : hr < 19 ? '¡Buenas tardes! ' : '¡Buenas noches! 🌙 ') : (hr < 12 ? 'Good morning! ☀️ ' : hr < 18 ? 'Good afternoon! ' : 'Good evening! 🌙 ');
    tips[0] = hello + tips[0];
    if (URLQ.get('a')) tips.splice(1, 0, es0 ? 'Hola vecino de ' + URLQ.get('a').slice(0, 40) + ' 👋 ya puse tu dirección — solo agrega una foto.' : 'Hi neighbor at ' + URLQ.get('a').slice(0, 40) + ' 👋 I already filled in your address — just add a photo.');
    var bt = bub.querySelector('.agent-bub-t');
    function say() {
      if (bubOff || chatOpen || document.hidden) return;
      bub.classList.add('show'); bt.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
      setTimeout(function () { if (!chatOpen) { bt.textContent = tips[ti % tips.length]; ti++; fab.classList.add('talk'); setTimeout(function () { fab.classList.remove('talk'); }, 900); } }, 900);
    }
    setTimeout(say, 1800); setInterval(say, 5000);
    bub.querySelector('.agent-bub-x').onclick = function (e) { e.stopPropagation(); bubOff = true; ss('agentBubOff', '1'); bub.classList.remove('show'); };
    bt.onclick = function () { openChat(); };

    // chat panel
    var panel = document.createElement('div'); panel.className = 'chat-panel hidden'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', AGT.n + ' — ' + EW.name);
    panel.innerHTML = '<div class="ch-head"><img src="' + AGT.img + '" alt=""><div><b>' + AGT.n + '</b><small><i class="ch-on"></i>' + (es0 ? 'En línea · ' : 'Online · ') + esc(EW.name) + '</small></div><button class="ch-x" aria-label="Close">×</button></div>' +
      '<div class="ch-log" id="chLog" aria-live="polite"></div><div class="ch-thumbs" id="chThumbs"></div>' +
      '<form class="ch-in" id="chForm">' + (EW.mode === 'quote' ? '<button type="button" class="ch-cam" id="chCam" aria-label="Add photo">📷</button><input type="file" id="chFile" accept="image/*" multiple class="hidden">' : '') +
      '<input id="chText" autocomplete="off" placeholder="' + (es0 ? 'Escribe aquí…' : 'Type a message…') + '"><button class="ch-send" aria-label="Send">➤</button></form>' +
      '<p class="ch-note">' + (es0 ? 'Asistente con IA · puede equivocarse · ' : 'AI assistant · may make mistakes · ') + PHONE + '</p>';
    document.body.appendChild(panel);
    var log = panel.querySelector('#chLog');
    function bubble(role, html) { var d = document.createElement('div'); d.className = 'ch-m ' + (role === 'assistant' ? 'a' : 'u'); d.innerHTML = (role === 'assistant' ? '<img class="ch-av" src="' + AGT.img + '" alt="">' : '') + '<div>' + html + '</div>'; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; }
    bubble('assistant', esc(msgs[0].text));
    function openChat() { chatOpen = true; bub.classList.remove('show'); panel.classList.remove('hidden'); fab.classList.add('open'); setTimeout(function () { panel.querySelector('#chText').focus(); }, 50); }
    function closeChat() { chatOpen = false; panel.classList.add('hidden'); fab.classList.remove('open'); }
    fab.onclick = function () { panel.classList.contains('hidden') ? openChat() : closeChat(); };
    panel.querySelector('.ch-x').onclick = closeChat;
    window.EW_openAgent = openChat;
    if ($('chCam')) {
      $('chCam').onclick = function () { $('chFile').click(); };
      $('chFile').onchange = function (e) {
        var files = Array.prototype.slice.call(e.target.files || [], 0, 3 - cPhotos.length);
        Promise.all(files.map(shrink)).then(function (out) { out.filter(Boolean).forEach(function (p) { cPhotos.push(p); }); $('chThumbs').innerHTML = cPhotos.map(function (p) { return '<img src="' + p.data + '" alt="">'; }).join(''); });
      };
    }
    function send(text) {
      if (busy || !text) return; busy = true;
      bubble('user', esc(text) + (cPhotos.length ? '<br><small>📷 ' + cPhotos.length + '</small>' : ''));
      msgs.push({ role: 'user', text: text });
      var wait = bubble('assistant', '<span class="typing"><i></i><i></i><i></i></span>');
      var ph = cPhotos.map(function (p) { return p.data; }); cPhotos = []; if ($('chThumbs')) $('chThumbs').innerHTML = '';
      post('/.netlify/functions/branch-chat', { branch: EW.branch, messages: msgs.slice(-14), photos: ph, quote: shared.quote, src: SRC || 'chat-' + EW.branch, lang: L }).then(function (r) {
        busy = false; wait.remove();
        if (!r || !r.ok) { bubble('assistant', r && r.error === 'busy' ? (es0 ? 'Muchos mensajes — espera un minuto o llama al ' : 'Lots of messages — please wait a minute or call ') + PHONE : (es0 ? 'Perdón, no pude responder. Llama o escribe al ' : 'Sorry, I could not answer. Call or text ') + PHONE); return; }
        if (r.quote) { shared.quote = r.quote; setQuote(r.quote); bubble('assistant', '<div class="ch-q">' + quoteCard(r.quote) + '</div>'); }
        msgs.push({ role: 'assistant', text: r.reply }); bubble('assistant', esc(r.reply));
        if (r.slots && r.slots.length && !r.booked) {
          var d = bubble('assistant', r.slots.slice(0, 3).map(function (s) { return '<div class="ch-day">' + esc(s.day) + '</div>' + s.windows.slice(0, 3).map(function (w) { return '<button type="button" class="ch-slot" data-t="' + esc(s.day + ', ' + w) + '">' + esc(w) + '</button>'; }).join(''); }).join(''));
          d.querySelectorAll('.ch-slot').forEach(function (b) { b.onclick = function () { send((r.lang === 'es' ? 'Quiero ' : 'I’ll take ') + b.getAttribute('data-t')); }; });
        }
        if (r.signup && r.signup.link) bubble('assistant', '<a class="btn btn-main btn-sm" href="' + esc(r.signup.link) + '">' + (r.lang === 'es' ? 'Inscribirme' : 'Sign up') + ' — ' + money(r.signup.price) + (r.lang === 'es' ? '/visita' : '/visit') + '</a>');
        if (r.booked) bubble('assistant', '<b>✔ ' + esc(r.booked.day) + ', ' + esc(r.booked.window) + '</b><br><small>' + esc(r.booked.address) + '</small>');
      });
    }
    panel.querySelector('#chForm').addEventListener('submit', function (e) { e.preventDefault(); var t = panel.querySelector('#chText'); var v = t.value.trim(); if (!v && cPhotos.length) v = es0 ? 'Aquí están las fotos' : 'Here are my photos'; t.value = ''; send(v); });

    // "meet your assistant" card inside the quote / sign-up section
    var card = $('agentCard');
    if (card) {
      card.innerHTML = '<div class="agent-card"><img src="' + AGT.img + '" alt=""><div><b>' + (es0 ? '¿Prefieres platicar? ' : 'Rather chat? ') + (es0 ? 'Habla con ' : 'Talk to ') + AGT.n + '</b><p>' + esc(AGT.tips[L][0]) + '</p><button type="button" class="btn btn-main btn-sm">' + (es0 ? 'Abrir chat' : 'Open chat') + '</button></div></div>';
      card.querySelector('button').onclick = openChat;
    }
  }

  /* ───────── SIGN-UP (bins, pet waste) ───────── */
  var RS = {
    bins: { name: 'EcoWise Bin Solutions', short: 'Bin cleaning', logo: '/branding/bins-192.webp', unit: 'bins', inc: 2,
      plans: [{ k: 'monthly', l: 'Monthly', p: 29, x: 8, n: 'Most popular — every 4 weeks on your trash day' }, { k: 'bimonthly', l: 'Every 2 months', p: 35, x: 10 }, { k: 'quarterly', l: 'Every 3 months', p: 45, x: 10 }, { k: 'onetime', l: 'One-time clean', p: 55, x: 15, one: true }] },
    petwaste: { name: 'EcoWise Pet Waste', short: 'Pet waste', logo: '/branding/petwaste-192.webp', unit: 'dogs', inc: 1,
      plans: [{ k: 'weekly', l: 'Weekly', p: 17, t: 20, x: 3, n: 'Most popular — disinfectant included' }, { k: 'twice_weekly', l: '2× per week', p: 15, t: 18, x: 3 }, { k: 'biweekly', l: 'Every 2 weeks', p: 27, t: 30, x: 4 }, { k: 'onetime', l: 'One-time cleanup', p: 85, t: 85, x: 0, one: true, n: 'Parties, move-out, home sale' }] },
  };
  function price(d, k, units, bundle) {
    var D = RS[d], p = D.plans.filter(function (x) { return x.k === k; })[0] || D.plans[0], n = Math.max(1, Number(units) || 1), v;
    v = d === 'bins' ? p.p + Math.max(0, n - D.inc) * p.x : (n === 1 ? p.p : p.t + Math.max(0, n - 2) * p.x);
    if (bundle && !p.one) v = v * 0.9;
    return Math.round(v * 100) / 100;
  }
  var TERMS = window.EW_TERMS || {};
  var ERR = { missing_info: 'Please fill in your name, email and address.', agree_required: 'Please type your name and check “I agree”.', signature_required: 'Please draw your signature.', stripe_not_connected: 'Online card setup is not available yet — we will call you to finish.', busy: 'Too many tries — please wait a few minutes.', not_found: 'This link is not valid. Please call ' + PHONE + '.' };

  if (EW.mode === 'signup' && $('sGo')) {
    var q = new URLSearchParams(location.search);
    var divs = q.get('bundle') ? ['bins', 'petwaste'] : [EW.branch];
    var plans = { bins: 'monthly', petwaste: 'weekly' }, units = { bins: 2, petwaste: 1 };
    if (q.get('plan') && RS[EW.branch].plans.some(function (p) { return p.k === q.get('plan'); })) plans[EW.branch] = q.get('plan');
    if (q.get('units')) units[EW.branch] = Math.max(1, Math.min(12, Number(q.get('units')) || units[EW.branch]));
    if (q.get('a')) setTimeout(function () { $('sAddr').value = q.get('a').slice(0, 160); }, 0);
    var pad = sigPad($('sSig'));
    $('sClear').addEventListener('click', function () { pad.clear(); });
    function render() {
      var bundle = divs.length === 2;
      $('sSvc').innerHTML = ['bins', 'petwaste'].map(function (d) {
        return '<button type="button" data-d="' + d + '" class="' + (divs.indexOf(d) >= 0 ? 'on' : '') + '"><img src="' + RS[d].logo + '" alt=""><b>' + RS[d].short + '</b><br><small>' + (d === 'bins' ? 'Carts washed on trash day' : 'Weekly yard scooping') + '</small></button>';
      }).join('');
      $('sBundle').textContent = bundle ? '✔ Bundle: 10% off both services' : 'Add the other service and save 10% on both';
      $('sPlans').innerHTML = divs.map(function (d) {
        var D = RS[d];
        return '<p class="f" style="font-weight:700;margin-top:14px">' + D.short + ' plan</p>' + D.plans.map(function (p) {
          return '<label class="plan ' + (plans[d] === p.k ? 'on' : '') + '"><input type="radio" name="p_' + d + '" value="' + p.k + '" ' + (plans[d] === p.k ? 'checked' : '') + '><span>' + p.l + (p.n ? '<small>' + p.n + '</small>' : '') + '</span><b>' + money(price(d, p.k, units[d], bundle)) + '</b><small>/visit</small></label>';
        }).join('') + '<label class="f">How many ' + D.unit + '?</label><input class="i" type="number" min="1" max="12" value="' + units[d] + '" data-u="' + d + '" style="max-width:110px">' +
          (d === 'petwaste' && plans[d] !== 'weekly' && plans[d] !== 'twice_weekly' && plans[d] !== 'onetime' ? '<p class="muted">First cleanup if the yard has buildup: $65 once (free with a weekly plan).</p>' : '');
      }).join('');
      $('sPetFields').classList.toggle('hidden', divs.indexOf('petwaste') < 0);
      $('sDayWrap').classList.toggle('hidden', divs.indexOf('bins') >= 0);
      $('sTerms').innerHTML = divs.map(function (d) { return '<b>' + RS[d].name + ' — Service Agreement</b><ol>' + (TERMS[d] || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>'; }).join('') + '<p>' + 'A division of EcoWise Junk Removal LLC, Austin, TX · ' + PHONE + '</p>';
      var tot = divs.reduce(function (s, d) { return s + price(d, plans[d], units[d], bundle); }, 0);
      $('sTotal').textContent = money(tot);
    }
    $('sSvc').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-d]'); if (!b) return; var d = b.getAttribute('data-d');
      if (divs.indexOf(d) >= 0) { if (divs.length > 1) divs = divs.filter(function (x) { return x !== d; }); } else divs = ['bins', 'petwaste'];
      render();
    });
    $('sPlans').addEventListener('change', function (e) {
      if (e.target.name && e.target.name.indexOf('p_') === 0) plans[e.target.name.slice(2)] = e.target.value;
      if (e.target.getAttribute('data-u')) units[e.target.getAttribute('data-u')] = Math.max(1, Number(e.target.value) || 1);
      render();
    });
    render();
    $('sGo').addEventListener('click', function () {
      $('sErr').textContent = '';
      if (!pad.hasInk()) { $('sErr').textContent = ERR.signature_required; return; }
      if (!$('sAgree').checked) { $('sErr').textContent = ERR.agree_required; return; }
      $('sGo').disabled = true; $('sGo').innerHTML = '<span class="spin"></span> Signing you up…';
      var body = { action: 'signup', divisions: divs, plans: plans, units: units, name: $('sName').value.trim(), email: $('sEmail').value.trim(), phone: $('sPhone').value.trim(),
        address: $('sAddr').value.trim(), service_day: $('sDay').value, gate_code: $('sGate').value.trim(), pets_note: $('sPets').value.trim(),
        signer_name: $('sName').value.trim(), signature: pad.data(), agree: true, src: q.get('src') || ('web-' + EW.branch), hp: $('sHp').value };
      post('/.netlify/functions/join', body).then(function (r) {
        if (!r || !r.ok) { $('sGo').disabled = false; $('sGo').textContent = 'Sign up — next: add card'; $('sErr').textContent = ERR[r && r.error] || (r && r.error) || 'Something went wrong — call ' + PHONE; return; }
        $('sGo').innerHTML = '<span class="spin"></span> Opening secure card page…';
        post('/.netlify/functions/join', { action: 'card_setup', id: r.id, k: r.k }).then(function (c) {
          location.href = c && c.url ? c.url : '/account/?id=' + encodeURIComponent(r.id) + '&k=' + encodeURIComponent(r.k);
        });
      });
    });
  }

  /* ───────── CLIENT ACCOUNT (/account/) ───────── */
  if (EW.mode === 'account') {
    var qa = new URLSearchParams(location.search), id = qa.get('id'), k = qa.get('k'), padA = null;
    var box = $('acct');
    function act(action, extra) {
      var b = { action: action, id: id, k: k }; for (var x in extra || {}) b[x] = extra[x];
      return post('/.netlify/functions/join', b);
    }
    function load() {
      act('get').then(function (d) {
        if (!d || !d.ok) { box.innerHTML = '<p class="err">' + (ERR[d && d.error] || 'We could not open your account. Please call ' + PHONE + '.') + '</p>'; return; }
        var cs = d.customers, unsigned = cs.some(function (c) { return !c.signed_at; }), noCard = cs.some(function (c) { return !c.card_summary; });
        var h = '<h3>Hi ' + esc(cs[0].name.split(' ')[0]) + '</h3><p class="muted">Your EcoWise services</p>';
        if (unsigned) h += '<div class="result" style="margin-top:12px"><b>1. Sign your service agreement</b><div class="terms" style="margin-top:8px">' + cs.map(function (c) { return '<b>' + esc(RS[c.division].name) + '</b><ol>' + (d.terms[c.division] || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>'; }).join('') + '</div><label class="f">Your full name</label><input class="i" id="aName"><label class="f">Signature</label><canvas class="sig" id="aSig"></canvas><label class="chk"><input type="checkbox" id="aAgree"> I agree to the service agreement and to sign electronically.</label><button class="btn btn-main" id="aSign" style="width:100%;margin-top:10px">Sign agreement</button></div>';
        else if (noCard) h += '<div class="result" style="margin-top:12px"><b>2. Add your card</b><p class="muted">Nothing is charged now. Your card is charged automatically on each service day.</p><button class="btn btn-main" id="aCard" style="width:100%">Add card securely (Stripe)</button></div>';
        cs.forEach(function (c) {
          var D = RS[c.division], p = D.plans.filter(function (x) { return x.k === c.plan; })[0] || {};
          h += '<div class="result" style="margin-top:12px"><div style="display:flex;gap:10px;align-items:center"><img src="' + D.logo + '" style="width:42px;height:42px;border-radius:50%"><div style="flex:1"><b>' + esc(D.name) + '</b><br><small class="muted">' + esc(c.customer_id) + ' · ' + esc(c.address) + '</small></div><b>' + esc(c.status) + '</b></div>' +
            '<p style="font-size:14px;margin:10px 0 0">Plan: <b>' + esc(p.l || c.plan) + '</b> · ' + c.units + ' ' + D.unit + ' · <b>' + money(c.price_per_visit) + '</b>/visit' + (c.bundle ? ' (bundle −10%)' : '') + '<br>Service day: <b>' + esc(c.service_day) + '</b>' + (c.division === 'bins' && c.trash_route ? ' (your City trash day)' : '') + ' · Next: <b>' + esc(c.next_service_date || '—') + '</b>' +
            (c.card_summary ? '<br>Card: ' + esc(c.card_summary) + (c.payment_status === 'failed' ? ' — <span class="err">last payment failed, please update</span>' : '') : '') + '</p>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">' +
            (c.status === 'Active' ? '<button class="btn btn-sm btn-ghost" style="color:#14201a;border-color:#c9c3b4" data-a="pause" data-d="' + c.division + '">Pause</button>' : '') +
            (c.status === 'Paused' ? '<button class="btn btn-sm btn-ghost" style="color:#14201a;border-color:#c9c3b4" data-a="resume" data-d="' + c.division + '">Resume</button>' : '') +
            (c.card_summary ? '<button class="btn btn-sm btn-ghost" style="color:#14201a;border-color:#c9c3b4" data-a="card">Update card</button>' : '') +
            (c.status !== 'Cancelled' ? '<button class="btn btn-sm btn-ghost" style="color:#b3261e;border-color:#e4b4ae" data-a="cancel" data-d="' + c.division + '">Cancel</button>' : '') + '</div></div>';
        });
        if (cs.length === 1 && cs[0].status !== 'Cancelled') { var o = cs[0].division === 'bins' ? 'petwaste' : 'bins'; h += '<a class="result" style="display:block;text-decoration:none;margin-top:12px;border-style:dashed" href="/' + (o === 'bins' ? 'bins' : 'pet-waste') + '/?bundle=1#signup"><b>Add ' + RS[o].name + ' and save 10% on both</b></a>'; }
        h += '<div class="result" style="margin-top:12px"><b>Your service photos</b>' + (d.visits.length ? d.visits.map(function (v) {
          var ph = v.before_photos.slice(0, 2).concat(v.after_photos.slice(0, 2), v.gate_photo ? [v.gate_photo] : []);
          return '<div style="border-top:1px solid #e1ddd2;margin-top:8px;padding-top:8px"><small>' + esc(v.date) + ' · ' + esc(RS[v.division].short) + ' · ' + esc(v.status) + (v.amount ? ' · ' + money(v.amount) : '') + '</small><div class="thumbs">' + ph.map(function (u) { return '<a href="' + esc(u) + '" target="_blank" rel="noopener"><img src="' + esc(u) + '" alt=""></a>'; }).join('') + '</div></div>';
        }).join('') : '<p class="muted">Photos appear here after each visit.</p>') + '</div>';
        box.innerHTML = h;
        if ($('aSig')) padA = sigPad($('aSig'));
        if ($('aSign')) $('aSign').onclick = function () {
          if (!padA.hasInk() || !$('aAgree').checked || $('aName').value.trim().length < 3) { alert('Type your name, sign and check “I agree”.'); return; }
          act('sign', { signer_name: $('aName').value.trim(), signature: padA.data(), agree: true }).then(load);
        };
        if ($('aCard')) $('aCard').onclick = cardSetup;
        box.querySelectorAll('button[data-a]').forEach(function (b) {
          b.onclick = function () {
            var a = b.getAttribute('data-a');
            if (a === 'card') return cardSetup();
            if (a === 'cancel' && !confirm('Cancel this service? (7 days notice per the agreement)')) return;
            act(a, { division: b.getAttribute('data-d') }).then(load);
          };
        });
      });
    }
    function cardSetup() { act('card_setup').then(function (c) { if (c && c.url) location.href = c.url; else alert(ERR[c && c.error] || 'Could not open the card page. Call ' + PHONE); }); }
    if (!id || !k) box.innerHTML = '<p>Use the link from your email or sign up at <a href="/bins/">Bin Solutions</a> or <a href="/pet-waste/">Pet Waste</a>.</p>';
    else if (qa.get('setup') === 'ok' && qa.get('session_id')) act('card_confirm', { session_id: qa.get('session_id') }).then(function () { history.replaceState({}, '', '/account/?id=' + encodeURIComponent(id) + '&k=' + encodeURIComponent(k)); load(); });
    else load();
  }
})();
