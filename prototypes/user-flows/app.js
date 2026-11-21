import { scenarios } from './scenarios.js';

const storageKey = 'sintesis.flow-lab.v1';
const params = new URLSearchParams(location.search);
let saved = {};
try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { /* Storage is optional. */ }
const enabled = Object.fromEntries(scenarios.map(({ id }) => [id, saved?.[id] !== false]));
if (params.has('enabled')) {
  const selected = new Set(params.get('enabled').split(','));
  for (const id of Object.keys(enabled)) enabled[id] = selected.has(id);
}
let activeId = scenarios.some(s => s.id === params.get('flow')) ? params.get('flow') : 'capture';
let fixture = 'normal';
const flowState = {};
const initialState = () => ({ step: 0, amount: '125000', subject: 'Compra de materiales para la etapa 2', scope: 'ribera', fields: ['Proveedor', 'Fecha', 'Total'], period: 'Septiembre 2026', expiry: '7 días', dirty: false, source: false, shared: false, selectedTask: 'document', read: false, resolved: [] });
for (const { id } of scenarios) flowState[id] = initialState();
let extractionTimer;

const $ = (selector) => document.querySelector(selector);
const escape = (value) => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const money = (value) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(Number(value));
const button = (label, action, primary = false) => `<button type="button" data-action="${action}" class="${primary ? 'primary' : ''}">${label}</button>`;
const notice = (title, body, type = '') => `<div class="notice ${type}"><strong>${title}</strong><p>${body}</p></div>`;
const title = (heading, subtitle = '') => `<div class="product-title"><div><h3>${heading}</h3><p>${subtitle}</p></div></div>`;
const steps = (labels, current) => `<ol class="steps">${labels.map((label, index) => `<li ${current === index ? 'aria-current="step"' : ''}>${index + 1}. ${label}</li>`).join('')}</ol>`;
const invoice = () => `<div class="paper" aria-label="Documento fuente de ejemplo"><p class="eyebrow">Documento de ejemplo · página 1</p><h3>Factura A</h3><p>Materiales del Litoral · datos ficticios<br>Comprobante 0001-00000042</p><hr><p>Obra Ribera · 07/09/2026<br>Materiales para etapa 2</p><hr><p class="muted">Total del documento</p><p class="amount">$ 125.000,00</p><small class="muted">Representación de una factura, sin archivo real.</small></div>`;

function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify(enabled)); } catch { /* Private modes can block storage. */ }
  const query = new URLSearchParams({ flow: activeId, enabled: scenarios.filter(s => enabled[s.id]).map(s => s.id).join(',') });
  history.replaceState(null, '', `?${query}`);
}

function announce(message) { $('#announcement').textContent = message; }

function renderNavigation() {
  $('#experiments').innerHTML = scenarios.map(s => `<div class="experiment"><button data-flow="${s.id}" aria-current="${activeId === s.id}">${s.number} · ${s.title}<small>${s.short}</small></button><input type="checkbox" data-toggle="${s.id}" aria-label="Activar propuesta: ${s.title}" ${enabled[s.id] ? 'checked' : ''}></div>`).join('');
}

