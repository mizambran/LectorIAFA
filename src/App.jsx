import React, { useState } from 'react';
import { Container } from 'react-bootstrap';
import Swal from 'sweetalert2';

import Menu from './components/shared/Menu';
import Facturas from './components/Facturas';
import ListaDeFacturas from './components/ListaDeFacturas';

export default function App() {
  const [vistaActual, setVistaActual] = useState('cargar');
  const [facturas, setFacturas] = useState([]);
  const [facturaEditando, setFacturaEditando] = useState(null);

  // GUARDA O ACTUALIZA
  const guardarFactura = (facturaGuardada) => {
    if (facturaEditando) {
      setFacturas(facturas.map(f => f.cabecera.id === facturaEditando.cabecera.id ? facturaGuardada : f));
      setFacturaEditando(null); 
    } else {
      setFacturas([...facturas, facturaGuardada]);
    }
    setVistaActual('lista'); 
  };

  const actualizarEstadoFactura = (id, nuevoEstado) => {
    setFacturas(facturas.map(f => f.cabecera.id === id ? { ...f, cabecera: { ...f.cabecera, estado: nuevoEstado } } : f));
  };

  // ELIMINA CON ALERTA DE CONFIRMACIÓN
  const eliminarFactura = (id) => {
    Swal.fire({
      title: '¿Estás seguro?',
      text: "No podrás revertir esto. El documento se borrará.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        setFacturas(facturas.filter(f => f.cabecera.id !== id));
        Swal.fire('¡Eliminado!', 'El comprobante ha sido borrado.', 'success');
      }
    });
  };

  // PREPARA LA EDICIÓN
  const editarFactura = (facturaCompleta) => {
    setFacturaEditando(facturaCompleta);
    setVistaActual('cargar'); 
  };

  const cambiarVista = (vista) => {
    setVistaActual(vista);
    if (vista === 'lista') setFacturaEditando(null);
  };

  return (
    <div className="bg-light min-vh-100 font-sans">
      <Menu setVistaActual={cambiarVista} />

      <Container className="py-4">
        {vistaActual === 'cargar' ? (
          <Facturas 
            agregarFactura={guardarFactura} 
            facturaEditando={facturaEditando} 
            cancelarEdicion={() => setFacturaEditando(null)}
          />
        ) : (
          <ListaDeFacturas 
            facturas={facturas} 
            actualizarEstadoFactura={actualizarEstadoFactura} 
            eliminarFactura={eliminarFactura} 
            editarFactura={editarFactura}     
          />
        )}
      </Container>
    </div>
  );
}