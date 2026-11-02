import api from './client'

const data = (promise) => promise.then((response) => response.data)

export const profileApi = {
  options: () => data(api.get('/profile/options')),
  get: () => data(api.get('/profile')),
  update: (payload) => data(api.put('/profile', payload)),

  listPublications: () => data(api.get('/profile/publications')),
  createPublication: (payload) => data(api.post('/profile/publications', payload)),
  updatePublication: (id, payload) => data(api.put(`/profile/publications/${id}`, payload)),
  deletePublication: (id) => data(api.delete(`/profile/publications/${id}`)),
  lookupDoi: (doi) => data(api.get('/profile/publications/lookup', { params: { doi } })),

  listPatents: () => data(api.get('/profile/patents')),
  createPatent: (payload) => data(api.post('/profile/patents', payload)),
  updatePatent: (id, payload) => data(api.put(`/profile/patents/${id}`, payload)),
  deletePatent: (id) => data(api.delete(`/profile/patents/${id}`)),

  listHistory: () => data(api.get('/profile/history')),
  createHistory: (payload) => data(api.post('/profile/history', payload)),
  updateHistory: (id, payload) => data(api.put(`/profile/history/${id}`, payload)),
  deleteHistory: (id) => data(api.delete(`/profile/history/${id}`)),
}