function render() {
  const scenario = scenarios.find(s => s.id === activeId);
  renderNavigation();
  $('#scenario-kicker').textContent = `Recorrido ${scenario.number} / 06`;
  $('#scenario-title').textContent = scenario.title;
  $('#scenario-goal').textContent = scenario.goal;
  $('#current-mode').setAttribute('aria-pressed', String(!enabled[activeId]));
  $('#proposal-mode').setAttribute('aria-pressed', String(enabled[activeId]));
  $('#comparison').innerHTML = `<div><span>Existente · según código</span><p>${scenario.before}</p></div><div><span>Propuesta</span><p>${scenario.after}</p></div>`;
  $('#preview-label').textContent = enabled[activeId] ? 'Prototipo interactivo · datos de ejemplo' : 'Esquema del recorrido existente · no es una captura de la app';
  $('#fixture').value = fixture;
  $('#fixture').disabled = !enabled[activeId];
  $('#restart').disabled = !enabled[activeId];
  $('#evidence').innerHTML = `<div><h3>Ya existe</h3><p>${scenario.reuse}</p><details><summary>Ver referencias de código</summary><p>${scenario.source}</p></details></div><div><h3>Qué cambia y qué debe conservarse</h3><p>${scenario.change}</p><p>${scenario.invariant}</p></div>`;
  if (!enabled[activeId]) {
    $('#preview').innerHTML = `<div class="product-body"><p class="eyebrow">Mapa de la implementación actual</p><ol class="existing-flow">${scenario.current.map(([heading, body]) => `<li><strong>${heading}</strong><p>${body}</p></li>`).join('')}</ol><div class="actions">${button('Probar la propuesta', 'enable', true)}</div></div>`;
    return;
  }
  const obraLabel = activeId === 'ask' && flowState.ask.scope === 'parque' ? 'Obra Parque' : 'Obra Ribera';
  const scope = activeId === 'configure' ? ['Configuración de la empresa', 'Modelo de obras'] : activeId === 'inbox' ? ['Mi trabajo', 'Constructora de ejemplo'] : [obraLabel, 'Constructora de ejemplo'];
  let content;
  if (fixture === 'loading') {
    content = `<div class="empty-state" role="status">${title('Cargando este recorrido', 'Se conserva el contexto mientras esperamos la respuesta.')}<progress aria-label="Cargando datos"></progress></div>`;
  } else if (fixture === 'error') {
    content = `${notice(scenario.error[0], scenario.error[1], 'error')}<div class="actions">${button('Reintentar', 'normal', true)}</div>`;
  } else if (fixture === 'empty') {
    content = `<div class="empty-state">${title(scenario.empty[0], scenario.empty[1])}${button('Usar datos de ejemplo', 'normal', true)}</div>`;
  } else if (fixture === 'readonly') {
    content = `<div class="empty-state">${title('Acción no disponible para tu acceso', scenario.restricted)}<span class="status">Solo consulta</span></div>`;
  } else {
    const views = { capture: renderCapture, generate: renderGenerate, ask: renderAsk, report: renderReport, configure: renderConfigure, inbox: renderInbox };
    content = views[activeId](flowState[activeId]);
  }
  $('#preview').innerHTML = `<div class="product-top"><div><strong>${scope[0]}</strong><span>${scope[1]}</span></div><span class="status">Ejemplo sin conexión</span></div><div class="product-body">${content}</div>`;
  const expirySelect = $('#preview').querySelector('[name="expiry"]');
  if (expirySelect) expirySelect.value = flowState.report.expiry;
}

function renderCapture(state) {
  const heading = title('Compras', 'Documentos y datos de esta obra');
  if (state.step === 0) return `${heading}<p class="breadcrumbs">Obra Ribera / Documentos / Compras</p>${notice('Los datos se extraen al cargar', 'Guardamos el archivo en Compras y te mostramos el resultado para que puedas revisarlo.')}<div class="row"><div><strong>Factura de ejemplo</strong><p>Materiales del Litoral · PDF · 1 página</p></div>${button('Usar factura de ejemplo', 'upload', true)}</div><p class="muted" style="margin-top:16px">En la app: botón Cargar documentos y arrastre en el mismo destino.</p>`;
  if (state.step === 1) return `${heading}${steps(['Cargar', 'Extraer', 'Revisar'], 1)}${notice('Factura guardada en Compras', 'La extracción sigue en curso. Todavía no hay datos listos para corregir.')}<progress aria-label="Extrayendo datos"></progress>`;
  if (state.step === 3) return `${heading}${notice('Cambios guardados', 'El documento original sigue disponible junto a los datos corregidos.', 'success')}<div class="row"><div><strong>Factura 0001-00000042</strong><p>Materiales del Litoral · 07/09/2026</p></div><strong>${money(state.amount)}</strong></div><div class="actions">${button('Volver a revisar', 'review')}${button('Ver documento fuente', 'source')}</div>${state.source ? `<div style="margin-top:20px">${invoice()}</div>` : ''}`;
  return `${heading}${steps(['Cargar', 'Extraer', 'Revisar'], 2)}<div class="document-grid">${invoice()}<form data-form="capture"><span class="status">Datos extraídos · revisión opcional</span><h3 style="margin-top:16px">Datos de la factura</h3><label class="field"><span>Proveedor</span><input value="Materiales del Litoral" readonly></label><label class="field"><span>Total (ARS)</span><input name="amount" type="number" min="0" step="0.01" value="${escape(state.amount)}" required><small>Comparalo con el documento a la izquierda.</small></label><p id="dirty-label" class="muted">${state.dirty ? 'Hay cambios sin guardar.' : 'Podés corregir el importe antes de guardar.'}</p><div class="actions"><button class="primary" type="submit">Guardar datos</button></div></form></div>`;
}

