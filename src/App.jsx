import React, { useState } from 'react';
import { Container } from 'react-bootstrap';

// Importamos nuestros componentes
import Menu from './components/shared/Menu';
import Facturas from './components/Facturas';
import ListaDeFacturas from './components/ListaDeFacturas';

export default function App() {
  // 1. ESTADO GLOBAL DE LA VISTA
  // Define qué pantalla estamos viendo. Inicia en 'cargar'
  const [vistaActual, setVistaActual] = useState('cargar');

  // 2. ESTADO GLOBAL DE LOS DATOS
  // Acá viven todas las facturas procesadas. Inicia como un array vacío.
  const [facturas, setFacturas] = useState([]);

  // 3. FUNCIONES CONTROLADORAS
  // Esta función se la pasamos a Facturas.jsx para que nos mande el objeto nuevo
  const agregarFactura = (nuevaFactura) => {
    setFacturas([...facturas, nuevaFactura]);
    // Opcional: Si querés que al guardar te lleve directo a la lista, descomentá esto:
    // setVistaActual('lista'); 
  };

  // Esta función se la pasamos a ListaDeFacturas.jsx para que pueda cambiar 
  // el estado a 'Enviada' cuando se aprieta el botón de enviar a la API
  const actualizarEstadoFactura = (id, nuevoEstado) => {
    setFacturas(
      facturas.map(factura => 
        factura.id === id ? { ...factura, estado: nuevoEstado } : factura
      )
    );
  };

  

  // 4. RENDERIZADO
  return (
    <div className="bg-light min-vh-100 font-sans">
      {/* El menú siempre está visible arriba. Le pasamos la función para cambiar de vista */}
      <Menu setVistaActual={setVistaActual} />

      {/* Contenedor principal para darle márgenes al contenido */}
      <Container className="py-4">
        
        {/* Lógica de navegación: Renderizado Condicional */}
        {vistaActual === 'cargar' ? (
          <Facturas agregarFactura={agregarFactura} />
        ) : (
          <ListaDeFacturas 
            facturas={facturas} 
            actualizarEstadoFactura={actualizarEstadoFactura} 
          />
        )}
        
      </Container>
    </div>
  );
}