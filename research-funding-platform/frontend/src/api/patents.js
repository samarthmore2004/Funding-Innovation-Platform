import api, { cleanParams } from './client'

const data = (promise) => promise.then((response) => response.data)

export const patentsApi = {
  list: (params) => data(api.get('/patents', { params: cleanParams(params) })),
  facets: () => data(api.get('/patents/facets')),
  get: (id) => data(api.get(`/patents/${id}`)),
  trends: (params) => data(api.get('/patents/analytics/trends', { params: cleanParams(params) })),
  assignees: (params) => data(api.get('/patents/analytics/assignees', { params: cleanParams(params) })),
  competitors: (assignees) =>
    data(api.get('/patents/analytics/competitors', { params: { assignees: assignees.join(',') } })),
  clusters: (params) => data(api.get('/patents/analytics/clusters', { params: cleanParams(params) })),
  innovationMap: () => data(api.get('/patents/analytics/innovation-map')),
  liveSearch: (q) => data(api.get('/patents/live-search', { params: { q } })),
}
