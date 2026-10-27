(() => {
  const trigger = document.querySelector('#profile-trigger');
  const menu = document.querySelector('#profile-menu');
  const summary = document.querySelector('#profile-menu-summary');
  const accountOverlay = document.querySelector('#profile-account-overlay');
  const accountName = document.querySelector('#profile-account-name');
  const accountNameEdit = document.querySelector('#profile-account-edit-name');
  const nameEditor = document.querySelector('#profile-name-editor');
  const nameInput = document.querySelector('#profile-name-input');
  const nameSave = document.querySelector('#profile-name-save');
  const nameCancel = document.querySelector('#profile-name-cancel');
  const nameFeedback = document.querySelector('#profile-name-feedback');
  const addressesOverlay = document.querySelector('#profile-address-overlay');
  const addressList = document.querySelector('#profile-address-list');
  const addressEmpty = document.querySelector('#profile-address-empty');
  if (!trigger || !menu || !accountOverlay || !addressesOverlay) return;

  function closeMenu() {
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  }

  function closeOverlay(overlay) {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function openOverlay(overlay) {
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function openAccountDetails() {
    const signedIn = Boolean(signedInPhone);
    accountName.textContent = signedIn ? signedInName : 'Not signed in';
    document.querySelector('#profile-account-phone').textContent = signedIn ? `+91 ${signedInPhone}` : '—';
    document.querySelector('#profile-account-help').textContent = signedIn
      ? 'Your account details are saved for this browser session.'
      : 'Sign in with your mobile number to view your Aabha account details.';
    document.querySelector('#profile-account-sign-in').hidden = signedIn;
    accountNameEdit.hidden = !signedIn;
    nameEditor.hidden = true;
    nameFeedback.textContent = '';
    openOverlay(accountOverlay);
  }

  function closeNameEditor() {
    nameEditor.hidden = true;
    accountNameEdit.hidden = !signedInPhone;
    nameFeedback.textContent = '';
  }

  function saveAccountName() {
    const name = nameInput.value.trim();
    if (name.length < 2) {
      nameFeedback.textContent = 'Please enter a name with at least 2 characters.';
      nameInput.focus();
      return;
    }

    signedInName = name;
    sessionStorage.setItem('aabhaName', name);
    accountName.textContent = name;
    summary.textContent = `${name} · +91 ${signedInPhone}`;
    updateLoginButton();
    closeNameEditor();
    document.querySelector('#profile-account-help').textContent = 'Your account details are saved for this browser session.';
    showToast('Account name updated.');
  }

  accountNameEdit.addEventListener('click', () => {
    nameInput.value = signedInName;
    nameFeedback.textContent = '';
    nameEditor.hidden = false;
    accountNameEdit.hidden = true;
    nameInput.focus();
    nameInput.select();
  });
  nameSave.addEventListener('click', saveAccountName);
  nameCancel.addEventListener('click', closeNameEditor);
  nameInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveAccountName();
    } else if (event.key === 'Escape') {
      closeNameEditor();
      accountNameEdit.focus();
    }
  });

  function renderProfileAddresses() {
    if (!addressList || !addressEmpty) return;
    addressList.innerHTML = addressBook.map(address => {
      const id = escapeAddressText(address.id);
      const lines = [address.house, address.area, address.landmark, address.city, address.state, address.pincode].filter(Boolean).join(', ');
      const selected = String(address.id) === String(selectedAddressId);
      return `<article class="profile-address-card ${selected ? 'is-selected' : ''}"><strong>${escapeAddressText(address.name)} · ${escapeAddressText(address.pincode)}</strong><small>${escapeAddressText(lines)}</small><div class="profile-address-card-actions"><button type="button" data-profile-edit-address="${id}">Edit</button>${selected ? '<button type="button" disabled>Selected</button>' : `<button type="button" data-profile-select-address="${id}">Use this address</button>`}</div></article>`;
    }).join('');
    addressEmpty.hidden = addressBook.length > 0;
  }

  function openSavedAddresses() {
    renderProfileAddresses();
    openOverlay(addressesOverlay);
  }

  trigger.addEventListener('click', event => {
    event.stopPropagation();
    const shouldOpen = menu.hidden;
    menu.hidden = !shouldOpen;
    trigger.setAttribute('aria-expanded', String(shouldOpen));
    if (shouldOpen) {
      summary.textContent = signedInPhone ? `${signedInName} · +91 ${signedInPhone}` : 'Sign in to see your Aabha account.';
      menu.querySelector('[role="menuitem"]')?.focus();
    }
  });

  menu.addEventListener('click', event => {
    const action = event.target.closest('[data-profile-action]')?.dataset.profileAction;
    if (!action) return;
    closeMenu();
    if (action === 'account') openAccountDetails();
    if (action === 'addresses') openSavedAddresses();
    if (action === 'logout') {
      if (!signedInPhone) {
        showToast('You are already signed out.');
        return;
      }
      sessionStorage.removeItem('aabhaPhone');
      sessionStorage.removeItem('aabhaName');
      signedInPhone = '';
      signedInName = '';
      pendingPhone = '';
      updateLoginButton();
      closeAuth();
      showToast('You have signed out.');
    }
  });

  document.addEventListener('click', event => {
    if (!menu.hidden && !event.target.closest('.profile-actions')) closeMenu();
  });

  document.querySelectorAll('[data-close-profile="account"]').forEach(button => button.addEventListener('click', () => closeOverlay(accountOverlay)));
  document.querySelectorAll('[data-close-profile="addresses"]').forEach(button => button.addEventListener('click', () => closeOverlay(addressesOverlay)));
  [accountOverlay, addressesOverlay].forEach(overlay => overlay.addEventListener('click', event => {
    if (event.target === overlay) closeOverlay(overlay);
  }));

  document.querySelector('#profile-account-sign-in').addEventListener('click', () => {
    closeOverlay(accountOverlay);
    openAuth();
  });

  document.querySelector('#profile-add-address').addEventListener('click', () => {
    closeOverlay(addressesOverlay);
    openDeliveryForm();
  });

  addressList.addEventListener('click', event => {
    const edit = event.target.closest('[data-profile-edit-address]');
    if (edit) {
      closeOverlay(addressesOverlay);
      openDeliveryForm(edit.dataset.profileEditAddress);
      return;
    }
    const select = event.target.closest('[data-profile-select-address]');
    if (select) {
      selectedAddressId = select.dataset.profileSelectAddress;
      renderAddressBook();
      renderProfileAddresses();
      showToast('Saved address selected');
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    closeMenu();
    if (accountOverlay.classList.contains('open')) closeOverlay(accountOverlay);
    if (addressesOverlay.classList.contains('open')) closeOverlay(addressesOverlay);
  });
})();
