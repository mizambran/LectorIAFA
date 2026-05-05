import React, { useState, useRef, useEffect } from 'react';
import { Form, Button, Row, Col, Card, Spinner, Alert, Table } from 'react-bootstrap';
import { useForm, useFieldArray } from 'react-hook-form'; 
import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import jsQR from 'jsqr';
import { FaFileInvoice, FaUpload, FaSave, FaPlus, FaTrash, FaTimes, FaQrcode } from 'react-icons/fa';
import Swal from 'sweetalert2';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const TIPOS_IMPUESTOS = [
  { id: 'percepIva', label: 'Percepción IVA' },
  { id: 'percepIibbTuc', label: 'Percep. IIBB Tucumán' },
  { id: 'percepIibbSalta', label: 'Percep. IIBB Salta' },
  { id: 'percepIibbNacional', label: 'Percep. IIBB (Otras)' },
  { id: 'impInternos', label: 'Impuestos Internos' }
];

export default function Facturas({ agregarFactura, facturaEditando, cancelarEdicion }) {
  const { register, handleSubmit, setValue, control, watch, formState: { errors }, reset, unregister } = useForm({
    defaultValues: { 
      cabecera: { tipoComprobante: 'FA', letraComprobante: 'C' },
      items: [{ codigo: '', descripcion: '', cantidad: 1, precioUnitario: 0, alicuota: '21' }] 
    }
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchItems = watch("items");
  const watchNeto = watch("cabecera.neto");
  
  const totalCalculadoItems = watchItems.reduce((acc, item) => {
    return acc + ((parseFloat(item.cantidad) || 0) * (parseFloat(item.precioUnitario) || 0));
  }, 0);
  
  const [escaneando, setEscaneando] = useState(false);
  const archivoInputRef = useRef(null);
  const [impuestosVisibles, setImpuestosVisibles] = useState([]); 
  const [impuestoSeleccionado, setImpuestoSeleccionado] = useState("");

  // CARGAR DATOS SI ESTAMOS EDITANDO
  useEffect(() => {
    if (facturaEditando) {
      reset(facturaEditando);
      const impuestosExtra = TIPOS_IMPUESTOS.map(t => t.id).filter(id => facturaEditando.cabecera[id]);
      setImpuestosVisibles(impuestosExtra);
    }
  }, [facturaEditando, reset]);

  const procesarDocumento = async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    setEscaneando(true);

    try {
      let canvas, context, viewport;
      if (archivo.type === 'application/pdf') {
        const arrayBuffer = await archivo.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pagina = await pdf.getPage(1);
        viewport = pagina.getViewport({ scale: 2.0 }); 
        canvas = document.createElement('canvas');
        context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await pagina.render({ canvasContext: context, viewport: viewport }).promise;
      } else {
        await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            context = canvas.getContext('2d');
            context.drawImage(img, 0, 0);
            resolve();
          };
          img.onerror = reject;
          img.src = URL.createObjectURL(archivo);
        });
      }

      const imageDataObj = context.getImageData(0, 0, canvas.width, canvas.height);
      const imagenParaOCR = canvas.toDataURL('image/jpeg');

      // Lógica simplificada de extracción (para no sobrecargar el código de UI en este ejemplo)
      const codigoQR = jsQR(imageDataObj.data, imageDataObj.width, imageDataObj.height);
      if (codigoQR && codigoQR.data) {
        try {
          const url = new URL(codigoQR.data);
          const datosAfip = JSON.parse(atob(url.searchParams.get('p'))); 
          const cuitStr = String(datosAfip.cuit);
          setValue('cabecera.cuit', `${cuitStr.slice(0, 2)}-${cuitStr.slice(2, 10)}-${cuitStr.slice(10)}`);
          setValue('cabecera.fechaEmision', datosAfip.fecha); 
          setValue('cabecera.total', datosAfip.importe);
        } catch (e) { console.log(e); }
      }

      const { data: { text } } = await Tesseract.recognize(imagenParaOCR, 'spa');
      const textoLimpio = text.toLowerCase();
      
      const extraerMonto = (texto, p) => {
        const r = texto.match(new RegExp(`(?:${p.join('|')})[^0-9]{0,30}(\\d{1,3}(?:[.\\s]\\d{3})*[,.]\\d{2}|\\d+[,.]\\d{2})`, 'i'));
        return r ? r[1].replace(/[\s.]/g, '').replace(',', '.') : '';
      };
      
      setValue('cabecera.neto', extraerMonto(textoLimpio, ['importe neto gravado', 'subtotal'])); 

      Swal.fire({ icon: 'success', title: '¡Lectura completada!', toast: true, position: 'top-end', timer: 3000, showConfirmButton: false });

    } catch (error) {
      Swal.fire('Error', 'Hubo un error al leer la factura.', 'error');
    } finally {
      setEscaneando(false);
    }
  };

  const agregarImpuestoManual = () => {
    if (impuestoSeleccionado && !impuestosVisibles.includes(impuestoSeleccionado)) {
      setImpuestosVisibles([...impuestosVisibles, impuestoSeleccionado]);
      setImpuestoSeleccionado("");
    }
  };

  const quitarImpuesto = (idImpuesto) => {
    setImpuestosVisibles(impuestosVisibles.filter(id => id !== idImpuesto));
    unregister(`cabecera.${idImpuesto}`); 
  };

  const cancelarProceso = () => {
    reset({
      cabecera: { tipoComprobante: 'FA', letraComprobante: 'C' },
      items: [{ codigo: '', descripcion: '', cantidad: 1, precioUnitario: 0, alicuota: '21' }] 
    }); 
    setImpuestosVisibles([]);
    if (archivoInputRef.current) archivoInputRef.current.value = ""; 
    if (cancelarEdicion) cancelarEdicion();
  };

  // VALIDACIÓN DE SUBTOTALES Y GUARDADO (FORMATO SQL)
  const manejarEnvio = (datos) => {
    const netoFormulario = parseFloat(datos.cabecera.neto || 0);
    
    // Validamos si hay diferencia mayor a 1 peso entre ítems y el Neto
    if (Math.abs(totalCalculadoItems - netoFormulario) > 1) {
      Swal.fire({
        title: '¡Cuidado con los montos!',
        text: `El Total de los Ítems ($${totalCalculadoItems.toFixed(2)}) no coincide con el Neto Gravado ($${netoFormulario}). ¿Deseás guardar igual?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, guardar',
        cancelButtonText: 'Revisar'
      }).then((result) => {
        if (result.isConfirmed) procesarGuardadoSQL(datos);
      });
    } else {
      procesarGuardadoSQL(datos);
    }
  };

  const procesarGuardadoSQL = (datos) => {
    // Acá aseguramos que el JSON tiene la estructura perfecta para una DB SQL (2 tablas: cabecera y detalle)
    const idGenerado = facturaEditando ? facturaEditando.cabecera.id : Date.now();
    
    const payloadSQL = {
      cabecera: {
        ...datos.cabecera,
        id: idGenerado,
        estado: facturaEditando ? facturaEditando.cabecera.estado : 'Pendiente'
      },
      // Le inyectamos a cada ítem el ID de la cabecera (como Foreign Key para SQL)
      detalle_items: datos.items.map(item => ({
        ...item,
        cabecera_id: idGenerado
      }))
    };
    
    agregarFactura(payloadSQL);
    Swal.fire({ icon: 'success', title: '¡Guardado!', text: 'El comprobante está listo en la bandeja.', timer: 2000, showConfirmButton: false });
    cancelarProceso();
  };

  return (
    <Card className="shadow-sm mb-4 border-0">
      <Card.Header className={`text-white d-flex align-items-center py-3 ${facturaEditando ? 'bg-warning text-dark' : 'bg-primary'}`}>
        <FaFileInvoice className="me-2 fs-5" />
        <h5 className="mb-0 fw-bold">{facturaEditando ? 'Editando Factura' : 'Procesar Nueva Factura'}</h5>
      </Card.Header>
      
      <Card.Body className="p-4">
        {!facturaEditando && (
          <div className="mb-4 p-4 border rounded bg-light text-center border-dashed">
            <Form.Group controlId="archivoFactura">
              <Form.Label className="d-block font-weight-bold text-secondary mb-3" style={{cursor: 'pointer'}}>
                <FaUpload size={28} className="mb-2 d-block mx-auto text-primary" />
                Haz clic para subir Factura
              </Form.Label>
              <Form.Control type="file" accept="image/*, application/pdf" onChange={procesarDocumento} disabled={escaneando} ref={archivoInputRef} className="mx-auto" style={{maxWidth: '400px'}} />
            </Form.Group>
            {escaneando && <div className="mt-3 text-primary"><Spinner animation="border" size="sm" /> Analizando...</div>}
          </div>
        )}

        <Form onSubmit={handleSubmit(manejarEnvio)}>
          <h6 className="text-primary border-bottom pb-2 mb-3 mt-4 fw-bold">1. Datos del Comprobante</h6>
          <Row className="mb-3">
            <Col md={3} className="mb-3 mb-md-0"><Form.Group><Form.Label className="small fw-bold">Tipo</Form.Label><Form.Select {...register("cabecera.tipoComprobante")}><option value="FA">Factura</option><option value="NC">Nota de Crédito</option></Form.Select></Form.Group></Col>
            <Col md={2} className="mb-3 mb-md-0"><Form.Group><Form.Label className="small fw-bold">Letra</Form.Label><Form.Select {...register("cabecera.letraComprobante")}><option value="A">A</option><option value="B">B</option><option value="C">C</option></Form.Select></Form.Group></Col>
            <Col md={4} className="mb-3 mb-md-0"><Form.Group><Form.Label className="small fw-bold">Razón Social</Form.Label><Form.Control type="text" {...register("cabecera.razonSocial")} /></Form.Group></Col>
            <Col md={3} className="mb-3 mb-md-0"><Form.Group><Form.Label className="small fw-bold">CUIT Emisor</Form.Label><Form.Control type="text" {...register("cabecera.cuit", { required: true })} isInvalid={!!errors.cabecera?.cuit} /></Form.Group></Col>
          </Row>
          <Row className="mb-4">
            <Col md={4} className="mb-3 mb-md-0"><Form.Group><Form.Label className="small fw-bold">Punto Vta.</Form.Label><Form.Control type="text" {...register("cabecera.puntoVenta")} /></Form.Group></Col>
            <Col md={4} className="mb-3 mb-md-0"><Form.Group><Form.Label className="small fw-bold">Nro. Comp.</Form.Label><Form.Control type="text" {...register("cabecera.numeroComprobante")} /></Form.Group></Col>
            <Col md={4} className="mb-3 mb-md-0"><Form.Group><Form.Label className="small fw-bold">Fecha</Form.Label><Form.Control type="date" {...register("cabecera.fechaEmision", { required: true })} isInvalid={!!errors.cabecera?.fechaEmision} /></Form.Group></Col>
          </Row>

          <h6 className="text-primary border-bottom pb-2 mb-3 mt-4 fw-bold d-flex justify-content-between align-items-center">
            2. Detalle de Ítems
            <Button variant="outline-primary" size="sm" onClick={() => append({ codigo: '', descripcion: '', cantidad: 1, precioUnitario: 0, alicuota: '21' })}>
              <FaPlus /> Fila
            </Button>
          </h6>
          
          {/* EL CONTENEDOR CON SCROLL Y TABLA ADAPTADA */}
          <div className="table-responsive mb-3 border rounded" style={{ maxHeight: '350px', overflowY: 'auto' }}>
            <Table size="sm" bordered hover className="align-middle mb-0" style={{ minWidth: '700px' }}>
              <thead className="bg-light text-muted small position-sticky top-0 shadow-sm" style={{ zIndex: 1 }}>
                <tr>
                  <th style={{minWidth: '100px'}}>Código</th>
                  <th style={{minWidth: '200px'}}>Descripción</th>
                  <th style={{minWidth: '80px'}}>Cant.</th>
                  <th style={{minWidth: '100px'}}>P. Unit. ($)</th>
                  <th style={{minWidth: '100px'}}>Subtotal ($)</th>
                  <th style={{minWidth: '90px'}}>IVA</th>
                  <th style={{minWidth: '50px'}} className="text-center"><FaTrash /></th>
                </tr>
              </thead>
              <tbody>
                {fields.map((item, index) => {
                  const cant = parseFloat(watchItems[index]?.cantidad) || 0;
                  const precio = parseFloat(watchItems[index]?.precioUnitario) || 0;
                  const subtotal = (cant * precio).toFixed(2);

                  return (
                  <tr key={item.id}>
                    <td><Form.Control size="sm" type="text" {...register(`items.${index}.codigo`)} /></td>
                    <td><Form.Control size="sm" type="text" {...register(`items.${index}.descripcion`)} /></td>
                    <td><Form.Control size="sm" type="number" step="0.01" {...register(`items.${index}.cantidad`)} /></td>
                    <td><Form.Control size="sm" type="number" step="0.01" {...register(`items.${index}.precioUnitario`)} /></td>
                    {/* SUBTOTAL CALCULADO */}
                    <td className="bg-light fw-bold text-secondary text-end align-middle px-2">
                      ${subtotal}
                    </td>
                    <td>
                      <Form.Select size="sm" {...register(`items.${index}.alicuota`)}>
                        <option value="21">21%</option><option value="10.5">10.5%</option><option value="27">27%</option><option value="0">0%</option>
                      </Form.Select>
                    </td>
                    <td className="text-center">
                      <Button variant="outline-danger" size="sm" onClick={() => remove(index)}><FaTimes /></Button>
                    </td>
                  </tr>
                )})}
              </tbody>
            </Table>
          </div>

          <h6 className="text-primary border-bottom pb-2 mb-3 mt-4 fw-bold">3. Importes Finales</h6>
          <Row className="mb-4">
            <Col md={3} className="mb-3 mb-md-0">
              <Form.Group>
                <Form.Label className="small fw-bold text-muted d-block">
                  Neto Gravado OCR ($)
                  <span className={`float-end fw-normal badge bg-${Math.abs(totalCalculadoItems - parseFloat(watchNeto || 0)) < 1 ? 'success' : 'danger'}`}>
                    Ítems: ${totalCalculadoItems.toFixed(2)}
                  </span>
                </Form.Label>
                <Form.Control type="number" step="0.01" {...register("cabecera.neto")} />
              </Form.Group>
            </Col>
            <Col md={3} className="mb-3 mb-md-0"><Form.Group><Form.Label className="small fw-bold">Monto IVA ($)</Form.Label><Form.Control type="number" step="0.01" {...register("cabecera.iva")} /></Form.Group></Col>
            <Col md={3} className="mb-3 mb-md-0"><Form.Group><Form.Label className="small fw-bold">Alícuotas IVA (%)</Form.Label><Form.Control type="text" {...register("cabecera.alicuotasIva")} /></Form.Group></Col>
            <Col md={3} className="mb-3 mb-md-0"><Form.Group><Form.Label className="small fw-bold text-primary">Total Factura ($)</Form.Label><Form.Control type="number" step="0.01" className="bg-primary text-white font-weight-bold" {...register("cabecera.total", { required: true })} isInvalid={!!errors.cabecera?.total} /></Form.Group></Col>
          </Row>

          <h6 className="text-primary border-bottom pb-2 mb-3 fw-bold">4. Percepciones e Impuestos</h6>
          <Row className="mb-3">
            {impuestosVisibles.map(id => {
              const lbl = TIPOS_IMPUESTOS.find(t => t.id === id)?.label;
              return (
                <Col md={4} key={id} className="mb-3">
                  <Form.Group>
                    <Form.Label className="d-flex justify-content-between small fw-bold">
                      <span className="text-truncate">{lbl} ($)</span>
                      <FaTrash className="text-danger" style={{cursor: 'pointer'}} onClick={() => quitarImpuesto(id)} />
                    </Form.Label>
                    <Form.Control type="number" step="0.01" {...register(`cabecera.${id}`)} />
                  </Form.Group>
                </Col>
              );
            })}
          </Row>

          <div className="bg-light p-3 rounded mb-4">
            <Row className="align-items-center">
              <Col md={6} className="mb-2 mb-md-0">
                <Form.Select size="sm" value={impuestoSeleccionado} onChange={(e) => setImpuestoSeleccionado(e.target.value)}>
                  <option value="">Agregar impuesto adicional...</option>
                  {TIPOS_IMPUESTOS.filter(t => !impuestosVisibles.includes(t.id)).map(t => (<option key={t.id} value={t.id}>{t.label}</option>))}
                </Form.Select>
              </Col>
              <Col md="auto"><Button variant="outline-primary" size="sm" onClick={agregarImpuestoManual} disabled={!impuestoSeleccionado}><FaPlus /> Agregar</Button></Col>
            </Row>
          </div>

          <div className="d-flex justify-content-between border-top pt-4">
            <Button variant="outline-danger" type="button" onClick={cancelarProceso} disabled={escaneando}><FaTimes className="me-2" />{facturaEditando ? 'Cancelar Edición' : 'Cancelar'}</Button>
            <Button variant="success" type="submit" disabled={escaneando} className="px-4 shadow-sm"><FaSave className="me-2" />{facturaEditando ? 'Guardar Cambios' : 'Confirmar y Guardar'}</Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
}