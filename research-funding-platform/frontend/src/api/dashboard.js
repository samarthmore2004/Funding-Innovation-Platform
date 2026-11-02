import api, { cleanParams } from './client'

const data = (promise) => promise.then((response) => response.data)

export const dashboardApi = {
  get: (view) => data(api.get('/dashboard', { params: cleanParams({ view }) })),
}
