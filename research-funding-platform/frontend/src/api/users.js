import api, { downloadFile } from './client'

const data = (promise) => promise.then((response) => response.data)

export const usersApi = {
  updateMe: (payload) => data(api.patch('/users/me', payload)),
  exportMe: () => downloadFile('/users/me/export', {}, 'my-data-export.json'),
  deleteMe: (password) => data(api.post('/users/me/delete', { password })),
}
