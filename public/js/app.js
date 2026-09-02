(function () {
  const CAT = {
    masuk: ['Penjualan', 'Modal Tambahan', 'Piutang Cair', 'Lainnya'],
    keluar: ['Belanja Bahan', 'Gaji Pegawai', 'Listrik & Air', 'Sewa Tempat', 'Lainnya']
  };
  const API = '/api/transactions';

  let state = {
    transactions: [],
    filter: 'today',
    formType: 'masuk',
    formCat: CAT.masuk[0],
    search: '',
    editingId: null,
    loading: true
  };

  const rupiah = (n) => 'Rp ' + Math.round(n).toLocaleString('id-ID');
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  function formatDateID(dstr) {
    const d = new Date(dstr + 'T00:00:00');
    return dayNames[d.getDay()] + ', ' + d.getDate() + ' ' + monthNames[d.getMonth()] + ' ' + d.getFullYear();
  }
  function formatDateShort(dstr) {
    const d = new Date(dstr + 'T00:00:00');
    return d.getDate() + ' ' + monthNames[d.getMonth()].slice(0, 3);
  }
  function startOfWeek(d) {
    const dt = new Date(d);
    const day = (dt.getDay() + 6) % 7;
    dt.setDate(dt.getDate() - day);
    dt.setHours(0, 0, 0, 0);
    return dt;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  // ---- Toast ----
  function toast(message, type = '') {
    const stack = document.getElementById('toastStack');
    const el = document.createElement('div');
    el.className = 'toast' + (type ? ' ' + type : '');
    el.textContent = message;
    stack.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  function setStatus(online) {
    const pill = document.getElementById('statusPill');
    const text = document.getElementById('statusText');
    pill.classList.toggle('online', online);
    pill.classList.toggle('offline', !online);
    text.textContent = online ? 'Tersimpan di database' : 'Koneksi bermasalah';
  }

  // ---- API calls ----
  async function apiRequest(url, options) {
    const res = await fetch(url, options);
    if (!res.ok) {
      let msg = 'Terjadi kesalahan';
      try { msg = (await res.json()).error || msg; } catch (e) {}
      throw new Error(msg);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  async function loadTransactions() {
    state.loading = true;
    try {
      const data = await apiRequest(API);
      state.transactions = data;
      setStatus(true);
    } catch (e) {
      setStatus(false);
      toast('Gagal memuat data: ' + e.message, 'error');
    } finally {
      state.loading = false;
    }
  }

  async function createTransaction(tx) {
    const saved = await apiRequest(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tx)
    });
    state.transactions.unshift(saved);
  }

  async function updateTransaction(id, tx) {
    const saved = await apiRequest(`${API}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tx)
    });
    const idx = state.transactions.findIndex(t => t.id === id);
    if (idx !== -1) state.transactions[idx] = saved;
  }

  async function deleteTransaction(id) {
    await apiRequest(`${API}/${id}`, { method: 'DELETE' });
    state.transactions = state.transactions.filter(t => t.id !== id);
  }

  // ---- Derived data ----
  function filteredTransactions() {
    const now = new Date();
    const today = todayStr();
    let list = state.transactions;
    if (state.filter === 'today') {
      list = list.filter(t => t.date === today);
    } else if (state.filter === 'week') {
      const start = startOfWeek(now);
      list = list.filter(t => new Date(t.date + 'T00:00:00') >= start);
    } else if (state.filter === 'month') {
      list = list.filter(t => {
        const d = new Date(t.date + 'T00:00:00');
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
    }
    if (state.search.trim()) {
      const q = state.search.trim().toLowerCase();
      list = list.filter(t =>
        (t.desc || '').toLowerCase().includes(q) ||
        (t.category || '').toLowerCase().includes(q)
      );
    }
    return list;
  }

  function sums(list) {
    let masuk = 0, keluar = 0;
    list.forEach(t => { if (t.type === 'masuk') masuk += t.amount; else keluar += t.amount; });
    return { masuk, keluar, net: masuk - keluar };
  }

  // ---- Render ----
  function renderHero() {
    const list = filteredTransactions();
    const { masuk, keluar, net } = sums(list);
    const labelMap = { today: 'Untung hari ini', week: 'Untung minggu ini', month: 'Untung bulan ini', all: 'Untung keseluruhan' };
    document.getElementById('heroLabel').textContent = net < 0 ? labelMap[state.filter].replace('Untung', 'Rugi') : labelMap[state.filter];
    const amountEl = document.getElementById('heroAmount');
    amountEl.textContent = rupiah(Math.abs(net));
    amountEl.className = 'hero-amount ' + (net < 0 ? 'loss' : 'gain');
    document.getElementById('totalMasuk').textContent = rupiah(masuk);
    document.getElementById('totalKeluar').textContent = rupiah(keluar);
    document.getElementById('heroSub').textContent = state.loading
      ? 'Memuat data…'
      : (list.length === 0 ? 'Belum ada transaksi pada periode ini' : list.length + ' transaksi tercatat');
  }

  function renderChart() {
    const el = document.getElementById('chartBars');
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    const nets = days.map(d => sums(state.transactions.filter(t => t.date === d)).net);
    const maxAbs = Math.max(1, ...nets.map(n => Math.abs(n)));
    el.innerHTML = days.map((d, i) => {
      const n = nets[i];
      const h = n === 0 ? 4 : Math.max(6, Math.round((Math.abs(n) / maxAbs) * 96));
      const cls = n === 0 ? 'zero' : (n > 0 ? 'gain' : 'loss');
      const label = d === todayStr() ? 'Ini' : formatDateShort(d).split(' ')[0];
      return `<div class="bar-col"><div class="bar ${cls}" style="height:${h}px" title="${rupiah(n)}"></div><div class="bar-day">${label}</div></div>`;
    }).join('');
  }

  function renderCategoryBreakdown() {
    const list = filteredTransactions();
    const card = document.getElementById('catCard');
    const title = document.getElementById('catTitle');
    const sub = document.getElementById('catSub');

    if (list.length === 0) {
      card.style.display = 'none';
      title.style.display = 'none';
      return;
    }

    const totals = {};
    list.forEach(t => {
      const key = t.category + '::' + t.type;
      totals[key] = (totals[key] || 0) + t.amount;
    });
    const rows = Object.entries(totals)
      .map(([key, amount]) => {
        const [name, type] = key.split('::');
        return { name, type, amount };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const maxAmt = Math.max(...rows.map(r => r.amount));

    card.innerHTML = rows.map(r => `
      <div class="cat-row">
        <div class="cat-row-top">
          <span class="name">${escapeHtml(r.name)}</span>
          <span class="amt">${rupiah(r.amount)}</span>
        </div>
        <div class="cat-track"><div class="cat-fill ${r.type}" style="width:${Math.max(4, Math.round((r.amount / maxAmt) * 100))}%"></div></div>
      </div>
    `).join('');

    sub.textContent = `${rows.length} kategori`;
    card.style.display = 'block';
    title.style.display = 'flex';
  }

  function renderLedger() {
    const list = filteredTransactions().slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const countEl = document.getElementById('ledgerCount');
    countEl.textContent = list.length ? list.length + ' catatan' : '';

    const ledgerEl = document.getElementById('ledger');

    if (state.loading) {
      ledgerEl.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
      return;
    }

    if (list.length === 0) {
      const msg = state.search
        ? 'Tidak ada catatan yang cocok dengan pencarian.'
        : 'Belum ada catatan kas untuk periode ini.<br>Tambahkan transaksi pertama di kiri.';
      ledgerEl.innerHTML = `<div class="empty-state"><div class="em-icon">🧾</div><p>${msg}</p></div>`;
      return;
    }

    const byDate = {};
    list.forEach(t => { (byDate[t.date] = byDate[t.date] || []).push(t); });
    const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

    ledgerEl.innerHTML = dates.map(d => {
      const items = byDate[d];
      const { net } = sums(items);
      const rows = items.map(t => {
        const time = t.createdAt ? new Date(t.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';
        return `
        <div class="tx-row" data-id="${t.id}">
          <div class="tx-icon ${t.type}">${t.type === 'masuk' ? '↓' : '↑'}</div>
          <div class="tx-mid">
            <div class="desc">${escapeHtml(t.desc || t.category)}</div>
            <div class="meta">${escapeHtml(t.category)} · ${time}</div>
          </div>
          <div class="tx-amount ${t.type}">${t.type === 'masuk' ? '+' : '-'}${rupiah(t.amount)}</div>
          <button class="tx-del" data-id="${t.id}" title="Hapus">✕</button>
        </div>`;
      }).join('');
      return `
      <div class="day-group">
        <div class="day-head">
          <span class="d">${formatDateID(d)}</span>
          <span class="n ${net < 0 ? 'loss' : 'gain'}">${net < 0 ? '-' : '+'}${rupiah(Math.abs(net))}</span>
        </div>
        ${rows}
      </div>`;
    }).join('');
  }

  function renderAll() {
    renderHero();
    renderChart();
    renderCategoryBreakdown();
    renderLedger();
  }

  function renderCatChips() {
    const cats = CAT[state.formType];
    if (!cats.includes(state.formCat)) state.formCat = cats[0];
    document.getElementById('catRow').innerHTML = cats.map(c =>
      `<button type="button" class="chip ${c === state.formCat ? 'active' : ''}" data-cat="${c}">${c}</button>`
    ).join('');
  }

  // ---- Edit mode ----
  function enterEditMode(tx) {
    state.editingId = tx.id;
    state.formType = tx.type;
    state.formCat = tx.category;

    document.querySelectorAll('.type-toggle button').forEach(b => b.classList.toggle('active', b.dataset.type === tx.type));
    renderCatChips();
    document.getElementById('fAmount').value = Number(tx.amount).toLocaleString('id-ID');
    document.getElementById('fDesc').value = tx.desc || '';
    document.getElementById('fDate').value = tx.date;

    document.getElementById('formTitle').textContent = 'Edit transaksi';
    document.getElementById('editBanner').style.display = 'flex';
    document.getElementById('addCard').classList.add('editing');
    document.getElementById('submitBtn').textContent = 'Perbarui transaksi';
    document.getElementById('cancelEditBottom').style.display = 'block';
    document.getElementById('addCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function exitEditMode() {
    state.editingId = null;
    document.getElementById('formTitle').textContent = 'Tambah transaksi';
    document.getElementById('editBanner').style.display = 'none';
    document.getElementById('addCard').classList.remove('editing');
    document.getElementById('submitBtn').textContent = 'Simpan transaksi';
    document.getElementById('cancelEditBottom').style.display = 'none';
    document.getElementById('fAmount').value = '';
    document.getElementById('fDesc').value = '';
    document.getElementById('fDate').value = todayStr();
  }

  // ---- CSV export ----
  function exportCsv() {
    const list = filteredTransactions().slice().sort((a, b) => a.date.localeCompare(b.date));
    if (list.length === 0) {
      toast('Tidak ada data untuk diekspor', 'error');
      return;
    }
    const header = ['Tanggal', 'Jenis', 'Kategori', 'Keterangan', 'Jumlah'];
    const rows = list.map(t => [
      t.date,
      t.type === 'masuk' ? 'Uang Masuk' : 'Uang Keluar',
      t.category,
      (t.desc || '').replace(/"/g, '""'),
      t.amount
    ]);
    const csv = [header, ...rows]
      .map(r => r.map(v => `"${v}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `warung-empuk-${state.filter}-${todayStr()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---- Event wiring ----
  document.getElementById('filters').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-filter]');
    if (!btn) return;
    state.filter = btn.dataset.filter;
    document.querySelectorAll('#filters button').forEach(b => b.classList.toggle('active', b === btn));
    renderHero(); renderCategoryBreakdown(); renderLedger();
  });

  document.querySelectorAll('.type-toggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      state.formType = btn.dataset.type;
      document.querySelectorAll('.type-toggle button').forEach(b => b.classList.toggle('active', b === btn));
      renderCatChips();
    });
  });

  document.getElementById('catRow').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    state.formCat = chip.dataset.cat;
    renderCatChips();
  });

  document.getElementById('fAmount').addEventListener('input', (e) => {
    const digits = e.target.value.replace(/[^\d]/g, '');
    e.target.value = digits ? Number(digits).toLocaleString('id-ID') : '';
  });

  document.getElementById('searchBox').addEventListener('input', (e) => {
    state.search = e.target.value;
    renderLedger();
    document.getElementById('ledgerCount').textContent = filteredTransactions().length + ' catatan';
  });

  document.getElementById('exportBtn').addEventListener('click', exportCsv);
  document.getElementById('cancelEditTop').addEventListener('click', exitEditMode);
  document.getElementById('cancelEditBottom').addEventListener('click', exitEditMode);

  function flashInvalid(el) {
    el.style.borderColor = 'var(--loss)';
    setTimeout(() => { el.style.borderColor = 'var(--line)'; }, 900);
  }

  document.getElementById('submitBtn').addEventListener('click', async () => {
    const amountRaw = document.getElementById('fAmount').value.replace(/[^\d]/g, '');
    const amount = Number(amountRaw);
    const desc = document.getElementById('fDesc').value.trim();
    const date = document.getElementById('fDate').value || todayStr();

    if (!amount || amount <= 0) {
      flashInvalid(document.getElementById('fAmount'));
      return;
    }

    const payload = { type: state.formType, amount, desc, category: state.formCat, date };
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;

    try {
      if (state.editingId) {
        await updateTransaction(state.editingId, payload);
        toast('Transaksi diperbarui', 'success');
        exitEditMode();
      } else {
        await createTransaction(payload);
        toast('Transaksi tersimpan', 'success');
        document.getElementById('fAmount').value = '';
        document.getElementById('fDesc').value = '';
      }
      renderAll();
    } catch (e) {
      toast('Gagal menyimpan: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('ledger').addEventListener('click', async (e) => {
    const delBtn = e.target.closest('.tx-del');
    if (delBtn) {
      e.stopPropagation();
      const id = delBtn.dataset.id;
      const prev = state.transactions;
      try {
        await deleteTransaction(id);
        toast('Transaksi dihapus');
        renderAll();
      } catch (err) {
        state.transactions = prev;
        toast('Gagal menghapus: ' + err.message, 'error');
      }
      return;
    }
    const row = e.target.closest('.tx-row');
    if (row) {
      const tx = state.transactions.find(t => t.id === row.dataset.id);
      if (tx) enterEditMode(tx);
    }
  });

  // ---- Init ----
  async function init() {
    document.getElementById('fDate').value = todayStr();
    renderCatChips();
    renderAll();
    await loadTransactions();
    renderAll();
  }
  init();
})();
