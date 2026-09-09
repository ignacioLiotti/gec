# 02 — Diagramas de Acción

Diagramas de flujo para decidir el próximo paso según lo que pasó. Los códigos entre paréntesis (`E1`, `W2`, `LL-1`, etc.) refieren a las plantillas de `04-mensajes-prearmados.md` y los guiones de `03-guiones-de-llamadas.md`.

---

## 1. Pipeline completo

```mermaid
flowchart TD
    A[Prospecto en lista] --> B[Secuencia de contacto<br/>llamadas + email + WhatsApp]
    B -->|Responde / atiende| C{Calificación rápida}
    B -->|7 toques sin respuesta| N[Nutrición<br/>1 toque cada 30-45 días]
    C -->|Tiene dolor + es decisor| D[Reunión de descubrimiento]
    C -->|Tiene dolor, NO es decisor| C2[Pedir intro al decisor<br/>+ sumarlo como aliado]
    C2 --> D
    C -->|Sin dolor / fuera de ICP| X[Descartar con elegancia<br/>pedir referido]
    D --> E[Demo personalizada]
    E --> F[Propuesta de piloto]
    F -->|Acepta| G[Piloto 30-60 días<br/>con criterios de éxito]
    F -->|Lo piensa| H[Cadencia post-demo<br/>seguimiento días 2-5-10-15]
    H -->|Acepta| G
    H -->|No avanza tras 3 intentos| N
    G -->|Criterios cumplidos| I[Cliente pago]
    G -->|No cumple| J[Revisión: ajustar producto<br/>o cerrar piloto con aprendizaje]
    I --> K[Expansión: más obras,<br/>usuarios y módulos]
    I --> R[Pedir referidos y testimonio]
    N -->|Muestra interés| C
```

---

## 2. Primer contacto telefónico

```mermaid
flowchart TD
    A[Llamada fría LL-1] --> B{¿Atiende?}
    B -->|No atiende| C[WhatsApp W1 o email A1<br/>registrar intento en planilla]
    C --> C2[Reintentar en 2-3 días<br/>máx. 2 llamadas/semana]
    B -->|Atiende recepción /<br/>no es el decisor| D[Guion gatekeeper LL-0]
    D -->|Consigo nombre + derivación| A2[Llamar al decisor]
    D -->|No deriva| D2[Pedir email del decisor<br/>enviar E1 dirigido a él]
    B -->|Atiende el decisor| E[Apertura 30 segundos<br/>+ pregunta de dolor]
    E --> F{Reacción}
    F -->|Interés| G[2-3 preguntas de calificación<br/>proponer reunión con 2 opciones<br/>de día y horario]
    G --> H[Reunión agendada:<br/>confirmar por WhatsApp W4<br/>en el momento]
    F -->|"Mandame info"| I[Aceptar + comprometer llamada:<br/>enviar E1 ese día y<br/>agendar seguimiento a 3 días]
    F -->|Objeción| J[Respuesta de 05-manejo-objeciones<br/>+ reintentar cierre a reunión UNA vez]
    J -->|Acepta| H
    J -->|No| K[Cerrar bien: pedir permiso para<br/>recontactar en 1-2 meses → Nutrición]
    F -->|"No me interesa" seco| K
```

---

## 3. Día de la reunión / demo

```mermaid
flowchart TD
    A[Reunión agendada] --> B[24 h antes: confirmar W5]
    B --> C{¿Confirma?}
    C -->|Sí| D[Preparación: revisar notas,<br/>armar demo con SU caso,<br/>checklist de 06-guia-de-reuniones]
    C -->|No responde| E[Llamada corta de confirmación<br/>la mañana de la reunión]
    E -->|Confirma| D
    E -->|Cancela| F[Reagendar EN esa misma<br/>conversación con 2 opciones]
    D --> G[Reunión:<br/>15 min descubrimiento<br/>20 min demo<br/>10 min próximos pasos]
    G --> H{Cierre de la reunión}
    H -->|Quiere avanzar| I[Definir piloto: obra, usuarios,<br/>documentos, criterio de éxito,<br/>fecha de inicio]
    H -->|Necesita consultarlo| J[Acordar fecha concreta de respuesta<br/>+ ofrecer demo al socio/equipo]
    H -->|Tibio| K[Email resumen E5 +<br/>cadencia post-demo]
    I --> L[Email E6: alcance del piloto<br/>por escrito ese mismo día]
```

