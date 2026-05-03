import React, { useState } from 'react';
import { Card, Table, Button, Badge, Form, Modal } from 'react-bootstrap';
import { FaPaperPlane, FaCheckDouble, FaInbox, FaEdit, FaTrash, FaCode } from 'react-icons/fa';

export default function ListaDeFacturas({ facturas, actualizarEstadoFactura, eliminarFactura, editarFactura }) {
  const [seleccionadas, setSeleccionadas] = useState([]);
  
  // Estados para la Modal del JSON
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
      const facturasPendientes = facturas.filter(f => f.estado === 'Pendiente').map(f => f.id);
      setSeleccionadas(facturasPendientes);
    } else {
      setSeleccionadas([]);
    }
  };

  const enviarApiIndividual = (id) => {
    console.log(`Enviando factura ${id} via API...`);
    actualizarEstadoFactura(id, 'Enviada');
    setSeleccionadas(seleccionadas.filter(item => item !== id));
  };

  const enviarMultiplesApi = () => {
    console.log(`Enviando ${seleccionadas.length} facturas en lote via API...`);
    seleccionadas.forEach(id => {
      actualizarEstadoFactura(id, 'Enviada');
    });
    setSeleccionadas([]); 
  };

  const abrirModalJson = (factura) => {
    setFacturaVisualizando(factura);
    setMostrarModalJson(true);
  };

  const pendientes = facturas.filter(f => f.estado === 'Pendiente');
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
              {/* --- VISTA MOBILE (Tarjetas) --- */}
              <div className="d-block d-md-none">
                {/* Seleccionar todas arriba en mobile */}
                <div className="bg-light p-2 mb-3 rounded d-flex align-items-center">
                  <Form.Check 
                    type="checkbox" 
                    id="checkTodasMobile"
                    onChange={manejarSeleccionTodas}
                    checked={todasSeleccionadas}
                    disabled={pendientes.length === 0}
                    label={<span className="ms-1 fw-bold text-secondary small">Seleccionar todas las pendientes</span>}
                  />
                </div>

                {facturas.map((factura) => (
                  <Card key={factura.id} className="mb-3 border shadow-sm">
                    <Card.Body className="p-3">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div className="d-flex align-items-start gap-2">
                           <Form.Check 
                              type="checkbox"
                              checked={seleccionadas.includes(factura.id)}
                              onChange={() => manejarSeleccion(factura.id)}
                              disabled={factura.estado === 'Enviada'}
                              className="mt-1"
                            />
                           <div>
                              <Badge bg={factura.estado === 'Pendiente' ? 'warning' : 'success'} text={factura.estado === 'Pendiente' ? 'dark' : 'light'} className="mb-1">
                                {factura.estado}
                              </Badge>
                              <h6 className="mb-0 fw-bold text-truncate" style={{maxWidth: '200px'}}>{factura.razonSocial || 'Sin Razón Social'}</h6>
                           </div>
                        </div>
                        <div className="text-end">
                          <span className="d-block fw-bold text-primary fs-5">${factura.total}</span>
                          <small className="text-muted" style={{fontSize: '0.75rem'}}>{factura.fechaEmision}</small>
                        </div>
                      </div>
                      
                      <div className="text-muted small mb-3">
                        CUIT: {factura.cuit} | Comp: {factura.letraComprobante}-{factura.puntoVenta}-{factura.numeroComprobante}
                      </div>

                      {/* Botonera Mobile */}
                      <div className="d-flex gap-2">
                        <Button 
                          variant="success" 
                          size="sm"
                          className="flex-grow-1"
                          onClick={() => enviarApiIndividual(factura.id)}
                          disabled={factura.estado === 'Enviada'}
                        >
                          <FaPaperPlane className="me-1" /> Enviar
                        </Button>
                        <Button 
                          variant="outline-secondary" 
                          size="sm"
                          onClick={() => abrirModalJson(factura)}
                        >
                          <FaCode />
                        </Button>
                        <Button 
                          variant="outline-warning" 
                          size="sm"
                          onClick={() => editarFactura(factura)}
                          disabled={factura.estado === 'Enviada'}
                        >
                          <FaEdit />
                        </Button>
                        <Button 
                          variant="outline-danger" 
                          size="sm"
                          onClick={() => eliminarFactura(factura.id)}
                        >
                          <FaTrash />
                        </Button>
                      </div>
                    </Card.Body>
                  </Card>
                ))}
              </div>

              {/* --- VISTA DESKTOP (Tabla) --- */}
              <div className="d-none d-md-block table-responsive">
                <Table hover className="align-middle mt-3">
                  <thead className="table-light text-secondary">
                    <tr>
                      <th style={{ width: '40px' }}>
                        <Form.Check 
                          type="checkbox" 
                          onChange={manejarSeleccionTodas}
                          checked={todasSeleccionadas}
                          disabled={pendientes.length === 0}
                        />
                      </th>
                      <th>Emisión</th>
                      <th>CUIT</th>
                      <th>Razón Social</th>
                      <th className="text-end">Total</th>
                      <th className="text-center">Estado</th>
                      <th className="text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturas.map((factura) => (
                      <tr key={factura.id}>
                        <td>
                          <Form.Check 
                            type="checkbox"
                            checked={seleccionadas.includes(factura.id)}
                            onChange={() => manejarSeleccion(factura.id)}
                            disabled={factura.estado === 'Enviada'}
                          />
                        </td>
                        <td>{factura.fechaEmision}</td>
                        <td className="fw-bold text-secondary">{factura.cuit}</td>
                        <td className="text-truncate" style={{ maxWidth: '200px' }}>
                          {factura.razonSocial || 'Sin Datos'}
                        </td>
                        <td className="text-end fw-bold">${factura.total}</td>
                        <td className="text-center">
                          <Badge bg={factura.estado === 'Pendiente' ? 'warning' : 'success'} text={factura.estado === 'Pendiente' ? 'dark' : 'light'}>
                            {factura.estado}
                          </Badge>
                        </td>
                        <td className="text-center">
                          <div className="d-flex justify-content-center gap-2">
                            <Button 
                              variant="outline-success" 
                              size="sm"
                              title="Enviar por API"
                              onClick={() => enviarApiIndividual(factura.id)}
                              disabled={factura.estado === 'Enviada'}
                            >
                              <FaPaperPlane />
                            </Button>

                            <Button 
                              variant="outline-secondary" 
                              size="sm"
                              title="Ver Payload JSON"
                              onClick={() => abrirModalJson(factura)}
                            >
                              <FaCode />
                            </Button>
                            
                            <Button 
                              variant="outline-warning" 
                              size="sm"
                              title="Editar comprobante"
                              onClick={() => editarFactura(factura)}
                              disabled={factura.estado === 'Enviada'} 
                            >
                              <FaEdit />
                            </Button>

                            <Button 
                              variant="outline-danger" 
                              size="sm"
                              title="Eliminar comprobante"
                              onClick={() => eliminarFactura(factura.id)}
                            >
                              <FaTrash />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </>
          )}
        </Card.Body>
      </Card>

      {/* --- MODAL PARA AUDITAR JSON --- */}
      <Modal show={mostrarModalJson} onHide={() => setMostrarModalJson(false)} size="lg" centered>
        <Modal.Header closeButton className="bg-dark text-white">
          <Modal.Title className="fs-5 d-flex align-items-center">
            <FaCode className="me-2 text-warning" /> Payload a enviar
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-light">
          <p className="text-muted small mb-2">Este es el objeto exacto que se enviará al sistema externo vía API:</p>
          <pre className="bg-dark text-success p-3 rounded" style={{ fontSize: '0.85rem', overflowX: 'auto' }}>
            {facturaVisualizando ? JSON.stringify(facturaVisualizando, null, 2) : ''}
          </pre>
        </Modal.Body>
        <Modal.Footer className="bg-light">
          <Button variant="secondary" onClick={() => setMostrarModalJson(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}