"use strict";

(() => {
  // ==================================================
  // DOM要素
  // ==================================================

  const clearBtn = document.querySelector(".clearBtn");
  const stopBtn = document.querySelector(".stopBtn");
  const typingArea = document.querySelector(".typingArea");
  const statusDiv = document.querySelector(".statusDiv");
  const statusText = document.querySelector(".statusText");
  const speakerSelect = document.querySelector(".speakerSelect");
  const speedRange = document.querySelector(".speedRange");
  const speedValue = document.querySelector(".speedValue");
  const toggleLangBtn = document.querySelector(".toggleLangBtn");

  // ==================================================
  // 状態
  // ==================================================

  let speechQueue = [];
  let isSpeaking = false;
  let lastLength = 0;

  // ==================================================
  // ステータス表示
  // ==================================================

  const updateStatus = (currentSpeech = "") => {
    if (currentSpeech) {
      statusText.textContent =
        `発話中: 「${currentSpeech}」 ` +
        `(残りキュー: ${speechQueue.length}件)`;
      statusDiv.style.backgroundColor = "#eeddeeff";
      statusDiv.style.borderLeftColor = "#33aa66ff";
    } else {
      statusText.textContent = "残りキュー0件";
      statusDiv.style.backgroundColor = "#eeddffff";
      statusDiv.style.borderLeftColor = "#0088ccff";
    }
  };

  const updateReadyStatus = () => {
    statusText.textContent = "ブラウザ音声合成 準備完了";
    statusDiv.style.backgroundColor = "#eeffeeff";
    statusDiv.style.borderLeftColor = "#33aa66ff";
  };

  const updateErrorStatus = (message) => {
    statusText.textContent = message;
    statusDiv.style.backgroundColor = "#ffeeeeff";
    statusDiv.style.borderLeftColor = "#cc3344ff";
  };

  // ==================================================
  // 音声リスト
  // ==================================================

  // 指定言語の音声インデックスを探す
  const findVoiceIndex = (voices, langCode) => {
    const normalizedLangCode = langCode.toLowerCase();
    // 優先1: デフォルト設定かつ指定言語
    let index = voices.findIndex(
      (voice) =>
        voice.default &&
        voice.lang.toLowerCase().startsWith(normalizedLangCode),
    );
    // 優先2: 最初に見つかった指定言語
    if (index === -1) {
      index = voices.findIndex((voice) =>
        voice.lang.toLowerCase().startsWith(normalizedLangCode),
      );
    }
    return index;
  };

  const loadVoices = () => {
    const voices = window.speechSynthesis.getVoices();
    speakerSelect.innerHTML = "";
    if (voices.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "利用可能な音声を読み込み中...";
      speakerSelect.appendChild(option);
      statusText.textContent = "音声リストを読み込み中...";
      return;
    }
    // 音声をすべてプルダウンに追加
    voices.forEach((voice, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `${voice.name} (${voice.lang})`;
      speakerSelect.appendChild(option);
    });
    // 起動時は日本語音声を選ぶ
    let defaultIndex = findVoiceIndex(voices, "ja");
    // 日本語音声がなければ最初の音声
    if (defaultIndex === -1) {
      defaultIndex = 0;
    }
    speakerSelect.selectedIndex = defaultIndex;
    updateLanguageButton("ja");
    updateReadyStatus();
  };

  // ==================================================
  // 言語切り替え
  // ==================================================

  const updateLanguageButton = (langCode) => {
    if (langCode === "ja") {
      toggleLangBtn.textContent = "日本語";
      toggleLangBtn.classList.remove("lang-en");
      toggleLangBtn.classList.add("lang-ja");
    } else {
      toggleLangBtn.textContent = "英語";
      toggleLangBtn.classList.remove("lang-ja");
      toggleLangBtn.classList.add("lang-en");
    }
  };

  const selectLanguage = (langCode) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      updateErrorStatus("利用可能な音声がありません。");
      return;
    }
    const targetIndex = findVoiceIndex(voices, langCode);
    if (targetIndex === -1) {
      const languageName = langCode.toLowerCase() === "ja" ? "日本語" : "英語";
      updateErrorStatus(`${languageName}の音声が見つかりません。`);
      return;
    }
    speakerSelect.selectedIndex = targetIndex;
    updateLanguageButton(langCode);
  };

  const toggleLanguage = () => {
    const voices = window.speechSynthesis.getVoices();
    const currentVoice = voices[speakerSelect.selectedIndex];
    if (currentVoice && currentVoice.lang.toLowerCase().startsWith("ja")) {
      selectLanguage("en");
    } else {
      selectLanguage("ja");
    }
  };

  // ==================================================
  // 読み上げキュー
  // ==================================================

  const speakNext = () => {
    if (speechQueue.length === 0) {
      isSpeaking = false;
      updateStatus();
      return;
    }
    isSpeaking = true;
    const textToSpeak = speechQueue.shift();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    const voices = window.speechSynthesis.getVoices();
    const selectedVoiceIndex = Number(speakerSelect.value);
    updateStatus(textToSpeak);
    if (voices[selectedVoiceIndex]) {
      utterance.voice = voices[selectedVoiceIndex];
    }
    utterance.rate = Number(speedRange.value);
    utterance.onend = () => {
      speakNext();
    };
    utterance.onerror = (event) => {
      // cancel()による停止の場合は、次の発話を始めない
      if (event.error === "canceled" || event.error === "interrupted") {
        isSpeaking = false;
        updateStatus();
        return;
      }
      speakNext();
    };
    window.speechSynthesis.speak(utterance);
  };

  const enqueueSpeech = (text) => {
    const normalizedText = text.trim();
    if (normalizedText === "") {
      return;
    }
    speechQueue.push(normalizedText);
    if (!isSpeaking) {
      speakNext();
    }
  };

  const stopSpeech = () => {
    // 自前のキューを空にする
    speechQueue = [];
    // 発話中フラグを解除
    isSpeaking = false;
    // ブラウザ側の発話を停止し、キューも削除
    window.speechSynthesis.cancel();
    updateStatus();
  };

  // ==================================================
  // イベントハンドラー
  // ==================================================

  const handleClear = () => {
    typingArea.value = "";
    // 次回の差分取得位置もリセット
    lastLength = 0;
    typingArea.focus();
  };

  const handleTextInput = () => {
    if (typingArea.value === "") {
      lastLength = 0;
    }
  };

  const handleCompositionEnd = (event) => {
    const confirmedText = event.data?.trim() ?? "";
    if (confirmedText !== "") {
      enqueueSpeech(confirmedText);
    }
    lastLength = typingArea.value.length;
  };

  const handleKeyDown = (event) => {
    if (event.key !== "Enter" || event.isComposing) {
      return;
    }
    const currentText = typingArea.value;
    const newText = currentText.substring(lastLength).trim();
    if (newText !== "") {
      enqueueSpeech(newText);
    }
    lastLength = currentText.length;
  };

  const handleSpeedChange = () => {
    speedValue.textContent = Number(speedRange.value).toFixed(1);
  };

  // ==================================================
  // 初期化
  // ==================================================

  const initialize = () => {
    if (!("speechSynthesis" in window)) {
      updateErrorStatus("このブラウザは音声合成に対応していません。");
      return;
    }
    clearBtn.addEventListener("click", handleClear);
    stopBtn.addEventListener("click", stopSpeech);
    typingArea.addEventListener("input", handleTextInput);
    typingArea.addEventListener("compositionend", handleCompositionEnd);
    typingArea.addEventListener("keydown", handleKeyDown);
    speedRange.addEventListener("input", handleSpeedChange);
    toggleLangBtn.addEventListener("click", toggleLanguage);
    // 現時点で取得できる音声を読み込む
    loadVoices();
    // 音声リストが変化したら再読み込み
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    }
    // 速度表示をHTMLのrange値に合わせる
    handleSpeedChange();
  };
  initialize();
})();

/*** End of JS ***/