---

## 4. Árbol de decisión: respuestas a mensajes (email/WhatsApp)

```mermaid
flowchart TD
    A[Llega respuesta] --> B{Tipo de respuesta}
    B -->|"Contame más / me interesa"| C[NO explicar todo por escrito:<br/>responder con R1 y proponer<br/>llamada de 15 min con 2 horarios]
    B -->|"¿Cuánto cuesta?"| D[Respuesta R2: rango honesto +<br/>"depende de obras y usuarios" +<br/>llevar a reunión]
    B -->|"Mandame info"| E[Enviar E4 una página +<br/>anunciar llamada en 3 días]
    B -->|"Ahora no / estamos a full"| F[R4: empatizar + preguntar<br/>cuándo retomar + agendar<br/>recontacto en planilla]
    B -->|"Ya tenemos un sistema /<br/>nos arreglamos con Excel"| G[R5: no pelear contra el Excel,<br/>preguntar por el hueco:<br/>papeles, fotos, WhatsApp]
    B -->|Deriva a otra persona| H[Agradecer + pedir presentación<br/>directa por el mismo canal +<br/>contactar al derivado en 24 h]
    B -->|Negativa clara| I[R8: agradecer, dejar puerta<br/>abierta, pedir referido,<br/>mover a Nutrición]
    C --> Z[Registrar en planilla:<br/>etapa + próximo paso + fecha]
    D --> Z
    E --> Z
    F --> Z
    G --> Z
    H --> Z
    I --> Z
```

---

## 5. Flujo del piloto (de piloto a cliente)

```mermaid
flowchart TD
    A[Piloto acordado] --> B[Kickoff: cargar 1 obra real,<br/>configurar carpetas y tablas,<br/>capacitar 1-3 usuarios]
    B --> C[Semana 1-2: acompañamiento cercano<br/>check-in por WhatsApp cada 2-3 días]
    C --> D{¿Están cargando<br/>documentos reales?}
    D -->|Sí| E[Semana 3-4: medir y anotar:<br/>docs procesados, horas ahorradas,<br/>errores evitados]
    D -->|No| F[Llamar al campeón interno:<br/>destrabar fricción concreta<br/>o reconfigurar flujos]
    F --> C
    E --> G[Reunión de cierre de piloto:<br/>mostrar números contra el<br/>criterio de éxito acordado]
    G -->|Criterio cumplido| H[Propuesta comercial:<br/>plan + precio + condición<br/>de cliente temprano]
    G -->|Resultados parciales| I[Extender piloto 2-4 semanas<br/>con ajustes puntuales,<br/>UNA sola vez]
    H -->|Acepta| J[Cliente: onboarding completo<br/>+ pedir testimonio y referidos]
    H -->|No| K[Documentar el porqué<br/>→ Nutrición]
    I --> G
```

---

## 6. Reglas transversales (aplican a todos los flujos)

1. **Todo termina en la planilla**: después de cada toque, actualizar etapa, próximo paso y fecha. Sin excepción.
2. **Nunca dos seguimientos idénticos seguidos**: cada toque cambia de ángulo (problema → caso GEC → licitaciones → cierre).
3. **El silencio no es un "no"**: recién después del toque de cierre (T7) el prospecto pasa a Nutrición.
4. **Un "no" hoy es un prospecto para dentro de 3 meses**: cerrar siempre en buenos términos y pedir referido.
5. **Velocidad de respuesta**: responder mensajes entrantes el mismo día hábil; un prospecto que escribe está caliente por horas, no por semanas.
