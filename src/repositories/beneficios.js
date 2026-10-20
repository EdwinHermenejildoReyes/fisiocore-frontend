import api from '@/services/api'

export const beneficiosRepository = {
  // Grupos
  listarGrupos: () =>
    api.get('/beneficios/grupos/').then((r) => r.data),

  crearGrupo: (data) =>
    api.post('/beneficios/grupos/', data).then((r) => r.data),

  actualizarGrupo: (id, data) =>
    api.patch(`/beneficios/grupos/${id}/`, data).then((r) => r.data),

  // Configuración de beneficio por grupo
  listarConfigs: () =>
    api.get('/beneficios/configs/').then((r) => r.data),

  crearConfig: (data) =>
    api.post('/beneficios/configs/', data).then((r) => r.data),

  actualizarConfig: (id, data) =>
    api.patch(`/beneficios/configs/${id}/`, data).then((r) => r.data),

  // Beneficios mensuales
  listarMensual: (params) =>
    api.get('/beneficios/mensual/', { params }).then((r) => r.data),

  marcarPagado: (id, data) =>
    api.post(`/beneficios/mensual/${id}/marcar_pagado/`, data).then((r) => r.data),

  desmarcarPagado: (id) =>
    api.post(`/beneficios/mensual/${id}/desmarcar_pagado/`).then((r) => r.data),

  generarMes: (data) =>
    api.post('/beneficios/mensual/generar_mes/', data).then((r) => r.data),

  reporte: (params) =>
    api.get('/beneficios/mensual/reporte/', { params }).then((r) => r.data),
}
