import React, { useState, useRef } from 'react';
import { Form, Button, Row, Col, Card, Spinner, Alert } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import jsQR from 'jsqr';
import { FaFileInvoice, FaUpload, FaSave, FaPlus, FaTrash, FaTimes, FaQrcode } from 'react-icons/fa';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const TIPOS_IMPUESTOS = [
  { id: 'percepIva', label: 'Percepción IVA' },
  { id: 'percepIibbTuc', label: 'Percep. IIBB Tucumán' },
  { id: 'percepIibbSalta', label: 'Percep. IIBB Salta' },
  { id: 'percepIibbNacional', label: 'Percep. IIBB (Otras)' },
  { id: 'impInternos', label: 'Impuestos Internos' },
  { id: 'otrasPercepciones', label: 'Otras Percepciones/Tasas' }
];

const DICCIONARIO_QR_AFIP = {
  1: { tipo: 'FA', letra: 'A' }, 2: { tipo: 'ND', letra: 'A' }, 3: { tipo: 'NC', letra: 'A' },
  6: { tipo: 'FA', letra: 'B' }, 7: { tipo: 'ND', letra: 'B' }, 8: { tipo: 'NC', letra: 'B' },
  11: { tipo: 'FA', letra: 'C' }, 12: { tipo: 'ND', letra: 'C' }, 13: { tipo: 'NC', letra: 'C' },
  51: { tipo: 'FA', letra: 'M' }, 52: { tipo: 'ND', letra: 'M' }, 53: { tipo: 'NC', letra: 'M' }
};

