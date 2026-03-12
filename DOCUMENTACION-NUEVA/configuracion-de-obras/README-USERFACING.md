# Configuracion de Obras - User Facing

## 1. Objetivo de este documento

Este documento describe `Configuracion de Obras` desde el punto de vista del usuario.

No se centra en tablas internas ni APIs, sino en:

- que ve el usuario
- que entiende de cada pantalla
- que accion realiza
- que resultado espera
- como el sistema le comunica lo que paso
- que deberia sentirse claro en UX/UI

Aplica a dos perfiles principales:

1. `Admin del tenant` que configura la estructura
2. `Usuario operativo de obra` que luego usa esa estructura dentro de una obra

---

## 2. Promesa funcional para el usuario

La promesa de este modulo es simple:

> "Defini una sola vez como queres organizar y extraer informacion en tus obras, y el sistema lo replica en todas."

Desde UX, esto significa que el usuario deberia sentir:

- control sobre la estructura
- previsibilidad
- consistencia entre obras
- bajo esfuerzo repetitivo
- claridad sobre que es solo organizacion y que es dato estructurado

---

## 3. Que ve el usuario en la pantalla principal

La pantalla transmite tres ideas:

1. `Como se van a organizar los documentos`
2. `Como se van a capturar datos`
3. `Como se van a acelerar tareas repetitivas`

Visualmente, eso se reparte en tres bloques:

- `Carpetas Predeterminadas`
- `Acciones rapidas`
- `Plantillas de Extraccion`

Cada bloque tiene que responder una pregunta concreta:

### Carpetas Predeterminadas

Pregunta que responde:

> "Que estructura va a tener cada obra?"

### Acciones rapidas

Pregunta que responde:

> "Que flujos guiados puedo usar para cargar informacion mas rapido?"

### Plantillas de Extraccion

Pregunta que responde:

> "Como sabe el sistema que leer de cada documento?"

---

## 4. Lectura UX de cada bloque

## 4.1. Carpetas Predeterminadas

### Que ve el usuario

Una lista de carpetas con:

- nombre
- path
- icono
- acciones de editar y eliminar

Si una carpeta es de datos, ademas ve:

- badge `Extraccion`
- cantidad de campos
- plantilla asociada
- posibilidad de expandir detalles

### Que debe entender sin leer documentacion

- una carpeta sin badge es solo organizacion
- una carpeta con badge `Extraccion` tiene inteligencia asociada
- el path muestra donde vive dentro de la jerarquia
- expandir una carpeta de extraccion permite auditar rapidamente su configuracion

### Señales visuales correctas

- carpetas normales deben sentirse livianas y de infraestructura
- carpetas de extraccion deben sentirse mas importantes y "activas"
- el badge `Extraccion` funciona como marcador de capacidad, no solo decoracion

### Riesgo UX

Si no se diferencia bien carpeta normal de carpeta de datos, el usuario no entiende por que unas carpetas generan tablas y otras no.

---

## 4.2. Acciones rapidas

### Que ve el usuario

Un bloque con:

- boton `Nueva accion`
- lista de acciones configuradas o estado vacio

### Que debe entender

- las acciones rapidas no son carpetas
- son recorridos guiados de trabajo
- cada accion es una secuencia de pasos basada en carpetas ya existentes

### Estado vacio correcto

Cuando no hay acciones configuradas, el estado vacio deberia comunicar:

- que son opcionales
- que sirven para acelerar flujos repetitivos
- que se construyen a partir de carpetas existentes

No deberia dar sensacion de error.

---

## 4.3. Plantillas de Extraccion

### Que ve el usuario

Un listado de plantillas OCR con:

- nombre
- cantidad de campos
- cantidad de regiones
- tablas involucradas
- acciones de borrar/expandir

### Que debe entender

- una plantilla representa un tipo de documento
- no extrae por si sola: se conecta luego a una carpeta de datos
- define "donde mirar" y "que columnas obtener"

### Riesgo UX

Si el usuario piensa que crear plantilla ya activa el OCR automaticamente en una obra, se genera confusion.

La UI debe dejar claro que:

1. la plantilla se crea aca
2. despues se vincula a una carpeta de datos
3. luego esa carpeta se usa dentro de las obras

---

## 5. Flujo del admin: crear una carpeta

## 5.1. Intencion del usuario

El usuario quiere que todas sus obras tengan una carpeta nueva.

Puede haber dos intenciones:

- "quiero solo un lugar para guardar archivos"
- "quiero una carpeta que ademas extraiga o guarde datos"

La UI tiene que separar ambas desde el primer paso.

