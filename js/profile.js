const Profile = {
  async load() {
    if (!Auth.currentUser) return;

    const { data, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', Auth.currentUser.id)
      .single();

    if (data) {
      document.getElementById('profile-store-name').value = data.store_name || '';
      document.getElementById('profile-full-name').value = data.full_name || '';
      document.getElementById('profile-email').value = data.email || Auth.currentUser.email || '';
      document.getElementById('profile-phone').value = data.phone || '';
      document.getElementById('profile-address').value = data.address || '';
      document.getElementById('profile-hours').value = data.business_hours || '';

      // Avatar initials
      const initials = (data.store_name || 'S').charAt(0).toUpperCase();
      document.getElementById('profile-avatar-letter').textContent = initials;
      
      // Initialize in read-only mode without triggering a reload
      Profile.toggleEdit(false, false);
    }
  },

  toggleEdit(isEditing, shouldReload = true) {
    const form = document.getElementById('profileForm');
    const editBtn = document.getElementById('profile-edit-btn');
    const actionBtns = document.getElementById('profile-edit-actions');
    const statusText = document.getElementById('profile-status-text');
    
    if (!form || !editBtn || !actionBtns) return;

    if (isEditing) {
      form.classList.remove('readonly-mode');
      form.querySelectorAll('.form-input').forEach(el => el.removeAttribute('readonly'));
      editBtn.style.display = 'none';
      actionBtns.style.display = 'flex';
      statusText.textContent = 'Editing Store Profile...';
      statusText.style.color = 'var(--accent-primary)';
    } else {
      form.classList.add('readonly-mode');
      form.querySelectorAll('.form-input').forEach(el => el.setAttribute('readonly', true));
      editBtn.style.display = 'block';
      actionBtns.style.display = 'none';
      statusText.textContent = 'Review your store credentials';
      statusText.style.color = 'var(--text-muted)';
      
      // Reload from DB if cancelled to revert changes
      if (shouldReload) Profile.load(); 
    }
  },

  async save() {
    const btn = document.querySelector('#profile-edit-actions .btn-primary');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    const profileData = {
      store_name: document.getElementById('profile-store-name').value.trim(),
      full_name: document.getElementById('profile-full-name').value.trim(),
      email: document.getElementById('profile-email').value.trim(),
      phone: document.getElementById('profile-phone').value.trim(),
      address: document.getElementById('profile-address').value.trim(),
      business_hours: document.getElementById('profile-hours').value.trim()
    };

    const { error } = await supabaseClient
      .from('profiles')
      .update(profileData)
      .eq('id', Auth.currentUser.id);

    btn.disabled = false;
    btn.innerHTML = originalText;

    if (error) {
      Toast.show('Error saving profile: ' + error.message, 'error');
      return;
    }

    Toast.show('Profile updated successfully!', 'success');
    Profile.toggleEdit(false);
  }
};
