import api from '@/services/api'

export const agendaRepository = {
  listarCitas: (params) =>
    api.get('/agenda/citas/', { params }).then((r) => r.data),

  obtenerCita: (id) =>
    api.get(`/agenda/citas/${id}/`).then((r) => r.data),

  crearCita: (data) =>
    api.post('/agenda/citas/', data).then((r) => r.data),

  actualizarCita: (id, data) =>
    api.patch(`/agenda/citas/${id}/`, data).then((r) => r.data),

  eliminarCita: (id) =>
    api.delete(`/agenda/citas/${id}/`).then((r) => r.data),

  cancelarCita: (id) =>
    api.post(`/agenda/citas/${id}/cancelar/`).then((r) => r.data),

  confirmarCita: (id) =>
    api.post(`/agenda/citas/${id}/confirmar/`).then((r) => r.data),

  completarCita: (id) =>
    api.post(`/agenda/citas/${id}/completar/`).then((r) => r.data),

  marcarNoAsistio: (id) =>
    api.post(`/agenda/citas/${id}/no_asistio/`).then((r) => r.data),

  resumenHoy: () =>
    api.get('/agenda/citas/resumen/').then((r) => r.data),

  listarFisioterapeutas: () =>
    api.get('/agenda/fisioterapeutas/').then((r) => r.data),

  disponibilidad: (fisioterapeutaId, fecha) =>
    api.get('/agenda/disponibilidad/', { params: { fisioterapeuta: fisioterapeutaId, fecha } }).then((r) => r.data),
}