## 5.2. Momento clave: elegir tipo de carpeta

En el dialogo, la decision entre:

- `Carpeta normal`
- `Carpeta de datos`

es el pivote UX mas importante.

### Que debe comunicar la UI

`Carpeta normal`
- organiza archivos
- no genera tabla
- no extrae datos

`Carpeta de datos`
- genera tabla asociada
- admite carga manual y/o OCR
- esos datos quedan disponibles para uso posterior

### Lo que el usuario espera despues de elegir

Si elige `Carpeta normal`:

- espera simplicidad
- pocos campos
- guardado rapido

Si elige `Carpeta de datos`:

- espera configuracion mas profunda
- poder definir columnas
- definir si extrae por OCR o carga manual

---

## 6. Flujo del admin: crear una carpeta de datos

## 6.1. Que ve

Al elegir `Carpeta de datos`, aparecen nuevas secciones:

- metodo de carga
- plantilla XLSX/CSV
- plantilla OCR
- datos anidados
- columnas de la tabla

### Lectura mental correcta del usuario

El usuario deberia entender esto como:

> "Estoy definiendo una mini base de datos para esta carpeta"

## 6.2. Metodo de carga

Opciones:

- `Solo OCR`
- `Solo manual`
- `Ambos`

### Lo que significa para el usuario

`Solo OCR`
- la carpeta se alimenta desde documentos

`Solo manual`
- la carpeta se alimenta desde carga humana

`Ambos`
- puede tener automatizacion y correccion/manual override

### Comunicacion UX recomendada

La UI deberia explicitar el tradeoff:

- OCR reduce carga manual pero depende de calidad del documento
- Manual da control total pero requiere mas tiempo
- Ambos es la opcion mas flexible

## 6.3. Columnas de la tabla

Esta es la parte mas sensible.

### Que hace el usuario

- agrega columnas
- cambia nombre
- define tipo
- marca required
- define scope documento/item si aplica

### Que espera que pase

- que esas columnas aparezcan luego donde se cargan o ven datos
- que sean las mismas en todas las obras
- que un cambio futuro se refleje sin romper lo anterior

### Que la UI deberia comunicar

- el nombre visible es el label
- el tipo condiciona como se interpreta el dato
- required afecta validaciones futuras
- en datos anidados hay diferencia entre encabezado del documento y detalle por item

### Caso muy importante

Si el usuario agrega una columna nueva a una carpeta ya existente, espera:

- verla en todas las obras
- verla tambien en datos historicos, aunque vacia

Eso hoy es parte central del comportamiento esperado.

---

## 7. Flujo del admin: editar una carpeta existente

## 7.1. Expectativa del usuario

El usuario no siente que esta "tocando codigo" ni "migrando schema".
Siente que esta corrigiendo una configuracion viva.

Ejemplos:

- "me falto una columna"
- "este nombre deberia ser otro"
- "ahora quiero cargar esto tambien manualmente"

## 7.2. Lo que el sistema deberia hacer sentir

Guardar cambios deberia sentirse:

- seguro
- reversible conceptualmente
- compatible con lo que ya existe

## 7.3. Mensaje UX ideal despues de guardar

La experiencia correcta no es solo:

- `Carpeta actualizada`

Tambien deberia dejar claro:

- que los cambios aplican a obras nuevas
- que los cambios se estan sincronizando a obras existentes

### Mensaje sugerido

`Configuracion guardada. Se aplicara a obras nuevas y se esta sincronizando con obras existentes.`

Esto baja ansiedad y evita la pregunta:

> "Guarde, pero por que todavia no lo veo en todas las obras?"

---

## 8. Flujo del admin: crear una plantilla OCR

## 8.1. Intencion del usuario

El usuario quiere "ensenarle" al sistema a leer un documento.

## 8.2. Modelo mental correcto

La UI debe hacer sentir que esta marcando zonas de lectura sobre un documento real.

No deberia parecer una configuracion abstracta.

## 8.3. Acciones del usuario

1. sube imagen
2. dibuja regiones
3. nombra cada region
4. marca si es valor unico o tabla
5. guarda

## 8.4. Lo que deberia comprender

- `single` = un dato puntual
- `table` = una grilla repetitiva
- la plantilla no extrae sola; necesita estar asignada a una carpeta

## 8.5. Señales UX importantes

- la region seleccionada debe destacarse fuerte
- los labels deben ser legibles sobre la imagen
- deberia ser muy claro cuando una region es `table`

---

## 9. Flujo del admin: crear una accion rapida

## 9.1. Intencion del usuario

