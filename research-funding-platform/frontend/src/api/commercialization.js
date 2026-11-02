import api from './client'

const data = (promise) => promise.then((response) => response.data)

export const commercializationApi = {
  overview: () => data(api.get('/commercialization/overview')),
  project: (id) => data(api.get(`/commercialization/projects/${id}`)),
}
