import { getSettings, onSettingsChanged, setMode } from '../shared/settings.js';

const form = document.getElementById('mode-form');
const warning = document.getElementById('sync-warning');

function applyMode(mode) {
  const input = form.querySelector(`input[value="${mode}"]`);
  if (input) input.checked = true;
}

form.addEventListener('change', async (event) => {
  if (event.target.name !== 'mode') return;
  const { store } = await setMode(event.target.value);
  // Deliberately sticky rather than a timed auto-dismiss: while sync stays
  // unavailable the user's choice keeps landing in local storage only, and
  // that's worth surfacing until a write actually reaches sync again.
  warning.hidden = store !== 'local';
});

onSettingsChanged((settings) => applyMode(settings.mode));

getSettings().then((settings) => applyMode(settings.mode));
