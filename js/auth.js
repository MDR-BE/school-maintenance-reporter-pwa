/* auth.js – simple cookie‑based protection for the PWA */
/* Returns true if a valid token is present, false otherwise */
function hasValidAuthToken() {
  const match = document.cookie.match(/(?:^|;)\s*pwa_auth=([^;]+)/);
  if (!match) return false;
  const token = decodeURIComponent(match[1]);
  // Validate by calling the script's validation endpoint (HEAD request)
  // We reuse the same endpoint the Apps Script uses for issuing tokens.
  const apiUrl = getApiBaseUrl(); // defined in utils.js
  let valid = false;
  const xhr = new XMLHttpRequest();
  xhr.open('HEAD', apiUrl + '?action=validate&token=' + encodeURIComponent(token), false);
  xhr.onreadystatechange = function () {
    if (xhr.readyState === XMLHttpRequest.DONE) {
      valid = (xhr.status === 200);
    }
  };
  xhr.send();
  return valid;
}

/* Show a login modal if no valid token */
function requireAuth() {
  if (!hasValidAuthToken()) {
    // Build a simple modal
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.background = 'rgba(0,0,0,0.6)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '9999';

    const box = document.createElement('div');
    box.style.background = '#fff';
    box.style.padding = '2rem';
    box.style.borderRadius = '8px';
    box.style.width = '320px';
    box.style.boxShadow = '0 2px 10px rgba(0,0,0,.2)';

    const title = document.createElement('h2');
    title.textContent = 'Toegang tot de PWA';
    title.style.marginTop = '0';

    const form = document.createElement('form');
    form.id = 'loginForm';
    form.innerHTML = `
      <label for="password">Wachtwoord:</label>
      <input type="password" id="password" name="password" autocomplete="current-password" required>
      <button type="submit">Inloggen</button>
      <div id="error" style="color:#d32f2f;margin-top:1rem;font-size:0.9rem;"></div>
    `;

    box.appendChild(title);
    box.appendChild(form);
    modal.appendChild(box);
    document.body.appendChild(modal);

    const errorDiv = form.querySelector('#error');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      errorDiv.textContent = '';
      const password = document.getElementById('password').value;
      // Call the validate endpoint (POST) to get a token
      fetch(getApiBaseUrl() + '?action=validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ password: password })
      })
        .then(r => r.json())
        .then(data => {
          if (data.success) {
            // Set cookie and reload the page
            document.cookie = "pwa_auth=" + data.token + "; path=/; max-age=" + (15*60) + "; SameSite=Lax";
            location.reload();
          } else {
            errorDiv.textContent = data.error || 'Ongeldig wachtwoord';
          }
        })
        .catch(() => {
          errorDiv.textContent = 'Kon de server niet bereiken.';
        });
    });
  }
}

/* Run on every page load */
requireAuth();