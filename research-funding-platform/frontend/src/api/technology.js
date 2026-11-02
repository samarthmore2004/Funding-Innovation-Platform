import api from './client'

const data = (promise) => promise.then((response) => response.data)

export const technologyApi = {
  areas: () => data(api.get('/technology/areas')),
  area: (key) => data(api.get(`/technology/areas/${encodeURIComponent(key)}`)),
  emerging: () => data(api.get('/technology/emerging')),
  opportunities: () => data(api.get('/technology/opportunities')),
  adoption: () => data(api.get('/technology/adoption')),
  competitive: (area) => data(api.get('/technology/competitive', { params: { area } })),
}
