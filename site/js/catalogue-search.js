/* Progressive enhancement: the complete catalogue remains usable without JS. */
(() => {
  'use strict';
  function initSearch() {
    const panel = document.querySelector('[data-catalogue-search]');
    if (!panel) return;
    const input = panel.querySelector('input');
    const clear = panel.querySelector('button');
    const status = document.querySelector('#catalogue-search-status');
    const empty = document.querySelector('#catalogue-search-empty');
    const groups = [...document.querySelectorAll('.catalogue-group')];
    const normalize = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').replace(/[’']/g, ' ').trim();
    const entries = groups.map(group => ({
      group,
      rows: [...group.querySelectorAll('tbody tr')].map(row => ({row, text: normalize(row.querySelector('th').textContent)})),
      originalOpen: group.open,
    }));
    let wasFiltering = false;
    const total = entries.reduce((sum, entry) => sum + entry.rows.length, 0);
    function filter() {
      const terms = normalize(input.value).split(/\s+/).filter(Boolean);
      const filtering = terms.length > 0;
      let count = 0;
      entries.forEach(entry => {
        if (filtering && !wasFiltering) entry.originalOpen = entry.group.open;
        let matches = 0;
        entry.rows.forEach(({row, text}) => {
          const show = terms.every(term => text.includes(term));
          row.hidden = !show;
          if (show) matches++;
        });
        count += matches;
        entry.group.hidden = matches === 0;
        if (filtering) entry.group.open = matches > 0;
        else if (wasFiltering) entry.group.open = entry.originalOpen;
      });
      clear.hidden = input.value.length === 0;
      empty.hidden = count !== 0;
      status.textContent = filtering
        ? `${count} prestation${count === 1 ? '' : 's'} trouvée${count === 1 ? '' : 's'} sur ${total}.`
        : `${total} prestations à découvrir dans les quatre rubriques.`;
      wasFiltering = filtering;
    }
    input.addEventListener('input', filter);
    input.addEventListener('keydown', event => {
      if (event.key === 'Escape' && input.value) {
        input.value = '';
        filter();
        event.preventDefault();
      }
    });
    clear.addEventListener('click', () => {
      input.value = '';
      filter();
      input.focus();
    });
    panel.hidden = false;
    status.hidden = false;
    filter();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSearch, {once:true});
  else initSearch();
})();