function renderGenerate(state) {
  const heading = title('Nuevo documento', 'Obra Ribera / Compras');
  if (state.step === 0) return `${heading}${notice('Se guardará en Compras de Obra Ribera', 'Podés revisar este destino antes de generar.')}<h3>¿Qué necesitás preparar?</h3><button class="choice" data-action="choose-template">Orden de compra<small>Plantilla de ejemplo: OC estándar · única opción compatible en este caso.</small></button><details><summary>Si hay varias plantillas o falta configuración</summary><p>Se muestran las opciones compatibles para elegir. No se selecciona una plantilla al azar ni se genera sin destino.</p></details>`;
  if (state.step === 1) return `${heading}${steps(['Elegir documento', 'Completar', 'Revisar'], 1)}<form data-form="generate"><label class="field"><span>Asunto</span><input name="subject" value="${escape(state.subject)}" required maxlength="160"></label><label class="field"><span>Proveedor</span><input value="Materiales del Litoral" readonly></label><p class="muted">Borrador privado · plantilla OC estándar · destino Compras</p><div class="actions"><button class="primary" type="submit">Vista previa</button>${button('Guardar borrador de ejemplo', 'save-draft')}</div></form>${state.draftSaved ? notice('Borrador de ejemplo guardado', 'Se conserva en este laboratorio mientras la página permanezca abierta.', 'success') : ''}`;
  if (state.step === 3) return `${heading}${notice('Documento generado · en revisión', 'La orden de compra está en Compras. Su aprobación sigue un paso separado.', 'success')}<div class="row"><div><strong>OC-0042.pdf</strong><p>Obra Ribera · plantilla OC estándar</p></div><span class="status warning">En revisión</span></div><div class="actions">${button('Editar documento', 'edit-generated')}${button('Ver en la bandeja de revisión', 'open-review')}</div>`;
  return `${heading}${steps(['Elegir documento', 'Completar', 'Revisar'], 2)}<div class="document-grid"><div class="paper"><p class="eyebrow">Vista previa · ejemplo</p><h3>Orden de compra</h3><p>Obra Ribera · Compras<br>Materiales del Litoral</p><hr><p>${escape(state.subject)}</p><hr><p class="amount">$ 125.000,00</p></div><div><h3>Antes de generar</h3><div class="row"><span>Destino</span><strong>Obra Ribera / Compras</strong></div><div class="row"><span>Plantilla</span><strong>OC estándar</strong></div><div class="row"><span>Estado siguiente</span><span class="status warning">En revisión</span></div><div class="actions">${button('Generar documento de ejemplo', 'generate', true)}${button('Volver a editar', 'edit')}</div></div></div>`;
}

function renderAsk(state) {
  const other = state.scope === 'parque';
  const obra = other ? 'Obra Parque' : 'Obra Ribera';
  const months = other ? '8' : '12';
  return `${title('Consultar documentos', 'La pregunta se limita al alcance que ves abajo.')}<label class="field"><span>Obra incluida</span><select name="scope"><option value="ribera" ${!other ? 'selected' : ''}>Obra Ribera</option><option value="parque" ${other ? 'selected' : ''}>Obra Parque</option></select><small>Documentos accesibles de esta obra. Cambiar el alcance inicia una nueva consulta de ejemplo.</small></label><div class="row"><strong>¿Cuál es el plazo de ejecución acordado?</strong>${button('Consultar ejemplo', 'ask', true)}</div>${state.step ? `<div style="margin-top:22px"><p>El contrato de <strong>${obra}</strong> establece un plazo de <strong>${months} meses</strong> desde el acta de inicio.</p><p class="muted">Respuesta preparada para este ejemplo.</p>${button('Contrato.pdf · página 3', 'source')}${state.source ? `<div class="paper" style="margin-top:20px"><p class="eyebrow">Fuente de ejemplo · ${obra}</p><h3>Contrato de obra</h3><hr><p>Cláusula 4. Plazo de ejecución: ${months} meses a partir de la firma del acta de inicio.</p><p class="muted">Página 3 · representación de documento</p></div>` : ''}</div>` : `<div class="empty-state"><h3>Preguntá desde la obra donde estás trabajando</h3><p class="muted">Si la documentación no respalda una respuesta, la pantalla debe decirlo y permitir revisar las fuentes.</p></div>`}`;
}

