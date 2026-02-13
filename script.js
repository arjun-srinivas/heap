const snapshotInput = document.getElementById('snapshotInput');
const searchInput = document.getElementById('searchInput');
const statusEl = document.getElementById('status');
const table = document.getElementById('constructorTable');
const tbody = table.querySelector('tbody');

let rows = [];
let currentSort = {key: 'shallow', direction: 'desc'};

const numberFmt = new Intl.NumberFormat('en-US');

snapshotInput.addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  try {
    statusEl.textContent = `Reading ${file.name}…`;
    const text = await file.text();

    statusEl.textContent = 'Parsing JSON snapshot…';
    const json = JSON.parse(text);

    statusEl.textContent = 'Building constructor statistics…';
    rows = buildConstructorRows(json);

    if (!rows.length) {
      throw new Error('No constructors were found in this snapshot.');
    }

    sortRows(currentSort.key, currentSort.direction);
    renderRows();

    searchInput.disabled = false;
    statusEl.textContent = `Loaded ${rows.length} constructors.`;
    table.classList.remove('hidden');
  } catch (error) {
    table.classList.add('hidden');
    searchInput.disabled = true;
    searchInput.value = '';
    rows = [];
    statusEl.textContent = `Failed: ${error.message}`;
  }
});

searchInput.addEventListener('input', renderRows);

for (const header of table.querySelectorAll('th[data-sort]')) {
  header.addEventListener('click', () => {
    const key = header.dataset.sort;
    if (currentSort.key === key) {
      currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
      currentSort = {key, direction: key === 'name' ? 'asc' : 'desc'};
    }
    sortRows(currentSort.key, currentSort.direction);
    renderRows();
  });
}

function buildConstructorRows(snapshot) {
  const meta = snapshot?.snapshot?.meta;
  if (!meta || !Array.isArray(snapshot.nodes) || !Array.isArray(snapshot.strings)) {
    throw new Error('The uploaded file is not a valid V8 heap snapshot.');
  }

  const fields = meta.node_fields;
  const fieldCount = fields.length;
  const fieldOffset = name => fields.indexOf(name);

  const typeOffset = fieldOffset('type');
  const nameOffset = fieldOffset('name');
  const selfSizeOffset = fieldOffset('self_size');

  if (typeOffset < 0 || nameOffset < 0 || selfSizeOffset < 0) {
    throw new Error('Snapshot metadata is missing expected node fields.');
  }

  const typeNames = meta.node_types[typeOffset];
  const strings = snapshot.strings;
  const aggregate = new Map();

  for (let i = 0; i < snapshot.nodes.length; i += fieldCount) {
    const typeIndex = snapshot.nodes[i + typeOffset];
    const typeName = typeNames[typeIndex] ?? 'unknown';

    let constructorName = strings[snapshot.nodes[i + nameOffset]] ?? '(unknown)';
    if (typeName !== 'object' && typeName !== 'native') {
      constructorName = `(${typeName}) ${constructorName}`;
    }

    const shallow = snapshot.nodes[i + selfSizeOffset] ?? 0;

    const current = aggregate.get(constructorName) || {name: constructorName, count: 0, shallow: 0};
    current.count += 1;
    current.shallow += shallow;
    aggregate.set(constructorName, current);
  }

  return Array.from(aggregate.values());
}

function sortRows(key, direction) {
  rows.sort((a, b) => {
    const order = direction === 'asc' ? 1 : -1;
    if (key === 'name') {
      return a.name.localeCompare(b.name) * order;
    }
    return (a[key] - b[key]) * order;
  });
}

function renderRows() {
  const q = searchInput.value.trim().toLowerCase();
  const filtered = q ? rows.filter(row => row.name.toLowerCase().includes(q)) : rows;

  tbody.innerHTML = '';
  for (const row of filtered) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(row.name)}</td>
      <td class="numeric">${numberFmt.format(row.count)}</td>
      <td class="numeric">${numberFmt.format(row.shallow)} B</td>
    `;
    tbody.appendChild(tr);
  }

  statusEl.textContent = `Showing ${filtered.length} of ${rows.length} constructors.`;
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
