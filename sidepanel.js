let isStudyMode = false;

document.addEventListener('DOMContentLoaded', () => {
  loadVocab();

  document.getElementById('addBtn').addEventListener('click', addWord);
  document.getElementById('studyModeBtn').addEventListener('click', toggleStudyMode);
});

function addWord() {
  const word = document.getElementById('word').value.trim();
  const wordType = document.getElementById('wordType').value;
  const meaning = document.getElementById('meaning').value.trim();
  let topic = document.getElementById('topic').value.trim() || 'Uncategorized';

  if (!word || !meaning) {
    alert('Please enter both a word and its meaning!');
    return;
  }

  const newEntry = { word, wordType, meaning, topic };

  chrome.storage.local.get({ vocab: [] }, (result) => {
    const vocabList = result.vocab;
    vocabList.push(newEntry);
    chrome.storage.local.set({ vocab: vocabList }, () => {
      // Clear inputs
      document.getElementById('word').value = '';
      document.getElementById('meaning').value = '';
      loadVocab();
    });
  });
}

function loadVocab() {
  chrome.storage.local.get({ vocab: [] }, (result) => {
    const listContainer = document.getElementById('vocabList');
    listContainer.innerHTML = '';
    
    // Group words by topic
    const grouped = result.vocab.reduce((acc, item) => {
      if (!acc[item.topic]) acc[item.topic] = [];
      acc[item.topic].push(item);
      return acc;
    }, {});

    // Render grouped words
    for (const [topic, words] of Object.entries(grouped)) {
      const topicDiv = document.createElement('div');
      topicDiv.className = 'topic-group';
      
      const topicTitle = document.createElement('div');
      topicTitle.className = 'topic-title';
      topicTitle.textContent = topic;
      topicDiv.appendChild(topicTitle);

      words.forEach(item => {
        const wordDiv = document.createElement('div');
        wordDiv.className = 'word-item';
        
        wordDiv.innerHTML = `
          <div>
            <span class="word-title">${item.word}</span>
            <span class="word-type">(${item.wordType})</span>
          </div>
          <div class="word-meaning">${item.meaning}</div>
        `;
        topicDiv.appendChild(wordDiv);
      });

      listContainer.appendChild(topicDiv);
    }
  });
}

function toggleStudyMode() {
  isStudyMode = !isStudyMode;
  const btn = document.getElementById('studyModeBtn');
  const container = document.getElementById('vocabList');
  
  if (isStudyMode) {
    btn.textContent = 'Disable Study Mode';
    btn.classList.add('active');
    container.classList.add('study-mode');
  } else {
    btn.textContent = 'Enable Study Mode';
    btn.classList.remove('active');
    container.classList.remove('study-mode');
  }
}