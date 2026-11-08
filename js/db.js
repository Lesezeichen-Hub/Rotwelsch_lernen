import { createProfile, mergeProfiles } from './storage.js';

let database;
let channel;
export async function openDatabase(scope = new URL('./', document.baseURI).pathname) {
  database = await new Promise((resolve, reject) => {
    const request = indexedDB.open(`rotwelsch-lernen:${scope}`, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('profiles', { keyPath: 'id' });
      request.result.createObjectStore('meta');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Bitte andere Rotwelsch-Tabs schließen, damit die Datenbank aktualisiert werden kann.'));
  });
  database.onversionchange = () => { database.close(); window.dispatchEvent(new Event('database-closed')); };
  channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(`rotwelsch-lernen:${scope}`) : null;
  if (channel) channel.onmessage = () => window.dispatchEvent(new Event('profile-changed'));
  if (!(await allProfiles()).length) {
    const profile = createProfile();
    await transaction(['profiles', 'meta'], 'readwrite', stores => { stores.profiles.put(profile); stores.meta.put(profile.id, 'active'); });
  }
}

function transaction(names, mode, operation) {
  return new Promise((resolve, reject) => {
    if (!database) { reject(new Error('Lernspeicher nicht geöffnet.')); return; }
    const current = database.transaction(names, mode);
    const stores = Object.fromEntries(names.map(name => [name, current.objectStore(name)]));
    let value;
    let failure;
    current.oncomplete = () => { if (mode === 'readwrite') channel?.postMessage('changed'); resolve(value); };
    current.onabort = current.onerror = () => reject(failure || current.error || new Error('Lernspeicher konnte nicht geschrieben werden.'));
    try { operation(stores, result => { value = result; }, error => { failure = error; current.abort(); }); }
    catch (error) { failure = error; current.abort(); }
  });
}

export const allProfiles = () => transaction(['profiles'], 'readonly', (stores, done) => { stores.profiles.getAll().onsuccess = event => done(event.target.result); });
export const getProfile = id => transaction(['profiles'], 'readonly', (stores, done) => { stores.profiles.get(id).onsuccess = event => done(event.target.result); });
export const activeId = () => transaction(['meta'], 'readonly', (stores, done) => { stores.meta.get('active').onsuccess = event => done(event.target.result); });
export const selectProfile = id => transaction(['meta'], 'readwrite', stores => { stores.meta.put(id, 'active'); });
export const addProfile = profile => transaction(['profiles'], 'readwrite', stores => { stores.profiles.add(profile); });

export function mutateProfile(id, update) {
  return transaction(['profiles'], 'readwrite', (stores, done, fail) => {
    stores.profiles.get(id).onsuccess = event => {
      try {
        const profile = event.target.result;
        if (!profile) throw new Error('Lernplatz nicht mehr vorhanden.');
        update(profile);
        profile.revision++;
        profile.updatedAt = new Date().toISOString();
        stores.profiles.put(profile);
        done(profile);
      } catch (error) { fail(error); }
    };
  });
}

export function importProfiles(profiles, merge, active) {
  return transaction(['profiles', 'meta'], 'readwrite', (stores, done, fail) => {
    stores.profiles.getAll().onsuccess = event => {
      try {
        const result = merge ? mergeProfiles(event.target.result, profiles) : profiles;
        if (result.length > 50) throw new Error('Maximal 50 Lernplätze sind möglich.');
        stores.profiles.clear();
        for (const profile of result) stores.profiles.put({ ...profile, revision: (profile.revision || 0) + 1 });
        const selected = result.some(profile => profile.id === active) ? active : result[0].id;
        stores.meta.put(selected, 'active');
        done(selected);
      } catch (error) { fail(error); }
    };
  });
}

export function removeProfile(id) {
  return transaction(['profiles', 'meta'], 'readwrite', (stores, done, fail) => {
    stores.profiles.getAll().onsuccess = event => {
      const rest = event.target.result.filter(profile => profile.id !== id);
      if (!rest.length) { fail(new Error('Der letzte Lernplatz kann nicht gelöscht werden.')); return; }
      stores.profiles.delete(id);
      stores.meta.put(rest[0].id, 'active');
      done(rest[0].id);
    };
  });
}