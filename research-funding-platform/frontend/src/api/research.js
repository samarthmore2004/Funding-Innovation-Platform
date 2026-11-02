import api, { cleanParams } from './client'

const data = (promise) => promise.then((response) => response.data)

export const researchApi = {
  overview: () => data(api.get('/research/overview')),
  trends: (params) => data(api.get('/research/trends', { params: cleanParams(params) })),
  emergingTopics: (params) => data(api.get('/research/emerging-topics', { params: cleanParams(params) })),
  hotspots: (params) => data(api.get('/research/hotspots', { params: cleanParams(params) })),
  citations: (params) => data(api.get('/research/citations', { params: cleanParams(params) })),
  publications: (params) => data(api.get('/research/publications', { params: cleanParams(params) })),
  liveTrend: (params) => data(api.get('/research/live-trend', { params: cleanParams(params) })),
  myAnalytics: () => data(api.get('/research/my-analytics')),
}
