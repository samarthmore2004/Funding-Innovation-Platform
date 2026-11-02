import api, { cleanParams } from './client'

const data = (promise) => promise.then((response) => response.data)

export const notificationsApi = {
  list: (params) => data(api.get('/notifications', { params: cleanParams(params) })),
  unreadCount: () => data(api.get('/notifications/unread-count')),
  markRead: (id) => data(api.post(`/notifications/${id}/read`)),
  markAllRead: () => data(api.post('/notifications/read-all')),
  remove: (id) => data(api.delete(`/notifications/${id}`)),
  refresh: () => data(api.post('/notifications/refresh')),
}
