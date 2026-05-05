import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Badge, Form, Modal, Row, Col } from 'react-bootstrap';
import { useForm, useFieldArray } from 'react-hook-form';
import { FaPaperPlane, FaCheckDouble, FaInbox, FaEdit, FaTrash, FaCode, FaTimes, FaSave, FaPlus } from 'react-icons/fa';
import Swal from 'sweetalert2';

const TIPOS_IMPUESTOS = [
  { id: 'percepIva', label: 'Percepción IVA' },
  { id: 'percepIibbTuc', label: 'Percep. IIBB Tucumán' },
  { id: 'percepIibbSalta', label: 'Percep. IIBB Salta' },
  { id: 'percepIibbNacional', label: 'Percep. IIBB (Otras)' },
  { id: 'impInternos', label: 'Impuestos Internos' }
];

// SUB-COMPONENTE: MODAL DE EDICIÓN
function ModalEdicionFactura({ factura, show, onHide, onGuardar }) {
  const { register, handleSubmit, control, watch, reset, formState: { errors } } = useForm({ defaultValues: factura });
  const { fields, append, remove } = useFieldArray({ control, name: "detalle_items" });
  
  const watchItems = watch("detalle_items") || [];
  const watchNeto = watch("cabecera.neto");
  const totalCalculadoItems = watchItems.reduce((acc, item) => acc + ((parseFloat(item.cantidad) || 0) * (parseFloat(item.precioUnitario) || 0)), 0);

  useEffect(() => {
    if (factura) reset(factura);
  }, [factura, reset]);

  const onSubmit = (datos) => {
    const netoFormulario = parseFloat(datos.cabecera.neto || 0);
    if (Math.abs(totalCalculadoItems - netoFormulario) > 1) {
      Swal.fire({
        title: '¡Revisá los montos!',
        text: `El Total de Ítems ($${totalCalculadoItems.toFixed(2)}) no coincide con el Neto ($${netoFormulario}). ¿Deseás guardar igual?`,
        icon: 'warning', showCancelButton: true, confirmButtonColor: '#198754', cancelButtonColor: '#6c757d', confirmButtonText: 'Sí, guardar', cancelButtonText: 'Revisar'
      }).then((result) => { if (result.isConfirmed) onGuardar(datos); });
    } else {
      onGuardar(datos);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="xl" backdrop="static" centered>
      <Form onSubmit={handleSubmit(onSubmit)}>
        <Modal.Header closeButton className="bg-warning text-dark">
          <Modal.Title className="fs-5 fw-bold"><FaEdit className="me-2" /> Editar Documento</Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-light p-4">
          <Row className="mb-3">
            <Col md={3} className="mb-3 mb-md-0"><Form.Group><Form.Label className="small fw-bold">Tipo</Form.Label><Form.Select {...register("cabecera.tipoComprobante")}><option value="FA">Factura</option><option value="NC">Nota de Crédito</option></Form.Select></Form.Group></Col>
            <Col md={2} className="mb-3 mb-md-0"><Form.Group><Form.Label className="small fw-bold">Letra</Form.Label><Form.Select {...register("cabecera.letraComprobante")}><option value="A">A</option><option value="B">B</option><option value="C">C</option></Form.Select></Form.Group></Col>
            <Col md={4} className="mb-3 mb-md-0"><Form.Group><Form.Label className="small fw-bold">Razón Social</Form.Label><Form.Control type="text" {...register("cabecera.razonSocial")} /></Form.Group></Col>
            <Col md={3} className="mb-3 mb-md-0"><Form.Group><Form.Label className="small fw-bold">CUIT Emisor</Form.Label><Form.Control type="text" {...register("cabecera.cuit", { required: true })} isInvalid={!!errors.cabecera?.cuit} /></Form.Group></Col>
          </Row>
          <Row className="mb-4">
            <Col md={4} className="mb-3 mb-md-0"><Form.Group><Form.Label className="small fw-bold">Punto Vta.</Form.Label><Form.Control type="text" {...register("cabecera.puntoVenta")} /></Form.Group></Col>
            <Col md={4} className="mb-3 mb-md-0"><Form.Group><Form.Label className="small fw-bold">Nro. Comp.</Form.Label><Form.Control type="text" {...register("cabecera.numeroComprobante")} /></Form.Group></Col>
            <Col md={4} className="mb-3 mb-md-0"><Form.Group><Form.Label className="small fw-bold">Fecha</Form.Label><Form.Control type="date" {...register("cabecera.fechaEmision")} /></Form.Group></Col>
          </Row>

          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="fw-bold text-primary mb-0">Detalle de Ítems</h6>
            <Button variant="outline-primary" size="sm" onClick={() => append({ codigo: '', descripcion: '', cantidad: 1, precioUnitario: 0, alicuota: '21' })}><FaPlus /> Fila</Button>
          </div>
          
          <div className="table-responsive mb-4 border rounded bg-white shadow-sm" style={{ maxHeight: '250px', overflowY: 'auto' }}>
            <Table size="sm" bordered hover className="align-middle mb-0" style={{ minWidth: '700px' }}>
              <thead className="bg-light text-muted small position-sticky top-0" style={{ zIndex: 1 }}>
                <tr><th>Código</th><th>Descripción</th><th>Cant.</th><th>P. Unit. ($)</th><th>Subtotal ($)</th><th>IVA</th><th className="text-center"><FaTrash /></th></tr>
              </thead>
              <tbody>
                {fields.map((item, index) => {
                  const cant = parseFloat(watchItems[index]?.cantidad) || 0;
                  const precio = parseFloat(watchItems[index]?.precioUnitario) || 0;
                  return (
                  <tr key={item.id}>
                    <td><Form.Control size="sm" type="text" {...register(`detalle_items.${index}.codigo`)} /></td>
                    <td><Form.Control size="sm" type="text" {...register(`detalle_items.${index}.descripcion`)} /></td>
                    <td><Form.Control size="sm" type="number" step="0.01" {...register(`detalle_items.${index}.cantidad`)} /></td>
                    <td><Form.Control size="sm" type="number" step="0.01" {...register(`detalle_items.${index}.precioUnitario`)} /></td>
                    <td className="bg-light fw-bold text-secondary text-end px-2 align-middle border-start">${(cant * precio).toFixed(2)}</td>
                    <td><Form.Select size="sm" {...register(`detalle_items.${index}.alicuota`)}><option value="21">21%</option><option value="10.5">10.5%</option><option value="0">0%</option></Form.Select></td>
                    <td className="text-center"><Button variant="outline-danger" size="sm" onClick={() => remove(index)}><FaTimes /></Button></td>
                  </tr>
                )})}
              </tbody>
            </Table>
          </div>

          <Row className="align-items-end">
            <Col md={3} className="mb-3 mb-md-0"><Form.Group><Form.Label className="small fw-bold d-block">Neto Gravado ($)<span className="float-end badge bg-info text-dark">Ítems: ${totalCalculadoItems.toFixed(2)}</span></Form.Label><Form.Control type="number" step="0.01" {...register("cabecera.neto")} /></Form.Group></Col>
            <Col md={3} className="mb-3 mb-md-0"><Form.Group><Form.Label className="small fw-bold">Monto IVA ($)</Form.Label><Form.Control type="number" step="0.01" {...register("cabecera.iva")} /></Form.Group></Col>
            <Col md={3} className="mb-3 mb-md-0"><Form.Group><Form.Label className="small fw-bold">Alícuotas IVA (%)</Form.Label><Form.Control type="text" {...register("cabecera.alicuotasIva")} /></Form.Group></Col>
            <Col md={3} className="mb-3 mb-md-0"><Form.Group><Form.Label className="small fw-bold text-primary">Total Factura ($)</Form.Label><Form.Control type="number" step="0.01" className="bg-primary text-white font-weight-bold" {...register("cabecera.total", { required: true })} /></Form.Group></Col>
          </Row>
        </Modal.Body>
        <Modal.Footer className="bg-light">
          <Button variant="outline-secondary" onClick={onHide}>Cancelar</Button>
          <Button variant="success" type="submit"><FaSave className="me-2"/> Guardar Cambios</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

// COMPONENTE PRINCIPAL DE LA LISTA
export default function ListaDeFacturas({ facturas, actualizarEstadoFactura, eliminarFactura, actualizarFactura }) {
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [mostrarModalJson, setMostrarModalJson] = useState(false);
  const [facturaVisualizando, setFacturaVisualizando] = useState(null);
  
  // ESTADOS PARA LA MODAL DE EDICIÓN
  const [facturaEditando, setFacturaEditando] = useState(null);

  const manejarSeleccion = (id) => {
    if (seleccionadas.includes(id)) setSeleccionadas(seleccionadas.filter(item => item !== id));
    else setSeleccionadas([...seleccionadas, id]);
  };

  const manejarSeleccionTodas = (e) => {
    if (e.target.checked) setSeleccionadas(facturas.filter(f => f.cabecera.estado === 'Pendiente').map(f => f.cabecera.id));
    else setSeleccionadas([]);
  };

  const enviarApiIndividual = (id) => {
    actualizarEstadoFactura(id, 'Enviada');
    setSeleccionadas(seleccionadas.filter(item => item !== id));
    Swal.fire({ icon: 'success', title: '¡Enviada!', text: 'La factura se envió correctamente.', timer: 2000, showConfirmButton: false });
  };

  const enviarMultiplesApi = () => {
    seleccionadas.forEach(id => actualizarEstadoFactura(id, 'Enviada'));
    setSeleccionadas([]); 
    Swal.fire({ icon: 'success', title: '¡Lote Enviado!', text: 'Las facturas seleccionadas fueron enviadas.', timer: 2000, showConfirmButton: false });
  };

  const abrirModalJson = (factura) => {
    setFacturaVisualizando(factura);
    setMostrarModalJson(true);
  };

  // FUNCIONES DEL MODAL DE EDICIÓN
  const abrirEdicion = (factura) => setFacturaEditando(factura);
  const cerrarEdicion = () => setFacturaEditando(null);
  
  const guardarEdicion = (datosEditados) => {
    actualizarFactura(datosEditados);
    cerrarEdicion();
    Swal.fire({ icon: 'success', title: 'Actualizado', text: 'Los cambios fueron guardados.', timer: 2000, showConfirmButton: false });
  };

  const pendientes = facturas.filter(f => f.cabecera.estado === 'Pendiente');
  const todasSeleccionadas = pendientes.length > 0 && seleccionadas.length === pendientes.length;

  return (
    <>
      <Card className="shadow-sm border-0 mb-4">
        <Card.Header className="bg-white border-bottom-0 pt-4 pb-0 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <h5 className="mb-0 fw-bold text-secondary d-flex align-items-center"><FaInbox className="me-2 text-primary" /> Bandeja de Salida</h5>
          {seleccionadas.length > 0 && (
            <Button variant="primary" onClick={enviarMultiplesApi} className="shadow-sm w-100 w-md-auto">
              <FaCheckDouble className="me-2" /> Enviar Seleccionadas ({seleccionadas.length})
            </Button>
          )}
        </Card.Header>
        
        <Card.Body>
          {facturas.length === 0 ? (
            <div className="text-center py-5 text-muted"><p className="mb-0">No hay documentos procesados.</p><small>Procesá una nueva factura para verla aquí.</small></div>
          ) : (
            <>
              {/* VISTA MOBILE */}
              <div className="d-block d-md-none">
                <div className="bg-light p-2 mb-3 rounded d-flex align-items-center">
                  <Form.Check type="checkbox" id="checkTodasMobile" onChange={manejarSeleccionTodas} checked={todasSeleccionadas} disabled={pendientes.length === 0} label={<span className="ms-1 fw-bold text-secondary small">Seleccionar todas las pendientes</span>} />
                </div>
                {facturas.map((doc) => {
                  const { cabecera } = doc;
                  return (
                  <Card key={cabecera.id} className="mb-3 border shadow-sm">
                    <Card.Body className="p-3">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div className="d-flex align-items-start gap-2">
                           <Form.Check type="checkbox" checked={seleccionadas.includes(cabecera.id)} onChange={() => manejarSeleccion(cabecera.id)} disabled={cabecera.estado === 'Enviada'} className="mt-1" />
                           <div>
                              <Badge bg={cabecera.estado === 'Pendiente' ? 'warning' : 'success'} text={cabecera.estado === 'Pendiente' ? 'dark' : 'light'} className="mb-1">{cabecera.estado}</Badge>
                              <h6 className="mb-0 fw-bold text-truncate" style={{maxWidth: '180px'}}>{cabecera.razonSocial || 'Sin Razón'}</h6>
                           </div>
                        </div>
                        <div className="text-end">
                          <span className="d-block fw-bold text-primary fs-5">${cabecera.total}</span>
                          <small className="text-muted" style={{fontSize: '0.75rem'}}>{cabecera.fechaEmision}</small>
                        </div>
                      </div>
                      <div className="text-muted small mb-3">CUIT: {cabecera.cuit} | Comp: {cabecera.letraComprobante}-{cabecera.puntoVenta}-{cabecera.numeroComprobante}</div>

                      <div className="d-flex gap-2">
                        <Button variant="success" size="sm" className="flex-grow-1" onClick={() => enviarApiIndividual(cabecera.id)} disabled={cabecera.estado === 'Enviada'}><FaPaperPlane className="me-1" /> Enviar</Button>
                        <Button variant="outline-secondary" size="sm" onClick={() => abrirModalJson(doc)}><FaCode /></Button>
                        <Button variant="outline-warning" size="sm" onClick={() => abrirEdicion(doc)} disabled={cabecera.estado === 'Enviada'}><FaEdit /></Button>
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
                    <tr><th style={{ width: '40px' }}><Form.Check type="checkbox" onChange={manejarSeleccionTodas} checked={todasSeleccionadas} disabled={pendientes.length === 0} /></th><th>Emisión</th><th>CUIT</th><th>Razón Social</th><th className="text-end">Total</th><th className="text-center">Estado</th><th className="text-center">Acciones</th></tr>
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
                        <td className="text-center"><Badge bg={cabecera.estado === 'Pendiente' ? 'warning' : 'success'} text={cabecera.estado === 'Pendiente' ? 'dark' : 'light'}>{cabecera.estado}</Badge></td>
                        <td className="text-center">
                          <div className="d-flex justify-content-center gap-2">
                            <Button variant="outline-success" size="sm" onClick={() => enviarApiIndividual(cabecera.id)} disabled={cabecera.estado === 'Enviada'}><FaPaperPlane /></Button>
                            <Button variant="outline-secondary" size="sm" onClick={() => abrirModalJson(doc)}><FaCode /></Button>
                            <Button variant="outline-warning" size="sm" onClick={() => abrirEdicion(doc)} disabled={cabecera.estado === 'Enviada'}><FaEdit /></Button>
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

      {/* MODAL DE EDICIÓN */}
      {facturaEditando && (
        <ModalEdicionFactura 
          factura={facturaEditando} 
          show={!!facturaEditando} 
          onHide={cerrarEdicion} 
          onGuardar={guardarEdicion} 
        />
      )}

      {/* MODAL PARA VER JSON */}
      <Modal show={mostrarModalJson} onHide={() => setMostrarModalJson(false)} size="lg" centered>
        <Modal.Header closeButton className="bg-dark text-white"><Modal.Title className="fs-5 d-flex align-items-center"><FaCode className="me-2 text-warning" /> Payload (SQL Ready)</Modal.Title></Modal.Header>
        <Modal.Body className="bg-light"><pre className="bg-dark text-success p-3 rounded" style={{ fontSize: '0.85rem', overflowX: 'auto' }}>{facturaVisualizando ? JSON.stringify(facturaVisualizando, null, 2) : ''}</pre></Modal.Body>
      </Modal>
    </>
  );
}