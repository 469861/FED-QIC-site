// Part A West reconsideration request – stepped form controller.
// UI is composed only from MMS Design System web components; this script wires
// navigation, conditional fields, validation, review, and the prototype submit.

const STATES = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AS', 'American Samoa'], ['AZ', 'Arizona'], ['AR', 'Arkansas'],
  ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'],
  ['FL', 'Florida'], ['GA', 'Georgia'], ['GU', 'Guam'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'],
  ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'],
  ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'],
  ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'], ['NH', 'New Hampshire'],
  ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'],
  ['MP', 'Northern Mariana Islands'], ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'],
  ['PR', 'Puerto Rico'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'], ['SD', 'South Dakota'], ['TN', 'Tennessee'],
  ['TX', 'Texas'], ['VI', 'U.S. Virgin Islands'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'],
  ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
];

const root = document.getElementById('stepped-form');
const form = root.querySelector('.sf-form');
const stepper = root.querySelector('mms-stepper');
const steps = [...root.querySelectorAll('.sf-step')];
const heading = document.getElementById('sf-step-heading');
const stepCount = document.getElementById('sf-step-count');
const errorSummary = document.getElementById('sf-error-summary');
const backBtn = document.getElementById('sf-back');
const nextBtn = document.getElementById('sf-next');
const cancelBtn = document.getElementById('sf-cancel');
const cancelModal = document.getElementById('sf-cancel-modal');
const reviewEl = document.getElementById('sf-review');
const confirmation = document.getElementById('sf-confirmation');
const uploadInput = document.getElementById('sf-upload-input');
const uploadBrowse = document.getElementById('sf-upload-browse');
const uploadDropzone = document.getElementById('sf-upload-dropzone');
const uploadCount = document.getElementById('sf-upload-count');
const uploadList = document.getElementById('sf-upload-list');
const uploadStatus = document.getElementById('sf-upload-status');

let current = 0;
let furthest = 0;
let uploadedFiles = [];
const uploadLimit = 10;
const uploadMaxBytes = 25 * 1024 * 1024;
const uploadTypes = ['jpg', 'jpeg', 'png', 'tiff', 'tif', 'pdf', 'xlsx', 'xls'];

/* ---------- Field helpers ---------- */

const fieldEls = () => [...form.querySelectorAll('[data-field]')];
const fieldEl = (name) => form.querySelector(`[data-field="${name}"]`);

function getValue(name) {
  const el = fieldEl(name);
  if (!el) return '';
  if (el.tagName === 'MMS-CHECKBOX') return el.checked;
  return (el.value || '').trim();
}

function isShown(el) {
  return !el.closest('[hidden]');
}

function setError(el, message) {
  el.error = Boolean(message);
  el.errorText = message || '';
}

function focusField(el) {
  if (el.tagName === 'MMS-RADIO-GROUP') {
    const radio = el.querySelector('mms-radio[selected]') || el.querySelector('mms-radio');
    (radio?.shadowRoot?.querySelector('input') || radio)?.focus();
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return;
  }
  const inner = el.shadowRoot?.querySelector('input, select, textarea');
  (inner || el).focus();
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function labelOf(el) {
  return el.getAttribute('label') || el.dataset.field;
}

// Lowercase the first letter for use mid-sentence, but keep acronyms ("ZIP") and proper nouns ("Medicare").
function midSentence(label) {
  return /^([A-Z]{2}|Medicare\b)/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1);
}

/* ---------- Dates ---------- */

function parseDate(str) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(str);
  if (!m) return null;
  const [, mm, dd, yyyy] = m.map(Number);
  const d = new Date(yyyy, mm - 1, dd);
  return d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd ? d : null;
}

function today() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

const pad = (n) => String(n).padStart(2, '0');
const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function fromIso(iso) {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${m}/${d}/${y}` : '';
}

/*
 * The DS has no date picker. Each DS text field marked data-date-picker is paired
 * with a visually hidden native <input type="date">; clicking the text field (or
 * Alt+ArrowDown) opens the browser's calendar, and picked dates are written back
 * to the DS field as MM/DD/YYYY. Typed dates are mirrored to the native input so
 * the calendar opens on the right month.
 */
function initDatePickers() {
  form.querySelectorAll('[data-date-picker]').forEach((field) => {
    const native = document.getElementById(field.dataset.datePicker);
    native.min = toIso(today());

    const open = () => {
      const d = parseDate(getValue(field.dataset.field));
      native.value = d ? toIso(d) : '';
      try {
        native.showPicker();
      } catch {
        // Browsers without showPicker() fall back to typing MM/DD/YYYY.
      }
    };

    field.addEventListener('click', open);
    field.addEventListener('keydown', (e) => {
      if (e.altKey && e.key === 'ArrowDown') {
        e.preventDefault();
        open();
      }
    });

    native.addEventListener('change', (e) => {
      e.stopPropagation();
      if (!native.value) return;
      field.value = fromIso(native.value);
      if (field.error) setError(field, validateField(field));
      const input = field.shadowRoot?.querySelector('input');
      input?.focus();
    });
  });
}

/* ---------- Conditional fields ---------- */

function updateConditionals() {
  form.querySelectorAll('[data-show-when]').forEach((el) => {
    const [key, values] = el.dataset.showWhen.split('=');
    const show = values.split(',').includes(getValue(key));
    el.hidden = !show;
    if (!show) {
      [el, ...el.querySelectorAll('[data-field]')]
        .filter((f) => f.dataset.field)
        .forEach((f) => setError(f, ''));
    }
  });
}

/* ---------- Validation ---------- */

function validateField(el) {
  if (!isShown(el)) return '';
  const name = el.dataset.field;
  const value = getValue(name);
  const label = labelOf(el);

  if (el.hasAttribute('required') && !value) {
    if (el.tagName === 'MMS-RADIO-GROUP') return `Select an answer for "${label}"`;
    if (el.tagName === 'MMS-SELECT') return `Select ${midSentence(label)}`;
    if (el.tagName === 'MMS-CHECKBOX') return 'You must certify this statement to submit your request';
    return `Enter ${midSentence(label)}`;
  }
  if (!value) return '';

  switch (name) {
    case 'phone':
    case 'callerPhone':
    case 'providerPhone':
      return value.replace(/\D/g, '').length === 10 ? '' : 'Enter a 10-digit phone number';
    case 'zip':
    case 'providerZip':
      return /^\d{5}(-\d{4})?$/.test(value) ? '' : 'Enter a 5-digit ZIP code, or ZIP+4';
    case 'dueDate': {
      const d = parseDate(value);
      if (!d) return 'Enter a real date in the format MM/DD/YYYY';
      if (d < today()) return 'Due date must be today or later';
      return '';
    }
    default:
      return '';
  }
}

function validateStep(index) {
  const errors = [];
  steps[index].querySelectorAll('[data-field]').forEach((el) => {
    const message = validateField(el);
    setError(el, message);
    if (message) errors.push({ el, message });
  });
  return errors;
}

function showErrorSummary(errors) {
  if (!errors.length) {
    errorSummary.hidden = true;
    return;
  }
  errorSummary.summary = errors.length === 1 ? 'There is 1 problem on this page.' : `There are ${errors.length} problems on this page.`;
  errorSummary.message = errors.map((e) => e.message).join('. ') + '.';
  errorSummary.hidden = false;
}

/* ---------- Document uploads ---------- */

function renderUploads(status = '') {
  uploadCount.textContent = `${uploadedFiles.length} of ${uploadLimit} documents selected`;
  uploadList.replaceChildren();

  uploadedFiles.forEach((file, index) => {
    const item = document.createElement('li');
    item.className = 'sf-uploader__item';

    const name = document.createElement('span');
    name.className = 'sf-uploader__filename';
    name.textContent = file.name;

    const remove = document.createElement('mms-button');
    remove.variant = 'secondary';
    remove.size = 'sm';
    remove.label = 'Remove';
    remove.setAttribute('aria-label', `Remove ${file.name}`);
    remove.addEventListener('click', () => {
      uploadedFiles.splice(index, 1);
      renderUploads(`${file.name} removed.`);
    });

    item.append(name, remove);
    uploadList.append(item);
  });

  uploadStatus.textContent = status || (uploadedFiles.length ? 'Documents are ready for review.' : 'No documents selected.');
}

function addUploads(files) {
  const all = [...files];
  const incoming = all.filter((f) => uploadTypes.includes(f.name.split('.').pop().toLowerCase()) && f.size <= uploadMaxBytes);
  const rejected = all.length - incoming.length;
  const remaining = uploadLimit - uploadedFiles.length;
  const accepted = incoming.slice(0, remaining);
  uploadedFiles.push(...accepted);

  let status = '';
  if (incoming.length > accepted.length) {
    status = remaining
      ? `Added ${accepted.length} document${accepted.length === 1 ? '' : 's'}. The limit is 10; ${incoming.length - accepted.length} not added.`
      : 'The 10-document limit has been reached. Remove a document before adding another.';
  } else if (accepted.length) {
    status = `Added ${accepted.length} document${accepted.length === 1 ? '' : 's'}.`;
  }
  if (rejected) status = `${status} ${rejected} file${rejected === 1 ? ' was' : 's were'} not added: unsupported type or larger than 25mb.`.trim();
  renderUploads(status);
}

function initUploader() {
  uploadBrowse.addEventListener('click', () => uploadInput.click());
  uploadInput.addEventListener('change', () => {
    addUploads(uploadInput.files);
    uploadInput.value = '';
  });

  uploadDropzone.addEventListener('dragover', (event) => {
    event.preventDefault();
    uploadDropzone.classList.add('is-dragover');
  });
  uploadDropzone.addEventListener('dragleave', (event) => {
    if (!uploadDropzone.contains(event.relatedTarget)) uploadDropzone.classList.remove('is-dragover');
  });
  uploadDropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    uploadDropzone.classList.remove('is-dragover');
    addUploads(event.dataTransfer.files);
  });

  renderUploads();
}

/* ---------- Review ---------- */

function reviewSections() {
  return [
    {
      step: 0, title: 'Beneficiary',
      rows: [
        ['Medicare number', getValue('mbi')],
        ['QIO redetermination number', getValue('qioRedeterminationNumber')],
        ['Name', `${getValue('firstName')} ${getValue('lastName')}`],
        ['Address', {
          address: {
            addressLine1: getValue('address1'), addressLine2: getValue('address2'),
            city: getValue('city'), state: getValue('state'), zipCode: getValue('zip'),
          },
        }],
        ['Phone number', getValue('phone')],
      ],
    },
    {
      step: 1, title: 'Representative',
      rows: [
        ['Name', `${getValue('callerFirstName')} ${getValue('callerLastName')}`],
        ['Phone number', getValue('callerPhone')],
      ],
    },
    {
      step: 2, title: 'Provider',
      rows: [
        ['Organization', getValue('providerOrg')],
        ['Address', {
          address: {
            addressLine1: getValue('providerAddress1'), addressLine2: getValue('providerAddress2'),
            city: getValue('providerCity'), state: getValue('providerState'), zipCode: getValue('providerZip'),
          },
        }],
        ['Contact name', [getValue('providerContactFirstName'), getValue('providerContactLastName')].filter(Boolean).join(' ')],
        ['Contact phone number', getValue('providerPhone')],
      ],
    },
    {
      step: 3, title: 'Additional information',
      rows: [
        ['Submitting additional information', { yes: 'Yes', no: 'No' }[getValue('submittingInfo')]],
        getValue('submittingInfo') === 'yes' && ['Due date', getValue('dueDate')],
      ],
    },
    {
      step: 4, title: 'Upload documents',
      rows: [['Selected documents', uploadedFiles.map((file) => file.name).join('\n')]],
    },
  ];
}

function renderReview() {
  reviewEl.replaceChildren();
  reviewSections().forEach((section) => {
    const card = document.createElement('mms-card');
    card.titleText = section.title;
    card.showDescription = false;
    card.showActions = true;
    card.className = 'sf-review__card';

    const dl = document.createElement('dl');
    dl.className = 'sf-review__list';
    dl.slot = 'body-content';
    section.rows.filter(Boolean).forEach(([label, value]) => {
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      if (value && value.address) {
        const a = value.address;
        // mms-address renders nothing unless line 1, city, state, and ZIP are all present.
        if (a.addressLine1 && a.city && a.state && a.zipCode) {
          const addr = document.createElement('mms-address');
          addr.multiline = true;
          Object.assign(addr, a);
          dd.append(addr);
        } else {
          const cityLine = [a.city, [a.state, a.zipCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
          dd.textContent = [a.addressLine1, a.addressLine2, cityLine].filter(Boolean).join('\n') || 'Not provided';
        }
      } else {
        dd.textContent = value || 'Not provided';
      }
      dl.append(dt, dd);
    });

    const edit = document.createElement('mms-button');
    edit.slot = 'actions';
    edit.variant = 'secondary';
    edit.size = 'sm';
    edit.label = 'Edit';
    edit.leftIcon = 'pencil-simple';
    edit.setAttribute('aria-label', `Edit ${section.title.toLowerCase()}`);
    edit.addEventListener('click', () => goTo(section.step));

    card.append(dl, edit);
    reviewEl.append(card);
  });
}

/* ---------- Navigation ---------- */

function updateStepper() {
  stepper.items = steps.map((s, i) => ({
    label: s.dataset.title,
    state: i === current ? 'current' : i <= furthest ? 'completed' : 'not-started',
  }));
}

function goTo(index, { focus = true } = {}) {
  if (index < 0 || index >= steps.length) return;
  current = index;
  furthest = Math.max(furthest, index);
  steps.forEach((s, i) => { s.hidden = i !== index; });
  errorSummary.hidden = true;

  const isFirst = index === 0;
  const isLast = index === steps.length - 1;
  backBtn.hidden = isFirst;
  nextBtn.label = isLast ? 'Submit request' : 'Continue';
  nextBtn.rightIcon = isLast ? 'paper-plane-right' : 'arrow-right';

  heading.textContent = steps[index].dataset.title;
  stepCount.textContent = `Step ${index + 1} of ${steps.length}`;
  document.title = `${steps[index].dataset.title} – Part A West Reconsideration Request | Maximus QIC`;

  if (steps[index].dataset.step === 'review') renderReview();
  updateConditionals();
  updateStepper();

  if (focus) {
    heading.focus();
    root.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
}

function handleNext() {
  const errors = validateStep(current);
  if (errors.length) {
    showErrorSummary(errors);
    focusField(errors[0].el);
    return;
  }
  if (current === steps.length - 1) {
    submit();
    return;
  }
  goTo(current + 1);
}

function firstInvalidStep() {
  for (let i = 0; i < steps.length - 1; i++) {
    if (validateStep(i).length) return i;
  }
  return -1;
}

function submit() {
  // Re-check every step in case an earlier answer was edited into an invalid state.
  const bad = firstInvalidStep();
  if (bad !== -1) {
    goTo(bad);
    showErrorSummary(validateStep(bad));
    return;
  }
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const number = `PAW-${stamp}-${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`;
  document.getElementById('sf-confirmation-number').textContent = number;
  const submittedEl = document.getElementById('sf-confirmation-submitted');
  submittedEl.dateTime = d.toISOString();
  submittedEl.textContent = d.toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });

  furthest = steps.length;
  current = steps.length;
  updateStepper();
  form.hidden = true;
  confirmation.hidden = false;
  document.title = 'Request submitted – Part A West Reconsideration Request | Maximus QIC';
  const confirmHeading = document.getElementById('sf-confirmation-heading');
  confirmHeading.focus();
  root.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

/* ---------- Init ---------- */

async function init() {
  await Promise.all(['mms-stepper', 'mms-select', 'mms-inline-alert', 'mms-button', 'mms-modal']
    .map((tag) => customElements.whenDefined(tag)));

  root.querySelectorAll('mms-inline-alert').forEach((a) => { a.dismissible = false; });
  const stateOptions = STATES.map(([value, label]) => ({ value, label }));
  fieldEl('state').options = stateOptions;
  fieldEl('providerState').options = stateOptions;
  initDatePickers();
  initUploader();

  form.addEventListener('submit', (e) => e.preventDefault());

  // Re-evaluate conditionals and clear a field's error once it's corrected.
  ['input', 'change'].forEach((type) => {
    form.addEventListener(type, (e) => {
      const el = e.target.closest?.('[data-field]');
      updateConditionals();
      if (el && el.error && !validateField(el)) setError(el, '');
    });
  });

  nextBtn.addEventListener('click', handleNext);
  backBtn.addEventListener('click', () => goTo(current - 1));

  stepper.addEventListener('step-click', (e) => {
    const { index } = e.detail;
    if (!form.hidden && index <= furthest && index !== current) goTo(index);
  });

  cancelBtn.addEventListener('click', () => { cancelModal.open = true; });
  cancelModal.addEventListener('primary-click', () => { window.location.href = 'part-a-west.html'; });
  cancelModal.addEventListener('close', () => { cancelModal.open = false; });

  document.getElementById('sf-print').addEventListener('click', () => window.print());

  goTo(0, { focus: false });
}

init();
