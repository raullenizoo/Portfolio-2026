/* ==========================================================================
   Portfolio Assistant — Gemini-powered chatbot
   Scope-limited to portfolio topics (skills, projects, about, contact).
   Uses the Gemini API (model: gemini-3.6-flash) directly from the browser.

   This version uses a built-in fallback key so visitors do not need to
   paste an API key manually. A saved custom key can still be used if one
   is present in localStorage.

   When the daily quota is exceeded (HTTP 429 / RESOURCE_EXHAUSTED), the
   widget shows an "Unable to respond" bubble and disables the input so
   the page stops sending further requests for the rest of the session.
   ========================================================================== */

(function () {
  "use strict";

  var GEMINI_MODEL = "gemini-3.6-flash";
  var GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL + ":generateContent";
  var STORAGE_KEY = "portfolio-gemini-key";
  /*
  var DEFAULT_API_KEY = "AQ.Ab8RN6IyHN1d7dyMVeJATfkrXBZEYBjMgpsRKV62YCscP79RLQ";
  */
  var DEFAULT_API_KEY ="AQ.Ab8RN6KuiCuIvSyU0TOplUa-YVsuJC79WsiYTsY_i-vb0TkK_g";
  var MAX_OUTPUT_TOKENS = 600;
  var MAX_REPLY_CHARS = 1000;
  var MAX_HISTORY_TURNS = 5;
  var QUOTA_MESSAGE = "Unable to respond";
  var QUOTA_PLACEHOLDER = "Chat is unavailable right now.";

  // Everything the assistant is allowed to know / talk about.
  var SYSTEM_INSTRUCTION = [
    "You are the portfolio assistant for Raul Lenizo's portfolio website.",
    "Answer only questions about Raul Lenizo and the content of this portfolio.",
    "Use only the following information when relevant: his skills (HTML5, CSS3, Bootstrap 5, JavaScript, PHP, REST APIs, MySQL, Git, GitHub, VS Code, and Figma); his projects (Attendify); his background (Aspiring Web developer and B.Sc. Information Technology student at Professional Academy Of The Philippines, 2024-Present); his career objective; his interests (chess, mechanical keyboards, hiking, and home-automation scripts); and his contact details (email lenizoraul99@gmail.com and GitHub github.com/raullenizoo).",
    "If the user asks about unrelated topics, general knowledge, other people, current events, or coding help not related to Raul's work, politely decline and redirect the conversation back to Raul's portfolio.",
    "Provide complete and detailed answers when the user asks for explanations, summaries, or descriptions. Keep replies short only for simple questions like yes/no or greetings. Use plain text only, no markdown, no bullet lists, and no emojis.",
    "If the question is unclear, ask a short clarifying question rather than guessing.",
    "If the user chat Tagalog just apologize that you can't response tagalog chats."
  ].join("\n");

  var elWidget, elToggle, elPanel, elClose, elMessages, elForm, elInput, elSubmitBtn, elKeyBar, elKeyInput, elKeySave;
  var history = [];
  var apiKey = DEFAULT_API_KEY;
  var chatDisabled = false;

  function getStoredKey() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }
  function storeKey(key) {
    try { localStorage.setItem(STORAGE_KEY, key); } catch (e) { /* storage unavailable */ }
  }

  function openPanel() {
    elWidget.classList.add("chat-open");
    elToggle.setAttribute("aria-expanded", "true");
    elPanel.setAttribute("aria-hidden", "false");
    setTimeout(function () { if (!chatDisabled) elInput.focus(); }, 200);
  }
  function closePanel() {
    elWidget.classList.remove("chat-open");
    elToggle.setAttribute("aria-expanded", "false");
    elPanel.setAttribute("aria-hidden", "true");
  }

  function addMessage(text, sender) {
    var msg = document.createElement("div");
    msg.className = "chat-msg chat-msg-" + sender;
    var p = document.createElement("p");
    p.textContent = text;
    msg.appendChild(p);
    elMessages.appendChild(msg);
    elMessages.scrollTop = elMessages.scrollHeight;
    return msg;
  }

  function addTypingIndicator() {
    var msg = document.createElement("div");
    msg.className = "chat-msg chat-msg-bot chat-msg-typing";
    msg.innerHTML = '<span class="chat-dot"></span><span class="chat-dot"></span><span class="chat-dot"></span>';
    elMessages.appendChild(msg);
    elMessages.scrollTop = elMessages.scrollHeight;
    return msg;
  }

  function truncateReply(text) {
    /* if (text.length <= MAX_REPLY_CHARS) return text;
    var cut = text.slice(0, MAX_REPLY_CHARS);
    var lastSpace = cut.lastIndexOf(" ");
    if (lastSpace > 0) cut = cut.slice(0, lastSpace);
    return cut.trim() + "…"; */
    return text;
  }

  function buildContents(userText) {
    var contents = [];
    var recent = history.slice(-MAX_HISTORY_TURNS * 2);
    recent.forEach(function (turn) {
      contents.push({ role: turn.role, parts: [{ text: turn.text }] });
    });
    contents.push({ role: "user", parts: [{ text: userText }] });
    return contents;
  }

  function buildRequestBody(userText) {
    return {
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents: buildContents(userText),
      generationConfig: {
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        temperature: 0.2
      }
    };
  }

  // Disables the input + submit button so the widget stops firing
  // requests (e.g. after the daily quota has been exhausted).
  function disableChatInput(placeholder) {
    chatDisabled = true;
    elInput.disabled = true;
    elInput.value = "";
    if (placeholder) elInput.placeholder = placeholder;
    if (elSubmitBtn) elSubmitBtn.disabled = true;
  }

  function askGemini(userText) {
    var body = buildRequestBody(userText);

    return fetch(GEMINI_ENDPOINT + "?key=" + encodeURIComponent(apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) {
        return res.json().catch(function () { return {}; }).then(function (errData) {
          var apiError = errData && errData.error;
          var msg = (apiError && apiError.message) || ("Request failed (" + res.status + ")");
          var err = new Error(msg);
          err.status = res.status;
          // Gemini reports quota/rate-limit exhaustion as HTTP 429 with
          // status "RESOURCE_EXHAUSTED".
          err.isQuotaExceeded = res.status === 429 || (apiError && apiError.status === "RESOURCE_EXHAUSTED");
          throw err;
        });
      }
      return res.json();
    }).then(function (data) {
      var candidate = data && data.candidates && data.candidates[0];
      var parts = candidate && candidate.content && candidate.content.parts;
      var text = (parts && parts.map(function (p) { return p.text || ""; }).join("").trim()) || "";
      if (!text) {
        var emptyErr = new Error("No response from the assistant. Try rephrasing your question.");
        throw emptyErr;
      }
      return truncateReply(text);
    });
  }

  function handleSend(e) {
    e.preventDefault();
    if (chatDisabled) return;

    var text = elInput.value.trim();
    if (!text) return;

    addMessage(text, "user");
    history.push({ role: "user", text: text });
    elInput.value = "";
    elInput.disabled = true;
    if (elSubmitBtn) elSubmitBtn.disabled = true;

    var typingEl = addTypingIndicator();

    askGemini(text).then(function (reply) {
      typingEl.remove();
      addMessage(reply, "bot");
      history.push({ role: "model", text: reply });
      elInput.disabled = false;
      if (elSubmitBtn) elSubmitBtn.disabled = false;
      elInput.focus();
    }).catch(function (err) {
      typingEl.remove();
      if (err && err.isQuotaExceeded) {
        addMessage(QUOTA_MESSAGE, "bot");
        disableChatInput(QUOTA_PLACEHOLDER);
      } else {
        addMessage("Sorry, something went wrong: " + err.message, "bot");
        elInput.disabled = false;
        if (elSubmitBtn) elSubmitBtn.disabled = false;
        elInput.focus();
      }
    });
  }

  function handleSaveKey() {
    var value = elKeyInput.value.trim();
    if (!value) return;
    apiKey = value;
    storeKey(value);
    elKeyBar.classList.add("d-none");
    elKeyInput.value = "";

    // A fresh/custom key means the previous quota lockout no longer
    // applies, so re-enable the chat.
    if (chatDisabled) {
      chatDisabled = false;
      elInput.disabled = false;
      elInput.placeholder = "";
      if (elSubmitBtn) elSubmitBtn.disabled = false;
    }
  }

  function init() {
    elWidget = document.getElementById("chatWidget");
    if (!elWidget) return;
    elToggle = document.getElementById("chatToggle");
    elPanel = document.getElementById("chatPanel");
    elClose = document.getElementById("chatClose");
    elMessages = document.getElementById("chatMessages");
    elForm = document.getElementById("chatForm");
    elInput = document.getElementById("chatInput");
    elSubmitBtn = elForm ? elForm.querySelector('button[type="submit"]') : null;
    elKeyBar = document.getElementById("chatKeyBar");
    elKeyInput = document.getElementById("chatApiKey");
    elKeySave = document.getElementById("chatKeySave");

    apiKey = getStoredKey() || DEFAULT_API_KEY;
    if (elKeyBar) elKeyBar.classList.add("d-none");

    elToggle.addEventListener("click", function () {
      var isOpen = elWidget.classList.contains("chat-open");
      if (isOpen) { closePanel(); } else { openPanel(); }
    });
    elClose.addEventListener("click", closePanel);
    elForm.addEventListener("submit", handleSend);
    if (elKeySave) elKeySave.addEventListener("click", handleSaveKey);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && elWidget.classList.contains("chat-open")) closePanel();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
      history.push({ role: "model", text: reply });
      elInput.disabled = false;
      if (elSubmitBtn) elSubmitBtn.disabled = false;
      elInput.focus();
    }).catch(function (err) {
      typingEl.remove();
      if (err && err.isQuotaExceeded) {
        addMessage(QUOTA_MESSAGE, "bot");
        disableChatInput(QUOTA_PLACEHOLDER);
      } else {
        addMessage("Sorry, something went wrong: " + err.message, "bot");
        elInput.disabled = false;
        if (elSubmitBtn) elSubmitBtn.disabled = false;
        elInput.focus();
      }
    });
  }

  function handleSaveKey() {
    var value = elKeyInput.value.trim();
    if (!value) return;
    apiKey = value;
    storeKey(value);
    elKeyBar.classList.add("d-none");
    elKeyInput.value = "";

    // A fresh/custom key means the previous quota lockout no longer
    // applies, so re-enable the chat.
    if (chatDisabled) {
      chatDisabled = false;
      elInput.disabled = false;
      elInput.placeholder = "";
      if (elSubmitBtn) elSubmitBtn.disabled = false;
    }
  }

  function init() {
    elWidget = document.getElementById("chatWidget");
    if (!elWidget) return;
    elToggle = document.getElementById("chatToggle");
    elPanel = document.getElementById("chatPanel");
    elClose = document.getElementById("chatClose");
    elMessages = document.getElementById("chatMessages");
    elForm = document.getElementById("chatForm");
    elInput = document.getElementById("chatInput");
    elSubmitBtn = elForm ? elForm.querySelector('button[type="submit"]') : null;
    elKeyBar = document.getElementById("chatKeyBar");
    elKeyInput = document.getElementById("chatApiKey");
    elKeySave = document.getElementById("chatKeySave");

    apiKey = getStoredKey() || DEFAULT_API_KEY;
    if (elKeyBar) elKeyBar.classList.add("d-none");

    elToggle.addEventListener("click", function () {
      var isOpen = elWidget.classList.contains("chat-open");
      if (isOpen) { closePanel(); } else { openPanel(); }
    });
    elClose.addEventListener("click", closePanel);
    elForm.addEventListener("submit", handleSend);
    if (elKeySave) elKeySave.addEventListener("click", handleSaveKey);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && elWidget.classList.contains("chat-open")) closePanel();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
      
