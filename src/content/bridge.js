// ISOLATED world entry. Runs alongside the page's DOM but in its own JS
// realm, with access to chrome.* APIs the MAIN-world hook cannot reach.
console.debug('[Snapfit] bridge loaded (ISOLATED world)');