function renderReport(state) {
  const emptyPeriod = state.period === 'Agosto 2026';
  const heading = title('Resumen de compras', 'Obra Ribera · vista guardada de ejemplo');
  return `${heading}<label class="field"><span>Período</span><select name="period"><option ${!emptyPeriod ? 'selected' : ''}>Septiembre 2026</option><option ${emptyPeriod ? 'selected' : ''}>Agosto 2026</option></select></label>${emptyPeriod ? notice('No hay compras en agosto', 'Probá septiembre para ver el reporte de ejemplo.') : `<p class="muted">2 registros incluidos · Obra Ribera · septiembre de 2026</p><div class="table-scroll"><table><caption class="sr-only">Compras de septiembre de la Obra Ribera</caption><thead><tr><th>Fecha</th><th>Proveedor</th><th>Total (ARS)</th></tr></thead><tbody><tr><td>07/09/2026</td><td>Materiales del Litoral</td><td>125.000,00</td></tr><tr><td>09/09/2026</td><td>Hormigones del Norte</td><td>310.000,00</td></tr><tr><th colspan="2">Total del alcance mostrado</th><th>435.000,00</th></tr></tbody></table></div><div class="actions">${button('Descargar CSV de ejemplo', 'download-report', true)}${button('Preparar enlace de ejemplo', 'share')}</div>`}<details><summary>Ajustar reporte</summary><p>La implementación puede abrir el taller existente: columnas, filtros, agrupación, reglas y formato. Esta maqueta prueba el acceso directo al resumen.</p></details>${state.shared && !emptyPeriod ? `<div class="notice" style="margin-top:20px"><strong>Revisá antes de compartir</strong><p>Se incluirían los 2 registros mostrados, para quien tenga el enlace.</p><label class="field"><span>Vencimiento del enlace</span><select name="expiry"><option>7 días</option><option>1 día</option></select></label>${button('Confirmar enlace simulado', 'confirm-share', true)}${state.linkReady ? '<p style="margin-top:12px">Enlace simulado preparado. Este laboratorio no publica ningún reporte.</p>' : ''}</div>` : ''}`;
}

function renderConfigure(state) {
  const heading = title('Extraer datos de facturas', 'Configuración guiada del modelo de obras');
  if (state.step === 0) return `${heading}${steps(['Ejemplo', 'Datos', 'Resultado'], 0)}<div class="row"><div><strong>Factura A de ejemplo</strong><p>Un documento representativo de compras</p></div>${button('Analizar ejemplo', 'analyze', true)}</div><p class="muted" style="margin-top:18px">La app ya permite analizar un ejemplo. Aquí se propone empezar siempre por ese paso.</p>`;
  if (state.step === 1) return `${heading}${steps(['Ejemplo', 'Datos', 'Resultado'], 1)}<form data-form="configure"><fieldset class="check-list"><legend>¿Qué información querés guardar?</legend>${['Proveedor', 'Fecha', 'Total', 'Número de comprobante'].map(field => `<label><input type="checkbox" name="field" value="${field}" ${state.fields.includes(field) ? 'checked' : ''}>${field}</label>`).join('')}</fieldset><p id="field-error" role="alert"></p><details><summary>Opciones avanzadas</summary><p>Conservar el editor actual para múltiples filas, cabecera / detalle, tipos y tablas. Se muestran solo cuando la extracción lo requiere.</p></details><div class="actions"><button type="submit" class="primary">Probar resultado</button></div></form>`;
  if (state.step === 3) return `${heading}${notice('Configuración de ejemplo confirmada', 'Se simuló la preparación de Compras para las próximas obras. El modelo real no fue modificado.', 'success')}<p>Campos elegidos: ${state.fields.join(', ')}.</p>`;
  const values = { Proveedor: 'Materiales del Litoral', Fecha: '07/09/2026', Total: '$ 125.000,00', 'Número de comprobante': '0001-00000042' };
  return `${heading}${steps(['Ejemplo', 'Datos', 'Resultado'], 2)}<h3>Así quedaría el registro</h3>${state.fields.map(field => `<div class="row"><span>${field}</span><strong>${values[field]}</strong></div>`).join('')}<div class="notice" style="margin-top:18px"><strong>Alcance propuesto</strong><p>Carpeta Compras de las próximas obras. Aplicar a obras existentes necesita una revisión de impacto separada.</p></div><div class="actions">${button('Confirmar configuración de ejemplo', 'apply-config', true)}${button('Cambiar datos elegidos', 'fields')}</div>`;
}

