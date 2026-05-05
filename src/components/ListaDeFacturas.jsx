import React, { useState } from 'react';
import { Card, Table, Button, Badge, Form, Modal } from 'react-bootstrap';
import { FaPaperPlane, FaCheckDouble, FaInbox, FaEdit, FaTrash, FaCode } from 'react-icons/fa';
import Swal from 'sweetalert2';

export default function ListaDeFacturas({ facturas, actualizarEstadoFactura, eliminarFactura, editarFactura }) {
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [mostrarModalJson, setMostrarModalJson] = useState(false);
  const [facturaVisualizando, setFacturaVisualizando] = useState(null);

  const manejarSeleccion = (id) => {
    if (seleccionadas.includes(id)) {
      setSeleccionadas(seleccionadas.filter(item => item !== id));
    } else {
      setSeleccionadas([...seleccionadas, id]);
    }
  };

  const manejarSeleccionTodas = (e) => {
    if (e.target.checked) {
      const facturasPendientes = facturas.filter(f => f.cabecera.estado === 'Pendiente').map(f => f.cabecera.id);
      setSeleccionadas(facturasPendientes);
    } else {
      setSeleccionadas([]);
    }
  };

  const enviarApiIndividual = (id) => {
    actualizarEstadoFactura(id, 'Enviada');
    setSeleccionadas(seleccionadas.filter(item => item !== id));
    Swal.fire({
      icon: 'success',
      title: '¡Enviada!',
      text: 'La factura se envió correctamente a la API.',
      timer: 2000,
      showConfirmButton: false
    });
  };

  const enviarMultiplesApi = () => {
    seleccionadas.forEach(id => actualizarEstadoFactura(id, 'Enviada'));
    setSeleccionadas([]); 
    Swal.fire({
      icon: 'success',
      title: '¡Lote Enviado!',
      text: 'Las facturas seleccionadas fueron enviadas.',
      timer: 2000,
      showConfirmButton: false
    });
  };

  const abrirModalJson = (factura) => {
    setFacturaVisualizando(factura);
    setMostrarModalJson(true);
  };

  const pendientes = facturas.filter(f => f.cabecera.estado === 'Pendiente');
  const todasSeleccionadas = pendientes.length > 0 && seleccionadas.length === pendientes.length;

  return (
    <>
      <Card className="shadow-sm border-0 mb-4">
        <Card.Header className="bg-white border-bottom-0 pt-4 pb-0 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <h5 className="mb-0 fw-bold text-secondary d-flex align-items-center">
            <FaInbox className="me-2 text-primary" /> Bandeja de Salida
          </h5>
          
          {seleccionadas.length > 0 && (
            <Button variant="primary" onClick={enviarMultiplesApi} className="shadow-sm w-100 w-md-auto">
              <FaCheckDouble className="me-2" />
              Enviar Seleccionadas ({seleccionadas.length})
            </Button>
          )}
        </Card.Header>
        
        <Card.Body>
          {facturas.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <p className="mb-0">No hay documentos procesados.</p>
              <small>Procesá una nueva factura para verla aquí.</small>
            </div>
          ) : (
            <>
              {/* VISTA MOBILE */}
              <div className="d-block d-md-none">
                <div className="bg-light p-2 mb-3 rounded d-flex align-items-center">
                  <Form.Check 
                    type="checkbox" id="checkTodasMobile" onChange={manejarSeleccionTodas} checked={todasSeleccionadas} disabled={pendientes.length === 0}
                    label={<span className="ms-1 fw-bold text-secondary small">Seleccionar todas las pendientes</span>}
                  />
                </div>

                {facturas.map((doc) => {
                  const { cabecera } = doc;
                  return (
                  <Card key={cabecera.id} className="mb-3 border shadow-sm">
                    <Card.Body className="p-3">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div className="d-flex align-items-start gap-2">
                           <Form.Check 
                              type="checkbox" checked={seleccionadas.includes(cabecera.id)} onChange={() => manejarSeleccion(cabecera.id)} disabled={cabecera.estado === 'Enviada'} className="mt-1"
                            />
                           <div>
                              <Badge bg={cabecera.estado === 'Pendiente' ? 'warning' : 'success'} text={cabecera.estado === 'Pendiente' ? 'dark' : 'light'} className="mb-1">
                                {cabecera.estado}
                              </Badge>
                              <h6 className="mb-0 fw-bold text-truncate" style={{maxWidth: '180px'}}>{cabecera.razonSocial || 'Sin Razón'}</h6>
                           </div>
                        </div>
                        <div className="text-end">
                          <span className="d-block fw-bold text-primary fs-5">${cabecera.total}</span>
                          <small className="text-muted" style={{fontSize: '0.75rem'}}>{cabecera.fechaEmision}</small>
                        </div>
                      </div>
                      <div className="text-muted small mb-3">
                        CUIT: {cabecera.cuit} | Comp: {cabecera.letraComprobante}-{cabecera.puntoVenta}-{cabecera.numeroComprobante}
                      </div>

                      <div className="d-flex gap-2">
                        <Button variant="success" size="sm" className="flex-grow-1" onClick={() => enviarApiIndividual(cabecera.id)} disabled={cabecera.estado === 'Enviada'}>
                          <FaPaperPlane className="me-1" /> Enviar
                        </Button>
                        <Button variant="outline-secondary" size="sm" onClick={() => abrirModalJson(doc)}><FaCode /></Button>
                        <Button variant="outline-warning" size="sm" onClick={() => editarFactura(doc)} disabled={cabecera.estado === 'Enviada'}><FaEdit /></Button>
                        <Button variant="outline-danger" size="sm" onClick={() => eliminarFactura(cabecera.id)}><FaTrash /></Button>
                      </div>
                    </Card.Body>
                  </Card>
                )})}
              </div>

              {/* VISTA DESKTOP */}
              <div className="d-none d-md-block table-responsive">
                <Table hover className="align-middle mt-3">
                  <thead className="table-light text-secondary">
                    <tr>
                      <th style={{ width: '40px' }}><Form.Check type="checkbox" onChange={manejarSeleccionTodas} checked={todasSeleccionadas} disabled={pendientes.length === 0} /></th>
                      <th>Emisión</th><th>CUIT</th><th>Razón Social</th><th className="text-end">Total</th><th className="text-center">Estado</th><th className="text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturas.map((doc) => {
                      const { cabecera } = doc;
                      return (
                      <tr key={cabecera.id}>
                        <td><Form.Check type="checkbox" checked={seleccionadas.includes(cabecera.id)} onChange={() => manejarSeleccion(cabecera.id)} disabled={cabecera.estado === 'Enviada'} /></td>
                        <td>{cabecera.fechaEmision}</td>
                        <td className="fw-bold text-secondary">{cabecera.cuit}</td>
                        <td className="text-truncate" style={{ maxWidth: '200px' }}>{cabecera.razonSocial || 'Sin Datos'}</td>
                        <td className="text-end fw-bold">${cabecera.total}</td>
                        <td className="text-center">
                          <Badge bg={cabecera.estado === 'Pendiente' ? 'warning' : 'success'} text={cabecera.estado === 'Pendiente' ? 'dark' : 'light'}>{cabecera.estado}</Badge>
                        </td>
                        <td className="text-center">
                          <div className="d-flex justify-content-center gap-2">
                            <Button variant="outline-success" size="sm" onClick={() => enviarApiIndividual(cabecera.id)} disabled={cabecera.estado === 'Enviada'}><FaPaperPlane /></Button>
                            <Button variant="outline-secondary" size="sm" onClick={() => abrirModalJson(doc)}><FaCode /></Button>
                            <Button variant="outline-warning" size="sm" onClick={() => editarFactura(doc)} disabled={cabecera.estado === 'Enviada'}><FaEdit /></Button>
                            <Button variant="outline-danger" size="sm" onClick={() => eliminarFactura(cabecera.id)}><FaTrash /></Button>
                          </div>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </Table>
              </div>
            </>
          )}
        </Card.Body>
      </Card>

      <Modal show={mostrarModalJson} onHide={() => setMostrarModalJson(false)} size="lg" centered>
        <Modal.Header closeButton className="bg-dark text-white">
          <Modal.Title className="fs-5 d-flex align-items-center"><FaCode className="me-2 text-warning" /> Payload (SQL Ready)</Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-light">
          <pre className="bg-dark text-success p-3 rounded" style={{ fontSize: '0.85rem', overflowX: 'auto' }}>
            {facturaVisualizando ? JSON.stringify(facturaVisualizando, null, 2) : ''}
          </pre>
        </Modal.Body>
      </Modal>
    </>
  );
}