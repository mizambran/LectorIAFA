import React from 'react';
import { Navbar, Container, Nav, Offcanvas } from 'react-bootstrap';
import { FaFileInvoice, FaList, FaUpload } from 'react-icons/fa';

export default function Menu({ setVistaActual }) {
  return (
    <Navbar bg="dark" variant="dark" expand="lg" className="mb-4 shadow-sm">
      <Container>
        <Navbar.Brand 
          href="#" 
          onClick={() => setVistaActual('cargar')}
          className="fw-bold d-flex align-items-center"
        >
          <FaFileInvoice className="me-2 text-primary" size={24} />
          Lector IA
        </Navbar.Brand>
        
        <Navbar.Toggle aria-controls="offcanvasNavbar" />
        
        <Navbar.Offcanvas
          id="offcanvasNavbar"
          aria-labelledby="offcanvasNavbarLabel"
          placement="end"
        >
          <Offcanvas.Header closeButton>
            <Offcanvas.Title id="offcanvasNavbarLabel" className="fw-bold">
              Menú Principal
            </Offcanvas.Title>
          </Offcanvas.Header>
          <Offcanvas.Body>
            <Nav className="justify-content-end flex-grow-1 pe-3">
              <Nav.Link 
                onClick={() => setVistaActual('cargar')} 
                className="d-flex align-items-center"
              >
                <FaUpload className="me-2" /> Procesar Factura
              </Nav.Link>
              <Nav.Link 
                onClick={() => setVistaActual('lista')} 
                className="d-flex align-items-center"
              >
                <FaList className="me-2" /> Bandeja de Salida
              </Nav.Link>
            </Nav>
          </Offcanvas.Body>
        </Navbar.Offcanvas>
      </Container>
    </Navbar>
  );
}