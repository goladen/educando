import React from 'react';
import { Wrench } from 'lucide-react';

export default function TeacherTools() {
    return (
        <div style={{ padding: '40px', textAlign: 'center', background: 'white', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', minHeight: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Wrench size={64} color="#bdc3c7" style={{ marginBottom: '20px' }} />
            <h2 style={{ color: '#2c3e50' }}>Herramientas del Profesor</h2>
            <p style={{ color: '#7f8c8d', maxWidth: '500px', lineHeight: '1.6' }}>
                Estamos construyendo un conjunto de utilidades para facilitar tu día a día en el aula.
                Próximamente encontrarás aquí generadores de informes, gestión avanzada de alumnos y más.
            </p>
            <div style={{ marginTop: '30px', padding: '10px 20px', background: '#f1f2f6', borderRadius: '20px', color: '#7f8c8d', fontSize: '0.9rem', fontWeight: 'bold' }}>
                🚧 En Construcción
            </div>
        </div>
    );
}