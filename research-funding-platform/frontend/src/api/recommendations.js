import api, { cleanParams } from './client'

const data = (promise) => promise.then((response) => response.data)

export const recommendationsApi = {
  list: (params) => data(api.get('/recommendations', { params: cleanParams(params) })),
  forProject: (projectId, params) =>
    data(api.get(`/recommendations/project/${projectId}`, { params: cleanParams(params) })),
  feedback: (fundingId, action) => data(api.post('/recommendations/feedback', { funding_id: fundingId, action })),
}