El usuario quiere convertir una secuencia repetitiva en un flujo guiado.

Ejemplo mental:

> "Para cargar certificados siempre hago esto, despues esto, despues esto."

## 9.2. Lo que ve

- nombre
- descripcion
- seleccion de carpetas

## 9.3. Lo que debe entender

- no esta creando datos nuevos
- esta empaquetando pasos existentes en una UX guiada

## 9.4. Qué comunica bien la UI

El orden importa.

Eso tiene que quedar claro con:

- seleccion ordenada
- numeracion visual
- feedback de paso 1, paso 2, paso 3

---

## 10. Lo que ve el usuario operativo dentro de una obra

Una vez configurado todo, el usuario operativo ya no entra en `Configuracion de Obras`.
Ve sus efectos dentro de la obra.

Los dos lugares mas importantes son:

1. pestana `General`
2. pestana `Documentos`

---

## 11. User flow en la pestana General

## 11.1. Acciones rapidas visibles

En `General`, el usuario puede ver un panel flotante de `Acciones rapidas`.

### Que debe sentir

- que tiene guias concretas para trabajar
- que el sistema le marca el orden correcto
- que no necesita recordar cada carpeta manualmente

## 11.2. Stepper de accion rapida

Cada paso debe responder:

- que carpeta estoy usando
- que tengo que hacer ahora
- que tipo de accion es
- cuanto me falta

### Modos que puede ver

- subir archivo
- OCR
- manual
- OCR o manual

### Comunicacion correcta

Cada paso deberia tener:

- nombre de carpeta
- subtitulo explicando accion
- indicador de paso actual
- estado completado/no completado

## 11.3. Cierre emocional del paso

Despues de completar un paso, el usuario necesita confirmacion inmediata.

Mensajes correctos:

- `Archivo subido`
- `Documento enviado a OCR`
- `Fila guardada`

Y luego el sistema debe moverse solo al siguiente paso o dejar muy claro que puede hacerlo.

---

## 12. User flow en la pestana Documentos

## 12.1. Lo que espera el usuario

El usuario no piensa en `obra_default_tablas` ni en jobs.
Piensa:

> "Subo un documento y quiero verlo ordenado, procesado y con datos claros."

## 12.2. Que ve en una carpeta normal

- archivos
- estructura
- nombres

No espera tabla asociada.

## 12.3. Que ve en una carpeta de datos

Ademas de archivos, espera:

- tabla de datos
- columnas visibles
- filas cargadas o extraidas
- posibilidad de editar
- estado de documentos OCR

## 12.4. Reflejo esperado despues de subir un documento OCR

Secuencia esperada por el usuario:

1. subo archivo
2. veo que se esta procesando
3. despues veo datos cargados

### Comunicacion UX necesaria

Estados que deben ser claros:

- pendiente
- procesando
- completado
- fallido

Si falla, el usuario necesita ver:

- que documento fallo
- si puede reintentar
- si el problema fue del archivo o del template

## 12.5. Reflejo esperado despues de una carga manual

El usuario espera:

- ver inmediatamente la fila en la tabla
- que se respeten los tipos
- required claros
- persistencia sin ambiguedad

---

## 13. Como se refleja una nueva columna para el usuario

Este fue el caso concreto de `N° Expediente`.

## 13.1. Lo que el admin hace

Edita `Certificados Extraidos` y agrega una columna.

## 13.2. Lo que el admin espera

- ver la columna en esa configuracion
- que quede para el futuro
- que aparezca tambien en obras ya existentes

## 13.3. Lo que el usuario operativo espera despues

En la tabla de certificados extraidos dentro de una obra espera:

- ver la nueva columna
- aunque las filas viejas no tengan valor, la columna debe existir

## 13.4. Mensaje UX ideal para este caso

Cuando se agrega una columna a una carpeta existente, el sistema deberia comunicar algo como:

`Nueva columna agregada. Se mostrara vacia en datos historicos hasta que se complete manualmente o por OCR.`

Eso elimina la duda:

> "Se rompio algo o simplemente todavia no tiene valor?"

---

## 14. Comunicacion de cambios en segundo plano

Hoy hay una capa de sincronizacion en background para obras existentes.

Desde UX, eso no puede quedar invisible.

## 14.1. Problema

Si el usuario guarda un cambio y el impacto en obras existentes tarda, puede interpretar:

- que no funciono
- que hay bug
- que tiene que repetir la accion

## 14.2. Que deberia comunicarse

Despues de guardar cambios estructurales:

- `Guardado correcto`
- `Aplica a nuevas obras`
- `Sincronizando obras existentes`

