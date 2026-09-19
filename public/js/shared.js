window.QMS = (function () {
  const CATEGORIES = {
    A: { code: 'A', name: 'Permohonan Paspor Baru' },
    B: { code: 'B', name: 'Penggantian Paspor' },
    C: { code: 'C', name: 'Pengambilan Paspor' }
  };
  const LOKET_COUNT = 4;

  // Nama tampilan untuk tiap nomor loket. Loket yang tidak didaftarkan di
  // sini akan otomatis memakai label default "Loket <nomor>".
  const LOKET_NAMES = {
    4: 'INTELDAKIM'
  };

  function loketLabel(loketNum) {
    return LOKET_NAMES[loketNum] || `Loket ${loketNum}`;
  }

  function spellNumber(number) {
    const [letter, digits] = number.split('-');
    return digits ? `${letter}, ${digits.split('').join(' ')}` : letter;
  }

  function warmUpVoices() {
    if ('speechSynthesis' in window) window.speechSynthesis.getVoices();
  }

  function speak(text) {
    try {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'id-ID';
      utter.rate = 0.92;
      const voices = window.speechSynthesis.getVoices();
      const idVoice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith('id'));
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
