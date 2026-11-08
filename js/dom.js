import { createElement, BookOpen, GraduationCap, LibraryBig, FileText, Puzzle, ChartNoAxesColumnIncreasing, Settings, ArrowRight, ArrowLeft, RotateCcw, Star, Plus, Check, X, Search, Volume2, Download, Upload, Printer, Moon, Sun, CircleHelp, Pause, Play, Trash2, ShieldCheck, WifiOff, RefreshCw, ChevronRight, Layers, ExternalLink, Timer, StopCircle } from 'lucide';

const icons = { BookOpen, GraduationCap, LibraryBig, FileText, Puzzle, ChartNoAxesColumnIncreasing, Settings, ArrowRight, ArrowLeft, RotateCcw, Star, Plus, Check, X, Search, Volume2, Download, Upload, Printer, Moon, Sun, CircleHelp, Pause, Play, Trash2, ShieldCheck, WifiOff, RefreshCw, ChevronRight, Layers, ExternalLink, Timer, StopCircle };

export function icon(name) {
  const element = createElement(icons[name] || CircleHelp);
  element.classList.add('icon');
  element.setAttribute('aria-hidden', 'true');
  return element;
}

export function h(tag, attrs = {}, ...children) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (name === 'class') element.className = value;
    else if (name.startsWith('on')) element.addEventListener(name.slice(2).toLowerCase(), value);
    else if (name === 'value' || name === 'checked' || name === 'disabled') element[name] = value;
    else element.setAttribute(name, value === true ? '' : String(value));
  }
  element.append(...children.flat(Infinity).filter(child => child !== null && child !== undefined && child !== false).map(child => child instanceof Node ? child : document.createTextNode(String(child))));
  return element;
}

export function notify(message, error = false) {
  const region = document.querySelector('#notification');
  region.textContent = message;
  region.className = error ? 'notification error' : 'notification';
  region.hidden = false;
}

export function guarded(action) {
  return async event => {
    const button = event?.currentTarget;
    if (button?.disabled) return;
    if (button?.tagName === 'BUTTON') button.disabled = true;
    try { await action(event); }
    catch (error) { notify(error.name === 'QuotaExceededError' ? 'Speicher voll. Bitte eine Sicherung exportieren und freien Speicher schaffen.' : error.message, true); }
    finally { if (button?.tagName === 'BUTTON') button.disabled = false; }
  };
}

export function button(label, name, action, attrs = {}) {
  return h('button', { type: 'button', ...attrs, onclick: guarded(action) }, name && icon(name), label);
}

export function tool(label, name, action, attrs = {}) {
  return button('', name, action, { ...attrs, 'aria-label': label, title: label, class: `icon-button ${attrs.class || ''}` });
}

export function link(label, href, attrs = {}) {
  return h('a', { href, ...attrs }, label);
}

export function external(label, url) {
  if (!/^https:\/\//.test(url || '')) return h('span', {}, label);
  return h('a', { href: url, target: '_blank', rel: 'noopener noreferrer', class: 'external' }, label, icon('ExternalLink'));
}

export function select(label, options, value, onchange, attrs = {}) {
  return h('label', { class: 'field' }, h('span', {}, label), h('select', { ...attrs, value, onchange }, options.map(option => h('option', { value: option.value, selected: option.value === value }, option.label))));
}

export function modal(title, ...children) {
  document.querySelector('dialog')?.close();
  document.querySelector('dialog')?.remove();
  const heading = h('h2', { id: 'dialog-title' }, title);
  const dialog = h('dialog', { 'aria-labelledby': 'dialog-title' }, h('div', { class: 'dialog-heading' }, heading, tool('Schließen', 'X', () => dialog.close())), ...children);
  document.body.append(dialog);
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  dialog.showModal();
  return dialog;
}

export function download(filename, content, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = h('a', { href: url, download: filename });
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const selected = Math.floor(Math.random() * (index + 1));
    [result[index], result[selected]] = [result[selected], result[index]];
  }
  return result;
}