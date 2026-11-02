import api, { cleanParams, downloadFile } from './client'

const data = (promise) => promise.then((response) => response.data)

export const reportsApi = {
  types: () => data(api.get('/reports/types')),
  history: () => data(api.get('/reports/history')),
  preview: (type, params) => data(api.get(`/reports/${type}/preview`, { params: cleanParams(params) })),
  download: (type, params) =>
    downloadFile(`/reports/${type}/download`, params, `${type}-report.${params?.format || 'csv'}`),
}
