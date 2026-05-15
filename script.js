 /* ── DATA ── */
      const USERS = [
        { email:'demo@abs.com',  pass:'1234',  name:'Demo User' },
        { email:'admin@abs.com', pass:'admin', name:'Admin'     }
      ];

      const PROVIDERS = {
        health: [
          { name:"Dr. Ayesha Khan – General Physician", fee:"PKR 1,500" },
          { name:"Dr. Usman Malik – Cardiologist",      fee:"PKR 2,500" },
          { name:"Dr. Fatima Shah – Pediatrician",      fee:"PKR 1,200" }
        ],
        education: [
          { name:"Prof. Ahmed Hassan – Mathematics",    fee:"PKR 800"  },
          { name:"Ms. Sara Noor – English Literature",  fee:"PKR 700"  },
          { name:"Sir Ali Rehman – Physics",            fee:"PKR 900"  }
        ],
        beauty: [
          { name:"Luxe Beauty Lounge",                  fee:"PKR 3,000" },
          { name:"Glamour Studio",                      fee:"PKR 2,000" },
          { name:"Elysium Spa & Salon",                 fee:"PKR 2,500" }
        ]
      };

      /* All possible slots in a day */
      const ALL_SLOTS = ["09:00 AM","10:00 AM","11:30 AM","01:00 PM","02:00 PM","03:30 PM","04:30 PM","05:00 PM"];

      /* Slots booked in this session (after payment) */
      const SESSION_BOOKED = new Set();

      /**
       * Returns the subset of ALL_SLOTS shown for a given date.
       * Uses a deterministic hash of the date string so every
       * provider sees the same slot list for a given day, but
       * different dates show different combinations (4–6 slots).
       */
      function getSlotsForDate(dateStr) {
        // Hash the date string to a stable number
        let h = 0;
        for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) >>> 0;

        // Shuffle ALL_SLOTS deterministically using h as seed
        const arr = [...ALL_SLOTS];
        for (let i = arr.length - 1; i > 0; i--) {
          h = (h * 1664525 + 1013904223) >>> 0;
          const j = h % (i + 1);
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }

        // Pick 4–6 slots depending on day-of-week feel
        const count = 4 + (h % 3); // 4, 5, or 6
        return arr.slice(0, count).sort((a, b) => {
          // Re-sort chronologically
          return ALL_SLOTS.indexOf(a) - ALL_SLOTS.indexOf(b);
        });
      }

      /**
       * ~35% of slots are pre-booked per provider+date+time combo.
       * Deterministic so the same combo always gives the same result.
       */
      function isBooked(provider, date, time) {
        const key = `${provider}|${date}|${time}`;
        if (SESSION_BOOKED.has(key)) return true;
        let h = 0;
        for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
        return (h % 10) < 4; // ~40% booked
      }

      /* ── STATE ── */
      let currentUser = null, currentDomain = null, selectedSlot = null, pendingBooking = null;

      /* ── HELPERS ── */
      const $     = id => document.getElementById(id);
      const show  = id => $(id).classList.remove('hidden');
      const hide  = id => $(id).classList.add('hidden');
      const delay = ms => new Promise(r => setTimeout(r, ms));

      function showScreen(name) {
        ['screen-login','screen-domain','screen-booking'].forEach(s => hide(s));
        show('screen-' + name);
      }

      /* ── AUTH ── */
      function doLogin() {
        const email = $('login-email').value.trim();
        const pass  = $('login-pass').value;
        const errEl = $('login-error');
        errEl.style.display = 'none';

        const user = USERS.find(u => u.email === email && u.pass === pass);
        if (!user) {
          errEl.textContent = 'Invalid credentials. Try demo@abs.com / 1234';
          errEl.style.display = 'block';
          return;
        }

        currentUser = user;
        $('user-name-chip').textContent = user.name;
        showScreen('domain');
      }

      function doLogout() {
        currentUser = currentDomain = selectedSlot = pendingBooking = null;
        $('login-email').value = $('login-pass').value = '';
        hide('modal-pay');
        hide('modal-confirm');
        showScreen('login');
      }

      /* ── DOMAIN ── */
      function selectDomain(domain) {
        currentDomain = domain;
        const labels = { health:'🏥 Healthcare', education:'📖 Education', beauty:'💆‍♀️ Beauty' };
        $('booking-title').textContent = labels[domain] + ' Appointment';

        const sel = $('provider');
        sel.innerHTML = '<option value="">Select Provider</option>';
        PROVIDERS[domain].forEach(p => {
          const o = document.createElement('option');
          o.value = o.textContent = p.name;
          sel.appendChild(o);
        });

        // Block past dates — set min to today in local timezone
        const now = new Date();
        const todayLocal =
          now.getFullYear() + '-' +
          String(now.getMonth() + 1).padStart(2, '0') + '-' +
          String(now.getDate()).padStart(2, '0');

        $('date').min   = todayLocal;
        $('date').value = '';
        selectedSlot = null;
        hide('slots-section');
        hide('availability-box');
        $('proceed-btn').disabled = true;
        showScreen('booking');
      }

      function goBack() { showScreen('domain'); selectedSlot = null; }

      /* ── SLOTS ── */
      function onFieldChange() {
        selectedSlot = null;
        hide('availability-box');
        $('proceed-btn').disabled = true;

        const provider = $('provider').value;
        const date     = $('date').value;
        if (!provider || !date) { hide('slots-section'); return; }

        buildSlotGrid(provider, date);
        show('slots-section');
      }

      function buildSlotGrid(provider, date) {
        const grid = $('slots-grid');
        grid.innerHTML = '';
        const slots = getSlotsForDate(date);

        slots.forEach(time => {
          const booked = isBooked(provider, date, time);
          const btn = document.createElement('button');
          btn.className = 'slot-btn' + (booked ? ' slot-taken' : '');
          btn.disabled  = booked;
          btn.innerHTML = booked
            ? `${time}<span class="slot-taken-tag">Unavailable</span>`
            : time;
          if (!booked) btn.onclick = () => pickSlot(btn, time);
          grid.appendChild(btn);
        });
      }

      function pickSlot(btn, time) {
        document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('slot-selected'));
        btn.classList.add('slot-selected');
        selectedSlot = time;
        hide('availability-box');
        $('proceed-btn').disabled = false;
      }

      /* ── CHECK & PROCEED ── */
      async function checkAndProceed() {
        const provider = $('provider').value;
        const date     = $('date').value;
        if (!provider || !date || !selectedSlot) {
          alert('Please select provider, date, and a time slot.');
          return;
        }

        show('availability-box');
        const badge = $('avail-badge'), txt = $('avail-text');
        badge.className = 'availability-badge avail-checking';
        txt.innerHTML   = '<span class="spinner"></span>&nbsp; Verifying availability…';
        $('proceed-btn').disabled = true;

        await delay(1000 + Math.random() * 600);

        const available = !isBooked(provider, date, selectedSlot);

        if (available) {
          badge.className  = 'availability-badge avail-free';
          txt.textContent  = '✓ Slot available! Proceeding to payment…';
          await delay(800);
          const provObj = PROVIDERS[currentDomain].find(p => p.name === provider);
          pendingBooking = { provider, date, time: selectedSlot, fee: provObj ? provObj.fee : 'N/A' };
          openPayModal();
        } else {
          badge.className = 'availability-badge avail-busy';
          txt.textContent = '✕ This slot was just taken. Please pick another time.';
          // visually mark it taken
          document.querySelectorAll('.slot-btn.slot-selected').forEach(b => {
            b.classList.remove('slot-selected');
            b.classList.add('slot-taken');
            b.disabled  = true;
            b.innerHTML = `${selectedSlot}<span class="slot-taken-tag">Unavailable</span>`;
          });
          selectedSlot = null;
          $('proceed-btn').disabled = true;
        }
      }

      /* ── PAYMENT ── */
      function openPayModal() {
        const { provider, date, time, fee } = pendingBooking;
        const fmt = new Date(date + 'T00:00').toLocaleDateString('en-PK', {
          weekday:'long', year:'numeric', month:'long', day:'numeric'
        });
        $('pay-summary').innerHTML = `
          <div class="s-row"><span class="k">Provider</span><span class="v">${provider}</span></div>
          <div class="s-row"><span class="k">Date</span><span class="v">${fmt}</span></div>
          <div class="s-row"><span class="k">Time</span><span class="v">${time}</span></div>
          <div class="s-row price"><span class="k">Consultation Fee</span><span class="v">${fee}</span></div>
        `;
        ['card-num','card-name','card-exp','card-cvv'].forEach(id => $(id).value = '');
        $('pay-err').style.display = 'none';
        $('pay-btn').disabled      = false;
        $('pay-btn').innerHTML     = 'Pay &amp; Confirm Appointment';
        show('modal-pay');
      }

      function closePayModal() {
        hide('modal-pay');
        $('proceed-btn').disabled = false;
      }

      function fmtCard(el) {
        let v = el.value.replace(/\D/g, '').substring(0, 16);
        el.value = v.replace(/(.{4})/g, '$1 ').trim();
      }

      function fmtExp(el) {
        let v = el.value.replace(/\D/g, '').substring(0, 4);
        if (v.length >= 3) v = v.substring(0, 2) + ' / ' + v.substring(2);
        el.value = v;
      }

      async function processPayment() {
        const num   = $('card-num').value.replace(/\s/g, '');
        const name  = $('card-name').value.trim();
        const exp   = $('card-exp').value.replace(/[\s/]/g, '');
        const cvv   = $('card-cvv').value.trim();
        const errEl = $('pay-err');
        errEl.style.display = 'none';

        if (num.length < 16) { showPayErr('Enter a valid 16-digit card number.'); return; }
        if (!name)           { showPayErr('Enter the cardholder name.');           return; }
        if (exp.length < 4)  { showPayErr('Enter a valid expiry date (MM/YY).');   return; }
        if (cvv.length < 3)  { showPayErr('Enter a valid 3-digit CVV.');           return; }

        const btn = $('pay-btn');
        btn.disabled  = true;
        btn.innerHTML = '<span class="spinner spinner-w"></span>&nbsp; Processing…';

        await delay(2000 + Math.random() * 800);

        // Mark slot booked
        SESSION_BOOKED.add(`${pendingBooking.provider}|${pendingBooking.date}|${pendingBooking.time}`);

        hide('modal-pay');
        showConfirmation();
      }

      function showPayErr(msg) {
        const e = $('pay-err');
        e.textContent   = msg;
        e.style.display = 'block';
      }

      /* ── CONFIRMATION ── */
      function showConfirmation() {
        const { provider, date, time, fee } = pendingBooking;
        const fmt = new Date(date + 'T00:00').toLocaleDateString('en-PK', {
          weekday:'long', year:'numeric', month:'long', day:'numeric'
        });
        const ref = 'ABS-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        $('confirm-details').innerHTML = `
          <div class="c-row"><span class="k">Reference No.</span><span class="v" style="color:var(--teal);font-weight:700;">${ref}</span></div>
          <div class="c-row"><span class="k">Provider</span><span class="v">${provider}</span></div>
          <div class="c-row"><span class="k">Date</span><span class="v">${fmt}</span></div>
          <div class="c-row"><span class="k">Time</span><span class="v">${time}</span></div>
          <div class="c-row"><span class="k">Patient</span><span class="v">${currentUser.name}</span></div>
          <div class="c-row"><span class="k">Amount Paid</span><span class="v" style="color:var(--success);font-weight:600;">${fee}</span></div>
          <div class="c-row"><span class="k">Status</span><span class="v" style="color:var(--success);font-weight:700;">Confirmed ✓</span></div>
        `;
        show('modal-confirm');
      }

      function bookAnother() {
        hide('modal-confirm');
        pendingBooking = selectedSlot = null;
        showScreen('domain');
      }

      /* Enter key on login */
      document.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !$('screen-login').classList.contains('hidden')) doLogin();
      });