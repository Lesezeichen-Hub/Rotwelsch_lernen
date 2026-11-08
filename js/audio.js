export function localVoices() {
  return 'speechSynthesis' in window ? speechSynthesis.getVoices().filter(voice => voice.localService && /^de(-|_)/i.test(voice.lang)) : [];
}

export function speak(text, voiceURI) {
  const voices = localVoices();
  const voice = voices.find(item => item.voiceURI === voiceURI) || voices[0];
  if (!voice) throw new Error('Keine lokale deutsche Vorlesestimme verfügbar. Die Lernfunktionen bleiben nutzbar.');
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = voice.lang;
  utterance.voice = voice;
  utterance.rate = 0.85;
  speechSynthesis.speak(utterance);
}

export function stopSpeech() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}