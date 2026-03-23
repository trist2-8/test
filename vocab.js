document.addEventListener('DOMContentLoaded', () => {
  const views = document.querySelectorAll('.view');
  const navBtns = document.querySelectorAll('.nav-btn');

  function showView(viewIdToShow) {
    views.forEach(view => view.classList.add('hidden'));
    navBtns.forEach(btn => btn.classList.remove('active'));
    document.getElementById(viewIdToShow).classList.remove('hidden');

    if(viewIdToShow === 'main-view') document.getElementById('navMainBtn').classList.add('active');
    if(viewIdToShow === 'management-view') document.getElementById('navManagementBtn').classList.add('active');
    if(viewIdToShow === 'review-dashboard-view') document.getElementById('navReviewBtn').classList.add('active');
  }

  // Navigation
  document.getElementById('navMainBtn').onclick = () => { showView('main-view'); initMainView(); };
  document.getElementById('navManagementBtn').onclick = () => { showView('management-view'); initManagementView(); };
  document.getElementById('navReviewBtn').onclick = () => { showView('review-dashboard-view'); initReviewView(); };
  document.querySelectorAll('.exit-game-btn').forEach(btn => btn.onclick = () => { 
      // Stop speech if exiting dictation
      window.speechSynthesis.cancel();
      showView('review-dashboard-view'); 
  });

  initMainView(); 

  function showToast(message) {
    const toast = document.getElementById('toastNotification');
    toast.textContent = message;
    toast.classList.remove('hidden', 'show');
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.classList.add('hidden'), 300); }, 3000);
  }

  function getUniqueWordsets(vocab) { return Array.from(new Set(vocab.map(w => w.wordset).filter(Boolean))); }

  // --- 1. MAIN ADD WORDS VIEW (Kept intact from previous fix) ---
  function initMainView() {
    const dropdown = document.getElementById('wordsetDropdown');
    chrome.storage.local.get({ vocab: [] }, (result) => {
      dropdown.innerHTML = '';
      const uniqueSets = getUniqueWordsets(result.vocab);
      if (uniqueSets.length === 0) dropdown.innerHTML = '<option value="Chưa phân loại">Chưa phân loại</option>';
      else uniqueSets.forEach(set => dropdown.innerHTML += `<option value="${set}">${set}</option>`);
    });

    document.getElementById('addSetBtn').onclick = () => {
      const newSetName = prompt("Nhập tên bộ từ mới:");
      if(newSetName && newSetName.trim() !== "") { dropdown.innerHTML += `<option value="${newSetName}" selected>${newSetName}</option>`; showToast(`Đã tạo bộ: ${newSetName}`); }
    };

    document.querySelector('.dropdown-toggle').onclick = (e) => { e.stopPropagation(); document.querySelector('.dropdown-menu').classList.toggle('hidden'); };
    document.onclick = () => document.querySelector('.dropdown-menu').classList.add('hidden');
    
    document.getElementById('importCsvBtn').onclick = () => document.getElementById('fileInputCsv').click();
    document.getElementById('fileInputCsv').onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => { processImport(e.target.result, ','); };
      reader.readAsText(file);
    };

    setupModal('tutorialBtn', 'tutorialModal'); setupModal('quickAddBtn', 'quickAddModal');

    document.getElementById('saveQuickWordBtn').onclick = () => {
      const word = document.getElementById('quickWord').value.trim(); const meaning = document.getElementById('quickMeaning').value.trim();
      if(!word || !meaning) return showToast('Vui lòng nhập đủ từ và nghĩa!');
      const wordset = document.getElementById('wordsetDropdown').value;
      chrome.storage.local.get({ vocab: [] }, (result) => {
        const newWord = { word, phonetic: '', wordType: '', meaning, example: '', notes: '', wordset, isLearned: false, id: Date.now() };
        chrome.storage.local.set({ vocab: [...result.vocab, newWord] }, () => { showToast('Đã thêm thành công!'); document.getElementById('quickWord').value = ''; document.getElementById('quickMeaning').value = ''; });
      });
    };

    document.getElementById('previewBtn').onclick = () => {
      const text = document.getElementById('bulkInput').value.trim();
      processImport(text, text.includes('\t') ? '\t' : '|');
    };
  }

  function setupModal(btnId, modalId) {
    const modal = document.getElementById(modalId);
    document.getElementById(btnId).onclick = () => modal.classList.remove('hidden');
    modal.querySelector('.close-modal').onclick = () => modal.classList.add('hidden');
    modal.onclick = (e) => { if(e.target === modal) modal.classList.add('hidden'); };
  }

  let currentParsedWords = [];
  function processImport(text, separator) {
    currentParsedWords = text.split('\n').map(line => line.trim()).filter(line => line.includes(separator)).map(line => {
        const p = line.split(separator).map(x => x.trim());
        if (p.length === 2) return { word: p[0]||'', phonetic: '', wordType: '', meaning: p[1]||'', example: '', notes: '' };
        return { word: p[0] || '', phonetic: p[1] || '', wordType: p[2] || '', meaning: p[3] || '', example: p[4] || '', notes: p[5] || '' };
      }).filter(w => w.word !== '');
    if (currentParsedWords.length === 0) return showToast('Không tìm thấy từ vựng hợp lệ!');
    renderPreviewTable(currentParsedWords, 'previewTableContainer');
    document.getElementById('input-view').classList.add('hidden'); document.getElementById('preview-view').classList.remove('hidden');
    document.getElementById('saveWordsBtn').textContent = `Lưu ${currentParsedWords.length} từ`;
  }

  document.getElementById('cancelPreviewBtn').onclick = () => { document.getElementById('preview-view').classList.add('hidden'); document.getElementById('input-view').classList.remove('hidden'); };

  document.getElementById('saveWordsBtn').onclick = () => {
    const editedWords = collectEditedWordsFromTable('previewTableContainer'); const wordset = document.getElementById('wordsetDropdown').value;
    chrome.storage.local.get({ vocab: [] }, (result) => {
      editedWords.forEach(w => { w.wordset = wordset; w.isLearned = false; w.id = Date.now() + Math.random(); });
      chrome.storage.local.set({ vocab: result.vocab.concat(editedWords) }, () => {
        showToast(`Đã lưu ${editedWords.length} từ!`); document.getElementById('bulkInput').value = '';
        document.getElementById('preview-view').classList.add('hidden'); document.getElementById('input-view').classList.remove('hidden');
      });
    });
  };

  function renderPreviewTable(words, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = `<table id="wordsTable_${containerId}" class="data-table"><thead><tr><th>#</th><th>TỪ VỰNG</th><th>PHIÊN ÂM</th><th>LOẠI TỪ</th><th>NGHĨA</th><th>VÍ DỤ</th><th>GHI CHÚ</th><th>XÓA</th></tr></thead><tbody></tbody></table>`;
    const tbody = container.querySelector('tbody');
    words.forEach((item, i) => {
      const row = tbody.insertRow();
      row.innerHTML = `<td>${i+1}</td><td><input type="text" value="${item.word || ''}" class="table-input"></td><td><input type="text" value="${item.phonetic || ''}" class="table-input"></td><td><input type="text" value="${item.wordType || ''}" class="table-input"></td><td><input type="text" value="${item.meaning || ''}" class="table-input"></td><td><input type="text" value="${item.example || ''}" class="table-input"></td><td><input type="text" value="${item.notes || ''}" class="table-input"></td><td><button class="delete-row-btn secondary-btn" data-index="${i}">🗑️</button></td>`;
    });
    container.querySelectorAll('.delete-row-btn').forEach(btn => btn.onclick = (e) => { words.splice(parseInt(e.target.dataset.index), 1); renderPreviewTable(words, containerId); });
  }

  function collectEditedWordsFromTable(containerId) {
    const edited = [];
    document.querySelectorAll(`#wordsTable_${containerId} tbody tr`).forEach(row => {
      const inputs = row.querySelectorAll('input');
      if (inputs[0].value.trim()) { edited.push({ word: inputs[0].value.trim(), phonetic: inputs[1].value.trim(), wordType: inputs[2].value.trim(), meaning: inputs[3].value.trim(), example: inputs[4].value.trim(), notes: inputs[5].value.trim() }); }
    });
    return edited;
  }

  // --- 2. MANAGEMENT VIEW (Kept intact) ---
  function initManagementView() { chrome.storage.local.get({ vocab: [] }, (result) => renderWordsetsGrid(result.vocab)); }
  function renderWordsetsGrid(vocab) {
    const grid = document.getElementById('wordsetGrid');
    grid.innerHTML = `<div class="set-card create-new-card" id="gridCreateBtn"><div class="create-new-content"><span class="create-icon">+</span><h2>Tạo bộ từ mới</h2></div></div>`;
    document.getElementById('gridCreateBtn').onclick = () => { showView('main-view'); initMainView(); };

    const groupedSets = vocab.reduce((acc, word) => {
      if (!acc[word.wordset]) acc[word.wordset] = { total: 0, learned: 0 };
      acc[word.wordset].total++; if (word.isLearned) acc[word.wordset].learned++; return acc;
    }, {});

    for (const [setName, counts] of Object.entries(groupedSets)) {
      const pct = counts.total > 0 ? (counts.learned / counts.total * 100).toFixed(0) : 0;
      const card = document.createElement('div'); card.className = 'set-card';
      card.innerHTML = `<div class="card-header"><div class="card-title-icon-wrapper"><span class="set-icon">🏷️</span><span class="set-title">${setName}</span></div></div>
        <div class="card-details"><span class="word-count">≡ ${counts.total} từ</span><div class="progress-bar-container"><div class="progress-bar" style="width: ${pct}%"></div></div><span class="learned-count">${counts.learned}/${counts.total} đã thuộc</span></div>
        <div class="card-action-bar"><button class="card-btn btn-view">Xem / Sửa</button><button class="card-btn btn-delete">Xóa Bộ Từ</button></div>`;
      grid.appendChild(card);
      card.querySelector('.btn-view').onclick = () => openSetDetails(setName);
      card.querySelector('.btn-delete').onclick = () => { if(confirm(`Xóa toàn bộ "${setName}"?`)) { chrome.storage.local.set({ vocab: vocab.filter(w => w.wordset !== setName) }, initManagementView); } };
    }
  }

  function openSetDetails(setName) {
    showView('set-details-view'); document.getElementById('detailsSetName').textContent = setName;
    chrome.storage.local.get({ vocab: [] }, (result) => {
      renderPreviewTable(result.vocab.filter(w => w.wordset === setName), 'setDetailsTableContainer');
      document.getElementById('backToManagementBtn').onclick = () => {
        const updatedWords = collectEditedWordsFromTable('setDetailsTableContainer'); updatedWords.forEach(w => w.wordset = setName); 
        const otherWords = result.vocab.filter(w => w.wordset !== setName);
        chrome.storage.local.set({ vocab: otherWords.concat(updatedWords) }, () => { showView('management-view'); initManagementView(); showToast('Đã lưu thay đổi!'); });
      };
    });
  }

  // --- 3. GAMES HUB & LOGIC ---
  function initReviewView() {
    chrome.storage.local.get({ vocab: [] }, (result) => {
      const dropdown = document.getElementById('reviewSetDropdown');
      dropdown.innerHTML = '<option value="all">Tất cả bộ từ</option>';
      getUniqueWordsets(result.vocab).forEach(set => dropdown.innerHTML += `<option value="${set}">${set}</option>`);
    });

    document.querySelectorAll('.vibrant-card').forEach(card => {
      card.onclick = (e) => {
        const game = e.currentTarget.getAttribute('data-game');
        const setName = document.getElementById('reviewSetDropdown').value;
        startGame(game, setName);
      };
    });
  }

  let studyQueue = [];
  let currentCardIdx = 0;

  function startGame(gameType, setName) {
    chrome.storage.local.get({ vocab: [] }, (result) => {
      studyQueue = setName === 'all' ? result.vocab : result.vocab.filter(w => w.wordset === setName);
      if (studyQueue.length === 0) return showToast('Bộ từ này trống!');
      if (gameType === 'quiz' && studyQueue.length < 4) return showToast('Trắc nghiệm cần ít nhất 4 từ trong bộ!');
      if (gameType === 'matching' && studyQueue.length < 4) return showToast('Nối từ cần ít nhất 4 từ trong bộ!');
      
      if (gameType === 'srs') return showToast('Tính năng tổng hợp đang phát triển!');

      studyQueue.sort(() => Math.random() - 0.5);
      currentCardIdx = 0;

      if (gameType === 'flashcard') { showView('study-mode-view'); renderFlashcard(); } 
      else if (gameType === 'quiz') { showView('quiz-mode-view'); renderQuiz(); }
      else if (gameType === 'typing') { showView('typing-mode-view'); renderTyping(); }
      else if (gameType === 'dictation') { showView('dictation-mode-view'); renderDictation(); }
      else if (gameType === 'matching') { showView('matching-mode-view'); renderMatching(); }
    });
  }

  // GAME: FLASHCARD
  function renderFlashcard() {
    if (currentCardIdx >= studyQueue.length) { showToast('Đã ôn xong!'); return showView('review-dashboard-view'); }
    const card = studyQueue[currentCardIdx];
    document.getElementById('studyProgress').textContent = `${currentCardIdx + 1} / ${studyQueue.length}`;
    document.getElementById('fcWord').textContent = card.word;
    document.getElementById('fcPhonetic').textContent = card.phonetic ? card.phonetic : '';
    document.getElementById('fcMeaning').textContent = card.meaning;
    document.getElementById('fcType').textContent = card.wordType ? `(${card.wordType})` : '';
    document.getElementById('fcExample').textContent = card.example ? card.example : '';
    document.getElementById('activeFlashcard').classList.remove('flipped');
  }
  document.getElementById('activeFlashcard').onclick = function() { this.classList.toggle('flipped'); };
  document.getElementById('btnLearned').onclick = () => { currentCardIdx++; renderFlashcard(); };
  document.getElementById('btnNotLearned').onclick = () => { currentCardIdx++; renderFlashcard(); };

  // GAME: QUIZ
  function renderQuiz() {
    if (currentCardIdx >= studyQueue.length) { showToast('Đã hoàn thành!'); return showView('review-dashboard-view'); }
    const correctCard = studyQueue[currentCardIdx];
    document.getElementById('quizProgress').textContent = `${currentCardIdx + 1} / ${studyQueue.length}`;
    document.getElementById('quizQuestionWord').textContent = correctCard.word;

    const wrongOptions = studyQueue.filter(w => w.word !== correctCard.word).sort(() => Math.random() - 0.5).slice(0, 3);
    const options = [correctCard, ...wrongOptions].sort(() => Math.random() - 0.5);
    const grid = document.getElementById('quizOptionsGrid'); grid.innerHTML = '';
    
    options.forEach(opt => {
      const btn = document.createElement('button'); btn.className = 'quiz-option-btn'; btn.textContent = opt.meaning;
      btn.onclick = () => {
        if (opt.word === correctCard.word) { btn.classList.add('correct'); setTimeout(() => { currentCardIdx++; renderQuiz(); }, 800); } 
        else { btn.classList.add('wrong'); setTimeout(() => btn.classList.remove('wrong'), 800); }
      };
      grid.appendChild(btn);
    });
  }

  // GAME: TYPING
  function renderTyping() {
      if (currentCardIdx >= studyQueue.length) { showToast('Đã hoàn thành gõ từ!'); return showView('review-dashboard-view'); }
      const card = studyQueue[currentCardIdx];
      document.getElementById('typingProgress').textContent = `${currentCardIdx + 1} / ${studyQueue.length}`;
      document.getElementById('typingQuestionMeaning').textContent = card.meaning;
      const inputField = document.getElementById('typingInput');
      inputField.value = '';
      inputField.focus();

      document.getElementById('typingSubmitBtn').onclick = () => {
          const answer = inputField.value.trim().toLowerCase();
          if (answer === card.word.toLowerCase()) {
              showToast('✅ Chính xác!');
              currentCardIdx++;
              setTimeout(renderTyping, 500);
          } else {
              showToast('❌ Sai rồi! Thử lại nhé.');
              inputField.classList.add('shake-error');
              setTimeout(() => inputField.classList.remove('shake-error'), 400);
          }
      };

      inputField.onkeypress = (e) => { if (e.key === 'Enter') document.getElementById('typingSubmitBtn').click(); };
  }

  // GAME: DICTATION
  function playWordAudio(wordText) {
      if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel(); // stop current
          const utterance = new SpeechSynthesisUtterance(wordText);
          utterance.lang = 'en-US'; // Defaulting to English
          utterance.rate = 0.85; // Slightly slower for dictation
          window.speechSynthesis.speak(utterance);
      } else {
          showToast('Trình duyệt của bạn không hỗ trợ đọc âm thanh.');
      }
  }

  function renderDictation() {
      if (currentCardIdx >= studyQueue.length) { showToast('Đã hoàn thành bài nghe!'); return showView('review-dashboard-view'); }
      const card = studyQueue[currentCardIdx];
      document.getElementById('dictationProgress').textContent = `${currentCardIdx + 1} / ${studyQueue.length}`;
      const inputField = document.getElementById('dictationInput');
      inputField.value = '';
      inputField.focus();

      // Play audio automatically on card load
      playWordAudio(card.word);

      document.getElementById('playAudioBtn').onclick = () => playWordAudio(card.word);

      document.getElementById('dictationSubmitBtn').onclick = () => {
          const answer = inputField.value.trim().toLowerCase();
          if (answer === card.word.toLowerCase()) {
              showToast('✅ Chính xác!');
              currentCardIdx++;
              setTimeout(renderDictation, 1000);
          } else {
              showToast('❌ Sai rồi, hãy nghe lại kỹ nhé!');
              inputField.classList.add('shake-error');
              setTimeout(() => inputField.classList.remove('shake-error'), 400);
          }
      };
      inputField.onkeypress = (e) => { if (e.key === 'Enter') document.getElementById('dictationSubmitBtn').click(); };
  }

  // GAME: MATCHING (Click to connect)
  let matchingSelection = null;
  let matchingPairsSolved = 0;
  
  function renderMatching() {
      document.getElementById('matchingProgress').textContent = `Mức độ: Vừa`;
      const grid = document.getElementById('matchingGrid');
      grid.innerHTML = '';
      matchingSelection = null;
      matchingPairsSolved = 0;

      // Take 6 random words for a 12-card grid
      const batch = studyQueue.sort(() => Math.random() - 0.5).slice(0, 6);
      let cards = [];
      
      batch.forEach(item => {
          cards.push({ text: item.word, type: 'word', matchId: item.word });
          cards.push({ text: item.meaning, type: 'meaning', matchId: item.word });
      });
      cards.sort(() => Math.random() - 0.5); // Shuffle grid

      cards.forEach(card => {
          const btn = document.createElement('button');
          btn.className = 'match-card';
          btn.textContent = card.text;
          btn.dataset.type = card.type;
          btn.dataset.matchId = card.matchId;

          btn.onclick = () => {
              if (btn.classList.contains('solved') || btn.classList.contains('selected')) return;

              btn.classList.add('selected');

              if (!matchingSelection) {
                  matchingSelection = btn;
              } else {
                  // Check match
                  if (matchingSelection.dataset.matchId === btn.dataset.matchId && matchingSelection.dataset.type !== btn.dataset.type) {
                      // Correct match
                      btn.classList.replace('selected', 'solved');
                      matchingSelection.classList.replace('selected', 'solved');
                      matchingSelection = null;
                      matchingPairsSolved++;
                      if(matchingPairsSolved === 6) {
                          setTimeout(() => { showToast('Hoàn thành xuất sắc!'); renderMatching(); }, 1000); // Reload new batch
                      }
                  } else {
                      // Wrong match
                      btn.classList.replace('selected', 'wrong');
                      matchingSelection.classList.replace('selected', 'wrong');
                      const prevSelection = matchingSelection;
                      matchingSelection = null;
                      
                      setTimeout(() => {
                          btn.classList.remove('wrong', 'selected');
                          prevSelection.classList.remove('wrong', 'selected');
                      }, 500);
                  }
              }
          };
          grid.appendChild(btn);
      });
  }
});document.addEventListener('DOMContentLoaded', () => {
  const views = document.querySelectorAll('.view');
  const navBtns = document.querySelectorAll('.nav-btn');

  function showView(viewIdToShow) {
    views.forEach(view => view.classList.add('hidden'));
    navBtns.forEach(btn => btn.classList.remove('active'));
    document.getElementById(viewIdToShow).classList.remove('hidden');

    if(viewIdToShow === 'main-view') document.getElementById('navMainBtn').classList.add('active');
    if(viewIdToShow === 'management-view') document.getElementById('navManagementBtn').classList.add('active');
    if(viewIdToShow === 'review-dashboard-view') document.getElementById('navReviewBtn').classList.add('active');
  }

  // Navigation
  document.getElementById('navMainBtn').onclick = () => { showView('main-view'); initMainView(); };
  document.getElementById('navManagementBtn').onclick = () => { showView('management-view'); initManagementView(); };
  document.getElementById('navReviewBtn').onclick = () => { showView('review-dashboard-view'); initReviewView(); };
  document.querySelectorAll('.exit-game-btn').forEach(btn => btn.onclick = () => { 
      // Stop speech if exiting dictation
      if('speechSynthesis' in window) window.speechSynthesis.cancel();
      showView('review-dashboard-view'); 
  });

  initMainView(); 

  function showToast(message) {
    const toast = document.getElementById('toastNotification');
    toast.textContent = message;
    toast.classList.remove('hidden', 'show');
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.classList.add('hidden'), 300); }, 3000);
  }

  function getUniqueWordsets(vocab) { return Array.from(new Set(vocab.map(w => w.wordset).filter(Boolean))); }

  // --- 1. MAIN ADD WORDS VIEW ---
  function initMainView() {
    const dropdown = document.getElementById('wordsetDropdown');
    chrome.storage.local.get({ vocab: [] }, (result) => {
      dropdown.innerHTML = '';
      const uniqueSets = getUniqueWordsets(result.vocab);
      if (uniqueSets.length === 0) dropdown.innerHTML = '<option value="Chưa phân loại">Chưa phân loại</option>';
      else uniqueSets.forEach(set => dropdown.innerHTML += `<option value="${set}">${set}</option>`);
    });

    document.getElementById('addSetBtn').onclick = () => {
      const newSetName = prompt("Nhập tên bộ từ mới:");
      if(newSetName && newSetName.trim() !== "") { dropdown.innerHTML += `<option value="${newSetName}" selected>${newSetName}</option>`; showToast(`Đã tạo bộ: ${newSetName}`); }
    };

    document.querySelector('.dropdown-toggle').onclick = (e) => { e.stopPropagation(); document.querySelector('.dropdown-menu').classList.toggle('hidden'); };
    document.onclick = () => document.querySelector('.dropdown-menu').classList.add('hidden');
    
    document.getElementById('importCsvBtn').onclick = () => document.getElementById('fileInputCsv').click();
    document.getElementById('fileInputCsv').onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => { processImport(e.target.result, ','); };
      reader.readAsText(file);
    };

    // Setup Modals (Including the new Strategy Modal)
    setupModal('tutorialBtn', 'tutorialModal'); 
    setupModal('quickAddBtn', 'quickAddModal');
    setupModal('openStrategyBtn', 'strategyModal');

    document.getElementById('saveQuickWordBtn').onclick = () => {
      const word = document.getElementById('quickWord').value.trim(); const meaning = document.getElementById('quickMeaning').value.trim();
      if(!word || !meaning) return showToast('Vui lòng nhập đủ từ và nghĩa!');
      const wordset = document.getElementById('wordsetDropdown').value;
      chrome.storage.local.get({ vocab: [] }, (result) => {
        const newWord = { word, phonetic: '', wordType: '', meaning, example: '', notes: '', wordset, isLearned: false, id: Date.now() };
        chrome.storage.local.set({ vocab: [...result.vocab, newWord] }, () => { showToast('Đã thêm thành công!'); document.getElementById('quickWord').value = ''; document.getElementById('quickMeaning').value = ''; });
      });
    };

    document.getElementById('previewBtn').onclick = () => {
      const text = document.getElementById('bulkInput').value.trim();
      processImport(text, text.includes('\t') ? '\t' : '|');
    };
  }

  function setupModal(btnId, modalId) {
    const btn = document.getElementById(btnId);
    const modal = document.getElementById(modalId);
    if(btn && modal) {
      btn.onclick = () => modal.classList.remove('hidden');
      modal.querySelector('.close-modal').onclick = () => modal.classList.add('hidden');
      modal.onclick = (e) => { if(e.target === modal) modal.classList.add('hidden'); };
    }
  }

  let currentParsedWords = [];
  function processImport(text, separator) {
    currentParsedWords = text.split('\n').map(line => line.trim()).filter(line => line.includes(separator)).map(line => {
        const p = line.split(separator).map(x => x.trim());
        if (p.length === 2) return { word: p[0]||'', phonetic: '', wordType: '', meaning: p[1]||'', example: '', notes: '' };
        return { word: p[0] || '', phonetic: p[1] || '', wordType: p[2] || '', meaning: p[3] || '', example: p[4] || '', notes: p[5] || '' };
      }).filter(w => w.word !== '');
    if (currentParsedWords.length === 0) return showToast('Không tìm thấy từ vựng hợp lệ!');
    renderPreviewTable(currentParsedWords, 'previewTableContainer');
    document.getElementById('input-view').classList.add('hidden'); document.getElementById('preview-view').classList.remove('hidden');
    document.getElementById('saveWordsBtn').textContent = `Lưu ${currentParsedWords.length} từ`;
  }

  document.getElementById('cancelPreviewBtn').onclick = () => { document.getElementById('preview-view').classList.add('hidden'); document.getElementById('input-view').classList.remove('hidden'); };

  document.getElementById('saveWordsBtn').onclick = () => {
    const editedWords = collectEditedWordsFromTable('previewTableContainer'); const wordset = document.getElementById('wordsetDropdown').value;
    chrome.storage.local.get({ vocab: [] }, (result) => {
      editedWords.forEach(w => { w.wordset = wordset; w.isLearned = false; w.id = Date.now() + Math.random(); });
      chrome.storage.local.set({ vocab: result.vocab.concat(editedWords) }, () => {
        showToast(`Đã lưu ${editedWords.length} từ!`); document.getElementById('bulkInput').value = '';
        document.getElementById('preview-view').classList.add('hidden'); document.getElementById('input-view').classList.remove('hidden');
      });
    });
  };

  function renderPreviewTable(words, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = `<table id="wordsTable_${containerId}" class="data-table"><thead><tr><th>#</th><th>TỪ VỰNG</th><th>PHIÊN ÂM</th><th>LOẠI TỪ</th><th>NGHĨA</th><th>VÍ DỤ</th><th>GHI CHÚ</th><th>XÓA</th></tr></thead><tbody></tbody></table>`;
    const tbody = container.querySelector('tbody');
    words.forEach((item, i) => {
      const row = tbody.insertRow();
      row.innerHTML = `<td>${i+1}</td><td><input type="text" value="${item.word || ''}" class="table-input"></td><td><input type="text" value="${item.phonetic || ''}" class="table-input"></td><td><input type="text" value="${item.wordType || ''}" class="table-input"></td><td><input type="text" value="${item.meaning || ''}" class="table-input"></td><td><input type="text" value="${item.example || ''}" class="table-input"></td><td><input type="text" value="${item.notes || ''}" class="table-input"></td><td><button class="delete-row-btn secondary-btn" data-index="${i}">🗑️</button></td>`;
    });
    container.querySelectorAll('.delete-row-btn').forEach(btn => btn.onclick = (e) => { words.splice(parseInt(e.target.dataset.index), 1); renderPreviewTable(words, containerId); });
  }

  function collectEditedWordsFromTable(containerId) {
    const edited = [];
    document.querySelectorAll(`#wordsTable_${containerId} tbody tr`).forEach(row => {
      const inputs = row.querySelectorAll('input');
      if (inputs[0].value.trim()) { edited.push({ word: inputs[0].value.trim(), phonetic: inputs[1].value.trim(), wordType: inputs[2].value.trim(), meaning: inputs[3].value.trim(), example: inputs[4].value.trim(), notes: inputs[5].value.trim() }); }
    });
    return edited;
  }

  // --- 2. MANAGEMENT VIEW ---
  function initManagementView() { chrome.storage.local.get({ vocab: [] }, (result) => renderWordsetsGrid(result.vocab)); }
  
  function renderWordsetsGrid(vocab) {
    const grid = document.getElementById('wordsetGrid');
    grid.innerHTML = `<div class="set-card create-new-card" id="gridCreateBtn"><div class="create-new-content"><span class="create-icon">+</span><h2>Tạo bộ từ mới</h2></div></div>`;
    document.getElementById('gridCreateBtn').onclick = () => { showView('main-view'); initMainView(); };

    const groupedSets = vocab.reduce((acc, word) => {
      if (!acc[word.wordset]) acc[word.wordset] = { total: 0, learned: 0 };
      acc[word.wordset].total++; if (word.isLearned) acc[word.wordset].learned++; return acc;
    }, {});

    for (const [setName, counts] of Object.entries(groupedSets)) {
      const pct = counts.total > 0 ? (counts.learned / counts.total * 100).toFixed(0) : 0;
      const card = document.createElement('div'); card.className = 'set-card';
      card.innerHTML = `<div class="card-header"><div class="card-title-icon-wrapper"><span class="set-icon">🏷️</span><span class="set-title">${setName}</span></div></div>
        <div class="card-details"><span class="word-count">≡ ${counts.total} từ</span><div class="progress-bar-container"><div class="progress-bar" style="width: ${pct}%"></div></div><span class="learned-count">${counts.learned}/${counts.total} đã thuộc</span></div>
        <div class="card-action-bar"><button class="card-btn btn-view">Xem / Sửa</button><button class="card-btn btn-delete">Xóa Bộ Từ</button></div>`;
      grid.appendChild(card);
      card.querySelector('.btn-view').onclick = () => openSetDetails(setName);
      card.querySelector('.btn-delete').onclick = () => { if(confirm(`Xóa toàn bộ "${setName}"?`)) { chrome.storage.local.set({ vocab: vocab.filter(w => w.wordset !== setName) }, initManagementView); } };
    }
  }

  function openSetDetails(setName) {
    showView('set-details-view'); document.getElementById('detailsSetName').textContent = setName;
    chrome.storage.local.get({ vocab: [] }, (result) => {
      renderPreviewTable(result.vocab.filter(w => w.wordset === setName), 'setDetailsTableContainer');
      document.getElementById('backToManagementBtn').onclick = () => {
        const updatedWords = collectEditedWordsFromTable('setDetailsTableContainer'); updatedWords.forEach(w => w.wordset = setName); 
        const otherWords = result.vocab.filter(w => w.wordset !== setName);
        chrome.storage.local.set({ vocab: otherWords.concat(updatedWords) }, () => { showView('management-view'); initManagementView(); showToast('Đã lưu thay đổi!'); });
      };
    });
  }

  // --- 3. GAMES HUB & LOGIC ---
  function initReviewView() {
    chrome.storage.local.get({ vocab: [] }, (result) => {
      const dropdown = document.getElementById('reviewSetDropdown');
      dropdown.innerHTML = '<option value="all">Tất cả bộ từ</option>';
      getUniqueWordsets(result.vocab).forEach(set => dropdown.innerHTML += `<option value="${set}">${set}</option>`);
    });

    document.querySelectorAll('.vibrant-card').forEach(card => {
      card.onclick = (e) => {
        const game = e.currentTarget.getAttribute('data-game');
        const setName = document.getElementById('reviewSetDropdown').value;
        startGame(game, setName);
      };
    });
  }

  let studyQueue = [];
  let currentCardIdx = 0;

  function startGame(gameType, setName) {
    chrome.storage.local.get({ vocab: [] }, (result) => {
      studyQueue = setName === 'all' ? result.vocab : result.vocab.filter(w => w.wordset === setName);
      if (studyQueue.length === 0) return showToast('Bộ từ này trống!');
      if (gameType === 'quiz' && studyQueue.length < 4) return showToast('Trắc nghiệm cần ít nhất 4 từ trong bộ!');
      if (gameType === 'matching' && studyQueue.length < 4) return showToast('Nối từ cần ít nhất 4 từ trong bộ!');
      
      if (gameType === 'srs') return showToast('Tính năng tổng hợp đang phát triển!');

      studyQueue.sort(() => Math.random() - 0.5);
      currentCardIdx = 0;

      if (gameType === 'flashcard') { showView('study-mode-view'); renderFlashcard(); } 
      else if (gameType === 'quiz') { showView('quiz-mode-view'); renderQuiz(); }
      else if (gameType === 'typing') { showView('typing-mode-view'); renderTyping(); }
      else if (gameType === 'dictation') { showView('dictation-mode-view'); renderDictation(); }
      else if (gameType === 'matching') { showView('matching-mode-view'); renderMatching(); }
    });
  }

  // GAME: FLASHCARD
  function renderFlashcard() {
    if (currentCardIdx >= studyQueue.length) { showToast('Đã ôn xong!'); return showView('review-dashboard-view'); }
    const card = studyQueue[currentCardIdx];
    document.getElementById('studyProgress').textContent = `${currentCardIdx + 1} / ${studyQueue.length}`;
    document.getElementById('fcWord').textContent = card.word;
    document.getElementById('fcPhonetic').textContent = card.phonetic ? card.phonetic : '';
    document.getElementById('fcMeaning').textContent = card.meaning;
    document.getElementById('fcType').textContent = card.wordType ? `(${card.wordType})` : '';
    document.getElementById('fcExample').textContent = card.example ? card.example : '';
    document.getElementById('activeFlashcard').classList.remove('flipped');
  }
  document.getElementById('activeFlashcard').onclick = function() { this.classList.toggle('flipped'); };
  document.getElementById('btnLearned').onclick = () => { currentCardIdx++; renderFlashcard(); };
  document.getElementById('btnNotLearned').onclick = () => { currentCardIdx++; renderFlashcard(); };

  // GAME: QUIZ
  function renderQuiz() {
    if (currentCardIdx >= studyQueue.length) { showToast('Đã hoàn thành!'); return showView('review-dashboard-view'); }
    const correctCard = studyQueue[currentCardIdx];
    document.getElementById('quizProgress').textContent = `${currentCardIdx + 1} / ${studyQueue.length}`;
    document.getElementById('quizQuestionWord').textContent = correctCard.word;

    const wrongOptions = studyQueue.filter(w => w.word !== correctCard.word).sort(() => Math.random() - 0.5).slice(0, 3);
    const options = [correctCard, ...wrongOptions].sort(() => Math.random() - 0.5);
    const grid = document.getElementById('quizOptionsGrid'); grid.innerHTML = '';
    
    options.forEach(opt => {
      const btn = document.createElement('button'); btn.className = 'quiz-option-btn'; btn.textContent = opt.meaning;
      btn.onclick = () => {
        if (opt.word === correctCard.word) { btn.classList.add('correct'); setTimeout(() => { currentCardIdx++; renderQuiz(); }, 800); } 
        else { btn.classList.add('wrong'); setTimeout(() => btn.classList.remove('wrong'), 800); }
      };
      grid.appendChild(btn);
    });
  }

  // GAME: TYPING
  function renderTyping() {
      if (currentCardIdx >= studyQueue.length) { showToast('Đã hoàn thành gõ từ!'); return showView('review-dashboard-view'); }
      const card = studyQueue[currentCardIdx];
      document.getElementById('typingProgress').textContent = `${currentCardIdx + 1} / ${studyQueue.length}`;
      document.getElementById('typingQuestionMeaning').textContent = card.meaning;
      const inputField = document.getElementById('typingInput');
      inputField.value = '';
      inputField.focus();

      document.getElementById('typingSubmitBtn').onclick = () => {
          const answer = inputField.value.trim().toLowerCase();
          if (answer === card.word.toLowerCase()) {
              showToast('✅ Chính xác!');
              currentCardIdx++;
              setTimeout(renderTyping, 500);
          } else {
              showToast('❌ Sai rồi! Thử lại nhé.');
              inputField.classList.add('shake-error');
              setTimeout(() => inputField.classList.remove('shake-error'), 400);
          }
      };

      inputField.onkeypress = (e) => { if (e.key === 'Enter') document.getElementById('typingSubmitBtn').click(); };
  }

  // GAME: DICTATION
  function playWordAudio(wordText) {
      if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel(); 
          const utterance = new SpeechSynthesisUtterance(wordText);
          utterance.lang = 'en-US'; 
          utterance.rate = 0.85; 
          window.speechSynthesis.speak(utterance);
      } else {
          showToast('Trình duyệt của bạn không hỗ trợ đọc âm thanh.');
      }
  }

  function renderDictation() {
      if (currentCardIdx >= studyQueue.length) { showToast('Đã hoàn thành bài nghe!'); return showView('review-dashboard-view'); }
      const card = studyQueue[currentCardIdx];
      document.getElementById('dictationProgress').textContent = `${currentCardIdx + 1} / ${studyQueue.length}`;
      const inputField = document.getElementById('dictationInput');
      inputField.value = '';
      inputField.focus();

      playWordAudio(card.word);

      document.getElementById('playAudioBtn').onclick = () => playWordAudio(card.word);

      document.getElementById('dictationSubmitBtn').onclick = () => {
          const answer = inputField.value.trim().toLowerCase();
          if (answer === card.word.toLowerCase()) {
              showToast('✅ Chính xác!');
              currentCardIdx++;
              setTimeout(renderDictation, 1000);
          } else {
              showToast('❌ Sai rồi, hãy nghe lại kỹ nhé!');
              inputField.classList.add('shake-error');
              setTimeout(() => inputField.classList.remove('shake-error'), 400);
          }
      };
      inputField.onkeypress = (e) => { if (e.key === 'Enter') document.getElementById('dictationSubmitBtn').click(); };
  }

  // GAME: MATCHING
  let matchingSelection = null;
  let matchingPairsSolved = 0;
  
  function renderMatching() {
      document.getElementById('matchingProgress').textContent = `Mức độ: Vừa`;
      const grid = document.getElementById('matchingGrid');
      grid.innerHTML = '';
      matchingSelection = null;
      matchingPairsSolved = 0;

      const batch = studyQueue.sort(() => Math.random() - 0.5).slice(0, 6);
      let cards = [];
      
      batch.forEach(item => {
          cards.push({ text: item.word, type: 'word', matchId: item.word });
          cards.push({ text: item.meaning, type: 'meaning', matchId: item.word });
      });
      cards.sort(() => Math.random() - 0.5); 

      cards.forEach(card => {
          const btn = document.createElement('button');
          btn.className = 'match-card';
          btn.textContent = card.text;
          btn.dataset.type = card.type;
          btn.dataset.matchId = card.matchId;

          btn.onclick = () => {
              if (btn.classList.contains('solved') || btn.classList.contains('selected')) return;

              btn.classList.add('selected');

              if (!matchingSelection) {
                  matchingSelection = btn;
              } else {
                  if (matchingSelection.dataset.matchId === btn.dataset.matchId && matchingSelection.dataset.type !== btn.dataset.type) {
                      btn.classList.replace('selected', 'solved');
                      matchingSelection.classList.replace('selected', 'solved');
                      matchingSelection = null;
                      matchingPairsSolved++;
                      if(matchingPairsSolved === 6) {
                          setTimeout(() => { showToast('Hoàn thành xuất sắc!'); renderMatching(); }, 1000); 
                      }
                  } else {
                      btn.classList.replace('selected', 'wrong');
                      matchingSelection.classList.replace('selected', 'wrong');
                      const prevSelection = matchingSelection;
                      matchingSelection = null;
                      
                      setTimeout(() => {
                          btn.classList.remove('wrong', 'selected');
                          prevSelection.classList.remove('wrong', 'selected');
                      }, 500);
                  }
              }
          };
          grid.appendChild(btn);
      });
  }
});