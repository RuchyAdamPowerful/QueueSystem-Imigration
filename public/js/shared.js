window.QMS = (function () {
  const CATEGORIES = {
    A: { code: 'A', name: 'Permohonan Paspor Baru' },
    B: { code: 'B', name: 'Penggantian Paspor' },
    C: { code: 'C', name: 'Pengambilan Paspor' }
  };
  const LOKET_COUNT = 2;

  // Nama tampilan untuk tiap nomor loket. Loket yang tidak didaftarkan di
  // sini akan otomatis memakai label default "Loket <nomor>".
  const LOKET_NAMES = {};

  function loketLabel(loketNum) {
    return LOKET_NAMES[loketNum] || `Loket ${loketNum}`;
  }

  function spellNumber(number) {
    const [letter, digits] = number.split('-');
    return digits ? `${letter}, ${digits.split('').join(' ')}` : letter;
  }

  function findIndonesianVoice() {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    const indonesianVoices = voices.filter(voice =>
      voice.lang && voice.lang.toLowerCase().startsWith('id')
    );
    return indonesianVoices.sort((first, second) => {
      const firstName = first.name.toLowerCase();
      const secondName = second.name.toLowerCase();
      const firstScore = (first.localService ? 2 : 0) + (/google|microsoft|natural/.test(firstName) ? 1 : 0);
      const secondScore = (second.localService ? 2 : 0) + (/google|microsoft|natural/.test(secondName) ? 1 : 0);
      return secondScore - firstScore;
    })[0] || null;
  }

  function warmUpVoices() {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener('voiceschanged', findIndonesianVoice, { once: true });
  }

  function speak(text) {
    try {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'id-ID';
      utter.rate = 0.88;
      utter.pitch = 1.02;
      utter.volume = 1;
      const idVoice = findIndonesianVoice();
      if (idVoice) utter.voice = idVoice;
      window.speechSynthesis.speak(utter);
    } catch (e) { /* speech synthesis tidak tersedia di perangkat ini */ }
  }

  function connectSocket() {
    // io() disediakan otomatis oleh /socket.io/socket.io.js
    return io();
  }

  return { CATEGORIES, LOKET_COUNT, LOKET_NAMES, loketLabel, spellNumber, speak, warmUpVoices, connectSocket };
})();