function renderInbox(state) {
  const heading = title('Mi trabajo', 'Tareas con su obra y documento de origen');
  if (state.step === 0) return `${heading}${!state.resolved.includes('document') ? `<div class="row"><div><span class="status warning">Documento en revisión</span><p><strong>Revisar OC-0042</strong> · Obra Ribera</p><p>Se generó una orden de compra. Falta la decisión de un revisor.</p></div>${button('Revisar orden', 'review-task', true)}</div>` : ''}${!state.resolved.includes('policy') ? `<div class="row"><div><span class="status warning">Seguimiento de póliza</span><p><strong>Confirmar baja solicitada</strong> · Obra Ribera</p><p>La baja está solicitada; falta la confirmación del productor.</p></div>${button('Ver póliza', 'policy-task')}</div>` : ''}${state.resolved.length === 2 ? notice('No quedan tareas pendientes en este ejemplo', 'Las dos acciones conservan su resultado en sus registros de origen.', 'success') : ''}<p class="muted" style="margin-top:18px">Se reúnen accesos a tareas existentes; cada una conserva su estado y permisos.</p>`;
  if (state.step === 2) return `${heading}${notice(state.selectedTask === 'policy' ? 'Confirmación registrada en el ejemplo' : 'Revisión resuelta en el ejemplo', state.selectedTask === 'policy' ? 'La baja queda confirmada. El saldo observado se mantiene como dato independiente.' : 'La orden de compra queda aprobada por el revisor del ejemplo.', 'success')}<div class="actions">${button('Volver a mis tareas', 'back-inbox', true)}</div>`;
  const policy = state.selectedTask === 'policy';
  return `${heading}<h3>${policy ? 'Póliza 1234 · Obra Ribera' : 'OC-0042 · Obra Ribera'}</h3>${notice(policy ? 'Baja solicitada' : 'Documento en revisión', policy ? 'Verificá la respuesta del productor antes de confirmar. Confirmar la baja no cancela el saldo.' : 'La decisión se guarda en el documento, no en el estado leído de una notificación.')}<div class="actions">${button(state.read ? 'Aviso leído' : 'Marcar aviso como leído', 'mark-read')}${button(policy ? 'Registrar confirmación de ejemplo' : 'Aprobar documento de ejemplo', 'resolve-task', true)}</div><p class="muted" style="margin-top:18px">${state.read ? 'El aviso fue leído. La tarea sigue pendiente.' : 'Leer el aviso no cambia el estado de la tarea.'}</p>`;
}

function updateAndRender(message = 'Recorrido actualizado.') {
  render();
  announce(message);
}

$('#experiments').addEventListener('click', event => {
  const trigger = event.target.closest('[data-flow]');
  if (!trigger) return;
  activeId = trigger.dataset.flow;
  fixture = 'normal';
  persist();
  updateAndRender();
  $(`[data-flow="${activeId}"]`).focus();
});
$('#experiments').addEventListener('change', event => {
  const id = event.target.dataset.toggle;
  if (!id) return;
  enabled[id] = event.target.checked;
  persist();
  updateAndRender('Preferencia del experimento guardada.');
  $(`[data-toggle="${id}"]`).focus();
});
function setMode(value) { enabled[activeId] = value; persist(); updateAndRender(value ? 'Propuesta activada.' : 'Recorrido existente.'); }
$('#current-mode').addEventListener('click', () => setMode(false));
$('#proposal-mode').addEventListener('click', () => setMode(true));
$('#fixture').addEventListener('change', event => { fixture = event.target.value; updateAndRender(); });
$('#restart').addEventListener('click', () => {
  if (flowState[activeId].dirty && !confirm('¿Descartar los cambios de ejemplo de este recorrido?')) return;
  if (activeId === 'capture') clearTimeout(extractionTimer);
  flowState[activeId] = initialState();
  fixture = 'normal';
  updateAndRender('Recorrido reiniciado.');
});
$('#reset-all').addEventListener('click', () => {
  if (Object.values(flowState).some(s => s.dirty) && !confirm('¿Descartar los cambios de ejemplo del laboratorio?')) return;
  clearTimeout(extractionTimer);
  for (const { id } of scenarios) { enabled[id] = true; flowState[id] = initialState(); }
  activeId = 'capture';
  fixture = 'normal';
  persist();
  updateAndRender('Laboratorio restablecido.');
});

