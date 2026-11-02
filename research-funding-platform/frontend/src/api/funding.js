import api, { cleanParams } from './client'

const data = (promise) => promise.then((response) => response.data)

export const fundingApi = {
  list: (params) => data(api.get('/funding', { params: cleanParams(params) })),
  facets: () => data(api.get('/funding/facets')),
  get: (id) => data(api.get(`/funding/${id}`)),
  create: (payload) => data(api.post('/funding', payload)),
  update: (id, payload) => data(api.put(`/funding/${id}`, payload)),
  remove: (id) => data(api.delete(`/funding/${id}`)),
  saved: () => data(api.get('/funding/saved')),
  save: (id, payload = {}) => data(api.post(`/funding/${id}/save`, payload)),
  unsave: (id) => data(api.delete(`/funding/${id}/save`)),
  updateSaved: (savedId, payload) => data(api.patch(`/funding/saved/${savedId}`, payload)),
}
