import React, { useState } from 'react';
import { Container } from 'react-bootstrap';
import Swal from 'sweetalert2';

import Menu from './components/shared/Menu';
import Facturas from './components/Facturas';
import ListaDeFacturas from './components/ListaDeFacturas';

export default function App() {
  const [vistaActual, setVistaActual] = useState('cargar');
  const [facturas, setFacturas] = useState([]);

  // SOLO AGREGA NUEVAS
  const agregarFactura = (nuevaFactura) => {
    setFacturas([...facturas, nuevaFactura]);
    setVistaActual('lista'); 
  };

  // NUEVA FUNCIÓN: ACTUALIZA DESDE LA MODAL
  const actualizarFactura = (facturaEditada) => {
    setFacturas(facturas.map(f => f.cabecera.id === facturaEditada.cabecera.id ? facturaEditada : f));
  };

  const actualizarEstadoFactura = (id, nuevoEstado) => {
    setFacturas(facturas.map(f => f.cabecera.id === id ? { ...f, cabecera: { ...f.cabecera, estado: nuevoEstado } } : f));
  };

  const eliminarFactura = (id) => {
    Swal.fire({
      title: '¿Estás seguro?',
      text: "El documento se borrará de la bandeja.",
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

  return (
    <div className="bg-light min-vh-100 font-sans">
      <Menu setVistaActual={setVistaActual} />

      <Container className="py-4">
        {vistaActual === 'cargar' ? (
          <Facturas agregarFactura={agregarFactura} />
        ) : (
          <ListaDeFacturas 
            facturas={facturas} 
            actualizarEstadoFactura={actualizarEstadoFactura} 
            eliminarFactura={eliminarFactura} 
            actualizarFactura={actualizarFactura}     
          />
        )}
      </Container>
    </div>
  );
}