$('#preview').addEventListener('input', event => {
  const state = flowState[activeId];
  if (event.target.name === 'amount' || event.target.name === 'subject') {
    state[event.target.name] = event.target.value;
    state.dirty = true;
    if ($('#dirty-label')) $('#dirty-label').textContent = 'Hay cambios sin guardar.';
  }
});
$('#preview').addEventListener('change', event => {
  const state = flowState[activeId];
  if (event.target.name === 'scope') { state.scope = event.target.value; state.step = 0; state.source = false; updateAndRender('Alcance cambiado.'); $('[name="scope"]').focus(); }
  if (event.target.name === 'period') { state.period = event.target.value; state.shared = false; state.linkReady = false; updateAndRender('Período actualizado.'); $('[name="period"]').focus(); }
  if (event.target.name === 'expiry') { state.expiry = event.target.value; state.linkReady = false; }
  if (event.target.name === 'field') {
    state.fields = Array.from($('#preview').querySelectorAll('[name="field"]:checked')).map(el => el.value);
    state.dirty = true;
  }
});

$('#preview').addEventListener('submit', event => {
  const form = event.target;
  if (!form.dataset.form) return;
  event.preventDefault();
  const state = flowState[activeId];
  if (form.dataset.form === 'capture') { state.step = 3; state.dirty = false; }
  if (form.dataset.form === 'generate') { state.step = 2; }
  if (form.dataset.form === 'configure') {
    if (!state.fields.length) { $('#field-error').textContent = 'Elegí al menos un dato para probar el resultado.'; return; }
    state.step = 2;
  }
  updateAndRender('Paso completado en el ejemplo.');
  focusPreview();
});

function focusPreview() {
  const next = $('#preview').querySelector('input:not([readonly]), button, select, summary');
  if (next) next.focus({ preventScroll: true });
}

$('#preview').addEventListener('click', event => {
  const trigger = event.target.closest('[data-action]');
  if (!trigger) return;
  const action = trigger.dataset.action;
  const state = flowState[activeId];
  switch (action) {
    case 'enable': setMode(true); return;
    case 'normal': fixture = 'normal'; break;
    case 'upload':
      state.step = 1;
      clearTimeout(extractionTimer);
      extractionTimer = setTimeout(() => {
        state.step = 2;
        if (activeId === 'capture' && enabled.capture && fixture === 'normal') { updateAndRender('Extracción de ejemplo lista para revisar.'); focusPreview(); }
      }, 650);
      break;
    case 'review': state.step = 2; break;
    case 'source': state.source = !state.source; break;
    case 'choose-template': state.step = 1; break;
    case 'save-draft': state.draftSaved = true; state.dirty = false; break;
    case 'edit': case 'edit-generated': state.step = 1; state.draftSaved = false; break;
    case 'generate': state.step = 3; state.dirty = false; break;
    case 'open-review': activeId = 'inbox'; flowState.inbox.step = 1; flowState.inbox.selectedTask = 'document'; enabled.inbox = true; persist(); break;
    case 'ask': state.step = 1; state.source = false; break;
    case 'share': state.shared = !state.shared; state.linkReady = false; break;
    case 'confirm-share': state.linkReady = true; break;
    case 'download-report': {
      const csv = '\uFEFFFecha,Proveedor,Total ARS\r\n07/09/2026,Materiales del Litoral,125000\r\n09/09/2026,Hormigones del Norte,310000\r\n';
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = 'compras-ejemplo.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      announce('CSV de ejemplo descargado.'); return;
    }
    case 'analyze': state.step = 1; break;
    case 'fields': state.step = 1; break;
    case 'apply-config': state.step = 3; state.dirty = false; break;
    case 'review-task': state.step = 1; state.selectedTask = 'document'; state.read = false; break;
    case 'policy-task': state.step = 1; state.selectedTask = 'policy'; state.read = false; break;
    case 'mark-read': state.read = true; break;
    case 'resolve-task': state.step = 2; if (!state.resolved.includes(state.selectedTask)) state.resolved.push(state.selectedTask); break;
    case 'back-inbox': state.step = 0; break;
    default: return;
  }
  updateAndRender();
  const retained = $('#preview').querySelector(`[data-action="${action}"]`);
  if (retained) retained.focus({ preventScroll: true }); else focusPreview();
});

persist();
render();
