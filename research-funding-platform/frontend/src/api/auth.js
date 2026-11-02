import api, { API_BASE_URL } from './client'

const data = (promise) => promise.then((response) => response.data)

export const authApi = {
  login: (payload) => data(api.post('/auth/login', payload)),
  register: (payload) => data(api.post('/auth/register', payload)),
  me: () => data(api.get('/auth/me')),
  changePassword: (payload) => data(api.post('/auth/change-password', payload)),
  oauthProviders: () => data(api.get('/auth/oauth/providers')),
  oauthLoginUrl: (provider) => `${API_BASE_URL}/auth/oauth/${encodeURIComponent(provider)}/login`,
}
