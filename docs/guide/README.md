# Guía de Usuario

Bienvenido a la plataforma de gestión de obras. Esta guía explica cómo usar el sistema día a día, sin tecnicismos.

## ¿Qué hace la plataforma?

Centraliza toda la información de tus obras: documentos, certificados, pólizas, órdenes de compra y datos extraídos automáticamente. Vos subís los documentos; el sistema lee su contenido, lo convierte en tablas editables y calcula los indicadores que necesitás para decidir (contrato, certificado a la fecha, saldo a certificar, porcentaje de avance).

El flujo central es siempre el mismo:

> **Documento → Extracción → Tabla → Cálculo → Decisión**

## Capítulos

1. [Primeros pasos](01-primeros-pasos.md) — crear tu cuenta, ingresar a tu empresa, conocer la pantalla principal.
2. [Obras](02-obras.md) — la tabla de obras, el detalle de cada obra y sus solapas.
3. [Documentos y extracción](03-documentos-y-extraccion.md) — subir archivos, carpetas, OCR y revisión de datos extraídos.
4. [Tablas y consolidación](04-tablas-y-macrotablas.md) — editar tablas, valores personalizados y macrotablas entre obras.
5. [Administración](05-administracion.md) — usuarios, invitaciones, roles y configuración de la empresa.

## Preguntas frecuentes rápidas

**¿Si vuelvo a subir un documento pierdo lo que edité?**
No. El sistema reconoce que es el mismo documento y conserva la identidad de cada fila, incluso si la extracción se repite. Si no puede asegurar la continuidad, te lo marca como conflicto en vez de pisar datos.

**¿Quién puede ver mis datos?**
Solo los usuarios de tu empresa (tenant). El aislamiento entre empresas se aplica a nivel de base de datos, no solo en pantalla.

**¿Los cambios de configuración de la empresa afectan mis obras existentes?**
Los cambios seguros se propagan solos, sin borrar nada. Los cambios que podrían perder información requieren una migración explícita aprobada por un administrador, con vista previa del impacto.

**¿Necesito ayuda?**
Contactá al administrador de tu empresa o al soporte de la plataforma.
