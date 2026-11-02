import api from './client'

const data = (promise) => promise.then((response) => response.data)

export const innovationApi = {
  weights: () => data(api.get('/innovation/weights')),
  projects: (scope = 'mine') => data(api.get('/innovation/projects', { params: { scope } })),
  createProject: (payload) => data(api.post('/innovation/projects', payload)),
  getProject: (id) => data(api.get(`/innovation/projects/${id}`)),
  updateProject: (id, payload) => data(api.put(`/innovation/projects/${id}`, payload)),
  deleteProject: (id) => data(api.delete(`/innovation/projects/${id}`)),
  setStage: (id, stage) => data(api.patch(`/innovation/projects/${id}/stage`, { stage })),
  score: (id) => data(api.post(`/innovation/projects/${id}/score`)),
  scorePreview: (payload) => data(api.post('/innovation/score-preview', payload)),
  portfolio: () => data(api.get('/innovation/portfolio')),
}
