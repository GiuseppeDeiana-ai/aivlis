// Chat della festa: cronologia condivisa, bolle con avatar, messaggi propri evidenziati.
// Solo gli invitati possono scrivere; festeggiata, regia e spettatori la leggono (la festeggiata
// non la vede per non distrarla durante gli scontri).

function chatEmptyHint() {
    const hint = document.createElement('div');
    hint.className = 'chat-empty-hint';
    hint.textContent = 'Nessun messaggio ancora... scrivi il primo!';
    return hint;
}

function renderChatMessage(container, msg, myGuestId) {
    const emptyHint = container.querySelector('.chat-empty-hint');
    if (emptyHint) emptyHint.remove();

    const row = document.createElement('div');
    row.className = 'chat-message' + (myGuestId && msg.id === myGuestId ? ' chat-message-you' : '');

    const avatarEl = document.createElement('div');
    avatarEl.className = 'chat-message-avatar';
    if (msg.avatar) {
        const img = document.createElement('img');
        img.src = msg.avatar;
        img.alt = '';
        avatarEl.appendChild(img);
    } else {
        avatarEl.textContent = '🙂';
    }

    const body = document.createElement('div');
    body.className = 'chat-message-body';
    const nameEl = document.createElement('div');
    nameEl.className = 'chat-message-name';
    nameEl.textContent = msg.name;
    const textEl = document.createElement('div');
    textEl.className = 'chat-message-text';
    textEl.textContent = msg.text;
    body.appendChild(nameEl);
    body.appendChild(textEl);

    row.appendChild(avatarEl);
    row.appendChild(body);
    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
}

function renderChatHistory(container, messages, myGuestId) {
    container.innerHTML = '';
    if (!messages || messages.length === 0) {
        container.appendChild(chatEmptyHint());
        return;
    }
    messages.forEach((msg) => renderChatMessage(container, msg, myGuestId));
}

function clearChatDisplay(container) {
    container.innerHTML = '';
    container.appendChild(chatEmptyHint());
}