## 14.3. Estados UX recomendados

- `Guardado`
- `Sincronizacion pendiente`
- `Sincronizacion en curso`
- `Sincronizacion completa`
- `Sincronizacion con errores`

Aunque hoy no todo eso este visible en UI, este deberia ser el marco UX del modulo.

---

## 15. Estados vacios y microcopy

## 15.1. Carpetas

Estado vacio correcto:

`No hay carpetas configuradas`

Subtexto ideal:

`Agrega carpetas para que cada nueva obra nazca con una estructura lista para usar.`

## 15.2. Acciones rapidas

Estado vacio correcto:

`Sin acciones configuradas`

Subtexto ideal:

`Crea recorridos guiados para acelerar cargas frecuentes en las obras.`

## 15.3. Plantillas OCR

Estado vacio correcto:

`Todavia no hay plantillas de extraccion`

Subtexto ideal:

`Crea plantillas para indicarle al sistema que datos leer de cada tipo de documento.`

---

## 16. Validaciones y mensajes de error

## 16.1. Principio UX

Los errores deben hablar en lenguaje de tarea, no de implementacion.

Evitar mensajes que suenen a base de datos o internals.

## 16.2. Ejemplos buenos

- `Selecciona una plantilla OCR o una plantilla XLSX/CSV`
- `Agrega al menos una columna`
- `El campo "Monto Certificado" es requerido`
- `Ya existe una plantilla con ese nombre`

## 16.3. Ejemplos a evitar

- mensajes con ids internos
- mensajes de tabla no encontrada sin contexto
- errores de validacion tecnicos sin accion clara

## 16.4. Error recuperable vs error bloqueante

El usuario debe distinguir entre:

- `te falta completar algo`
- `guardamos pero falta sincronizar`
- `fallo el guardado`

No todo error tiene el mismo peso.

---

## 17. Qué deberia sentirse consistente entre pantallas

Hay tres consistencias clave.

## 17.1. Consistencia terminologica

Si en admin se habla de:

- `carpeta de datos`
- `extraccion`
- `columnas`

entonces en obra no deberian aparecer nombres totalmente distintos para el mismo concepto.

## 17.2. Consistencia de estructura

Lo que el admin ve configurado deberia reflejarse claramente en:

- estructura de documentos
- tablas visibles
- quick actions

El usuario debe poder trazar mentalmente:

`lo configure aca -> aparece aca`

## 17.3. Consistencia temporal

Cuando algo no aparece instantaneamente por ser asincrono, la UI debe explicarlo.

---

## 18. Mapa de expectativas del usuario

## 18.1. Admin

Quiere sentir:

- "estoy definiendo el sistema"
- "no tengo que repetir esto por obra"
- "si agrego una mejora, se propaga"

## 18.2. Usuario operativo

Quiere sentir:

- "la obra ya viene preparada"
- "subo un documento y el sistema lo acomoda"
- "si hay una tabla, entiendo por que esta ahi"
- "si tengo que completar algo, se donde hacerlo"

---

## 19. Recomendaciones UX/UI para evolucion futura

## 19.1. Mostrar impacto al guardar

Agregar feedback explicito:

- `Se aplicara a nuevas obras`
- `Se sincronizara con 24 obras existentes`

## 19.2. Mostrar estado de sincronizacion

Agregar badge o estado visible despues de una edicion:

- `Sincronizacion pendiente`
- `Sincronizado`

## 19.3. Mostrar mejor la diferencia entre carpeta y tabla

Hoy se entiende, pero se puede reforzar mejor con copy:

- `Carpeta normal: solo organiza archivos`
- `Carpeta de datos: crea una tabla de datos asociada`

## 19.4. Mostrar ejemplos de uso

En carpetas de datos complejas, ayuda mucho mostrar:

- ejemplo de documentos compatibles
- ejemplo de filas esperadas

## 19.5. Hacer visible el efecto sobre obras existentes

Si el usuario edita una carpeta usada por muchas obras, deberia saber que el cambio no es local.

---

## 20. Resumen user-facing

Desde la experiencia del usuario, `Configuracion de Obras` es el lugar donde se diseña el comportamiento base del sistema para todas las obras.

El valor UX real del modulo es que:

- reduce repeticion
- ordena la carga documental
- transforma carpetas en datos utilizables
- convierte procesos manuales en flujos guiados
- mantiene coherencia entre configuracion central y uso diario en cada obra

La experiencia ideal es que el usuario sienta:

> "Configuro una vez, se refleja en todas las obras, y cada persona despues trabaja sobre una estructura clara, guiada y consistente."
