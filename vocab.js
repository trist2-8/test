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
  document.querySelectorAll('.exit-game-btn').forEach(btn => btn.onclick = () => { showView('management-view'); initManagementView(); });

  initMainView(); 

  function showToast(message) {
    const toast = document.getElementById('toastNotification');
    toast.textContent = message;
    toast.classList.remove('hidden', 'show');
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.classList.add('hidden'), 300); }, 3000);
  }

  function getUniqueWordsets(vocab) {
    return Array.from(new Set(vocab.map(w => w.wordset).filter(Boolean)));
  }

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
      if(newSetName && newSetName.trim() !== "") {
        dropdown.innerHTML += `<option value="${newSetName}" selected>${newSetName}</option>`;
        showToast(`Đã tạo bộ: ${newSetName}`);
      }
    };

    // CSV Dropdown & File logic
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

    setupModal('tutorialBtn', 'tutorialModal');
    setupModal('quickAddBtn', 'quickAddModal');

    document.getElementById('saveQuickWordBtn').onclick = () => {
      const word = document.getElementById('quickWord').value.trim();
      const meaning = document.getElementById('quickMeaning').value.trim();
      if(!word || !meaning) return showToast('Vui lòng nhập đủ từ và nghĩa!');
      
      const wordset = document.getElementById('wordsetDropdown').value;
      chrome.storage.local.get({ vocab: [] }, (result) => {
        const newWord = { word, phonetic: '', wordType: '', meaning, example: '', notes: '', wordset, isLearned: false, id: Date.now() };
        chrome.storage.local.set({ vocab: [...result.vocab, newWord] }, () => {
          showToast('Đã thêm thành công!');
          document.getElementById('quickWord').value = '';
          document.getElementById('quickMeaning').value = '';
        });
      });
    };

    // Parser Trigger
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

  // SMART PARSER: Handles 6 columns or 2 columns gracefully
  let currentParsedWords = [];
  function processImport(text, separator) {
    currentParsedWords = text.split('\n')
      .map(line => line.trim())
      .filter(line => line.includes(separator))
      .map(line => {
        const p = line.split(separator).map(x => x.trim());
        
        // If Quick Add format (Word | Meaning)
        if (p.length === 2) {
            return { word: p[0]||'', phonetic: '', wordType: '', meaning: p[1]||'', example: '', notes: '' };
        }
        
        // Full Format: Word | Phonetic | Type | Meaning | Example | Notes
        return { 
            word: p[0] || '', 
            phonetic: p[1] || '', 
            wordType: p[2] || '', 
            meaning: p[3] || '', 
            example: p[4] || '', 
            notes: p[5] || '' 
        };
      })
      .filter(w => w.word !== ''); // Filter out empty lines

    if (currentParsedWords.length === 0) return showToast('Không tìm thấy từ vựng hợp lệ!');
    
    renderPreviewTable(currentParsedWords, 'previewTableContainer');
    document.getElementById('input-view').classList.add('hidden');
    document.getElementById('preview-view').classList.remove('hidden');
    document.getElementById('saveWordsBtn').textContent = `Lưu ${currentParsedWords.length} từ`;
  }

  document.getElementById('cancelPreviewBtn').onclick = () => {
    document.getElementById('preview-view').classList.add('hidden'); 
    document.getElementById('input-view').classList.remove('hidden');
  };

  document.getElementById('saveWordsBtn').onclick = () => {
    const editedWords = collectEditedWordsFromTable('previewTableContainer');
    const wordset = document.getElementById('wordsetDropdown').value;
    chrome.storage.local.get({ vocab: [] }, (result) => {
      editedWords.forEach(w => { w.wordset = wordset; w.isLearned = false; w.id = Date.now() + Math.random(); });
      chrome.storage.local.set({ vocab: result.vocab.concat(editedWords) }, () => {
        showToast(`Đã lưu ${editedWords.length} từ!`);
        document.getElementById('bulkInput').value = '';
        document.getElementById('preview-view').classList.add('hidden'); 
        document.getElementById('input-view').classList.remove('hidden');
      });
    });
  };

  // FULL 6-COLUMN TABLE RENDERER
  function renderPreviewTable(words, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = `<table id="wordsTable_${containerId}" class="data-table">
      <thead><tr><th>#</th><th>TỪ VỰNG</th><th>PHIÊN ÂM</th><th>LOẠI TỪ</th><th>NGHĨA</th><th>VÍ DỤ</th><th>GHI CHÚ</th><th>XÓA</th></tr></thead><tbody></tbody></table>`;
    const tbody = container.querySelector('tbody');
    words.forEach((item, i) => {
      const row = tbody.insertRow();
      row.innerHTML = `<td>${i+1}</td>
        <td><input type="text" value="${item.word || ''}" class="table-input"></td>
        <td><input type="text" value="${item.phonetic || ''}" class="table-input"></td>
        <td><input type="text" value="${item.wordType || ''}" class="table-input"></td>
        <td><input type="text" value="${item.meaning || ''}" class="table-input"></td>
        <td><input type="text" value="${item.example || ''}" class="table-input"></td>
        <td><input type="text" value="${item.notes || ''}" class="table-input"></td>
        <td><button class="delete-row-btn secondary-btn" data-index="${i}">🗑️</button></td>`;
    });
    container.querySelectorAll('.delete-row-btn').forEach(btn => btn.onclick = (e) => {
      words.splice(parseInt(e.target.dataset.index), 1);
      renderPreviewTable(words, containerId);
    });
  }

  // FULL 6-COLUMN DATA COLLECTOR
  function collectEditedWordsFromTable(containerId) {
    const edited = [];
    document.querySelectorAll(`#wordsTable_${containerId} tbody tr`).forEach(row => {
      const inputs = row.querySelectorAll('input');
      if (inputs[0].value.trim()) {
        edited.push({ 
            word: inputs[0].value.trim(), 
            phonetic: inputs[1].value.trim(),
            wordType: inputs[2].value.trim(),
            meaning: inputs[3].value.trim(),
            example: inputs[4].value.trim(),
            notes: inputs[5].value.trim()
        });
      }
    });
    return edited;
  }

  // --- 2. MANAGEMENT VIEW ---
  function initManagementView() {
    chrome.storage.local.get({ vocab: [] }, (result) => renderWordsetsGrid(result.vocab));
  }

  function renderWordsetsGrid(vocab) {
    const grid = document.getElementById('wordsetGrid');
    grid.innerHTML = `<div class="set-card create-new-card" id="gridCreateBtn"><div class="create-new-content"><span class="create-icon">+</span><h2>Tạo bộ từ mới</h2></div></div>`;
    document.getElementById('gridCreateBtn').onclick = () => { showView('main-view'); initMainView(); };

    const groupedSets = vocab.reduce((acc, word) => {
      if (!acc[word.wordset]) acc[word.wordset] = { total: 0, learned: 0 };
      acc[word.wordset].total++;
      if (word.isLearned) acc[word.wordset].learned++;
      return acc;
    }, {});

    for (const [setName, counts] of Object.entries(groupedSets)) {
      const pct = counts.total > 0 ? (counts.learned / counts.total * 100).toFixed(0) : 0;
      const card = document.createElement('div');
      card.className = 'set-card';
      
      card.innerHTML = `
        <div class="card-header">
          <div class="card-title-icon-wrapper"><span class="set-icon">🏷️</span><span class="set-title">${setName}</span></div>
        </div>
        <div class="card-details">
          <span class="word-count">≡ ${counts.total} từ</span>
          <div class="progress-bar-container"><div class="progress-bar" style="width: ${pct}%"></div></div>
          <span class="learned-count">${counts.learned}/${counts.total} đã thuộc</span>
        </div>
        <div class="card-action-bar">
          <button class="card-btn btn-view">Xem / Sửa</button>
          <button class="card-btn btn-flashcard">Học Flashcard</button>
          <button class="card-btn btn-quiz">Trắc nghiệm</button>
          <button class="card-btn btn-delete">Xóa Bộ Từ</button>
        </div>
      `;
      grid.appendChild(card);

      card.querySelector('.btn-view').onclick = () => openSetDetails(setName);
      card.querySelector('.btn-flashcard').onclick = () => startGame('flashcard', setName);
      card.querySelector('.btn-quiz').onclick = () => startGame('quiz', setName);
      card.querySelector('.btn-delete').onclick = () => {
        if(confirm(`Xóa toàn bộ "${setName}"?`)) {
          chrome.storage.local.set({ vocab: vocab.filter(w => w.wordset !== setName) }, initManagementView);
        }
      };
    }
  }

  function openSetDetails(setName) {
    showView('set-details-view');
    document.getElementById('detailsSetName').textContent = setName;
    chrome.storage.local.get({ vocab: [] }, (result) => {
      renderPreviewTable(result.vocab.filter(w => w.wordset === setName), 'setDetailsTableContainer');
      document.getElementById('backToManagementBtn').onclick = () => {
        const updatedWords = collectEditedWordsFromTable('setDetailsTableContainer');
        updatedWords.forEach(w => w.wordset = setName); 
        const otherWords = result.vocab.filter(w => w.wordset !== setName);
        chrome.storage.local.set({ vocab: otherWords.concat(updatedWords) }, () => {
          showView('management-view'); initManagementView(); showToast('Đã lưu thay đổi!');
        });
      };
    });
  }

  // --- 3. GAMES HUB ---
  function initReviewView() {
    chrome.storage.local.get({ vocab: [] }, (result) => {
      const dropdown = document.getElementById('reviewSetDropdown');
      dropdown.innerHTML = '<option value="all">Tất cả bộ từ</option>';
      getUniqueWordsets(result.vocab).forEach(set => dropdown.innerHTML += `<option value="${set}">${set}</option>`);
    });

    document.querySelectorAll('.game-card').forEach(card => {
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
      if (studyQueue.length < 4 && gameType === 'quiz') return showToast('Trắc nghiệm cần ít nhất 4 từ trong bộ!');
      if (studyQueue.length === 0) return showToast('Bộ từ này trống!');

      studyQueue.sort(() => Math.random() - 0.5);
      currentCardIdx = 0;

      if (gameType === 'flashcard') {
        showView('study-mode-view');
        renderFlashcard();
      } else if (gameType === 'quiz') {
        showView('quiz-mode-view');
        renderQuiz();
      } else {
        showToast('Game này đang được phát triển!');
      }
    });
  }

  // --- FLASHCARD ENGINE ---
  function renderFlashcard() {
    if (currentCardIdx >= studyQueue.length) { showToast('Đã ôn xong!'); return showView('management-view'); }
    const card = studyQueue[currentCardIdx];
    document.getElementById('studyProgress').textContent = `${currentCardIdx + 1} / ${studyQueue.length}`;
    
    // Fill all data into the Flashcard
    document.getElementById('fcWord').textContent = card.word;
    document.getElementById('fcPhonetic').textContent = card.phonetic ? card.phonetic : '';
    document.getElementById('fcMeaning').textContent = card.meaning;
    document.getElementById('fcType').textContent = card.wordType ? `(${card.wordType})` : '';
    document.getElementById('fcExample').textContent = card.example ? card.example : '';
    
    document.getElementById('activeFlashcard').classList.remove('flipped');
  }

  document.getElementById('activeFlashcard').onclick = function() { this.classList.toggle('flipped'); };
  
  function updateLearnedStatus(isLearned) {
    const currentWord = studyQueue[currentCardIdx];
    chrome.storage.local.get({ vocab: [] }, (result) => {
      const vocab = result.vocab;
      const idx = vocab.findIndex(w => w.word === currentWord.word && w.wordset === currentWord.wordset);
      if(idx !== -1) { vocab[idx].isLearned = isLearned; chrome.storage.local.set({ vocab: vocab }); }
    });
    currentCardIdx++; renderFlashcard();
  }
  document.getElementById('btnLearned').onclick = () => updateLearnedStatus(true);
  document.getElementById('btnNotLearned').onclick = () => updateLearnedStatus(false);

  // --- QUIZ ENGINE ---
  function renderQuiz() {
    if (currentCardIdx >= studyQueue.length) { showToast('Bạn đã hoàn thành bài thi!'); return showView('management-view'); }
    
    const correctCard = studyQueue[currentCardIdx];
    document.getElementById('quizProgress').textContent = `${currentCardIdx + 1} / ${studyQueue.length}`;
    document.getElementById('quizQuestionWord').textContent = correctCard.word;

    const wrongOptions = studyQueue.filter(w => w.word !== correctCard.word).sort(() => Math.random() - 0.5).slice(0, 3);
    const options = [correctCard, ...wrongOptions].sort(() => Math.random() - 0.5);

    const grid = document.getElementById('quizOptionsGrid');
    grid.innerHTML = '';
    
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'quiz-option-btn';
      btn.textContent = opt.meaning;
      btn.onclick = () => {
        if (opt.word === correctCard.word) {
          btn.classList.add('correct');
          setTimeout(() => { currentCardIdx++; renderQuiz(); }, 800);
        } else {
          btn.classList.add('wrong');
          setTimeout(() => btn.classList.remove('wrong'), 800);
        }
      };
      grid.appendChild(btn);
    });
  }
});