export default function Facturas({ agregarFactura }) {
  const { register, handleSubmit, setValue, formState: { errors }, reset, unregister } = useForm({
    defaultValues: { tipoComprobante: 'FA', letraComprobante: 'C' }
  });
  
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
            viewport = { width: img.width, height: img.height };
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
        } catch (e) {
          console.log("Se encontró un QR pero no era el formato de AFIP", e);
        }
      }

      if (datosAfip) {
        const cuitStr = String(datosAfip.cuit);
        setValue('cuit', `${cuitStr.slice(0, 2)}-${cuitStr.slice(2, 10)}-${cuitStr.slice(10)}`);
        setValue('fechaEmision', datosAfip.fecha); 
        setValue('puntoVenta', String(datosAfip.ptoVta).padStart(5, '0'));
        setValue('numeroComprobante', String(datosAfip.nroCmp).padStart(8, '0'));
        setValue('total', datosAfip.importe);

        const tipoLetra = DICCIONARIO_QR_AFIP[datosAfip.tipoCmp];
        if (tipoLetra) {
          setValue('tipoComprobante', tipoLetra.tipo);
          setValue('letraComprobante', tipoLetra.letra);
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
          setValue('tipoComprobante', tipoLetra.tipo);
          setValue('letraComprobante', tipoLetra.letra);
        } else {
          if (/nota de cr[eé]dito/i.test(text)) setValue('tipoComprobante', 'NC');
          else if (/nota de d[eé]bito/i.test(text)) setValue('tipoComprobante', 'ND');
          else setValue('tipoComprobante', 'FA');

          const letraMatch = text.match(/(?:factura|nota de cr[eé]dito|nota de d[eé]bito|documento)[^\w]{0,10}([A-CEMX])\b/i);
          if (letraMatch) setValue('letraComprobante', letraMatch[1].toUpperCase());
        }

        const comprobanteCombo = text.match(/(?:comp[\w\s\.]*n[ro°º]*|factura)[^\d]*(\d{4,5})\s*[-_]\s*(\d{8})/i);
        if (comprobanteCombo) {
          setValue('puntoVenta', comprobanteCombo[1]);
          setValue('numeroComprobante', comprobanteCombo[2]);
        } else {
          const pvMatch = text.match(/punto de venta[^\d]*(\d{4,5})/i);
          const nroMatch = text.match(/comp[^\d]*n[ro°º]+[^\d]*(\d{8})/i);
          if (pvMatch) setValue('puntoVenta', pvMatch[1]);
          if (nroMatch) setValue('numeroComprobante', nroMatch[1]);
        }

        const cuitEncontrado = text.match(/\b(20|23|24|27|30|33|34)[\s\-\.]*\d{8}[\s\-\.]*\d{1}\b/);
        if (cuitEncontrado) {
          let cuitLimpio = cuitEncontrado[0].replace(/\D/g, ''); 
          setValue('cuit', `${cuitLimpio.slice(0, 2)}-${cuitLimpio.slice(2, 10)}-${cuitLimpio.slice(10)}`);
        }

        const fechaEncontrada = text.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
        if (fechaEncontrada) {
          setValue('fechaEmision', `${fechaEncontrada[3]}-${fechaEncontrada[2]}-${fechaEncontrada[1]}`);
        } else {
          setValue('fechaEmision', new Date().toISOString().split('T')[0]); 
        }
      }

      let rs = "";
      const razonSocialMatch = text.match(/raz[oó]n social[^\n\w]*([^\n]+)/i);
      if (razonSocialMatch) {
        rs = razonSocialMatch[1];
      } else {
        const tipoEmpresaMatch = text.match(/^([^\n]{3,50}?\b(?:S\.A\.|S\.R\.L\.|S\.A\.S\.|S\.H\.|S\.A|S\.R\.L|SA|SRL|SAS|SH)\b)/im);
        if (tipoEmpresaMatch) rs = tipoEmpresaMatch[1];
      }
      if (rs) {
        rs = rs.replace(/fecha de emisi[oó]n.*/i, '').replace(/c\.?u\.?i\.?t\.?.*/i, '').replace(/domicilio.*/i, '').trim();
        setValue('razonSocial', rs);
      }

      const extraerMonto = (texto, palabrasClave) => {
        const patron = new RegExp(`(?:${palabrasClave.join('|')})[^0-9]{0,30}(\\d{1,3}(?:[.\\s]\\d{3})*[,.]\\d{2}|\\d+[,.]\\d{2})`, 'i');
        const resultado = texto.match(patron);
        if (resultado) {
          let numeroLimpio = resultado[1].replace(/[\s.]/g, ''); 
          return numeroLimpio.replace(',', '.'); 
        }
        return '';
      };

      setValue('neto', extraerMonto(textoLimpio, ['importe neto gravado', 'subtotal', 'neto gravado'])); 
      if (!datosAfip) setValue('total', extraerMonto(textoLimpio, ['importe total', 'total'])); 

      // --- 6. LÓGICA NINJA DEL IVA (Súper Agresiva Nivel Dios) ---
      // Tesseract a veces lee "I.V.A." como "1.V.A.", "L.V.A." o "I VA"
      const lineasIva = text.match(/(?:[il1]\.?\s*v\.?\s*a\.?|impuesto al valor agregado)[^\n]+/gi);
      let totalIvaCalculado = 0;
      let alicuotasDetectadas = [];

      if (lineasIva) {
        lineasIva.forEach(linea => {
          if (/condici[oó]n|responsable/i.test(linea)) return;

          const porcentajeMatch = linea.match(/(\d+(?:[.,]\d+)?)%/);
          if (porcentajeMatch) alicuotasDetectadas.push(`${porcentajeMatch[1]}%`);

          // Magia: Borramos el porcentaje de la línea (ej: "21.0%")
          // Así evitamos que el OCR se confunda y lo tome como un importe si Tesseract lo leyó mal
          let lineaLimpia = linea.replace(/\d+(?:[.,]\d+)?\s*%/, '');
          
          const montosMatch = lineaLimpia.match(/(\d{1,3}(?:[.\s]\d{3})*[,.]\d{2}|\d+[,.]\d{2})/g);

          if (montosMatch) {
            const ultimoMonto = montosMatch[montosMatch.length - 1];
            let montoNum = parseFloat(ultimoMonto.replace(/[\s.]/g, '').replace(',', '.'));
            
            if (montoNum > 0) {
              totalIvaCalculado += montoNum;
            }
          }
        });
      }

      if (totalIvaCalculado > 0) {
        setValue('iva', totalIvaCalculado.toFixed(2));
        if (alicuotasDetectadas.length > 0) setValue('alicuotasIva', [...new Set(alicuotasDetectadas)].join(' - '));
      } else {
        // Super Fallback si la regex de línea falló
        const ivaFallback = extraerMonto(textoLimpio, ['i\\.v\\.a\\.', 'i\\.v\\.a', 'iva']);
        if (ivaFallback) setValue('iva', ivaFallback);
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
          setValue(imp.id, imp.valor);
          impuestosEncontrados.push(imp.id);
        }
      });
      setImpuestosVisibles(impuestosEncontrados);

    } catch (error) {
      console.error("Error al procesar el documento:", error);
      alert("Hubo un error al leer la factura. Revisá la consola.");
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
    unregister(idImpuesto); 
  };

  const cancelarProceso = () => {
    reset({
      tipoComprobante: 'FA', letraComprobante: 'C',
      razonSocial: '', cuit: '', puntoVenta: '', numeroComprobante: '',
      fechaEmision: '', neto: '', iva: '', alicuotasIva: '', total: '',
      percepIva: '', percepIibbTuc: '', percepIibbSalta: '', percepIibbNacional: '', impInternos: ''
    }); 
    setMetodoLectura(null);
    setImpuestosVisibles([]);
    setImpuestoSeleccionado("");
    if (archivoInputRef.current) {
      archivoInputRef.current.value = ""; 
    }
  };

  const manejarEnvio = (datos) => {
    const nuevaFactura = { ...datos, id: Date.now(), estado: 'Pendiente' };
    agregarFactura(nuevaFactura);
    cancelarProceso(); 
  };

  return (
    <Card className="shadow-sm mb-4 border-0">
      <Card.Header className="bg-primary text-white d-flex align-items-center py-3">
        <FaFileInvoice className="me-2 fs-5" />
        <h5 className="mb-0 fw-bold">Procesar Documento</h5>
      </Card.Header>
      
      <Card.Body className="p-4">
        <div className="mb-4 p-4 border rounded bg-light text-center border-dashed">
          <Form.Group controlId="archivoFactura">
            <Form.Label className="d-block font-weight-bold text-secondary mb-3" style={{cursor: 'pointer'}}>
              <FaUpload size={28} className="mb-2 d-block mx-auto text-primary" />
              Haz clic para subir Factura (PDF, PNG, JPG)
            </Form.Label>
            <Form.Control 
              type="file" 
              accept="image/png, image/jpeg, application/pdf" 
              onChange={procesarDocumento}
              disabled={escaneando}
              ref={archivoInputRef} 
              className="mx-auto"
              style={{maxWidth: '400px'}}
            />
          </Form.Group>
          {escaneando && (
            <div className="mt-3 text-primary fw-bold">
              <Spinner animation="border" size="sm" className="me-2" />
              IA Analizando comprobante...
            </div>
          )}
        </div>

        {metodoLectura === 'QR' && (
          <Alert variant="success" className="small d-flex align-items-center">
            <FaQrcode className="me-2 fs-5" />
            <div>
              <strong>¡Código QR Detectado!</strong> Validamos el CUIT, Fecha y Total directamente de AFIP. OCR extrajo el resto.
            </div>
          </Alert>
        )}
        {metodoLectura === 'OCR' && (
          <Alert variant="info" className="small">
            <strong>Lectura por OCR:</strong> No se detectó QR fiscal (posible Factura X o imagen borrosa). Por favor, verificá todos los campos minuciosamente.
          </Alert>
        )}

        <Form onSubmit={handleSubmit(manejarEnvio)}>
          <h6 className="text-primary border-bottom pb-2 mb-3 mt-4 fw-bold">1. Datos del Comprobante</h6>
          
          <Row className="mb-3">
            <Col md={3}>
              <Form.Group>
                <Form.Label className="small text-muted fw-bold">Tipo</Form.Label>
                <Form.Select {...register("tipoComprobante")}>
                  <option value="FA">Factura</option>
                  <option value="NC">Nota de Crédito</option>
                  <option value="ND">Nota de Débito</option>
                  <option value="RE">Recibo</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={2}>
              <Form.Group>
                <Form.Label className="small text-muted fw-bold">Letra</Form.Label>
                <Form.Select {...register("letraComprobante")}>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="E">E</option>
                  <option value="M">M</option>
                  <option value="X">X</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label className="small text-muted fw-bold">Razón Social</Form.Label>
                <Form.Control type="text" placeholder="Nombre de la empresa" {...register("razonSocial")} />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label className="small text-muted fw-bold">CUIT Emisor</Form.Label>
                <Form.Control 
                  type="text" 
                  placeholder="Ej: 30-12345678-9"
                  {...register("cuit", { required: "El CUIT es obligatorio" })}
                  isInvalid={!!errors.cuit}
                />
              </Form.Group>
            </Col>
          </Row>

          <Row className="mb-4">
            <Col md={4}>
              <Form.Group>
                <Form.Label className="small text-muted fw-bold">Punto Vta.</Form.Label>
                <Form.Control type="text" placeholder="Ej: 00002" {...register("puntoVenta")} />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label className="small text-muted fw-bold">Nro. Comprobante</Form.Label>
                <Form.Control type="text" placeholder="Ej: 00000032" {...register("numeroComprobante")} />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label className="small text-muted fw-bold">Fecha de Emisión</Form.Label>
                <Form.Control 
                  type="date" 
                  {...register("fechaEmision", { required: "La fecha es obligatoria" })}
                  isInvalid={!!errors.fechaEmision}
                />
              </Form.Group>
            </Col>
          </Row>

          <h6 className="text-primary border-bottom pb-2 mb-3 fw-bold">2. Importes y Totales</h6>
          <Row className="mb-4">
            <Col md={3}>
              <Form.Group>
                <Form.Label className="small text-muted fw-bold">Neto Gravado ($)</Form.Label>
                <Form.Control type="number" step="0.01" {...register("neto")} />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label className="small text-muted fw-bold">Monto IVA ($)</Form.Label>
                <Form.Control type="number" step="0.01" {...register("iva")} />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label className="small text-muted fw-bold">Alícuotas IVA (%)</Form.Label>
                <Form.Control type="text" placeholder="Ej: 21% - 10.5%" {...register("alicuotasIva")} />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label className="small text-primary fw-bold">Total Factura ($)</Form.Label>
                <Form.Control 
                  type="number" 
                  step="0.01" 
                  className="bg-primary text-white font-weight-bold"
                  {...register("total", { required: "El total es obligatorio" })} 
                  isInvalid={!!errors.total}
                />
              </Form.Group>
            </Col>
          </Row>

          <h6 className="text-primary border-bottom pb-2 mb-3 fw-bold">3. Percepciones e Impuestos</h6>
          <Row className="mb-3">
            {impuestosVisibles.map(idActivo => {
              const infoImpuesto = TIPOS_IMPUESTOS.find(t => t.id === idActivo);
              return (
                <Col md={4} key={idActivo} className="mb-3">
                  <Form.Group>
                    <Form.Label className="d-flex justify-content-between align-items-center small fw-bold text-secondary">
                      <span className="text-truncate" style={{maxWidth: '85%'}}>{infoImpuesto?.label} ($)</span>
                      <FaTrash 
                        className="text-danger" 
                        style={{cursor: 'pointer'}} 
                        onClick={() => quitarImpuesto(idActivo)}
                      />
                    </Form.Label>
                    <Form.Control type="number" step="0.01" {...register(idActivo)} />
                  </Form.Group>
                </Col>
              );
            })}
          </Row>

          <div className="bg-light p-3 rounded mb-4">
            <Row className="align-items-end">
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="small text-muted fw-bold">Agregar impuesto adicional:</Form.Label>
                  <Form.Select 
                    value={impuestoSeleccionado} 
                    onChange={(e) => setImpuestoSeleccionado(e.target.value)}
                  >
                    <option value="">Seleccionar impuesto...</option>
                    {TIPOS_IMPUESTOS
                      .filter(t => !impuestosVisibles.includes(t.id))
                      .map(t => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md="auto">
                <Button 
                  variant="success" 
                  onClick={agregarImpuestoManual}
                  disabled={!impuestoSeleccionado}
                  className='mt-1'
                >
                  <FaPlus className="me-1" /> Agregar
                </Button>
              </Col>
            </Row>
          </div>

          <div className="d-flex justify-content-between border-top pt-4 mt-2">
            <Button 
              variant="outline-danger" 
              type="button" 
              onClick={cancelarProceso}
              disabled={escaneando}
            >
              <FaTimes className="me-2" />
              Cancelar
            </Button>
            
            <Button variant="success" type="submit" disabled={escaneando} size="lg" className="px-5 shadow-sm">
              <FaSave className="me-2" />
              Guardar
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
}