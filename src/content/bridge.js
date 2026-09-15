// ISOLATED world entry. Runs alongside the page's DOM but in its own JS
// realm, with access to chrome.* APIs the MAIN-world hook cannot reach.
import { MODE_ATTR, READY_ATTR } from '../shared/constants.js';
import { getSettings, onSettingsChanged } from '../shared/settings.js';

console.debug('[Snapfit] bridge loaded (ISOLATED world)');

// At document_start, document.documentElement may not exist yet.
function whenDocumentElement() {
  if (document.documentElement) return Promise.resolve();
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      if (document.documentElement) {
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(document, { childList: true });
  });
}

async function publish() {
  const { mode } = await getSettings();
  await whenDocumentElement();
  document.documentElement.setAttribute(MODE_ATTR, mode);
  document.documentElement.setAttribute(READY_ATTR, '1');
}

publish();
onSettingsChanged(publish);
