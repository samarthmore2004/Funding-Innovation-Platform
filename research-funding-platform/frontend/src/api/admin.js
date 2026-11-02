import api, { cleanParams, downloadFile } from './client'

const data = (promise) => promise.then((response) => response.data)

export const adminApi = {
  users: (params) => data(api.get('/admin/users', { params: cleanParams(params) })),
  updateUser: (id, payload) => data(api.patch(`/admin/users/${id}`, payload)),
  analytics: () => data(api.get('/admin/analytics')),
  recommendationMonitoring: () => data(api.get('/admin/recommendation-monitoring')),
  datasets: () => data(api.get('/admin/datasets')),
  downloadTemplate: (key) => downloadFile(`/admin/datasets/${key}/template`, {}, `${key}-template.csv`),
  importDataset: (key, file) => {
    const form = new FormData()
    form.append('file', file)
    return data(api.post(`/admin/datasets/${key}/import`, form, { timeout: 300000 }))
  },
  syncGrantsGov: (payload) => data(api.post('/admin/datasets/funding/sync-grantsgov', payload, { timeout: 300000 })),
  syncOpenAlex: (payload) => data(api.post('/admin/datasets/publications/sync-openalex', payload, { timeout: 300000 })),
  auditLogs: (params) => data(api.get('/admin/audit-logs', { params: cleanParams(params) })),
  system: () => data(api.get('/admin/system')),
  runJob: (name) => data(api.post(`/admin/jobs/${encodeURIComponent(name)}/run`, null, { timeout: 300000 })),
  broadcast: (payload) => data(api.post('/admin/notifications/broadcast', payload)),
}
