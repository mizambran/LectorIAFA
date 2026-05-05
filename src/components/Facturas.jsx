import React, { useState, useRef } from 'react';
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

const DICCIONARIO_QR_AFIP = {
  1: { tipo: 'FA', letra: 'A' }, 2: { tipo: 'ND', letra: 'A' }, 3: { tipo: 'NC', letra: 'A' },
  6: { tipo: 'FA', letra: 'B' }, 7: { tipo: 'ND', letra: 'B' }, 8: { tipo: 'NC', letra: 'B' },
  11: { tipo: 'FA', letra: 'C' }, 12: { tipo: 'ND', letra: 'C' }, 13: { tipo: 'NC', letra: 'C' },
  51: { tipo: 'FA', letra: 'M' }, 52: { tipo: 'ND', letra: 'M' }, 53: { tipo: 'NC', letra: 'M' }
};

export default function Facturas({ agregarFactura }) {
  const { register, handleSubmit, setValue, control, watch, formState: { errors }, reset, unregister } = useForm({
    defaultValues: { 
      cabecera: { tipoComprobante: 'FA', letraComprobante: 'C' },
      detalle_items: [{ codigo: '', descripcion: '', cantidad: 1, precioUnitario: 0, alicuota: '21' }] 
    }
  });

  const { fields, append, remove } = useFieldArray({ control, name: "detalle_items" });
  const watchItems = watch("detalle_items") || []; 
  const watchNeto = watch("cabecera.neto");
  
  const totalCalculadoItems = watchItems.reduce((acc, item) => acc + ((parseFloat(item.cantidad) || 0) * (parseFloat(item.precioUnitario) || 0)), 0);
  
  const [escaneando, setEscaneando] = useState(false);
  const [metodoLectura, setMetodoLectura] = useState(null);
  const archivoInputRef = useRef(null);
  const [impuestosVisibles, setImpuestosVisibles] = useState([]); 
  const [impuestoSeleccionado, setImpuestoSeleccionado] = useState("");

  const procesarDocumento = async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    
    setEscaneando(true);
    setMetodoLectura(null);
    setImpuestosVisibles([]); 

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

      let datosAfip = null;
      const codigoQR = jsQR(imageDataObj.data, imageDataObj.width, imageDataObj.height);
      
      if (codigoQR && codigoQR.data) {
        try {
          const url = new URL(codigoQR.data);
          const base64Data = url.searchParams.get('p');
          if (base64Data) {
            datosAfip = JSON.parse(atob(base64Data)); 
            setMetodoLectura('QR');
          }
        } catch (e) { console.log(e); }
      }

      if (datosAfip) {
        const cuitStr = String(datosAfip.cuit);
        setValue('cabecera.cuit', `${cuitStr.slice(0, 2)}-${cuitStr.slice(2, 10)}-${cuitStr.slice(10)}`);
        setValue('cabecera.fechaEmision', datosAfip.fecha); 
        setValue('cabecera.puntoVenta', String(datosAfip.ptoVta).padStart(5, '0'));
        setValue('cabecera.numeroComprobante', String(datosAfip.nroCmp).padStart(8, '0'));
        setValue('cabecera.total', datosAfip.importe);

        const tipoLetra = DICCIONARIO_QR_AFIP[datosAfip.tipoCmp];
        if (tipoLetra) {
          setValue('cabecera.tipoComprobante', tipoLetra.tipo);
          setValue('cabecera.letraComprobante', tipoLetra.letra);
        }
      }

      const { data: { text } } = await Tesseract.recognize(imagenParaOCR, 'spa');
      const textoLimpio = text.toLowerCase();
      
      if (!datosAfip) setMetodoLectura('OCR'); 

      if (!datosAfip) {
        const codMatch = text.match(/c[oó0]d[^\d]{0,5}(001|002|003|006|007|008|011|012|013|051|052|053)/i);
        if (codMatch) {
          const codigoAfip = codMatch[1];
          const tipoLetra = DICCIONARIO_QR_AFIP[parseInt(codigoAfip)] || { tipo: 'FA', letra: 'C' };
          setValue('cabecera.tipoComprobante', tipoLetra.tipo);
          setValue('cabecera.letraComprobante', tipoLetra.letra);
        } else {
          if (/nota de cr[eé]dito/i.test(text)) setValue('cabecera.tipoComprobante', 'NC');
          else if (/nota de d[eé]bito/i.test(text)) setValue('cabecera.tipoComprobante', 'ND');
          else setValue('cabecera.tipoComprobante', 'FA');
          const letraMatch = text.match(/(?:factura|nota de cr[eé]dito|nota de d[eé]bito|documento)[^\w]{0,10}([A-CEMX])\b/i);
          if (letraMatch) setValue('cabecera.letraComprobante', letraMatch[1].toUpperCase());
        }

        const comprobanteCombo = text.match(/(?:comp[\w\s\.]*n[ro°º]*|factura)[^\d]*(\d{4,5})\s*[-_]\s*(\d{8})/i);
        if (comprobanteCombo) {
          setValue('cabecera.puntoVenta', comprobanteCombo[1]);
          setValue('cabecera.numeroComprobante', comprobanteCombo[2]);
        } else {
          const pvMatch = text.match(/punto de venta[^\d]*(\d{4,5})/i);
          const nroMatch = text.match(/comp[^\d]*n[ro°º]+[^\d]*(\d{8})/i);
          if (pvMatch) setValue('cabecera.puntoVenta', pvMatch[1]);
          if (nroMatch) setValue('cabecera.numeroComprobante', nroMatch[1]);
        }

        const cuitEncontrado = text.match(/\b(20|23|24|27|30|33|34)[\s\-\.]*\d{8}[\s\-\.]*\d{1}\b/);
        if (cuitEncontrado) {
          let cuitLimpio = cuitEncontrado[0].replace(/\D/g, ''); 
          setValue('cabecera.cuit', `${cuitLimpio.slice(0, 2)}-${cuitLimpio.slice(2, 10)}-${cuitLimpio.slice(10)}`);
        }

        const fechaEncontrada = text.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
        if (fechaEncontrada) setValue('cabecera.fechaEmision', `${fechaEncontrada[3]}-${fechaEncontrada[2]}-${fechaEncontrada[1]}`);
        else setValue('cabecera.fechaEmision', new Date().toISOString().split('T')[0]); 
      }

      let rs = "";
      const razonSocialMatch = text.match(/raz[oó]n social[^\n\w]*([^\n]+)/i);
      if (razonSocialMatch) rs = razonSocialMatch[1];
      else {
        const tipoEmpresaMatch = text.match(/^([^\n]{3,50}?\b(?:S\.A\.|S\.R\.L\.|S\.A\.S\.|S\.H\.|S\.A|S\.R\.L|SA|SRL|SAS|SH)\b)/im);
        if (tipoEmpresaMatch) rs = tipoEmpresaMatch[1];
      }
      if (rs) {
        rs = rs.replace(/fecha de emisi[oó]n.*/i, '').replace(/c\.?u\.?i\.?t\.?.*/i, '').replace(/domicilio.*/i, '').trim();
        setValue('cabecera.razonSocial', rs);
      }

      const extraerMonto = (texto, palabrasClave) => {
        const patron = new RegExp(`(?:${palabrasClave.join('|')})[^0-9]{0,30}(\\d{1,3}(?:[.\\s]\\d{3})*[,.]\\d{2}|\\d+[,.]\\d{2})`, 'i');
        const resultado = texto.match(patron);
        return resultado ? resultado[1].replace(/[\s.]/g, '').replace(',', '.') : '';
      };

      setValue('cabecera.neto', extraerMonto(textoLimpio, ['importe neto gravado', 'subtotal', 'neto gravado'])); 
      if (!datosAfip) setValue('cabecera.total', extraerMonto(textoLimpio, ['importe total', 'total'])); 

      const lineasIva = text.match(/(?:[il1]\.?\s*v\.?\s*a\.?|impuesto al valor agregado)[^\n]+/gi);
      let totalIvaCalculado = 0;
      let alicuotasDetectadas = [];

      if (lineasIva) {
        lineasIva.forEach(linea => {
          if (/condici[oó]n|responsable/i.test(linea)) return;
          const porcentajeMatch = linea.match(/(\d+(?:[.,]\d+)?)%/);
          if (porcentajeMatch) alicuotasDetectadas.push(`${porcentajeMatch[1]}%`);

          let lineaLimpia = linea.replace(/\d+(?:[.,]\d+)?\s*%/, '');
          const montosMatch = lineaLimpia.match(/(\d{1,3}(?:[.\s]\d{3})*[,.]\d{2}|\d+[,.]\d{2})/g);
          if (montosMatch) {
            const ultimoMonto = montosMatch[montosMatch.length - 1];
            let montoNum = parseFloat(ultimoMonto.replace(/[\s.]/g, '').replace(',', '.'));
            if (montoNum > 0) totalIvaCalculado += montoNum;
          }
        });
      }

      if (totalIvaCalculado > 0) {
        setValue('cabecera.iva', totalIvaCalculado.toFixed(2));
        if (alicuotasDetectadas.length > 0) setValue('cabecera.alicuotasIva', [...new Set(alicuotasDetectadas)].join(' - '));
      } else {
        const ivaFallback = extraerMonto(textoLimpio, ['i\\.v\\.a\\.', 'i\\.v\\.a', 'iva']);
        if (ivaFallback) setValue('cabecera.iva', ivaFallback);
      }

      const busquedaImpuestos = [
        { id: 'percepIva', valor: extraerMonto(textoLimpio, ['percep.*iva', 'ret.*iva']) },
        { id: 'percepIibbTuc', valor: extraerMonto(textoLimpio, ['percep.*iibb.*tuc', 'ingresos brutos.*tuc']) },
        { id: 'percepIibbSalta', valor: extraerMonto(textoLimpio, ['percep.*iibb.*salta']) },
        { id: 'percepIibbNacional', valor: extraerMonto(textoLimpio, ['percep.*iibb', 'perc.*ingresos brutos']) },
        { id: 'impInternos', valor: extraerMonto(textoLimpio, ['imp.*interno', 'impuestos internos']) }
      ];

      const impuestosEncontrados = [];
      busquedaImpuestos.forEach(imp => {
        if (imp.valor) {
          setValue(`cabecera.${imp.id}`, imp.valor);
          impuestosEncontrados.push(imp.id);
        }
      });
      setImpuestosVisibles(impuestosEncontrados);

      Swal.fire({ icon: 'success', title: '¡Lectura completada!', toast: true, position: 'top-end', timer: 3000, showConfirmButton: false });

    } catch (error) {
      Swal.fire('Error', 'Hubo un problema al procesar el documento.', 'error');
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
    reset({ cabecera: { tipoComprobante: 'FA', letraComprobante: 'C' }, detalle_items: [{ codigo: '', descripcion: '', cantidad: 1, precioUnitario: 0, alicuota: '21' }] }); 
    setMetodoLectura(null); setImpuestosVisibles([]); setImpuestoSeleccionado("");
    if (archivoInputRef.current) archivoInputRef.current.value = ""; 
  };

  const manejarEnvio = (datos) => {
    const netoFormulario = parseFloat(datos.cabecera.neto || 0);
    if (Math.abs(totalCalculadoItems - netoFormulario) > 1) {
      Swal.fire({
        title: '¡Revisá los montos!',
        text: `El Total de la tabla de Ítems ($${totalCalculadoItems.toFixed(2)}) no coincide con el Neto Gravado OCR ($${netoFormulario}). ¿Deseás guardar igual?`,
        icon: 'warning', showCancelButton: true, confirmButtonColor: '#198754', cancelButtonColor: '#6c757d', confirmButtonText: 'Sí, guardar', cancelButtonText: 'Cancelar y revisar'
      }).then((result) => { if (result.isConfirmed) procesarGuardadoSQL(datos); });
    } else procesarGuardadoSQL(datos);
  };

  const procesarGuardadoSQL = (datos) => {
    const idGenerado = Date.now();
    const payloadSQL = {
      cabecera: { ...datos.cabecera, id: idGenerado, estado: 'Pendiente' },
      detalle_items: datos.detalle_items.map(item => ({ ...item, cabecera_id: idGenerado }))
    };
    agregarFactura(payloadSQL);
    Swal.fire({ icon: 'success', title: '¡Guardado!', text: 'El comprobante está listo en la bandeja.', timer: 2000, showConfirmButton: false });
    cancelarProceso();
  };

  return (
    <Card className="shadow-sm mb-4 border-0">
      <Card.Header className="bg-primary text-white d-flex align-items-center py-3">
        <FaFileInvoice className="me-2 fs-5" />
        <h5 className="mb-0 fw-bold">Procesar Factura</h5>
      </Card.Header>
      
      <Card.Body className="p-4">
        <div className="mb-4 p-4 border rounded bg-light text-center border-dashed">
          <Form.Group controlId="archivoFactura">
            <Form.Label className="d-block font-weight-bold text-secondary mb-3" style={{cursor: 'pointer'}}>
              <FaUpload size={28} className="mb-2 d-block mx-auto text-primary" />
              Haz clic para subir Factura (PDF, PNG, JPG)
            </Form.Label>
            <Form.Control type="file" accept="image/png, image/jpeg, application/pdf" onChange={procesarDocumento} disabled={escaneando} ref={archivoInputRef} className="mx-auto" style={{maxWidth: '400px'}} />
          </Form.Group>
          {escaneando && <div className="mt-3 text-primary fw-bold"><Spinner animation="border" size="sm" className="me-2" /> IA Analizando comprobante...</div>}
        </div>

        {metodoLectura === 'QR' && <Alert variant="success" className="small d-flex align-items-center"><FaQrcode className="me-2 fs-5" /><div><strong>¡Código QR Detectado!</strong> Validamos CUIT, Fecha y Total.</div></Alert>}
        {metodoLectura === 'OCR' && <Alert variant="info" className="small"><strong>Lectura por OCR:</strong> No se detectó QR fiscal. Revisá con atención.</Alert>}

        <Form onSubmit={handleSubmit(manejarEnvio)}>
          <h6 className="text-primary border-bottom pb-2 mb-3 mt-4 fw-bold">1. Datos del Comprobante</h6>
          <Row className="mb-3">
            <Col md={3} className="mb-3 mb-md-0"><Form.Group><Form.Label className="small text-muted fw-bold">Tipo</Form.Label><Form.Select {...register("cabecera.tipoComprobante")}><option value="FA">Factura</option><option value="NC">Nota de Crédito</option><option value="ND">Nota de Débito</option><option value="RE">Recibo</option></Form.Select></Form.Group></Col>
            <Col md={2} className="mb-3 mb-md-0"><Form.Group><Form.Label className="small text-muted fw-bold">Letra</Form.Label><Form.Select {...register("cabecera.letraComprobante")}><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="E">E</option><option value="M">M</option><option value="X">X</option></Form.Select></Form.Group></Col>
            <Col md={4} className="mb-3 mb-md-0"><Form.Group><Form.Label className="small text-muted fw-bold">Razón Social</Form.Label><Form.Control type="text" placeholder="Nombre de la empresa" {...register("cabecera.razonSocial")} /></Form.Group></Col>
            <Col md={3} className="mb-3 mb-md-0"><Form.Group><Form.Label className="small text-muted fw-bold">CUIT Emisor</Form.Label><Form.Control type="text" placeholder="Ej: 30-12345678-9" {...register("cabecera.cuit", { required: true })} isInvalid={!!errors.cabecera?.cuit} /></Form.Group></Col>
          </Row>

          <Row className="mb-4">
            <Col md={4} className="mb-3 mb-md-0"><Form.Group><Form.Label className="small text-muted fw-bold">Punto Vta.</Form.Label><Form.Control type="text" placeholder="Ej: 00002" {...register("cabecera.puntoVenta")} /></Form.Group></Col>
            <Col md={4} className="mb-3 mb-md-0"><Form.Group><Form.Label className="small text-muted fw-bold">Nro. Comprobante</Form.Label><Form.Control type="text" placeholder="Ej: 00000032" {...register("cabecera.numeroComprobante")} /></Form.Group></Col>
            <Col md={4} className="mb-3 mb-md-0"><Form.Group><Form.Label className="small text-muted fw-bold">Fecha de Emisión</Form.Label><Form.Control type="date" {...register("cabecera.fechaEmision", { required: true })} isInvalid={!!errors.cabecera?.fechaEmision} /></Form.Group></Col>
          </Row>

          <h6 className="text-primary border-bottom pb-2 mb-3 mt-4 fw-bold d-flex justify-content-between align-items-center">
            2. Detalle de Ítems
            <Button variant="outline-primary" size="sm" onClick={() => append({ codigo: '', descripcion: '', cantidad: 1, precioUnitario: 0, alicuota: '21' })}><FaPlus /> Agregar Fila</Button>
          </h6>
          
          <div className="table-responsive mb-3 border rounded shadow-sm" style={{ maxHeight: '350px', overflowY: 'auto' }}>
            <Table size="sm" bordered hover className="align-middle mb-0" style={{ minWidth: '750px' }}>
              <thead className="bg-light text-muted small position-sticky top-0" style={{ zIndex: 1 }}>
                <tr>
                  <th style={{minWidth: '100px'}}>Código</th><th style={{minWidth: '220px'}}>Descripción</th><th style={{minWidth: '80px'}}>Cant.</th>
                  <th style={{minWidth: '110px'}}>P. Unit. ($)</th><th style={{minWidth: '110px'}}>Subtotal ($)</th><th style={{minWidth: '90px'}}>IVA</th><th style={{width: '60px'}} className="text-center">Quitar</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((item, index) => {
                  const cant = parseFloat(watchItems[index]?.cantidad) || 0;
                  const precio = parseFloat(watchItems[index]?.precioUnitario) || 0;
                  return (
                  <tr key={item.id}>
                    <td><Form.Control size="sm" type="text" placeholder="Cód..." {...register(`detalle_items.${index}.codigo`)} /></td>
                    <td><Form.Control size="sm" type="text" placeholder="Producto..." {...register(`detalle_items.${index}.descripcion`)} /></td>
                    <td><Form.Control size="sm" type="number" step="0.01" {...register(`detalle_items.${index}.cantidad`)} /></td>
                    <td><Form.Control size="sm" type="number" step="0.01" {...register(`detalle_items.${index}.precioUnitario`)} /></td>
                    <td className="bg-light fw-bold text-secondary text-end px-2 align-middle border-start">${(cant * precio).toFixed(2)}</td>
                    <td><Form.Select size="sm" {...register(`detalle_items.${index}.alicuota`)}><option value="21">21%</option><option value="10.5">10.5%</option><option value="27">27%</option><option value="0">0%</option></Form.Select></td>
                    <td className="text-center"><Button variant="outline-danger" size="sm" onClick={() => remove(index)}><FaTrash /></Button></td>
                  </tr>
                )})}
              </tbody>
            </Table>
          </div>

          <h6 className="text-primary border-bottom pb-2 mb-3 mt-4 fw-bold">3. Importes Finales</h6>
          <Row className="mb-4 align-items-end">
            <Col md={3} className="mb-3 mb-md-0"><Form.Group><Form.Label className="small text-muted fw-bold d-block">Neto($)<span className={`float-end mt-1 mb-1 badge bg-${Math.abs(totalCalculadoItems - parseFloat(watchNeto || 0)) < 1 ? 'success' : 'danger'}`}>Suma Ítems: ${totalCalculadoItems.toFixed(2)}</span></Form.Label><Form.Control type="number" step="0.01" {...register("cabecera.neto")} /></Form.Group></Col>
            <Col md={3} className="mb-3 mb-md-0"><Form.Group><Form.Label className="small text-muted fw-bold mb-md-4">IVA ($)</Form.Label><Form.Control type="number" step="0.01" {...register("cabecera.iva")} /></Form.Group></Col>
            <Col md={3} className="mb-3 mb-md-0"><Form.Group><Form.Label className="small text-muted fw-bold mb-md-4">Alícuotas IVA (%)</Form.Label><Form.Control type="text" placeholder="Ej: 21% - 10.5%" {...register("cabecera.alicuotasIva")} /></Form.Group></Col>
            <Col md={3} className="mb-3 mb-md-0"><Form.Group><Form.Label className="small text-primary fw-bold mb-md-4">Total Factura ($)</Form.Label><Form.Control type="number" step="0.01" className="bg-primary text-white font-weight-bold" {...register("cabecera.total", { required: true })} isInvalid={!!errors.cabecera?.total} /></Form.Group></Col>
          </Row>

          <h6 className="text-primary border-bottom pb-2 mb-3 fw-bold">4. Percepciones e Impuestos</h6>
          <Row className="mb-3">
            {impuestosVisibles.map(id => (<Col md={4} key={id} className="mb-3"><Form.Group><Form.Label className="d-flex justify-content-between align-items-center small fw-bold text-secondary"><span className="text-truncate" style={{maxWidth: '85%'}}>{TIPOS_IMPUESTOS.find(t => t.id === id)?.label} ($)</span><FaTrash className="text-danger" style={{cursor: 'pointer'}} onClick={() => quitarImpuesto(id)} /></Form.Label><Form.Control type="number" step="0.01" {...register(`cabecera.${id}`)} /></Form.Group></Col>))}
          </Row>

          <div className="bg-light p-3 rounded mb-4">
            <Row className="align-items-end">
              <Col md={6} className="mb-2 mb-md-0"><Form.Group><Form.Label className="small text-muted fw-bold">Agregar impuesto adicional:</Form.Label><Form.Select value={impuestoSeleccionado} onChange={(e) => setImpuestoSeleccionado(e.target.value)}><option value="">Seleccionar impuesto...</option>{TIPOS_IMPUESTOS.filter(t => !impuestosVisibles.includes(t.id)).map(t => (<option key={t.id} value={t.id}>{t.label}</option>))}</Form.Select></Form.Group></Col>
              <Col md="auto"><Button variant="outline-primary" onClick={agregarImpuestoManual} disabled={!impuestoSeleccionado}><FaPlus className="me-1" /> Agregar</Button></Col>
            </Row>
          </div>

          <div className="d-flex flex-column flex-md-row justify-content-between border-top pt-4 mt-2 gap-2">
            <Button variant="outline-danger" type="button" onClick={cancelarProceso} disabled={escaneando} className="w-100 w-md-auto py-2 py-md-1"><FaTimes className="me-2" />Cancelar Carga</Button>
            <Button variant="success" type="submit" disabled={escaneando} size="lg" className="w-100 w-md-auto px-5 shadow-sm"><FaSave className="me-2" />Confirmar y Guardar</Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
}