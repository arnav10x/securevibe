// Fixture: auth state trusted from browser storage.
export function login(user) {
  localStorage.setItem('isAdmin', user.admin ? 'true' : 'false');
}

export function isAdmin() {
  return localStorage.getItem('isAdmin') === 'true';
}
