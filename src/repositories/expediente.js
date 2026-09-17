import api from '@/services/api'

export const expedienteRepository = {
  listarSesiones: (params) =>
    api.get('/expediente/sesiones/', { params }).then((r) => r.data),

  obtenerSesion: (id) =>
    api.get(`/expediente/sesiones/${id}/`).then((r) => r.data),

  crearSesion: (data) =>
    api.post('/expediente/sesiones/', data).then((r) => r.data),

  actualizarSesion: (id, data) =>
    api.patch(`/expediente/sesiones/${id}/`, data).then((r) => r.data),

  citasDisponibles: (params) =>
    api.get('/expediente/sesiones/citas_disponibles/', { params }).then((r) => r.data),

  crearEvaluacion: (data) =>
    api.post('/expediente/evaluaciones/', data).then((r) => r.data),

  actualizarEvaluacion: (id, data) =>
    api.patch(`/expediente/evaluaciones/${id}/`, data).then((r) => r.data),

  eliminarEvaluacion: (id) =>
    api.delete(`/expediente/evaluaciones/${id}/`),

  subirFotoEvaluacion: (id, file) => {
    const formData = new FormData()
    formData.append('foto_postural', file)
    return api.post(`/expediente/evaluaciones/${id}/subir-foto/`, formData).then((r) => r.data)
  },
}
