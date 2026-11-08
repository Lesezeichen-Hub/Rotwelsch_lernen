try {
  const scope = new URL('./', document.baseURI).pathname;
  document.documentElement.dataset.theme = localStorage.getItem(`rotwelsch-theme:${scope}`) || 'light';
} catch { document.documentElement.dataset.theme = 'light'; }